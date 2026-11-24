import {
  EMBED_PROTOCOL,
  batchSchema,
  hostConfigSchema,
  type UiInput,
  type UiBatch,
  type Json,
} from "../../../packages/agent-ui/src/protocol";
import type { ComponentEntry } from "../../../packages/catalog/src/index";
import type { Message, RunConfig } from "../../../packages/protocol/src/index";

export interface LibrarySnapshot {
  messages: Message[];
  config: RunConfig;
  entry?: ComponentEntry;
  template?: boolean;
  intervalMs: number;
  batches?: UiBatch[];
}
export function libraryExport(snapshot: LibrarySnapshot) {
  const inputs: UiInput[] = snapshot.messages.map((message, index) => {
    const body = message.createSurface as
      | {
          surfaceId: string;
          dataModel: { view: Record<string, Json>; ready: boolean };
        }
      | undefined;
    if (
      index === 0 &&
      snapshot.template &&
      snapshot.entry &&
      body?.dataModel?.view
    )
      return {
        type: "template.create",
        id: body.surfaceId,
        template: snapshot.entry.key,
        templateVersion: snapshot.entry.version,
        data: body.dataModel.view,
        lifecycle: {
          renderPolicy: snapshot.config.renderPolicy,
          ready: body.dataModel.ready,
        },
      };
    return { type: "a2ui", messages: [message] };
  });
  const batches =
    snapshot.batches ??
    inputs.map((input, index) =>
      batchSchema.parse({
        protocol: EMBED_PROTOCOL,
        runId: "run_001",
        batchId: `batch_${index + 1}`,
        firstSequence: index + 1,
        inputs: [input],
      }),
    );
  const config = hostConfigSchema.parse({
    ...snapshot.config,
    actionHandler: "external",
  });
  const document = { config, intervalMs: snapshot.intervalMs, batches };
  const server = `import { readFile, writeFile } from "node:fs/promises";
import { AgentUiAdapter } from "@aap/agent-ui/server";
import { hostManifestSchema, batchSchema, hostConfigSchema } from "@aap/agent-ui/protocol";

// Copy the matching static Host release and approved plugin assets separately.
const manifest = hostManifestSchema.parse(JSON.parse(await readFile("./release/manifest.json", "utf8")));
const input = JSON.parse(await readFile("./ui-input.json", "utf8")) as {config: unknown; intervalMs: number; batches: unknown[]};
const batches = input.batches.map(batch => batchSchema.parse(batch));
const adapter = new AgentUiAdapter(batches[0]?.runId ?? "run_001", manifest.entries);
try {
  const normalized = batches.map(batch => adapter.apply(batch));
  await writeFile("./normalized.json", JSON.stringify({config: hostConfigSchema.parse(input.config), intervalMs: input.intervalMs, batches: normalized}, null, 2));
  // For live Agents, keep this adapter for the run and send each compiled batch
  // through your own HTTP/SSE transport. Feed backend-confirmed Action results
  // through adapter.apply with the next input sequence and a fresh batchId.
} finally { adapter.dispose(); }
`;
  const react = `import { useEffect, useState } from "react";
import { AgentUiClient, AgentUiHost, AgentUiProvider } from "@aap/agent-ui/react";
import { hostManifestSchema, hostConfigSchema, normalizedBatchSchema, type ActionEvent, type NormalizedBatch } from "@aap/agent-ui/protocol";
import release from "./release/manifest.json";
import prepared from "./normalized.json";

const manifest = hostManifestSchema.parse(release);
const config = hostConfigSchema.parse(prepared.config);
const batches = normalizedBatchSchema.array().parse(prepared.batches);
export function AgentUiExample({hostUrl, onAction}: {hostUrl: string; onAction: (event: ActionEvent) => Promise<NormalizedBatch[]>}) {
  const [client, setClient] = useState<AgentUiClient | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const next = new AgentUiClient(batches[0]?.runId ?? "run_001", event => {
      void onAction(event).then(async result => {
        for (const batch of normalizedBatchSchema.array().parse(result)) await next.apply(batch);
      }).catch(failure => setError(String(failure)));
    }, failure => setError(failure.message));
    setClient(next);
    return () => next.dispose();
  }, [onAction]);
  if (!client) return null;
  return <AgentUiProvider client={client}>
    {error && <p role="alert">{error}</p>}
    <AgentUiHost hostUrl={hostUrl} manifest={manifest} config={config} onConnected={() => {
      // Replay full history on every connection; identical batches deduplicate.
      void (async () => { for (const batch of batches) {
        await client.apply(batch);
        if (prepared.intervalMs > 0) await new Promise(resolve => setTimeout(resolve, prepared.intervalMs));
      } })().catch(failure => setError(String(failure)));
    }} />
  </AgentUiProvider>;
}
// hostUrl must use a separate credential-free origin with an exact parent allowlist.
// Supply a stable onAction callback returning the backend normalized batches. Forward the entire ActionEvent to your backend;
// authorize there, then apply its new normalized batches with this run's client.
`;
  return { document, input: JSON.stringify(document, null, 2), server, react };
}
