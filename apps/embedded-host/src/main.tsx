import { RuntimeAppearance } from "../../../packages/runtime/src/appearance";
import { browserId } from "../../../packages/protocol/src/browser-id";
import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { A2uiSurface, type ReactCatalogComponent } from "@a2ui/react";
import { MessageProcessor } from "@a2ui/web_core/v1_0";
import { z } from "zod";
import {
  makeCatalogs,
  RenderBoundary,
} from "../../../packages/runtime/src/catalog";
import { PluginAssetOrigin } from "../../../packages/runtime/src/asset-origin";
import { RuntimeEnvironment } from "../../../packages/runtime/src/policy";
import {
  defaultRun,
  runConfigSchema,
  processWithFallback,
  type RunConfig,
  type Message,
} from "../../../packages/protocol/src/index";
import { isJsonEnvelope } from "../../../packages/protocol/src/bridge";
import { setLocale } from "../../../packages/i18n/src/index";
import {
  EMBED_PROTOCOL,
  HOST_VERSION,
  actionEventSchema,
  hostManifestSchema,
  normalizedBatchSchema,
  canonical,
  type ComponentEntry,
} from "../../../packages/agent-ui/src/protocol";
import "../../playground/src/tokens.css";
import "../../playground/src/shared.css";
import "../../preview-host/src/host.css";

let config: RunConfig = { ...defaultRun, actionHandler: "external" };
let processor: MessageProcessor<ReactCatalogComponent> | undefined;
let port: MessagePort | undefined;
let runId = "";
let revision = 0;
let selected: Set<string> | undefined;
let disposed = false;
let nextSequence = 1;
const applied = new Map<
  string,
  { signature: string; lastSequence: number; errors: unknown[] }
>();
const listeners = new Set<() => void>();
const documentId = browserId();
const notify = () => {
  revision++;
  listeners.forEach((fn) => fn());
};
const post = (type: string, payload: Record<string, unknown> = {}) =>
  port?.postMessage({ type, protocol: EMBED_PROTOCOL, runId, ...payload });
function reportError(
  message: string,
  code = "RENDER_ERROR",
  details?: unknown,
) {
  post("error", { code, message, details });
}
function cleanup() {
  disposed = true;
  processor?.dispose();
  processor = undefined;
  applied.clear();
  notify();
}
function App() {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => revision,
  );
  return (
    <PluginAssetOrigin.Provider value={location.origin}>
      <RuntimeEnvironment.Provider value={config}>
        <RuntimeAppearance />
        <div data-runtime-theme data-theme={config.theme}>
          {Array.from(processor?.getSurfaces().values() ?? [])
            .filter((surface) => !selected || selected.has(surface.id))
            .map((surface) => (
              <section key={`${runId}:${surface.id}`} data-surface={surface.id}>
                <RenderBoundary onError={reportError}>
                  <A2uiSurface surface={surface} />
                </RenderBoundary>
              </section>
            ))}
        </div>
      </RuntimeEnvironment.Provider>
    </PluginAssetOrigin.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
const deployment = z
  .object({ allowedParents: z.array(z.string().url()).min(1).max(20) })
  .strict()
  .parse(
    await fetch("/host-config.json", { credentials: "omit" }).then(
      (response) => {
        if (!response.ok)
          throw Error("Host deployment configuration unavailable");
        return response.json();
      },
    ),
  );
const parents = new Set(
  deployment.allowedParents.map((value) => {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.origin === location.origin ||
      value !== url.origin
    )
      throw Error("Use exact separate parent origins");
    return url.origin;
  }),
);
function ready(origin: string) {
  parent.postMessage(
    {
      type: "agent-ui.ready",
      protocol: EMBED_PROTOCOL,
      hostVersion: HOST_VERSION,
      documentId,
    },
    origin,
  );
}
window.addEventListener("message", (event) => {
  if (
    event.source !== parent ||
    !parents.has(event.origin) ||
    !isJsonEnvelope(event.data, 2_000_000) ||
    event.data.protocol !== EMBED_PROTOCOL
  )
    return;
  if (event.data.type === "agent-ui.probe") {
    ready(event.origin);
    return;
  }
  if (event.data.type !== "agent-ui.connect" || !event.ports[0] || port) return;
  port = event.ports[0];
  let chain = Promise.resolve();
  port.onmessage = (incoming) => {
    chain = chain
      .then(async () => {
        const message = incoming.data;
        if (!isJsonEnvelope(message, 2_000_000)) return;
        if (message.type === "init" && !processor && !disposed) {
          if (
            message.protocol !== EMBED_PROTOCOL ||
            message.hostVersion !== HOST_VERSION ||
            typeof message.runId !== "string"
          )
            throw Error("HOST_VERSION: incompatible client");
          runId = message.runId;
          const manifest = hostManifestSchema.parse(message.manifest);
          const entries = manifest.entries as ComponentEntry[];
          for (const entry of entries)
            for (const asset of [entry.bundleUrl, entry.stylesheetUrl])
              if (asset) {
                const url = new URL(asset, location.origin);
                if (
                  url.origin !== location.origin ||
                  !/^\/artifacts\/[a-zA-Z0-9-]+\/(plugin\.(js|css))$/.test(
                    url.pathname,
                  ) ||
                  url.search ||
                  url.hash
                )
                  throw Error(
                    "ASSET_ORIGIN: plugin assets must be approved Host artifacts",
                  );
              }
          config = runConfigSchema.parse({
            ...defaultRun,
            actionHandler: "external",
            ...(message.config as object),
          });
          setLocale(config.locale, false);
          document.documentElement.dataset.theme = config.theme;
          processor = new MessageProcessor<ReactCatalogComponent>(
            await makeCatalogs(entries, config, reportError),
            (action) => {
              const event = actionEventSchema.parse({
                protocol: EMBED_PROTOCOL,
                runId,
                actionId: browserId(),
                message: { version: "1.0", action },
              });
              post("action", { event });
            },
            { version: "1.0", reportErrorsOnly: true },
          );
          notify();
          post("connected", { hostVersion: HOST_VERSION });
          return;
        }
        if (!processor || disposed || message.runId !== runId) {
          reportError("Stale run or disconnected Host", "STALE_RUN");
          return;
        }
        if (message.type === "batch") {
          const batch = normalizedBatchSchema.parse(message.batch);
          if (batch.runId !== runId)
            throw Error("STALE_RUN: batch belongs to another run");
          const signature = canonical({ ...batch, replay: false });
          const prior = applied.get(batch.batchId);
          if (prior) {
            if (prior.signature !== signature)
              throw Error("BATCH_CONFLICT: changed batch");
            post("applied", {
              batchId: batch.batchId,
              lastSequence: prior.lastSequence,
              errors: prior.errors,
            });
            return;
          }
          if (batch.firstSequence !== nextSequence)
            throw Error(`SEQUENCE_CONFLICT: expected ${nextSequence}`);
          if (applied.size >= 1000)
            throw Error("RUN_LIMIT: reset the conversation");
          config = { ...config, componentPolicies: batch.componentPolicies };
          const errors = processWithFallback(
            processor,
            batch.messages as Message[],
          ).map((error) => JSON.parse(JSON.stringify(error)) as unknown);
          applied.set(batch.batchId, {
            signature,
            lastSequence: batch.lastSequence,
            errors,
          });
          nextSequence = batch.lastSequence + 1;
          notify();
          post("applied", {
            batchId: batch.batchId,
            lastSequence: batch.lastSequence,
            errors,
            surfaceIds: [...processor.getSurfaces().keys()],
          });
          if (errors.length)
            reportError(
              "Core reported processing errors",
              "CORE_ERROR",
              errors,
            );
        } else if (message.type === "configure") {
          const change = z
            .object({
              locale: runConfigSchema.shape.locale.optional(),
              theme: runConfigSchema.shape.theme.optional(),
              themeTokens: runConfigSchema.shape.themeTokens,
              componentAppearances: runConfigSchema.shape.componentAppearances,
            })
            .strict()
            .parse(message.config);
          config = {
            ...config,
            ...Object.fromEntries(
              Object.entries(change).filter(([, value]) => value !== undefined),
            ),
          };
          setLocale(config.locale, false);
          document.documentElement.dataset.theme = config.theme;
          notify();
        } else if (message.type === "select") {
          selected =
            message.surfaceIds === undefined
              ? undefined
              : new Set(
                  z.array(z.string()).max(1000).parse(message.surfaceIds),
                );
          notify();
        } else if (message.type === "dispose") {
          cleanup();
          port?.close();
        }
      })
      .catch((error) =>
        post("error", {
          code: "HOST_COMMAND_ERROR",
          message: String(error),
          ...(typeof incoming.data?.batch?.batchId === "string"
            ? { batchId: incoming.data.batch.batchId }
            : {}),
        }),
      );
  };
  port.start();
});
new ResizeObserver(() =>
  post("resize", { height: document.getElementById("root")!.scrollHeight }),
).observe(document.getElementById("root")!);
addEventListener("pagehide", cleanup, { once: true });
for (const origin of parents) ready(origin);
