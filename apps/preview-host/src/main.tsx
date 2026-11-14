import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { A2uiSurface, type ReactCatalogComponent } from "@a2ui/react";
import { MessageProcessor } from "@a2ui/web_core/v1_0";
import {
  makeCatalogs,
  RenderBoundary,
} from "../../../packages/runtime/src/catalog";
import {
  defaultRun,
  runConfigSchema,
  type RunConfig,
  type Message,
  processWithFallback,
} from "../../../packages/protocol/src/index";
import {
  MeasurementTracker,
  isMeasurementRequest,
  type RuntimeStatistics,
} from "../../../packages/protocol/src/measurement";
import { RuntimeMeasurement } from "../../../packages/runtime/src/measurement";
import type { ComponentEntry } from "../../../packages/catalog/src/index";
import { setLocale } from "../../../packages/i18n/src/index";
import { RuntimeEnvironment } from "../../../packages/runtime/src/policy";
import { isJsonEnvelope } from "../../../packages/protocol/src/bridge";
import "../../playground/src/tokens.css";
import "../../playground/src/shared.css";
import "./host.css";
let processor: MessageProcessor<ReactCatalogComponent> | undefined;
let config: RunConfig = defaultRun;
let port: MessagePort | undefined;
let runId = "";
let revision = 0;
let measurementId: string | undefined;
const measurements = new MeasurementTracker((requestId, measurement) =>
  post("measured", { requestId, measurement }),
);
const listeners = new Set<() => void>();
const inputs = new Map<string, number>();
const inputKey = (surfaceId: string, componentId: string) =>
  JSON.stringify([surfaceId, componentId]);
let longTasks: { startTime: number; duration: number; name: string }[] = [];
let statisticsStart = performance.now();
const collectTasks = (entries: PerformanceEntry[]) => {
  for (const e of entries)
    if (e.startTime >= statisticsStart && longTasks.length < 10000)
      longTasks.push({
        startTime: e.startTime - statisticsStart,
        duration: e.duration,
        name: e.name,
      });
};
let taskObserver: PerformanceObserver | undefined;
try {
  if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
    taskObserver = new PerformanceObserver((list) =>
      collectTasks(list.getEntries()),
    );
    taskObserver.observe({ type: "longtask" });
  }
} catch {
  taskObserver = undefined;
}
const memory = () => {
  const value = (
    performance as Performance & { memory?: { usedJSHeapSize?: number } }
  ).memory?.usedJSHeapSize;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};
let initialMemory: number | null = null;
function statistics(): RuntimeStatistics {
  if (taskObserver) collectTasks(taskObserver.takeRecords());
  const used = memory();
  return {
    scope: "preview-host-document-best-effort",
    longTasks: taskObserver
      ? {
          count: longTasks.length,
          durationMs: longTasks.reduce((sum, e) => sum + e.duration, 0),
          entries: longTasks,
        }
      : null,
    memory:
      used === null
        ? null
        : {
            usedJSHeapBytes: used,
            initialUsedJSHeapBytes: initialMemory,
            deltaBytes: initialMemory === null ? null : used - initialMemory,
          },
  };
}
const modelSubscriptions = new Map<string, { unsubscribe: () => void }>();
const notify = () => {
  revision++;
  listeners.forEach((fn) => fn());
};
function post(type: string, payload: Record<string, unknown> = {}) {
  port?.postMessage({ type, runId, ...payload });
}
function reportRuntimeError(error: string) {
  post("error", { error });
  if (measurementId) measurements.finish(measurementId, "error");
}
function snapshot() {
  return Array.from(processor?.getSurfaces().values() ?? []).map((surface) => ({
    id: surface.id,
    data: surface.dataModel.get("/"),
    components: Array.from(surface.componentsModel.values).map((c) => ({
      id: c.id,
      component: c.type,
      catalogId: c.catalog.id,
      ...c.properties,
    })),
  }));
}
function App() {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => revision,
  );
  const surfaces = Array.from(processor?.getSurfaces().values() ?? []);
  return (
    <RuntimeMeasurement.Provider
      value={{
        requestId: measurementId,
        report: (id, target, stage, visible, at) =>
          measurements.report(
            id,
            target,
            stage,
            visible,
            at === undefined ? performance.now() : at - performance.timeOrigin,
          ),
        input: (target, at) => {
          if (
            Number.isFinite(at) &&
            Math.abs(performance.timeOrigin + performance.now() - at) < 30000
          )
            inputs.set(inputKey(target.surfaceId, target.componentId), at);
        },
      }}
    >
      <RuntimeEnvironment.Provider value={config}>
        <div data-theme={config.theme} style={{ padding: 0 }}>
          {surfaces.map((s) => (
            <section data-surface={s.id} key={runId + s.id}>
              <RenderBoundary onError={reportRuntimeError}>
                <A2uiSurface surface={s} />
              </RenderBoundary>
            </section>
          ))}
        </div>
      </RuntimeEnvironment.Provider>
    </RuntimeMeasurement.Provider>
  );
}
window.addEventListener("message", (event) => {
  if (
    event.source !== parent ||
    event.origin !== "http://localhost:5173" ||
    event.data?.type !== "preview.init" ||
    !event.ports[0] ||
    port
  )
    return;
  port = event.ports[0];
  let commandChain = Promise.resolve();
  port.onmessage = (e) => {
    commandChain = commandChain
      .then(async () => {
        const m = e.data;
        if (!isJsonEnvelope(m, 2_000_000)) return;
        if (m.type === "reset") {
          inputs.clear();
          taskObserver?.takeRecords();
          longTasks = [];
          statisticsStart = performance.now();
          initialMemory = memory();
          measurements.dispose();
          measurementId = undefined;
          processor?.dispose();
          modelSubscriptions.forEach((sub) => sub.unsubscribe());
          modelSubscriptions.clear();
          runId = m.runId;
          config = runConfigSchema.parse(m.config);
          document.documentElement.dataset.theme = config.theme;
          setLocale(config.locale, false);
          processor = new MessageProcessor<ReactCatalogComponent>(
            await makeCatalogs(
              m.entries as ComponentEntry[],
              config,
              reportRuntimeError,
            ),
            (action) => {
              const key = inputKey(action.surfaceId, action.sourceComponentId);
              const inputAt = inputs.get(key);
              inputs.delete(key);
              post("action", {
                action,
                ...(inputAt === undefined
                  ? {}
                  : {
                      interaction: {
                        inputAt,
                        hostReceivedAt:
                          performance.timeOrigin + performance.now(),
                      },
                    }),
              });
            },
            { version: "1.0", reportErrorsOnly: true },
          );
          notify();
          post("reset");
        } else if (m.runId === runId && m.type === "configuration") {
          config = runConfigSchema.parse({ ...config, ...m.config });
          document.documentElement.dataset.theme = config.theme;
          setLocale(config.locale, false);
          notify();
        } else if (m.runId === runId && m.type === "messages" && processor) {
          const start = performance.now();
          measurementId = undefined;
          if (isMeasurementRequest(m.measure)) {
            measurementId = m.requestId;
            measurements.begin(m.requestId, m.measure);
          }
          const errors = processWithFallback(
            processor,
            m.messages as Message[],
          );
          const surfaces = processor.getSurfaces();
          for (const [id, sub] of modelSubscriptions)
            if (!surfaces.has(id)) {
              sub.unsubscribe();
              modelSubscriptions.delete(id);
            }
          for (const [id, surface] of surfaces)
            if (!modelSubscriptions.has(id))
              modelSubscriptions.set(
                id,
                surface.dataModel.subscribe("/", () =>
                  post("snapshot", { surfaces: snapshot() }),
                ),
              );
          notify();
          const applyMs = performance.now() - start;
          if (errors.length) measurements.finish(m.requestId, "error");
          post("applied", {
            requestId: m.requestId,
            errors,
            surfaces: snapshot(),
            applyMs,
            ...(m.collectStats ? { stats: statistics() } : {}),
          });
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              post("paint", {
                requestId: m.requestId,
                paintMs: performance.now() - start,
              }),
            ),
          );
        }
      })
      .catch((error) => post("error", { error: String(error) }));
  };
  post("connected");
});
new ResizeObserver(() =>
  post("resize", { height: document.body.scrollHeight }),
).observe(document.body);
parent.postMessage({ type: "preview.ready" }, "http://localhost:5173");
createRoot(document.getElementById("root")!).render(<App />);
