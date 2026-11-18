import { McpAppsPanel } from "../../../packages/mcp-apps-host/src/react";
import {
  parseLibrarySource,
  scenarioInputs,
} from "../../../packages/agent-ui/src/playground-input";
import type { UiBatch } from "../../../packages/agent-ui/src/protocol";
import { AppearanceEditor, ThemeEditor } from "./AppearanceEditor";
import { libraryExport, type LibrarySnapshot } from "./libraryExport";
import type { ComponentAppearance } from "../../../packages/protocol/src/appearance";
import {
  previewOrigin,
  apiBase,
} from "../../../packages/protocol/src/browser-deployment";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  builtins,
  instantiate,
  recoverTemplateValues,
  templateMeta,
  type ComponentEntry,
  type Field,
} from "../../../packages/catalog/src/index";
import {
  defaultRun,
  parseMessages,
  MessageParseError,
  runConfigSchema,
  type Message,
  type RunConfig,
} from "../../../packages/protocol/src/index";
import {
  setLocale,
  useTranslation,
  type TranslationKey,
} from "../../../packages/i18n/src/index";
import { Icon } from "./icons";
import { api, download } from "./api";
import { usePreview } from "./usePreview";
import { Plugins } from "./pages/Plugins";
import { Documentation } from "./pages/Documentation";
import { Benchmarks } from "./pages/Benchmarks";
import "./tokens.css";
import "./shared.css";
import "./app.css";
const appearanceNodeKey = (surfaceId: string, componentId: string) =>
  JSON.stringify([surfaceId, componentId]);
type Page = "playground" | "plugins" | "docs" | "benchmarks" | "mcp";
type Draft = {
  values: Record<string, unknown>;
  template: string;
  json: string | null;
  customJson?: string;
  libraryJson?: string | null;
  customLibraryJson?: string;
  libraryJsonByTemplate?: Record<string, string | null>;
  appearance?: Record<string, ComponentAppearance>;
  appearanceNode?: string;
  jsonByTemplate?: Record<string, string | null>;
};
function Segment({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
function App() {
  const { locale, t, l } = useTranslation();
  const [page, setPage] = useState<Page>("playground");
  const [entries, setEntries] = useState<ComponentEntry[]>(builtins);
  const [catalogError, setCatalogError] = useState(false);
  const [selected, setSelected] = useState("text");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [focus, setFocus] = useState(false);
  const [narrowTab, setNarrowTab] = useState("preview");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [config, setConfig] = useState<RunConfig>({ ...defaultRun, locale });
  const [configDraft, setConfigDraft] = useState<string | null>(null);
  const [editMode, setEditMode] = useState("form");
  const [jsonTab, setJsonTab] = useState("messages");
  const [custom, setCustom] = useState(false);
  const [inputFormat, setInputFormat] = useState<"a2ui" | "library">("a2ui");
  const [sessionJson, setSessionJson] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<TranslationKey | "">("");
  const [renderedSignature, setRenderedSignature] = useState("");
  const [host, setHost] = useState("card");
  const [device, setDevice] = useState("desktop");
  const [debug, setDebug] = useState(false);
  const [debugTab, setDebugTab] = useState("messages");
  const [surfaceId, setSurfaceId] = useState("all");
  const [configurationTab, setConfigurationTab] = useState("content");
  const [themeOpen, setThemeOpen] = useState(false);
  const [renderedExport, setRenderedExport] = useState<LibrarySnapshot | null>(
    null,
  );
  const [copy, setCopy] = useState(false);
  const [copyTab, setCopyTab] = useState("api");
  const [copySource, setCopySource] = useState("draft");
  const [pendingMode, setPendingMode] = useState<"native" | "sandbox" | null>(
    null,
  );
  const [interval, setIntervalMs] = useState(1200);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState("尚未渲染");
  const [playing, setPlaying] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(228);
  const [middleWidth, setMiddleWidth] = useState(440);
  const preview = usePreview(entries, { ...config, locale });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceEditor = useRef<HTMLTextAreaElement>(null);
  const queue = useRef<Message[][]>([]);
  const queuePolicies = useRef<(RunConfig["componentPolicies"] | undefined)[]>(
    [],
  );
  const requestGeneration = useRef(0);
  const index = useRef(0);
  const active = useRef(false);
  const latest = useRef({ interval, config, locale });
  latest.current = { interval, config, locale };
  const session = new URLSearchParams(location.search).get("session");
  const sessionRun = useRef("");
  const sessionConnected = useRef(false);
  const current = entries.find((e) => e.key === selected) ?? entries[0];
  const draft = drafts[current.key] ?? {
    values: structuredClone(current.defaults),
    template: "full",
    json: null,
  };
  const generated = useMemo(
    () => instantiate(current, draft.values, draft.template),
    [current, draft.values, draft.template],
  );
  const format = session ? "a2ui" : inputFormat;
  const templateJson =
    format === "library" ? (draft.libraryJson ?? null) : draft.json;
  const generatedLibrary = JSON.stringify(
    scenarioInputs(current, generated.messages, generated.renderPolicy),
    null,
    2,
  );
  const templateSource =
    templateJson ??
    (format === "library"
      ? generatedLibrary
      : JSON.stringify(generated.messages, null, 2));
  const customSource =
    format === "library" ? draft.customLibraryJson : draft.customJson;
  const source = custom
    ? session
      ? sessionJson
      : (customSource ?? templateSource)
    : templateSource;
  const signature = JSON.stringify([selected, draft.template, format, source]);
  const dirty = !!renderedSignature && signature !== renderedSignature;
  const changeDraft = (patch: Partial<Draft>) => {
    requestGeneration.current++;
    setDrafts((prev) => ({
      ...prev,
      [current.key]: {
        ...(prev[current.key] ?? {
          values: structuredClone(current.defaults),
          template: "full",
          json: null,
        }),
        ...patch,
      },
    }));
  };
  const changeCustomJson = (value: string) => {
    requestGeneration.current++;
    if (session) setSessionJson(value);
    else
      changeDraft(
        format === "library"
          ? { customLibraryJson: value }
          : { customJson: value },
      );
  };
  const changeTemplateJson = (value: string | null) => {
    requestGeneration.current++;
    changeDraft(
      format === "library" ? { libraryJson: value } : { json: value },
    );
  };
  const parseSource = (value: string) =>
    format === "library" ? parseLibrarySource(value) : parseMessages(value);
  const compileSource = async (
    value: string,
  ): Promise<{
    batches?: UiBatch[];
    steps: {
      messages: Message[];
      componentPolicies?: RunConfig["componentPolicies"];
    }[];
  }> => {
    if (format === "library") return api("/library/compile", { text: value });
    const messages = parseMessages(value);
    const result = await api<{ valid: boolean; errors: unknown[] }>(
      "/messages/validate",
      { messages },
    );
    if (!result.valid) throw new Error(JSON.stringify(result.errors, null, 2));
    return { steps: messages.map((message) => ({ messages: [message] })) };
  };
  const stop = useCallback(() => {
    active.current = false;
    setPlaying(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const reload = useCallback(async () => {
    const result = await api<{ components: ComponentEntry[] }>("/components");
    setEntries((previous) =>
      JSON.stringify(previous) === JSON.stringify(result.components)
        ? previous
        : result.components,
    );
    setCatalogError(false);
  }, []);
  useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let pending = false;
    let delay = 1000;
    const refresh = async () => {
      if (pending || disposed) return;
      clearTimeout(retry);
      pending = true;
      try {
        await reload();
        delay = 1000;
      } catch {
        if (!disposed) {
          setCatalogError(true);
          retry = setTimeout(() => void refresh(), delay);
          delay = Math.min(delay * 2, 30000);
        }
      } finally {
        pending = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      clearTimeout(retry);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [page, reload]);
  useEffect(() => {
    setConfig((prev) => ({ ...prev, locale }));
  }, [locale]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
  }, [theme, locale]);
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(""), 2500);
      return () => clearTimeout(timeout);
    }
  }, [toast]);
  useEffect(() => {
    if (!error) return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById("source-diagnostic")
        ?.scrollIntoView({ block: "nearest" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [error]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const next = useCallback(async () => {
    if (index.current >= queue.current.length) {
      stop();
      setPhase("已完成");
      return;
    }
    const messages = queue.current[index.current];
    try {
      const result = await preview.apply(messages, "message", {
        componentPolicies: queuePolicies.current[index.current],
      });
      index.current++;
      setStep(index.current);
      if (result.errors?.length) {
        stop();
        setPhase("运行失败");
      } else if (index.current >= queue.current.length) {
        stop();
        setPhase("已完成");
      }
    } catch (e) {
      stop();
      setError(String(e));
      setPhase("运行失败");
    }
  }, [preview.apply, stop]);
  const schedule = useRef<() => void>(() => {});
  schedule.current = () => {
    if (!active.current) return;
    timer.current = setTimeout(() => {
      void next().then(() => {
        if (active.current) schedule.current();
      });
    }, latest.current.interval);
  };
  const play = () => {
    if (active.current) {
      stop();
      setPhase("已暂停");
    } else {
      active.current = true;
      setPlaying(true);
      setPhase("运行中");
      schedule.current();
    }
  };
  const render = async () => {
    stop();
    setError("");
    const generation = ++requestGeneration.current;
    try {
      const compiled = await compileSource(source);
      if (generation !== requestGeneration.current) return;
      const messages = compiled.steps.flatMap((step) => step.messages);
      const renderPolicy = config.renderPolicy;
      setConfig((prev) => ({ ...prev, renderPolicy }));
      preview.reset(undefined, { renderPolicy });
      queue.current = compiled.steps.map((step) => step.messages);
      queuePolicies.current = compiled.steps.map(
        (step) => step.componentPolicies,
      );
      index.current = 0;
      setStep(0);
      setRenderedSignature(signature);
      setRenderedExport(
        structuredClone({
          messages,
          config: { ...config, locale },
          entry: current,
          template: format === "a2ui" && !custom && draft.json === null,
          batches: compiled.batches,
          intervalMs: interval,
        }),
      );
      setPhase("运行中");
      await next();
      if (queue.current.length > 1 && index.current < queue.current.length) {
        active.current = true;
        setPlaying(true);
        schedule.current();
      }
    } catch (e) {
      if (generation !== requestGeneration.current) return;
      setError(String(e));
      setPhase("运行失败");
    }
  };
  const reset = () => {
    requestGeneration.current++;
    stop();
    queue.current = [];
    if (session)
      void api(`/preview-sessions/${session}/reset`, { locale }).catch(
        (error) => setError(String(error)),
      );
    else preview.reset();
    index.current = 0;
    setStep(0);
    setPhase("尚未渲染");
    setRenderedSignature("");
    setError("");
  };
  const select = (key: string) => {
    if (session) {
      setToast("外部会话由 Agent 提供组件与消息。");
      return;
    }
    requestGeneration.current++;
    stop();
    setSelected(key);
    const entry = entries.find((e) => e.key === key);
    if (entry)
      setConfig((prev) => ({
        ...prev,
        componentAppearances: Object.entries(
          drafts[key]?.appearance ?? {},
        ).reduce<NonNullable<RunConfig["componentAppearances"]>>(
          (result, [key, value]) => {
            const [surface, node] = JSON.parse(key) as [string, string];
            (result[surface] ??= {})[node] = value;
            return result;
          },
          {},
        ),
        renderPolicy: instantiate(
          entry,
          drafts[key]?.values ?? entry.defaults,
          drafts[key]?.template ?? "full",
        ).renderPolicy,
      }));
    setCustom(false);
    setError("");
    setRenderedSignature("");
    preview.reset();
    queue.current = [];
    index.current = 0;
    setStep(0);
    setPhase("尚未渲染");
    setNarrowTab("config");
  };
  const restore = () => {
    changeDraft({
      values: structuredClone(current.defaults),
      template: "full",
      json: null,
      jsonByTemplate: {},
      libraryJson: null,
      libraryJsonByTemplate: {},
    });
    setError("");
  };
  const drag = (which: "left" | "middle", event: React.MouseEvent) => {
    const start = event.clientX;
    const initial = which === "left" ? leftWidth : middleWidth;
    const move = (e: MouseEvent) => {
      const value = Math.min(
        which === "left" ? 360 : 720,
        Math.max(which === "left" ? 180 : 320, initial + e.clientX - start),
      );
      if (which === "left") setLeftWidth(value);
      else setMiddleWidth(value);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
  useEffect(() => {
    if (!session || !preview.connected || sessionConnected.current) return;
    sessionConnected.current = true;
    let cancelled = false;
    let eventSource: EventSource | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let chain = Promise.resolve();
    void api(`/preview-sessions/${session}/connect`, {})
      .then(async (connection) => {
        if (cancelled) return;
        sessionRun.current = connection.runId;
        preview.onError.current = (message) => {
          if (cancelled || !sessionRun.current) return;
          const runId = sessionRun.current;
          const code =
            /^[A-Z][A-Z0-9_]{0,99}(?=:|$)/.exec(message)?.[0] ??
            "PREVIEW_ERROR";
          void api(`/preview-sessions/${session}/error`, {
            runId,
            error: { code, message: message.slice(0, 65536) },
          }).catch((error) => {
            if (!cancelled && sessionRun.current === runId)
              setError(String(error));
          });
        };
        setConfig(connection.config);
        setCustom(true);
        setSessionJson(JSON.stringify(connection.messages, null, 2));
        setLocale(connection.config.locale);
        if (connection.config.container) setHost(connection.config.container);
        preview.reset(connection.runId, connection.config);
        if (connection.messages.length) {
          const result = await preview.apply(connection.messages);
          await api(`/preview-sessions/${session}/ack`, {
            runId: connection.runId,
            sequence: connection.lastReceivedSequence,
            errors: result.errors,
          });
        }
        setPhase("就绪");
        eventSource = new EventSource(
          `${apiBase}/preview-sessions/${session}/events?after=${connection.eventCursor}`,
        );
        eventSource.addEventListener("messages.queued", (event) => {
          const e = JSON.parse((event as MessageEvent).data);
          if (e.runId !== sessionRun.current) return;
          chain = chain
            .then(async () => {
              if (cancelled || e.runId !== sessionRun.current) return;
              const result = await preview.apply(e.payload.messages);
              if (cancelled || e.runId !== sessionRun.current) return;
              setSessionJson((previous) =>
                JSON.stringify(
                  [...parseMessagesSafe(previous), ...e.payload.messages],
                  null,
                  2,
                ),
              );
              await api(`/preview-sessions/${session}/ack`, {
                runId: e.runId,
                sequence: e.payload.lastSequence,
                errors: result.errors,
              });
              setPhase(result.errors?.length ? "运行失败" : "就绪");
            })
            .catch((error) => {
              if (!cancelled && e.runId === sessionRun.current)
                setError(String(error));
            });
        });
        eventSource.addEventListener("run.reset", (event) => {
          const e = JSON.parse((event as MessageEvent).data);
          sessionRun.current = e.runId;
          preview.reset(e.runId, e.payload.config);
          setConfig(e.payload.config);
          setLocale(e.payload.config.locale);
          setSessionJson("[]");
        });
        eventSource.addEventListener("session.destroyed", (event) => {
          const e = JSON.parse((event as MessageEvent).data);
          sessionRun.current = "";
          if (heartbeat) clearInterval(heartbeat);
          preview.onAction.current = null;
          preview.onError.current = null;
          preview.reset();
          setPhase(
            e.payload.reason === "expired" ? "会话已过期" : "会话已结束",
          );
          eventSource?.close();
        });
        heartbeat = setInterval(
          () =>
            void api(`/preview-sessions/${session}/heartbeat`, {}).catch((e) =>
              setError(String(e)),
            ),
          5000,
        );
        preview.onAction.current = (record) => {
          void api(`/preview-sessions/${session}/action`, {
            runId: record.runId,
            action: record.action,
          }).catch((e) => {
            if (!cancelled && record.runId === sessionRun.current)
              setError(String(e));
          });
        };
      })
      .catch((e) => {
        setError(String(e));
        sessionConnected.current = false;
      });
    return () => {
      cancelled = true;
      eventSource?.close();
      if (heartbeat) clearInterval(heartbeat);
      preview.onAction.current = null;
      preview.onError.current = null;
    };
  }, [
    session,
    preview.connected,
    preview.apply,
    preview.reset,
    preview.onAction,
    preview.onError,
  ]);
  const modeSwitch = async () => {
    if (!pendingMode) return;
    const mode = pendingMode;
    setPendingMode(null);
    stop();
    setConfig((prev) => ({ ...prev, runtimeMode: mode }));
    const messages = preview.messages;
    if (session) {
      const result = await api(`/preview-sessions/${session}/reset`, {
        runtimeMode: mode,
        locale,
        replay: true,
      });
      sessionRun.current = result.runId;
      return;
    }
    preview.reset(undefined, {
      runtimeMode: mode,
      componentPolicies: preview.appliedConfig.componentPolicies,
    });
    if (messages.length) await preview.apply(messages);
    setToast("就绪");
  };
  const [compileError, setCompileError] = useState<{
    source: string;
    message: string;
  } | null>(null);
  const [compiledDraft, setCompiledDraft] = useState<{
    source: string;
    messages: Message[];
  } | null>(null);
  useEffect(() => {
    if (format !== "library" || (!copy && configurationTab !== "appearance"))
      return;
    let disposed = false;
    void api<{ steps: { messages: Message[] }[] }>("/library/compile", {
      text: source,
    })
      .then((result) => {
        if (!disposed)
          setCompiledDraft({
            source,
            messages: result.steps.flatMap((step) => step.messages),
          });
      })
      .catch((error) => {
        if (!disposed) {
          setCompiledDraft(null);
          setCompileError({ source, message: String(error) });
        }
      });
    return () => {
      disposed = true;
    };
  }, [source, format, copy, configurationTab]);
  const copyMessages =
    copySource === "preview"
      ? preview.messages
      : format === "library"
        ? compiledDraft?.source === source
          ? compiledDraft.messages
          : []
        : parseMessagesSafe(source);
  const draftBatches = (() => {
    try {
      return format === "library" ? parseLibrarySource(source) : undefined;
    } catch {
      return undefined;
    }
  })();
  const copyConfig =
    copySource === "preview" ? preview.appliedConfig : { ...config, locale };
  const previewMatchesInputs =
    !!renderedExport &&
    preview.messages.length <= renderedExport.messages.length &&
    JSON.stringify(preview.messages) ===
      JSON.stringify(renderedExport.messages.slice(0, preview.messages.length));
  const library = libraryExport({
    ...(copySource === "preview" && renderedExport
      ? renderedExport
      : {
          entry: current,
          template: format === "a2ui" && !custom && draft.json === null,
          batches: draftBatches,
          intervalMs: interval,
        }),
    messages: copyMessages,
    config: copyConfig,
    ...(copySource === "preview" && renderedExport?.batches
      ? previewMatchesInputs
        ? { batches: renderedExport.batches.slice(0, step) }
        : { batches: undefined, template: false }
      : {}),
  });
  const generatedCopyValue =
    copyTab === "library"
      ? library.input
      : copyTab === "server"
        ? library.server
        : copyTab === "react"
          ? library.react
          : copyTab === "json"
            ? JSON.stringify(copyMessages, null, 2)
            : copyTab === "config"
              ? JSON.stringify(copyConfig, null, 2)
              : `# POST /api/v1/preview-sessions → open previewUrl → wait for preview.connected\ncurl -X POST ${location.origin}${apiBase}/preview-sessions/$SESSION_ID/messages \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify({ batchId: "batch-001", firstSequence: 1, messages: copyMessages }, null, 2).replace(/'/g, "'\\''")}'`;
  const exportReady =
    copySource === "preview" ||
    format !== "library" ||
    compiledDraft?.source === source;
  const copyValue = exportReady
    ? generatedCopyValue
    : compileError?.source === source
      ? compileError.message
      : t("正在校验便捷输入…");
  const groups = ["基础展示", "布局", "数据展示", "表单与交互", "已安装插件"];
  const shownSurfaces =
    surfaceId === "all"
      ? preview.surfaces
      : preview.surfaces.filter((s) => s.id === surfaceId);
  const inspectorValue =
    debugTab === "messages"
      ? preview.messages
      : debugTab === "tree"
        ? shownSurfaces.map((s) => ({
            surfaceId: s.id,
            components: s.components,
          }))
        : debugTab === "data"
          ? shownSurfaces.map((s) => ({ surfaceId: s.id, data: s.data }))
          : debugTab === "actions"
            ? preview.actions
            : debugTab === "metrics"
              ? preview.metrics
              : preview.errors;
  const sourceDiagnostic = useMemo(() => {
    if (!error) return null;
    try {
      parseSource(source);
    } catch (diagnostic) {
      if (diagnostic instanceof MessageParseError) return diagnostic;
    }
    return null;
  }, [error, source, format]);
  const diagnosticKeys: Record<MessageParseError["code"], TranslationKey> = {
    JSON_SYNTAX: "JSON语法错误",
    JSONL_SYNTAX: "JSONL语法错误",
    MESSAGE_TOO_LARGE: "消息超过大小限制",
    MESSAGE_COUNT: "消息数量超出范围",
    MESSAGE_OBJECT: "消息必须是对象",
  };
  const playback = (
    <div className="playback">
      <button
        className="btn btn-secondary"
        onClick={play}
        disabled={!queue.current.length || step >= queue.current.length}
      >
        <Icon name={playing ? "pause" : "play"} />
        {t(playing ? "暂停" : "继续")}
      </button>
      <button
        className="btn btn-secondary"
        onClick={() => {
          stop();
          void next();
        }}
        disabled={!queue.current.length || step >= queue.current.length}
      >
        <Icon name="next" />
        {t("下一步")}
      </button>
      <button className="btn btn-secondary" onClick={reset}>
        <Icon name="reset" />
        {t("重置")}
      </button>
      <label>
        {t("间隔")}
        <input
          className="input"
          type="number"
          min={50}
          max={30000}
          value={interval}
          aria-label={t("间隔")}
          onChange={(e) => setIntervalMs(Math.max(50, Number(e.target.value)))}
        />
        ms
      </label>
    </div>
  );
  return (
    <div className="application" data-theme={theme}>
      <header className="app-header">
        <div className="brand">
          <span>
            <Icon name="route" size={16} />
          </span>
          <b>Agent UI Playground</b>
        </div>
        <nav aria-label={t("主导航")}>
          {(
            ["playground", "plugins", "docs", "benchmarks", "mcp"] as Page[]
          ).map((p, i) => (
            <button
              aria-current={page === p ? "page" : undefined}
              key={p}
              onClick={() => setPage(p)}
            >
              {
                [
                  "Playground",
                  "Plugins",
                  "API & Docs",
                  "Benchmarks",
                  "MCP Apps",
                ][i]
              }
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <span className="tag tag-outline environment">
            {t("本地")} · A2UI 1.0
          </span>
          <button
            className="btn btn-secondary locale-switch"
            aria-label={t("选择语言")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
          >
            {locale === "zh-CN" ? "English" : "中文"}
          </button>
          <button
            className="btn btn-icon"
            aria-label={t("切换界面明暗主题")}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Icon name={theme === "light" ? "moon" : "sun"} />
          </button>
        </div>
      </header>
      <div
        className="page-content"
        style={{ display: page === "playground" ? "flex" : "none" }}
      >
        <div className="narrow-tabs" role="tablist">
          {[
            ["library", "组件库"],
            ["config", "模板配置"],
            ["preview", "预览面板"],
          ].map(([key, text]) => (
            <button
              role="tab"
              aria-selected={narrowTab === key}
              onClick={() => setNarrowTab(key)}
              key={key}
            >
              {l(text)}
            </button>
          ))}
        </div>
        <div
          className={`workspace ${focus ? "focused" : ""}`}
          data-panel={narrowTab}
          style={
            {
              "--left-width": `${leftWidth}px`,
              "--middle-width": `${middleWidth}px`,
            } as React.CSSProperties
          }
        >
          <aside
            className={`library ${collapsed ? "collapsed" : ""}`}
            aria-label={t("组件库")}
          >
            <div className="library-title">
              <strong>{!collapsed && t("组件库")}</strong>
              {!collapsed && <span>{entries.length}</span>}
              <button
                className="btn btn-ghost"
                aria-label={t(collapsed ? "展开组件库" : "收起组件库")}
                onClick={() => setCollapsed(!collapsed)}
              >
                <Icon name="panelLeft" />
              </button>
            </div>
            {!collapsed && (
              <div className="search">
                <Icon name="search" />
                <input
                  className="input"
                  aria-label={t("搜索组件")}
                  placeholder={t("搜索组件")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
            <div className="library-list">
              {catalogError && !collapsed && (
                <p className="muted" role="status">
                  {t("组件列表加载失败，正在重试。")}
                </p>
              )}
              {groups.map((group) => {
                const items = entries.filter(
                  (e) =>
                    e.category === group &&
                    `${e.name} ${e.component} ${l(e.category)}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                );
                return (
                  items.length > 0 && (
                    <div key={group}>
                      {!collapsed && (
                        <div className="group-label">
                          <span>{l(group)}</span>
                          <span>{items.length}</span>
                        </div>
                      )}
                      {items.map((e) => (
                        <button
                          className="component-item"
                          key={e.key}
                          title={e.name}
                          aria-current={
                            selected === e.key && !custom ? "true" : undefined
                          }
                          onClick={() => select(e.key)}
                        >
                          <Icon name={e.icon} />
                          {!collapsed && (
                            <>
                              <span>{e.name}</span>
                              {e.pluginId && (
                                <span className="tag tag-outline">
                                  {t("插件")}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                );
              })}
              {!entries.some((e) =>
                e.name.toLowerCase().includes(search.toLowerCase()),
              ) && (
                <p className="muted" style={{ padding: 12 }}>
                  {t("没有匹配的组件")}
                </p>
              )}
            </div>
            <div className="library-bottom">
              <button
                className="btn btn-ghost"
                onClick={() => setPage("plugins")}
              >
                <Icon name="upload" />
                {!collapsed && t("上传插件")}
              </button>
            </div>
          </aside>
          <div
            className="resizer left-resizer"
            role="separator"
            aria-label={t("组件库")}
            onMouseDown={(event) => drag("left", event)}
          />
          <div className="work-area">
            <div className="columns">
              <section className="configuration" aria-label={t("模板配置")}>
                <div className="component-heading">
                  <div>
                    <Icon name={current.icon} size={24} />
                    <h1>{custom ? t("自定义响应") : current.name}</h1>
                    <span className="tag tag-neutral">v{current.version}</span>
                    {current.pluginId && (
                      <span className="tag tag-outline">{t("插件")}</span>
                    )}
                    <button
                      className="btn btn-ghost"
                      onClick={() => setPage("docs")}
                    >
                      <Icon name="book" />
                      {t("文档")}
                    </button>
                  </div>
                  <p>
                    {custom
                      ? t(
                          format === "library"
                            ? "自定义便捷输入，支持单条输入、数组、批次或 JSONL。"
                            : "粘贴 Agent 响应，支持单条消息、数组或 JSONL。",
                        )
                      : l(current.description)}
                  </p>
                  <code>
                    {custom
                      ? format === "library"
                        ? "Library · enterprise-agent-ui/1"
                        : "A2UI · 1.0"
                      : `${current.pluginId ?? "a2ui"} · ${current.component}`}
                  </code>
                </div>
                <div className="response-entry">
                  <Segment
                    label={t("组件模板")}
                    options={[
                      { value: "template", label: t("组件模板") },
                      { value: "custom", label: t("自定义响应") },
                    ]}
                    value={custom ? "custom" : "template"}
                    onChange={(value) => {
                      if (
                        value === "custom" &&
                        customSource === undefined &&
                        !session
                      )
                        changeCustomJson(templateSource);
                      requestGeneration.current++;
                      stop();
                      setCustom(value === "custom");
                    }}
                  />
                </div>
                {!session && (
                  <div className="response-entry input-format">
                    <span>{t("输入格式")}</span>
                    <Segment
                      label={t("输入格式")}
                      value={format}
                      options={[
                        { value: "a2ui", label: "A2UI" },
                        { value: "library", label: t("Library 便捷模板") },
                      ]}
                      onChange={(value) => {
                        if (value === format) return;
                        requestGeneration.current++;
                        stop();
                        setError("");
                        setInputFormat(value as "a2ui" | "library");
                      }}
                    />
                  </div>
                )}
                {!custom && (
                  <div className="template-section">
                    <div className="section-label">
                      <strong>{t("场景模板")}</strong>
                      <span>{current.templates.length}</span>
                    </div>
                    <div
                      className="template-options"
                      role="radiogroup"
                      aria-label={t("场景模板")}
                    >
                      {current.templates.map((key, i) => (
                        <button
                          key={key}
                          role="radio"
                          aria-checked={draft.template === key}
                          onClick={() => {
                            if (key === draft.template) return;
                            requestGeneration.current++;
                            stop();
                            changeDraft({
                              template: key,
                              libraryJson:
                                draft.libraryJsonByTemplate?.[key] ?? null,
                              libraryJsonByTemplate: {
                                ...draft.libraryJsonByTemplate,
                                [draft.template]: draft.libraryJson ?? null,
                              },
                              json: draft.jsonByTemplate?.[key] ?? null,
                              jsonByTemplate: {
                                ...draft.jsonByTemplate,
                                [draft.template]: draft.json,
                              },
                            });
                            setConfig((prev) => ({
                              ...prev,
                              renderPolicy: instantiate(
                                current,
                                draft.values,
                                key,
                              ).renderPolicy,
                            }));
                          }}
                        >
                          <b>
                            <small>{String(i + 1).padStart(2, "0")}</small>
                            {l(templateMeta[key]?.[0] ?? key)}
                          </b>
                          <span>{l(templateMeta[key]?.[1] ?? "")}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="response-entry">
                  <Segment
                    label={t("模板配置")}
                    value={configurationTab}
                    onChange={setConfigurationTab}
                    options={[
                      { value: "content", label: t("内容") },
                      { value: "appearance", label: t("外观") },
                    ]}
                  />
                </div>
                <div className="edit-toolbar">
                  {!custom && (
                    <Segment
                      label={t("表单")}
                      options={[
                        { value: "form", label: t("表单") },
                        { value: "json", label: "JSON" },
                      ]}
                      value={editMode}
                      onChange={(mode) => {
                        if (mode === "form" && templateJson !== null) {
                          let values: Record<string, unknown> | null = null;
                          try {
                            if (format === "a2ui")
                              values = recoverTemplateValues(
                                current,
                                parseMessages(templateJson),
                                draft.template,
                              );
                            else {
                              const inputs = parseLibrarySource(
                                templateJson,
                              ).flatMap((batch) => batch.inputs);
                              const create = inputs[0];
                              if (
                                create?.type === "template.create" &&
                                create.template === current.key &&
                                JSON.stringify(inputs) ===
                                  JSON.stringify(
                                    scenarioInputs(
                                      current,
                                      instantiate(
                                        current,
                                        { ...current.defaults, ...create.data },
                                        draft.template,
                                      ).messages,
                                      generated.renderPolicy,
                                    ),
                                  )
                              )
                                values = {
                                  ...current.defaults,
                                  ...create.data,
                                };
                            }
                          } catch {
                            /* Preserve an invalid source draft in JSON mode. */
                          }
                          if (!values) {
                            setToast(
                              "当前消息无法映射回表单，请继续编辑 JSON 或恢复模板。",
                            );
                            return;
                          }
                          // Viewing the form must retain the original JSON text.
                          // An actual form edit regenerates it through the field handlers.
                          changeDraft({ values });
                        }
                        setEditMode(mode);
                      }}
                    />
                  )}{" "}
                  {(custom || editMode === "json") && (
                    <Segment
                      label="JSON"
                      options={[
                        { value: "messages", label: t("消息") },
                        { value: "config", label: t("运行配置") },
                      ]}
                      value={jsonTab}
                      onChange={setJsonTab}
                    />
                  )}{" "}
                  {dirty && (
                    <span className="dirty">
                      <i />
                      {t("配置已修改，尚未渲染")}
                    </span>
                  )}
                </div>
                <div className="configuration-scroll">
                  {configurationTab === "appearance" ? (
                    (() => {
                      const nodes = (
                        format === "library"
                          ? compiledDraft?.source === source
                            ? compiledDraft.messages
                            : []
                          : parseMessagesSafe(source)
                      ).flatMap((message) => {
                        const body = (message.createSurface ??
                          message.updateComponents) as
                          | {
                              surfaceId?: string;
                              components?: {
                                id: string;
                                component: string;
                              }[];
                            }
                          | undefined;
                        return (body?.components ?? []).map((node) => ({
                          ...node,
                          surfaceId: body?.surfaceId ?? "main",
                        }));
                      });
                      const unique = [
                        ...new Map(
                          nodes.map((node) => [
                            appearanceNodeKey(node.surfaceId, node.id),
                            node,
                          ]),
                        ).values(),
                      ];
                      const node =
                        unique.find(
                          (node) =>
                            appearanceNodeKey(node.surfaceId, node.id) ===
                            draft.appearanceNode,
                        ) ?? unique[0];
                      return (
                        <>
                          {node && (
                            <>
                              <label className="field-section">
                                {t("配置节点")}
                                <select
                                  className="input"
                                  value={appearanceNodeKey(
                                    node.surfaceId,
                                    node.id,
                                  )}
                                  onChange={(event) =>
                                    changeDraft({
                                      appearanceNode: event.target.value,
                                    })
                                  }
                                >
                                  {unique.map((item) => (
                                    <option
                                      key={appearanceNodeKey(
                                        item.surfaceId,
                                        item.id,
                                      )}
                                      value={appearanceNodeKey(
                                        item.surfaceId,
                                        item.id,
                                      )}
                                    >
                                      {item.surfaceId} / {item.id} ·{" "}
                                      {item.component}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <AppearanceEditor
                                component={node.component}
                                capabilities={
                                  entries.find(
                                    (entry) =>
                                      entry.component === node.component,
                                  )?.appearance
                                }
                                plugin={
                                  !!entries.find(
                                    (entry) =>
                                      entry.component === node.component,
                                  )?.pluginId
                                }
                                value={
                                  config.componentAppearances?.[
                                    node.surfaceId
                                  ]?.[node.id] ?? {}
                                }
                                onChange={(value) => {
                                  const appearance = {
                                    ...draft.appearance,
                                    [appearanceNodeKey(
                                      node.surfaceId,
                                      node.id,
                                    )]: value,
                                  };
                                  changeDraft({ appearance });
                                  setConfig((previous) => ({
                                    ...previous,
                                    componentAppearances: {
                                      ...previous.componentAppearances,
                                      [node.surfaceId]: {
                                        ...previous.componentAppearances?.[
                                          node.surfaceId
                                        ],
                                        [node.id]: value,
                                      },
                                    },
                                  }));
                                }}
                              />
                            </>
                          )}
                        </>
                      );
                    })()
                  ) : !custom && editMode === "form" ? (
                    <>
                      {generated.messages.length > 1 && (
                        <div className="field-section">
                          <div className="section-label">
                            <strong>{t("消息步骤")}</strong>
                            <span>
                              {t("消息计数", {
                                count: generated.messages.length,
                              })}
                            </span>
                            <button
                              className="btn btn-ghost"
                              onClick={() => {
                                setEditMode("json");
                                setJsonTab("messages");
                              }}
                            >
                              {t("完整消息序列")}
                            </button>
                          </div>
                          <ol className="message-steps">
                            {generated.messages.map((message, i) => (
                              <li key={i} className={i < step ? "applied" : ""}>
                                <span>{i + 1}</span>
                                <div>
                                  <b>
                                    {format === "library"
                                      ? scenarioInputs(
                                          current,
                                          generated.messages,
                                          generated.renderPolicy,
                                        )[i]?.type
                                      : Object.keys(message).find(
                                          (k) => k !== "version",
                                        )}
                                  </b>
                                  <code>
                                    {i === 0
                                      ? t("创建界面并载入初始数据")
                                      : t("更新路径", {
                                          path:
                                            i === 2 &&
                                            draft.template === "on_complete"
                                              ? "/ready"
                                              : "/view",
                                        })}
                                  </code>
                                </div>
                                <small>
                                  {t(i < step ? "已应用" : "尚未发送")}
                                </small>
                              </li>
                            ))}
                          </ol>
                          {playback}
                        </div>
                      )}
                      <div className="field-section">
                        <div className="section-label">
                          <strong>{t("组件配置")}</strong>
                        </div>
                        <div className="form-grid">
                          {current.fields.map((field) => (
                            <FieldInput
                              key={field.key}
                              field={field}
                              value={draft.values[field.key]}
                              onChange={(value) =>
                                changeDraft({
                                  values: {
                                    ...draft.values,
                                    [field.key]: value,
                                  },
                                  ...(format === "library"
                                    ? { libraryJson: null }
                                    : { json: null }),
                                })
                              }
                            />
                          ))}
                        </div>
                      </div>
                      {Object.entries(draft.values)
                        .filter(
                          ([, value]) =>
                            current.component !== "CapabilityProfile" &&
                            Array.isArray(value),
                        )
                        .map(([key, value]) => (
                          <ArrayEditor
                            key={key}
                            name={key}
                            schema={current.schema}
                            rows={value as Record<string, unknown>[]}
                            onChange={(rows) =>
                              changeDraft({
                                values: { ...draft.values, [key]: rows },
                                ...(format === "library"
                                  ? { libraryJson: null }
                                  : { json: null }),
                              })
                            }
                          />
                        ))}
                      {current.component === "CapabilityProfile" && (
                        <p className="muted">
                          {t("维度、分数与场景目标可在 JSON 中配置。")}
                        </p>
                      )}
                      <div className="field-section">
                        <button
                          className="disclosure"
                          aria-expanded={runOpen}
                          onClick={() => setRunOpen(!runOpen)}
                        >
                          <Icon name={runOpen ? "down" : "right"} />
                          <b>{t("平台运行配置")}</b>
                        </button>
                        {runOpen && (
                          <div className="form-grid run-config">
                            <label>
                              {t("渲染策略")}
                              <select
                                className="input"
                                value={config.renderPolicy}
                                aria-label={t("渲染策略")}
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    renderPolicy: e.target
                                      .value as RunConfig["renderPolicy"],
                                  })
                                }
                              >
                                {["progressive", "on_complete", "live"].map(
                                  (v) => (
                                    <option key={v}>{v}</option>
                                  ),
                                )}
                              </select>
                            </label>
                            <label>
                              {t("就绪条件")}
                              <input
                                className="input"
                                value={config.readyWhen}
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    readyWhen: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              {t("处理方式")}
                              <select
                                className="input"
                                disabled={!!session}
                                value={config.actionHandler}
                                aria-label={t("处理方式")}
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    actionHandler: e.target.value as
                                      "mock" | "external",
                                  })
                                }
                              >
                                <option value="mock">{t("Mock Agent")}</option>
                                <option value="external">
                                  {t("外部 Agent")}
                                </option>
                              </select>
                            </label>
                            <label>
                              {t("响应延迟")}
                              <input
                                className="input"
                                type="number"
                                value={config.latency}
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    latency: Math.max(
                                      0,
                                      Number(e.target.value),
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              {t("处理结果")}
                              <select
                                className="input"
                                value={config.outcome}
                                aria-label={t("处理结果")}
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    outcome: e.target
                                      .value as RunConfig["outcome"],
                                  })
                                }
                              >
                                {[
                                  ["success", "成功"],
                                  ["reject", "拒绝"],
                                  ["error", "错误"],
                                ].map(([value, key]) => (
                                  <option key={value} value={value}>
                                    {l(key)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <p className="muted wide">
                              {t("仅平台配置，不属于 A2UI 消息。")}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : jsonTab === "config" ? (
                    <div className="json-section">
                      <p className="muted">
                        {t("仅平台配置，不属于 A2UI 消息。")}
                      </p>
                      <p className="muted">
                        {t(
                          "支持 componentPolicies 按 Surface ID / Component ID 设置独立策略。",
                        )}
                      </p>
                      <textarea
                        className="json-editor"
                        aria-label={t("平台运行配置")}
                        spellCheck={false}
                        value={
                          configDraft ??
                          JSON.stringify({ ...config, locale }, null, 2)
                        }
                        onChange={(e) => setConfigDraft(e.target.value)}
                      />
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          try {
                            const next = runConfigSchema.parse(
                              JSON.parse(
                                configDraft ??
                                  JSON.stringify({ ...config, locale }),
                              ),
                            );
                            setConfig(next);
                            setLocale(next.locale);
                            setConfigDraft(null);
                            setError("");
                          } catch (e) {
                            setError(String(e));
                          }
                        }}
                      >
                        {t("应用运行配置")}
                      </button>
                    </div>
                  ) : (
                    <div className="json-section">
                      {(queue.current.length > 1 ||
                        (format === "library" &&
                          (draftBatches?.length ?? 0) > 1)) && (
                        <> {playback} </>
                      )}
                      <div className="json-tools">
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                            try {
                              const value = JSON.stringify(
                                parseMessages(source),
                                null,
                                2,
                              );
                              if (custom) changeCustomJson(value);
                              else changeTemplateJson(value);
                              setError("");
                            } catch (e) {
                              setError(String(e));
                            }
                          }}
                        >
                          {t("格式化")}
                        </button>
                        <label className="btn btn-ghost">
                          <Icon name="upload" />
                          {t("导入 JSON / JSONL")}
                          <input
                            hidden
                            type="file"
                            accept=".json,.jsonl"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setCustom(true);
                                void file.text().then((text) => {
                                  changeCustomJson(text);
                                });
                              }
                            }}
                          />
                        </label>
                        <button
                          className="btn btn-ghost"
                          onClick={() =>
                            void compileSource(source)
                              .then(() => {
                                setError("");
                                setToast("校验通过");
                              })
                              .catch((e) => setError(String(e)))
                          }
                        >
                          {t("校验")}
                        </button>
                      </div>
                      <div className="json-editor">
                        <div className="line-numbers" aria-hidden>
                          {source.split("\n").map((_, i) => (
                            <div
                              key={i}
                              className={
                                sourceDiagnostic?.line === i + 1
                                  ? "source-error-line"
                                  : undefined
                              }
                            >
                              {i + 1}
                            </div>
                          ))}
                        </div>
                        <textarea
                          ref={sourceEditor}
                          aria-label={
                            format === "library" ? "Library JSON" : "A2UI JSON"
                          }
                          aria-invalid={!!sourceDiagnostic}
                          aria-errormessage={
                            sourceDiagnostic ? "source-diagnostic" : undefined
                          }
                          readOnly={!!session}
                          spellCheck={false}
                          wrap="off"
                          value={source}
                          onChange={(e) => {
                            if (custom) changeCustomJson(e.target.value);
                            else changeTemplateJson(e.target.value);
                          }}
                        />
                      </div>
                      {!custom && templateJson !== null && (
                        <button
                          className="btn btn-ghost"
                          onClick={() => changeTemplateJson(null)}
                        >
                          {t("恢复模板")}
                        </button>
                      )}
                    </div>
                  )}
                  {error && (
                    <div role="alert" className="error" style={{ margin: 16 }}>
                      <strong id="source-diagnostic">
                        {sourceDiagnostic
                          ? t(diagnosticKeys[sourceDiagnostic.code], {
                              line: sourceDiagnostic.line,
                              column: sourceDiagnostic.column,
                            })
                          : t("校验失败")}
                      </strong>
                      {sourceDiagnostic &&
                        (sourceDiagnostic.code === "JSON_SYNTAX" ||
                          sourceDiagnostic.code === "JSONL_SYNTAX") && (
                          <button
                            className="btn btn-ghost"
                            onClick={() => {
                              setEditMode("json");
                              setJsonTab("messages");
                              requestAnimationFrame(() => {
                                const editor = sourceEditor.current;
                                if (!editor) return;
                                editor.focus();
                                editor.setSelectionRange(
                                  sourceDiagnostic.offset,
                                  Math.min(
                                    source.length,
                                    sourceDiagnostic.offset + 1,
                                  ),
                                );
                                editor.scrollTop =
                                  Math.max(0, sourceDiagnostic.line - 3) *
                                  parseFloat(
                                    getComputedStyle(editor).lineHeight,
                                  );
                              });
                            }}
                          >
                            {t("定位到错误", {
                              line: sourceDiagnostic.line,
                              column: sourceDiagnostic.column,
                            })}
                          </button>
                        )}
                      <details open>
                        <summary>{t("详细诊断")}</summary>
                        {error}
                      </details>
                    </div>
                  )}
                </div>
                <footer className="render-toolbar">
                  <button
                    className="btn btn-primary"
                    disabled={!preview.connected || !!session}
                    onClick={() => void render()}
                  >
                    <Icon name="play" />
                    {t(
                      generated.messages.length > 1 && !custom
                        ? "渲染并播放"
                        : "渲染",
                    )}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={session || custom ? reset : restore}
                  >
                    <Icon name="reset" />
                    {t(session || custom ? "重置" : "恢复示例")}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setCopy(true)}
                  >
                    <Icon name="copy" />
                    {t("复制接入代码")}
                  </button>
                </footer>
              </section>
              <div
                className="resizer middle-resizer"
                role="separator"
                aria-label={t("模板配置")}
                onMouseDown={(event) => drag("middle", event)}
              />
              <section className="preview" aria-label={t("预览面板")}>
                {themeOpen && (
                  <div
                    className="theme-popover"
                    role="dialog"
                    aria-label={t("预览主题配置")}
                  >
                    <div className="theme-popover-header">
                      <strong>{t("预览主题配置")}</strong>
                      <button
                        className="btn btn-ghost"
                        aria-label={t("关闭")}
                        onClick={() => setThemeOpen(false)}
                      >
                        ×
                      </button>
                    </div>
                    <ThemeEditor
                      value={config.themeTokens ?? {}}
                      onChange={(value) =>
                        setConfig((previous) => ({
                          ...previous,
                          themeTokens: value,
                        }))
                      }
                    />
                  </div>
                )}
                <div className="preview-toolbar">
                  <Segment
                    label={t("预览面板")}
                    options={["card", "chat", "workspace"].map((value, i) => ({
                      value,
                      label: l(["卡片", "对话", "工作区"][i]),
                    }))}
                    value={host}
                    onChange={setHost}
                  />
                  <div className="devices">
                    {["desktop", "tablet", "phone"].map((value, i) => (
                      <button
                        key={value}
                        aria-label={l(["桌面", "平板", "手机"][i])}
                        aria-pressed={device === value}
                        onClick={() => setDevice(value)}
                      >
                        <Icon name={["monitor", "tablet", "phone"][i]} />
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn btn-icon"
                    aria-label={t("切换预览主题")}
                    onClick={() =>
                      setConfig({
                        ...config,
                        theme: config.theme === "light" ? "dark" : "light",
                      })
                    }
                  >
                    <Icon name={config.theme === "light" ? "sun" : "moon"} />
                  </button>
                  <button
                    className="btn btn-ghost"
                    aria-expanded={themeOpen}
                    onClick={() => setThemeOpen(!themeOpen)}
                  >
                    {t("预览主题配置")}
                  </button>
                  {(current.pluginId || custom) && (
                    <Segment
                      label={t("运行模式")}
                      options={[
                        {
                          value: "native",
                          label: (
                            <>
                              <Icon name="zap" size={13} />
                              Native
                            </>
                          ),
                        },
                        {
                          value: "sandbox",
                          label: (
                            <>
                              <Icon name="shield" size={13} />
                              Sandbox
                            </>
                          ),
                        },
                      ]}
                      value={config.runtimeMode}
                      onChange={(value) =>
                        setPendingMode(value as "native" | "sandbox")
                      }
                    />
                  )}
                  <div className="preview-toolbar-end">
                    <button
                      className="btn btn-icon"
                      aria-label={t("调试面板")}
                      aria-pressed={debug}
                      onClick={() => setDebug(!debug)}
                    >
                      <Icon name="panelBottom" />
                    </button>
                    <button
                      className="btn btn-icon"
                      aria-label={t(focus ? "退出聚焦" : "聚焦预览")}
                      onClick={() => setFocus(!focus)}
                    >
                      <Icon name={focus ? "min" : "max"} />
                    </button>
                  </div>
                </div>
                <div className="runtime-status" role="status">
                  <span
                    className={`status-dot ${preview.errors.length ? "danger" : ""}`}
                  />
                  <b>
                    {preview.connected
                      ? t(
                          preview.errors.length
                            ? "运行失败"
                            : (phase as TranslationKey),
                        )
                      : t("等待预览连接")}
                  </b>
                  <code>
                    {t("消息进度", {
                      applied: session ? preview.messages.length : step,
                      total: session
                        ? parseMessagesSafe(source).length
                        : queue.current.length ||
                          (format === "library"
                            ? (draftBatches?.length ?? 0)
                            : parseMessagesSafe(source).length),
                    })}
                  </code>
                  <code>Preview Host · {config.runtimeMode}</code>
                  <span>
                    {t(
                      config.actionHandler === "mock"
                        ? "Mock Agent"
                        : "外部 Agent",
                    )}
                  </span>
                </div>
                {preview.surfaces.length > 1 && (
                  <div className="surface-selector">
                    <label>
                      Surface{" "}
                      <select
                        className="input"
                        value={surfaceId}
                        onChange={(e) => setSurfaceId(e.target.value)}
                      >
                        <option value="all">{t("所有 Surface")}</option>
                        {preview.surfaces.map((s) => (
                          <option key={s.id}>{s.id}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <div className="preview-canvas">
                  <div
                    className={`preview-frame ${host}`}
                    data-theme={config.theme}
                    style={{
                      width:
                        device === "phone"
                          ? 375
                          : device === "tablet"
                            ? 768
                            : host === "workspace"
                              ? "100%"
                              : 720,
                    }}
                  >
                    <div className="frame-caption">
                      <span>
                        {t(
                          host === "card"
                            ? "卡片"
                            : host === "chat"
                              ? "对话"
                              : "工作区",
                        )}{" "}
                        · {t(config.theme === "light" ? "浅色" : "深色")}
                      </span>
                      <span>
                        {device === "phone"
                          ? "375px"
                          : device === "tablet"
                            ? "768px"
                            : "auto"}
                      </span>
                    </div>
                    <div className="frame-content">
                      {host === "chat" && (
                        <>
                          <div className="chat-prompt">{t("数据展示")}</div>
                          <b className="muted">● Agent</b>
                        </>
                      )}
                      {host === "workspace" && <h3>{t("工作区")}</h3>}
                      <div className="preview-node">
                        {!preview.messages.length && (
                          <div className="idle">
                            <strong>{t("尚未渲染")}</strong>
                            <span>{t("填写左侧配置，然后点击「渲染」。")}</span>
                            <button
                              className="btn btn-primary"
                              disabled={!preview.connected || !!session}
                              onClick={() => void render()}
                            >
                              <Icon name="play" />
                              {t("渲染")}
                            </button>
                          </div>
                        )}
                        <iframe
                          ref={preview.iframe}
                          src={`${previewOrigin}/?app=${encodeURIComponent(new URL(import.meta.url).pathname)}`}
                          title="Preview Host"
                          sandbox="allow-scripts allow-same-origin"
                          referrerPolicy="no-referrer"
                          style={{
                            border: 0,
                            width: "100%",
                            height: preview.messages.length
                              ? preview.height
                              : 0,
                            display: "block",
                          }}
                        />
                        {preview.errors.length > 0 && (
                          <div className="error" role="alert">
                            {t("组件渲染失败")}
                            <details>
                              <summary>{t("详细诊断")}</summary>
                              {preview.errors.join("\n")}
                            </details>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            {!focus && (
              <section
                className={`inspector ${debug ? "" : "is-collapsed"}`}
                aria-label={t("调试面板")}
              >
                <div className="inspector-tabs">
                  {[
                    ["messages", "消息"],
                    ["tree", "组件树"],
                    ["data", "数据"],
                    ["actions", "操作"],
                    ["logs", "日志"],
                    ["metrics", "指标"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      aria-selected={debugTab === key}
                      onClick={() => {
                        setDebugTab(key);
                        setDebug(true);
                      }}
                    >
                      {l(label)}
                      {key === "actions" &&
                        preview.actions.length > 0 &&
                        ` ${preview.actions.length}`}
                    </button>
                  ))}
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      download(`agent-ui-${debugTab}.json`, inspectorValue)
                    }
                  >
                    <Icon name="ext" />
                    {t("导出")}
                  </button>
                  <button
                    className="btn btn-ghost"
                    aria-label={t("关闭")}
                    onClick={() => setDebug(!debug)}
                  >
                    <Icon name={debug ? "down" : "up"} />
                  </button>
                </div>
                {debug && <pre>{JSON.stringify(inspectorValue, null, 2)}</pre>}
              </section>
            )}
          </div>
        </div>
      </div>
      <div
        hidden={page !== "mcp"}
        style={{ flex: 1, minHeight: 0, overflow: "auto" }}
      >
        <McpAppsPanel
          baseUrl={`${apiBase}/mcp`}
          sandboxUrl={`${previewOrigin}/mcp-sandbox.html`}
          locale={locale}
          theme={theme}
        />
      </div>
      {page === "plugins" && (
        <Plugins
          reload={reload}
          notify={setToast}
          open={(key) => {
            select(key);
            setPage("playground");
          }}
          onUninstall={(id) => {
            const removed = entries.find((entry) => entry.pluginId === id);
            const active =
              removed &&
              preview.surfaces.some((surface) =>
                surface.components.some(
                  (component) => component.catalogId === removed.catalogId,
                ),
              );
            if (current.pluginId === id && !session) select("text");
            else if (active) reset();
          }}
        />
      )}
      {page === "docs" && (
        <Documentation entries={entries} selected={current.key} />
      )}
      {page === "benchmarks" && (
        <Benchmarks
          entries={entries}
          config={config}
          onBeforeRun={() => preview.reset()}
        />
      )}
      {copy && (
        <div className="modal-backdrop" onMouseDown={() => setCopy(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t("复制接入代码")}
            className="dialog copy-dialog"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              <h2>{t("复制接入代码")}</h2>
              <button
                className="btn btn-ghost"
                aria-label={t("关闭")}
                onClick={() => setCopy(false)}
              >
                <Icon name="x" />
              </button>
            </header>
            <div className="modal-tools">
              <Segment
                label={t("代码示例")}
                value={copyTab}
                onChange={setCopyTab}
                options={[
                  { value: "api", label: "API / cURL" },
                  { value: "json", label: "A2UI JSON" },
                  { value: "config", label: t("运行配置") },
                  { value: "library", label: "Library Inputs" },
                  { value: "server", label: "Library Node" },
                  { value: "react", label: "Library React" },
                ]}
              />
              <select
                className="input"
                value={copySource}
                onChange={(e) => setCopySource(e.target.value)}
              >
                <option value="draft">{t("当前草稿")}</option>
                <option value="preview">{t("当前预览")}</option>
              </select>
            </div>
            <p className="muted">
              {t("Library 接入")} ·{" "}
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setCopy(false);
                  setPage("docs");
                }}
              >
                {t("文档")}
              </button>
            </p>
            <pre>{copyValue}</pre>
            <footer>
              <button
                className="btn btn-secondary"
                disabled={!exportReady}
                onClick={() =>
                  download(
                    copyTab === "server"
                      ? "server.ts"
                      : copyTab === "react"
                        ? "AgentUiExample.tsx"
                        : copyTab === "library"
                          ? "ui-input.json"
                          : "config.json",
                    copyValue,
                    true,
                  )
                }
              >
                {t("下载代码")}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setCopy(false)}
              >
                {t("关闭")}
              </button>
              <button
                className="btn btn-primary"
                disabled={!exportReady}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(copyValue)
                    .then(() => setToast("已复制"))
                }
              >
                <Icon name="copy" />
                {t("复制")}
              </button>
            </footer>
          </section>
        </div>
      )}
      {pendingMode && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            className="dialog confirm-dialog"
          >
            <header>
              <h2>{t("切换运行模式")}</h2>
            </header>
            <p>{t("切换模式将销毁当前实例，并重放相同消息。")}</p>
            <code>
              {config.runtimeMode} → {pendingMode}
            </code>
            <footer>
              <button
                className="btn btn-secondary"
                onClick={() => setPendingMode(null)}
              >
                {t("取消")}
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  void modeSwitch().catch((e) => setError(String(e)))
                }
              >
                {t("确认切换")}
              </button>
            </footer>
          </section>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Icon name="check" />
          {t(toast)}
        </div>
      )}
    </div>
  );
}
function parseMessagesSafe(source: string) {
  try {
    return parseMessages(source);
  } catch {
    return [];
  }
}
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { l } = useTranslation();
  return (
    <label className={field.wide ? "wide" : ""}>
      {field.type !== "toggle" && <span>{l(field.label)}</span>}
      {field.type === "toggle" ? (
        <span className="toggle-field">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {l(field.label)}
        </span>
      ) : field.type === "textarea" ? (
        <textarea
          className="input"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          className="input"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options?.map((v) => (
            <option value={v} key={v}>
              {l(v)}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="input"
          type={
            field.type === "number"
              ? "number"
              : field.type === "color"
                ? "color"
                : "text"
          }
          value={String(
            value ??
              (field.type === "color"
                ? field.key === "targetColor"
                  ? "#7b848c"
                  : "#148a7d"
                : ""),
          )}
          onChange={(e) =>
            onChange(
              field.type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
        />
      )}
    </label>
  );
}
function ArrayEditor({
  name,
  schema,
  rows,
  onChange,
}: {
  name: string;
  schema?: Record<string, unknown>;
  rows: Record<string, unknown>[];
  onChange: (rows: Record<string, unknown>[]) => void;
}) {
  const { t, l } = useTranslation();
  const rowProperties =
    (
      schema?.properties as
        | Record<
            string,
            {
              items?: {
                properties?: Record<
                  string,
                  {
                    type?: string;
                    enum?: (string | number)[];
                    minimum?: number;
                    maximum?: number;
                  }
                >;
              };
            }
          >
        | undefined
    )?.[name]?.items?.properties ?? {};
  const keys = Object.keys(
    rows[0] ??
      (Object.keys(rowProperties).length ? rowProperties : { name: "" }),
  );
  const numeric = (key: string) =>
    ["number", "integer"].includes(rowProperties[key]?.type ?? "") ||
    typeof rows[0]?.[key] === "number";
  const setCell = (index: number, key: string, value: string) =>
    onChange(
      rows.map((row, i) =>
        i === index
          ? { ...row, [key]: numeric(key) ? Number(value) : value }
          : row,
      ),
    );
  const labels: Record<string, string> = {
    group: "区域组",
    region: "区域",
    credit: "信用",
    market: "市场",
    liquidity: "流动性",
    ops: "操作风险",
    date: "日期",
    desc: "说明",
    amount: "金额",
    name: "名称",
    owner: "负责人",
    status: "状态",
    label: "分类",
    value: "数值",
  };
  return (
    <div className="field-section array-section">
      <div className="section-label">
        <strong>
          {t(
            name === "rows"
              ? "区域与风险值"
              : name === "items" && keys.includes("date")
                ? "费用明细"
                : "行数据",
          )}
        </strong>
        <span>{rows.length}</span>
        <button
          className="btn btn-ghost"
          onClick={() =>
            onChange([
              ...rows,
              Object.fromEntries(
                keys.map((k) => [
                  k,
                  rowProperties[k]?.enum?.[0] ?? (numeric(k) ? 0 : ""),
                ]),
              ),
            ])
          }
        >
          <Icon name="plus" size={14} />
          {t("添加")}
        </button>
      </div>
      <div className="array-scroll">
        <div
          className="array-grid"
          style={{
            gridTemplateColumns: `${keys.map((key, i) => (rowProperties[key]?.enum ? "74px" : numeric(key) ? "48px" : i === 0 ? "minmax(90px,1fr)" : "minmax(74px,1fr)")).join(" ")} 30px`,
          }}
        >
          {keys.map((key) => (
            <span className="array-label" key={key}>
              {l(labels[key] ?? key)}
            </span>
          ))}
          <span />
          {rows.map((row, i) => (
            <ReactFragment key={i}>
              {keys.map((key) =>
                rowProperties[key]?.enum ? (
                  <select
                    className="input"
                    aria-label={`${l(labels[key] ?? key)} ${i + 1}`}
                    key={key}
                    value={String(row[key] ?? "")}
                    onChange={(e) => setCell(i, key, e.target.value)}
                  >
                    {rowProperties[key].enum!.map((value) => (
                      <option value={String(value)} key={String(value)}>
                        {l(String(value))}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={`${l(labels[key] ?? key)} ${i + 1}`}
                    className="input"
                    key={key}
                    type={numeric(key) ? "number" : "text"}
                    min={rowProperties[key]?.minimum}
                    max={rowProperties[key]?.maximum}
                    value={String(row[key] ?? "")}
                    onChange={(e) => setCell(i, key, e.target.value)}
                  />
                ),
              )}
              <button
                className="btn btn-ghost"
                aria-label={`${t("删除")} ${i + 1}`}
                onClick={() => onChange(rows.filter((_, index) => index !== i))}
              >
                <Icon name="trash" size={14} />
              </button>
            </ReactFragment>
          ))}
        </div>
      </div>
    </div>
  );
}
function ReactFragment({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
createRoot(document.getElementById("root")!).render(<App />);
