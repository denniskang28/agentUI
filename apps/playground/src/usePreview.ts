import { browserId } from "../../../packages/protocol/src/browser-id";
import { previewOrigin } from "../../../packages/protocol/src/browser-deployment";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentEntry } from "../../../packages/catalog/src/index";
import { isJsonEnvelope } from "../../../packages/protocol/src/bridge";
import {
  defaultRun,
  type Message,
  type RunConfig,
  patchMessage,
} from "../../../packages/protocol/src/index";
import type {
  MeasurementRequest,
  MeasurementResult,
  RuntimeStatistics,
} from "../../../packages/protocol/src/measurement";
export interface ApplyOptions {
  measure?: MeasurementRequest;
  recordHistory?: boolean;
  collectStats?: boolean;
}
export interface ApplyReceipt {
  requestId: string;
  errors: unknown[];
  applyMs: number;
  surfaces: SurfaceSnapshot[];
  roundTripMs: number;
  measurement?: MeasurementResult;
  stats?: RuntimeStatistics;
}
export interface SurfaceSnapshot {
  id: string;
  data: Record<string, any>;
  components: Record<string, unknown>[];
}
export interface ActionTiming {
  clockToleranceMs: 1;
  inputAt: number;
  hostReceivedAt: number;
  mainReceivedAt: number;
  inputToHostMs: number;
  hostToMainMs: number;
  mockMs?: number;
  responseCommitMs?: number;
  totalMs?: number;
  status: "pending" | "complete" | "error";
}
export interface ActionRecord {
  actionId: string;
  runId: string;
  timestamp: string;
  action: Record<string, any>;
  timing?: ActionTiming;
}
export interface Metric {
  requestId: string;
  applyMs?: number;
  paintMs?: number;
  kind: string;
  timestamp: number;
}
export function usePreview(
  entries: ComponentEntry[],
  config: RunConfig,
  measureActions = false,
) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const port = useRef<MessagePort | null>(null);
  const currentRun = useRef("");
  const latest = useRef({ entries, config, measureActions });
  latest.current = { entries, config, measureActions };
  const actionRecords = useRef<ActionRecord[]>([]);
  const count = useRef(0);
  const pending = useRef(
    new Map<
      string,
      {
        resolve: (value: any) => void;
        reject: (e: Error) => void;
        timer: ReturnType<typeof setTimeout>;
        started: number;
        measured: boolean;
        ack?: Omit<ApplyReceipt, "roundTripMs">;
        measurement?: MeasurementResult;
      }
    >(),
  );
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [connected, setConnected] = useState(false),
    [runId, setRunId] = useState(""),
    [surfaces, setSurfaces] = useState<SurfaceSnapshot[]>([]),
    [actions, setActions] = useState<ActionRecord[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [metrics, setMetrics] = useState<Metric[]>([]),
    [messages, setMessages] = useState<Message[]>([]),
    [height, setHeight] = useState(120);
  const onError = useRef<((error: string) => void) | null>(null);
  const errorRecords = useRef<string[]>([]);
  const appendErrors = useCallback((items: string[]) => {
    errorRecords.current = [...errorRecords.current, ...items];
    setErrors(errorRecords.current);
    items.forEach((item) => onError.current?.(item));
  }, []);
  const snapshots = useRef<SurfaceSnapshot[]>([]);
  const onAction = useRef<((record: ActionRecord) => void) | null>(null);
  const send = useCallback((payload: Record<string, unknown>) => {
    port.current?.postMessage({ ...payload, runId: currentRun.current });
  }, []);
  const apply = useCallback(
    (batch: Message[], kind = "message", options: ApplyOptions = {}) =>
      new Promise<ApplyReceipt>((resolve, reject) => {
        if (!port.current) {
          reject(new Error("PREVIEW_NOT_CONNECTED"));
          return;
        }
        const requestId = browserId();
        const timer = setTimeout(
          () => {
            pending.current.delete(requestId);
            reject(new Error("PREVIEW_ACK_TIMEOUT"));
          },
          options.measure ? 12000 : 10000,
        );
        pending.current.set(requestId, {
          resolve,
          reject,
          timer,
          started: performance.now(),
          measured: !!options.measure,
        });
        count.current += batch.length;
        if (options.recordHistory !== false)
          setMessages((prev) => [...prev, ...batch]);
        if (options.recordHistory !== false)
          setMetrics((prev) => [
            ...prev.slice(-999),
            { requestId, kind, timestamp: performance.now() },
          ]);
        send({
          type: "messages",
          messages: batch,
          requestId,
          ...(options.measure ? { measure: options.measure } : {}),
          collectStats: options.collectStats ?? false,
        });
      }),
    [send],
  );
  const reset = useCallback(
    (id = browserId(), override?: Partial<RunConfig>) => {
      currentRun.current = id;
      setRunId(id);
      count.current = 0;
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
      pending.current.forEach((p) => {
        clearTimeout(p.timer);
        p.reject(new Error("RUN_RESET"));
      });
      pending.current.clear();
      snapshots.current = [];
      setSurfaces([]);
      actionRecords.current = [];
      setActions([]);
      errorRecords.current = [];
      setErrors([]);
      setMetrics([]);
      setMessages([]);
      send({
        type: "reset",
        config: { ...latest.current.config, ...override },
        entries: latest.current.entries,
      });
      return id;
    },
    [send],
  );
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== iframe.current?.contentWindow ||
        event.origin !== previewOrigin ||
        event.data?.type !== "preview.ready"
      )
        return;
      if (port.current) return;
      const channel = new MessageChannel();
      port.current = channel.port1;
      const updateAction = (id: string, timing: ActionTiming) => {
        actionRecords.current = actionRecords.current.map((record) =>
          record.actionId === id ? { ...record, timing } : record,
        );
        setActions(actionRecords.current);
      };
      const finish = (requestId: string) => {
        const p = pending.current.get(requestId);
        if (!p?.ack || (p.measured && !p.measurement)) return;
        clearTimeout(p.timer);
        pending.current.delete(requestId);
        p.resolve({
          ...p.ack,
          measurement: p.measurement,
          roundTripMs: performance.now() - p.started,
        });
      };
      channel.port1.onmessage = (e) => {
        const m = e.data;
        if (!isJsonEnvelope(m, 2_000_000)) return;
        if (m.type === "connected") {
          setConnected(true);
          return;
        }
        if (m.runId !== currentRun.current) return;
        if (m.type === "snapshot") {
          snapshots.current = m.surfaces;
          setSurfaces(m.surfaces);
        } else if (m.type === "applied") {
          snapshots.current = m.surfaces;
          setSurfaces(m.surfaces);
          setMetrics((prev) =>
            prev.map((x) =>
              x.requestId === m.requestId ? { ...x, applyMs: m.applyMs } : x,
            ),
          );
          if (m.errors?.length)
            appendErrors(m.errors.map((x: unknown) => JSON.stringify(x)));
          const p = pending.current.get(m.requestId);
          if (p) {
            p.ack = m as Omit<ApplyReceipt, "roundTripMs">;
            finish(m.requestId);
          }
        } else if (m.type === "measured") {
          const p = pending.current.get(m.requestId);
          if (p) {
            p.measurement = m.measurement;
            finish(m.requestId);
          }
        } else if (m.type === "paint")
          setMetrics((prev) =>
            prev.map((x) =>
              x.requestId === m.requestId ? { ...x, paintMs: m.paintMs } : x,
            ),
          );
        else if (m.type === "error") appendErrors([String(m.error)]);
        else if (m.type === "resize" && Number.isFinite(m.height)) {
          setHeight(Math.min(4000, Math.max(1, m.height)));
        } else if (m.type === "action") {
          const receivedAt = performance.timeOrigin + performance.now();
          const interaction = m.interaction;
          const timing: ActionTiming | undefined =
            latest.current.measureActions &&
            interaction &&
            Number.isFinite(interaction.inputAt) &&
            Number.isFinite(interaction.hostReceivedAt) &&
            interaction.hostReceivedAt + 1 >= interaction.inputAt &&
            receivedAt + 1 >= interaction.hostReceivedAt &&
            receivedAt - interaction.inputAt < 30000
              ? {
                  clockToleranceMs: 1,
                  inputAt: interaction.inputAt,
                  hostReceivedAt: interaction.hostReceivedAt,
                  mainReceivedAt: receivedAt,
                  inputToHostMs: Math.max(
                    0,
                    interaction.hostReceivedAt - interaction.inputAt,
                  ),
                  hostToMainMs: Math.max(
                    0,
                    receivedAt - interaction.hostReceivedAt,
                  ),
                  status: "pending",
                }
              : undefined;
          const record: ActionRecord = {
            actionId: browserId(),
            runId: currentRun.current,
            timestamp: new Date().toISOString(),
            action: m.action,
            ...(timing ? { timing } : {}),
          };
          actionRecords.current = [...actionRecords.current, record];
          setActions(actionRecords.current);
          onAction.current?.(record);
          if (latest.current.config.actionHandler === "mock") {
            const id = currentRun.current;
            const action = m.action as {
              name: string;
              surfaceId: string;
              sourceComponentId: string;
              context: Record<string, any>;
            };
            const timer = setTimeout(() => {
              timers.current.delete(timer);
              if (id !== currentRun.current) return;
              const surface = snapshots.current.find(
                (s) => s.id === action.surfaceId,
              );
              if (!surface) return;
              let data: Record<string, unknown>;
              if (action.name === "finance.risk.drilldown")
                data = {
                  ...surface.data.view,
                  detail: {
                    ...action.context,
                    summary: "Agent risk detail",
                    exposure: 12400000,
                  },
                };
              else if (action.name.startsWith("expense."))
                data = {
                  ...surface.data.view,
                  resultVersion:
                    Number(surface.data.view?.resultVersion ?? 0) + 1,
                  status:
                    latest.current.config.outcome === "error"
                      ? "error"
                      : action.name === "expense.approve" &&
                          latest.current.config.outcome !== "reject"
                        ? "approved"
                        : action.name === "expense.requestChanges"
                          ? "changes_requested"
                          : "rejected",
                };
              else
                data = {
                  ...surface.data.view,
                  lastAction: action.name,
                  actionCount: Number(surface.data.view?.actionCount ?? 0) + 1,
                };
              const mockMs =
                performance.timeOrigin + performance.now() - receivedAt;
              void apply(
                [patchMessage(action.surfaceId, data, "/view")],
                "action",
                timing
                  ? {
                      measure: {
                        targets: [
                          {
                            surfaceId: action.surfaceId,
                            componentId: action.sourceComponentId,
                          },
                        ],
                        waitFor: "commit",
                      },
                      recordHistory: false,
                    }
                  : {},
              )
                .then((receipt) => {
                  if (timing && id === currentRun.current)
                    updateAction(record.actionId, {
                      ...timing,
                      mockMs,
                      responseCommitMs:
                        receipt.measurement?.status === "complete"
                          ? Math.max(
                              ...receipt.measurement.components.map(
                                (c) => c.commitMs ?? 0,
                              ),
                            )
                          : undefined,
                      totalMs:
                        performance.timeOrigin +
                        performance.now() -
                        timing.inputAt,
                      status:
                        receipt.measurement?.status === "complete" &&
                        !receipt.errors.length
                          ? "complete"
                          : "error",
                    });
                })
                .catch((e) => {
                  if (id !== currentRun.current) return;
                  appendErrors([String(e)]);
                  if (timing)
                    updateAction(record.actionId, {
                      ...timing,
                      mockMs,
                      status: "error",
                    });
                });
            }, latest.current.config.latency);
            timers.current.add(timer);
          }
        }
      };
      iframe.current?.contentWindow?.postMessage(
        { type: "preview.init" },
        previewOrigin,
        [channel.port2],
      );
      reset();
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      port.current?.close();
      timers.current.forEach((t) => clearTimeout(t));
      pending.current.forEach((p) => {
        clearTimeout(p.timer);
        p.reject(new Error("PREVIEW_DISPOSED"));
      });
      pending.current.clear();
    };
  }, [apply, reset, appendErrors]);
  useEffect(() => {
    send({
      type: "configuration",
      config: { locale: config.locale, theme: config.theme },
    });
  }, [config.locale, config.theme, send]);
  return {
    iframe,
    connected,
    runId,
    surfaces,
    actions,
    errors,
    errorRecords,
    metrics,
    messages,
    height,
    apply,
    reset,
    onAction,
    onError,
    actionRecords,
    config: config ?? defaultRun,
  };
}
