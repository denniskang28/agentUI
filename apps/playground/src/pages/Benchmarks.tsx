import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../../packages/i18n/src/index";
import {
  instantiate,
  type ComponentEntry,
} from "../../../../packages/catalog/src/index";
import {
  patchMessage,
  type RunConfig,
} from "../../../../packages/protocol/src/index";
import { usePreview, type ActionRecord } from "../usePreview";
import { api, download } from "../api";
import { Icon } from "../icons";
import {
  benchmarkFixture,
  countBenchmarkErrors,
  loadKind,
  percentile,
  updateFixture,
} from "../benchmark";
import type {
  MeasurementResult,
  RuntimeStatistics,
} from "../../../../packages/protocol/src/measurement";
interface Sample {
  tick: number;
  sentMs: number;
  roundTripMs: number;
  coreMs: number | null;
  error?: string;
  measurement?: MeasurementResult;
}
interface Result {
  mode: "native" | "sandbox";
  runId: string;
  stats: RuntimeStatistics | null;
  actions: ActionRecord[];
  initial?: MeasurementResult;
  status: "complete" | "stopped" | "error";
  configuration: {
    componentKey: string;
    frequency: number;
    duration: number;
    size: number | null;
    load: string;
    instances: number;
    locale: string;
    theme: string;
  };
  browser: string;
  bundleBytes: number | null;
  startedAt: string;
  coldReadyMs: number | null;
  firstRenderMs: number | null;
  updateP50: number | null;
  updateP95: number | null;
  requestedUpdates: number;
  sentUpdates: number;
  failedUpdates: number;
  skippedUpdates: number;
  completedUpdates: number;
  supersededUpdates: number;
  actualFrequency: number;
  raw: Sample[];
  errors: string[];
}
export function Benchmarks({
  entries,
  config,
  onBeforeRun,
}: {
  entries: ComponentEntry[];
  config: RunConfig;
  onBeforeRun: () => void;
}) {
  const { t, locale } = useTranslation();
  const [key, setKey] = useState(
    entries.find((e) => e.component === "DataTable")?.key ??
      entries[0]?.key ??
      "text",
  );
  const [frequency, setFrequency] = useState(10),
    [duration, setDuration] = useState(5),
    [size, setSize] = useState(100),
    [instances, setInstances] = useState(1);
  const [runMode, setRunMode] = useState("both"),
    [activeMode, setActiveMode] = useState<"native" | "sandbox">("native");
  const [busy, setBusy] = useState(false),
    [results, setResults] = useState<
      Partial<Record<"native" | "sandbox", Result>>
    >({}),
    [error, setError] = useState("");
  const preview = usePreview(
    entries,
    { ...config, runtimeMode: activeMode, actionHandler: "mock" },
    true,
  );
  const stopped = useRef(false),
    mounted = useRef(true),
    wake = useRef<(() => void) | undefined>(undefined);
  useEffect(
    () => () => {
      mounted.current = false;
      stopped.current = true;
      wake.current?.();
    },
    [],
  );
  const entry = entries.find((e) => e.key === key) ?? entries[0];
  const stop = () => {
    stopped.current = true;
    wake.current?.();
    preview.reset();
  };
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(
        () => {
          wake.current = undefined;
          resolve();
        },
        Math.max(0, ms),
      );
      wake.current = () => {
        clearTimeout(timer);
        wake.current = undefined;
        resolve();
      };
    });
  const run = async () => {
    if (!entry) return;
    stopped.current = false;
    setBusy(true);
    setResults({});
    setError("");
    onBeforeRun();
    let bundleBytes: number | null = null;
    if (entry.pluginId) {
      try {
        const { plugins } = await api<{
          plugins: { id: string; bytes?: number }[];
        }>("/plugins");
        bundleBytes =
          plugins.find((p) => p.id === entry.pluginId)?.bytes ?? null;
      } catch (e) {
        setError(String(e));
        setBusy(false);
        return;
      }
    }
    const fixture = benchmarkFixture(entry, size);
    const surfaceIds = Array.from(
      { length: instances },
      (_, index) => `bench-${index + 1}`,
    );
    const targets = surfaceIds.map((surfaceId) => ({
      surfaceId,
      componentId: "root",
    }));
    for (const mode of (runMode === "both"
      ? ["native", "sandbox"]
      : [runMode]) as ("native" | "sandbox")[]) {
      if (stopped.current) break;
      setActiveMode(mode);
      const result: Result = {
        mode,
        runId: "",
        stats: null,
        actions: [],
        status: "complete",
        configuration: {
          componentKey: entry.key,
          frequency,
          duration,
          size: loadKind(entry) === "fixture" ? null : size,
          load: loadKind(entry),
          instances,
          locale,
          theme: config.theme,
        },
        browser: navigator.userAgent,
        bundleBytes,
        startedAt: new Date().toISOString(),
        coldReadyMs: null,
        firstRenderMs: null,
        updateP50: null,
        updateP95: null,
        requestedUpdates: frequency * duration,
        sentUpdates: 0,
        failedUpdates: 0,
        skippedUpdates: 0,
        completedUpdates: 0,
        supersededUpdates: 0,
        actualFrequency: 0,
        raw: [],
        errors: [],
      };
      try {
        const start = performance.now();
        result.runId = preview.reset(undefined, {
          runtimeMode: mode,
          actionHandler: "mock",
        });
        const initial = await preview.apply(
          surfaceIds.flatMap(
            (id) => instantiate(entry, fixture, "full", id).messages,
          ),
          "benchmark.initial",
          {
            measure: {
              targets,
              waitFor: "paint",
              paintTargets: targets.slice(0, 1),
            },
            recordHistory: false,
          },
        );
        result.initial = initial.measurement;
        if (initial.errors.length || initial.measurement?.status !== "complete")
          throw new Error(
            `BENCHMARK_INITIAL_${initial.measurement?.status ?? "UNAVAILABLE"}: ${JSON.stringify(initial.errors)}`,
          );
        const startedAt = performance.timeOrigin + start;
        result.coldReadyMs =
          initial.measurement.startedAt -
          startedAt +
          Math.max(...initial.measurement.components.map((c) => c.readyMs!));
        result.firstRenderMs =
          initial.measurement.startedAt -
          startedAt +
          initial.measurement.components[0].paintMs!;
        const updateStart = performance.now();
        const pending = new Set<Promise<void>>();
        for (
          let tick = 1;
          tick <= result.requestedUpdates && !stopped.current;
          tick++
        ) {
          await wait(
            updateStart + (tick * 1000) / frequency - performance.now(),
          );
          if (stopped.current) break;
          if (
            performance.now() > updateStart + ((tick + 1) * 1000) / frequency ||
            pending.size >= 8
          ) {
            result.skippedUpdates++;
            continue;
          }
          const data = updateFixture(entry, fixture, tick);
          const sentMs = performance.now() - updateStart;
          result.sentUpdates++;
          const task = preview
            .apply(
              surfaceIds.map((id) => patchMessage(id, data, "/view")),
              "benchmark.update",
              { measure: { targets, waitFor: "commit" }, recordHistory: false },
            )
            .then((receipt) => {
              result.raw.push({
                tick,
                sentMs,
                roundTripMs: receipt.roundTripMs,
                coreMs: receipt.applyMs,
                measurement: receipt.measurement,
              });
              if (receipt.errors.length)
                result.errors.push(JSON.stringify(receipt.errors));
            })
            .catch((e) => {
              result.raw.push({
                tick,
                sentMs,
                roundTripMs: performance.now() - updateStart - sentMs,
                coreMs: null,
                error: String(e),
              });
              if (!stopped.current) result.errors.push(String(e));
            })
            .finally(() => pending.delete(task));
          pending.add(task);
        }
        const schedulingMs = performance.now() - updateStart;
        await Promise.all(pending);
        result.actualFrequency = result.sentUpdates / (schedulingMs / 1000);
        result.failedUpdates = result.raw.filter(
          (sample) =>
            sample.error ||
            sample.measurement?.status === "timeout" ||
            sample.measurement?.status === "error",
        ).length;
        result.raw.sort((a, b) => a.tick - b.tick);
        const samples = result.raw
          .filter((sample) => sample.measurement?.status === "complete")
          .map((sample) =>
            Math.max(
              ...sample.measurement!.components.map(
                (component) => component.commitMs!,
              ),
            ),
          );
        result.completedUpdates = samples.length;
        result.supersededUpdates = result.raw.filter(
          (sample) => sample.measurement?.status === "superseded",
        ).length;
        for (const sample of result.raw)
          if (
            sample.measurement?.status === "timeout" ||
            sample.measurement?.status === "error"
          )
            result.errors.push(
              `UPDATE_${sample.tick}_${sample.measurement.status}`,
            );
        result.updateP50 = percentile(samples, 0.5);
        result.updateP95 = percentile(samples, 0.95);
        if (!stopped.current) {
          await wait(0);
          const collected = await preview.apply([], "benchmark.statistics", {
            recordHistory: false,
            collectStats: true,
          });
          result.stats = collected.stats ?? null;
        }
        result.actions = structuredClone(preview.actionRecords.current);
      } catch (e) {
        if (!stopped.current) {
          result.status = "error";
          result.errors.push(String(e));
        }
      }
      result.errors = [
        ...new Set([...result.errors, ...preview.errorRecords.current]),
      ];
      if (stopped.current) result.status = "stopped";
      else if (result.errors.length) result.status = "error";
      if (mounted.current) setResults((prev) => ({ ...prev, [mode]: result }));
    }
    if (mounted.current) setBusy(false);
  };
  const displayResults = Object.fromEntries(
    Object.entries(results).map(([mode, result]) => {
      const current = result!.runId === preview.runId;
      const errors = [
        ...new Set([...result!.errors, ...(current ? preview.errors : [])]),
      ];
      return [
        mode,
        {
          ...result!,
          actions: current ? preview.actions : result!.actions,
          status:
            result!.status === "complete" && errors.length
              ? "error"
              : result!.status,
          errors,
          errorCounts: countBenchmarkErrors(errors),
        },
      ];
    }),
  ) as Partial<
    Record<
      "native" | "sandbox",
      Result & { errorCounts: ReturnType<typeof countBenchmarkErrors> }
    >
  >;
  const format = (value: number | null, unit = "") =>
    value === null
      ? t("不可用")
      : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}${unit}`;
  return (
    <main className="secondary-page benchmark-page">
      <div className="page-inner">
        <div className="page-heading">
          <div>
            <h1>Benchmarks</h1>
            <p>{t("在两种运行模式下测量真实预览性能。")}</p>
          </div>
          <span className="tag tag-outline">
            performance.now() · Preview Host
          </span>
        </div>
        <section className="panel">
          <h2>{t("测试配置")}</h2>
          <div className="bench-controls">
            <label>
              {t("测试组件")}
              <select
                className="input"
                aria-label={t("测试组件")}
                value={key}
                disabled={busy}
                onChange={(e) => setKey(e.target.value)}
              >
                {entries.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("测试模式")}
              <select
                className="input"
                aria-label={t("测试模式")}
                value={runMode}
                disabled={busy}
                onChange={(e) => setRunMode(e.target.value)}
              >
                <option value="both">{t("顺序对比")}</option>
                <option value="native">Native</option>
                <option value="sandbox">Sandbox</option>
              </select>
            </label>
            <label>
              {t("数据规模")}
              <select
                className="input"
                aria-label={t("数据规模")}
                value={size}
                disabled={busy || loadKind(entry) === "fixture"}
                onChange={(e) => setSize(Number(e.target.value))}
              >
                {[100, 1000, 10000].map((n) => (
                  <option key={n} value={n}>
                    {format(n)}{" "}
                    {t(loadKind(entry) === "cells" ? "单元格" : "记录")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("实例数")}
              <select
                className="input"
                aria-label={t("实例数")}
                value={instances}
                disabled={busy}
                onChange={(e) => setInstances(Number(e.target.value))}
              >
                {[1, 3, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              {t("更新频率 (Hz)")}
              <select
                className="input"
                aria-label={t("更新频率 (Hz)")}
                value={frequency}
                disabled={busy}
                onChange={(e) => setFrequency(Number(e.target.value))}
              >
                {[1, 10, 30, 60].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              {t("持续时间 (s)")}
              <input
                className="input"
                type="number"
                min={1}
                max={60}
                aria-label={t("持续时间 (s)")}
                value={duration}
                disabled={busy}
                onChange={(e) =>
                  setDuration(
                    Math.max(1, Math.min(60, Number(e.target.value) || 1)),
                  )
                }
              />
            </label>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button
                className="btn btn-primary"
                disabled={busy || !preview.connected}
                onClick={() => void run()}
              >
                <Icon name="play" />
                {t("开始测试")}
              </button>
              {busy && (
                <button className="btn btn-secondary" onClick={stop}>
                  {t("停止")}
                </button>
              )}
            </div>
          </div>
          <p className="muted">
            {runMode === "both"
              ? `${t("依次运行两种模式")} · Native → Sandbox`
              : runMode}
            {busy && ` · ${activeMode}`}
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
        </section>
        <section className="panel">
          <h2>
            {t("实时预览")} · {activeMode === "native" ? "Native" : "Sandbox"}
          </h2>
          <div className="benchmark-preview">
            <iframe
              ref={preview.iframe}
              src="http://127.0.0.1:4173"
              title="Benchmark Preview Host"
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              style={{
                border: 0,
                width: "100%",
                height: Math.max(120, preview.height),
                display: "block",
              }}
            />
          </div>
          {preview.errors.map((value, index) => (
            <div className="error" key={index}>
              {value}
            </div>
          ))}
        </section>
        <div className="page-heading">
          <h2 style={{ fontSize: 16, margin: 0 }}>{t("测试结果")}</h2>
          <button
            className="btn btn-secondary"
            style={{ marginLeft: "auto" }}
            disabled={!Object.keys(results).length}
            onClick={() =>
              download("benchmark.json", {
                schemaVersion: "benchmark/1.0",
                results: displayResults,
              })
            }
          >
            <Icon name="ext" />
            {t("导出 JSON")}
          </button>
        </div>
        <div className="benchmark-results">
          {(["native", "sandbox"] as const).map((mode) => (
            <section className="panel" key={mode}>
              <h2>{mode === "native" ? "Native" : "Sandbox"}</h2>
              {displayResults[mode] ? (
                <>
                  <p className="muted">
                    {t(
                      displayResults[mode]!.status === "complete"
                        ? "测试完成"
                        : displayResults[mode]!.status === "stopped"
                          ? "已停止"
                          : "测试失败",
                    )}
                  </p>
                  <div className="metric-grid">
                    {(
                      [
                        [
                          t("冷启动就绪"),
                          displayResults[mode]!.coldReadyMs,
                          " ms",
                        ],
                        [
                          t("首次内容显示"),
                          displayResults[mode]!.firstRenderMs,
                          " ms",
                        ],
                        [
                          t("更新提交中位数"),
                          displayResults[mode]!.updateP50,
                          " ms",
                        ],
                        [
                          t("更新提交长尾"),
                          displayResults[mode]!.updateP95,
                          " ms",
                        ],
                        [
                          t("样本数"),
                          displayResults[mode]!.completedUpdates,
                          "",
                        ],
                        [
                          t("被覆盖的更新"),
                          displayResults[mode]!.supersededUpdates,
                          "",
                        ],
                        [
                          t("跳过的更新"),
                          displayResults[mode]!.skippedUpdates,
                          "",
                        ],
                        [
                          t("实际发送频率"),
                          displayResults[mode]!.actualFrequency,
                          " Hz",
                        ],
                        [
                          t("长任务数量"),
                          displayResults[mode]!.stats?.longTasks?.count ?? null,
                          "",
                        ],
                        [
                          t("长任务总时长"),
                          displayResults[mode]!.stats?.longTasks?.durationMs ??
                            null,
                          " ms",
                        ],
                        [
                          t("内存"),
                          displayResults[mode]!.stats?.memory
                            ? displayResults[mode]!.stats!.memory!
                                .usedJSHeapBytes / 1048576
                            : null,
                          " MB",
                        ],
                        [
                          t("构建错误数"),
                          displayResults[mode]!.errorCounts.build,
                          "",
                        ],
                        [
                          t("加载错误数"),
                          displayResults[mode]!.errorCounts.load,
                          "",
                        ],
                        [
                          t("渲染错误数"),
                          displayResults[mode]!.errorCounts.render,
                          "",
                        ],
                        [
                          t("桥接错误数"),
                          displayResults[mode]!.errorCounts.bridge,
                          "",
                        ],
                        [
                          t("测量错误数"),
                          displayResults[mode]!.errorCounts.measurement +
                            displayResults[mode]!.errorCounts.other,
                          "",
                        ],
                        [
                          t("操作往返"),
                          [...displayResults[mode]!.actions]
                            .reverse()
                            .find((a) => a.timing?.status === "complete")
                            ?.timing?.totalMs ?? null,
                          " ms",
                        ],
                      ] as [string, number | null, string][]
                    ).map(([label, value, unit]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <b>{format(value, unit)}</b>
                      </div>
                    ))}
                  </div>
                  {displayResults[mode]!.errors.map((value, index) => (
                    <div key={index} className="error" role="alert">
                      {value}
                    </div>
                  ))}
                </>
              ) : (
                <p className="muted">{t("暂无测试结果")}</p>
              )}
            </section>
          ))}
        </div>
        <section className="panel">
          <h2>{t("操作分段耗时")}</h2>
          <p className="muted">
            {t(
              "在实时预览中点击交互组件；Mock 响应提交后记录分段耗时。没有真实点击时显示不可用。",
            )}
          </p>
          {preview.actions
            .filter((action) => action.timing)
            .map((action) => (
              <div className="metric-grid" key={action.actionId}>
                <strong>{action.action.name}</strong>
                <span>
                  {t(
                    action.timing!.status === "pending"
                      ? "处理中"
                      : action.timing!.status === "complete"
                        ? "测试完成"
                        : "测试失败",
                  )}
                </span>
                {(
                  [
                    [t("点击到 Host"), action.timing!.inputToHostMs],
                    [t("Host 到工作台"), action.timing!.hostToMainMs],
                    [t("Mock 等待与响应"), action.timing!.mockMs],
                    [t("响应到 UI 提交"), action.timing!.responseCommitMs],
                    [t("操作往返"), action.timing!.totalMs],
                  ] as [string, number | undefined][]
                ).map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <b>{format(value ?? null, " ms")}</b>
                  </div>
                ))}
              </div>
            ))}
        </section>
        <section className="panel">
          <h2>{t("测量范围")}</h2>
          <p className="muted">
            {t(
              "首次显示检查第一个实例的 React 提交及两次动画帧后的显示机会，不能代表屏幕像素已经呈现；冷启动为新实例，浏览器缓存保持自然状态。更新延迟从 Preview Host 收到数据到全部实例实际提交，不含绘制；原始数据另保留往返耗时。被覆盖、跳过及失败的更新不计入 P50/P95。",
            )}
          </p>
          <p className="muted">
            {t(
              "大数据使用可视窗口；不适用负载规模的组件使用原始模板。运行测试会清理工作台原有预览，避免背景实例干扰。长任务仅采集 Preview Host 可观察的条目，内存为浏览器尽力提供的堆快照，均不能精确归因到单个 Sandbox；不支持时显示不可用。",
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
