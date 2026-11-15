# Installation through first render

## Step 1: obtain release artifacts

Start with the [demo preparation flow](library-deployment.en-US.md). Deliver the built `.tgz` and complete `release/` to your chatbot project, rather than copying plugin TSX. In the consumer project:

```sh
npm install ./vendor/enterprise-agent-ui-0.2.0.tgz
```

Frontend consumers supply React 19. The reference demo uses Node 24, ESM and strict TypeScript. This delivery is local, not a public registry publication; do not assume a bare registry install retrieves it. Separate frontend/backend projects each install the package; a server needs only `/server` and `/protocol`.

## Step 2: add a server UI presenter

Keep intent detection and Agent calls. An Agent may return UiInput directly or keep returning domain data for a Presenter to translate. The demo uses the latter, keeping both applications' Agents identical.

This executable Node/TypeScript example needs a prepared `release/manifest.json` in its working directory. It generates a first batch without starting HTTP. Run with your existing TS runner or compile to ESM.

```ts
import { readFile } from "node:fs/promises";
import { AgentUiAdapter, EMBED_PROTOCOL } from "@enterprise/agent-ui/server";
import { hostManifestSchema, type UiInput } from "@enterprise/agent-ui/protocol";

const manifest = hostManifestSchema.parse(
  JSON.parse(await readFile("./release/manifest.json", "utf8")),
);
const runId = "run_001";
const adapter = new AgentUiAdapter(runId, manifest.entries);
let nextSequence = 1;

function present(batchId: string, inputs: UiInput[]) {
  const batch = adapter.apply({
    protocol: EMBED_PROTOCOL, runId, batchId,
    firstSequence: nextSequence, inputs,
  });
  nextSequence = batch.lastSequence + 1;
  return batch;
}

const text = manifest.entries.find((entry) => entry.key === "text");
if (!text) throw new Error("TEXT_NOT_INSTALLED");
const firstBatch = present("batch_1", [{
  type: "template.create", id: "summary_001",
  template: text.key, templateVersion: text.version,
  data: { text: "Hello from Agent" },
}]);
console.log(JSON.stringify(firstBatch));
// adapter.dispose() only when this run ends.
```

`present()` submits new batches. Advance the sequence only on success. For a retry, retain and resubmit the original UiBatch with its original `firstSequence` and `batchId`; do not repackage it using the current nextSequence.

Keep one Adapter per run, not one per message. Resolve template versions from the validated release manifest. `template` means `entry.key`, not a Playground REST scenario templateId. Expense plugins do not appear in the default built-in entries unless installed.

## Step 3: keep your transport

Send the complete returned batch through existing HTTP/SSE/WebSocket. Preserve `componentPolicies`, ordering and run metadata as well as `messages`. The Adapter does not create an HTTP endpoint.

The demo's outer business event has this shape:

```json
{
  "id": 1,
  "runId": "run_001",
  "type": "ui",
  "payload": {
    "batchId": "batch_1",
    "runId": "run_001",
    "firstSequence": 1,
    "lastSequence": 1,
    "messageCount": 1,
    "messages": [
      {
        "version": "1.0",
        "createSurface": {
          "surfaceId": "summary_001",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "components": [
            {
              "id": "root",
              "component": "Text",
              "text": {
                "@path": "/view/text"
              },
              "variant": "body"
            }
          ],
          "dataModel": {
            "view": {
              "text": "Hello from Agent",
              "variant": "body"
            },
            "ready": true,
            "input": "",
            "checked": false,
            "choices": []
          }
        }
      }
    ],
    "componentPolicies": {
      "summary_001": {
        "root": {
          "renderPolicy": "progressive",
          "readyWhen": "/ready"
        }
      }
    },
    "replay": false
  }
}
```

Outer `id` is the business SSE cursor. `firstSequence/lastSequence` count library inputs; `messageCount` counts generated wire messages. They are separate counters. The Text example includes its current defaults; send actual Adapter output instead of building normalized payloads manually.

## Step 4: load the Host manifest

Server and frontend must use the same release manifest. Fetch and validate it without credentials:

```ts
import { hostManifestSchema } from "@enterprise/agent-ui/protocol";
const hostUrl = "http://127.0.0.1:4183";
const response = await fetch(`${hostUrl}/manifest.json`, { credentials: "omit" });
if (!response.ok) throw new Error(`MANIFEST_HTTP_${response.status}`);
const manifest = hostManifestSchema.parse(await response.json());
```

See [Deployment](library-deployment.en-US.md) for serving the Host/manifest/assets. Host URL must have a separate origin. Its styles are self-contained; do not import plugin CSS or JS into the main application.

## Step 5: replace rich UI rendering

This component embeds the Host and replays retained current-run batches. Its owner supplies `records` containing only UI events for that run, ordered by event ID. Text and trace stay in the existing shell. Your application owns HTTP/SSE.

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AgentUiClient, AgentUiHost, AgentUiProvider } from "@enterprise/agent-ui/react";
import { normalizedBatchSchema, type ActionEvent, type HostManifest } from "@enterprise/agent-ui/protocol";

type UiRecord = { id: number; payload: unknown };
type Props = {
  runId: string;
  hostUrl: string;
  manifest: HostManifest;
  records: UiRecord[]; // retained UI batches for this run, sorted by event ID
  onAction: (event: ActionEvent) => Promise<void>;
  onError: (error: unknown) => void;
};
export function ChatRichUi(props: Props) {
  const { runId, hostUrl, manifest, records } = props;
  const callbacks = useRef(props);
  callbacks.current = props;
  const [connection, setConnection] = useState(0);
  const applied = useRef(0);
  const client = useMemo(() => new AgentUiClient(
    runId,
    (event) => { void callbacks.current.onAction(event).catch(callbacks.current.onError); },
    (error) => callbacks.current.onError(error),
  ), [runId]);

  useEffect(() => {
    if (!connection) return;
    let active = true;
    void (async () => {
      for (const record of records) {
        if (!active || record.id <= applied.current) continue;
        const receipt = await client.apply(normalizedBatchSchema.parse(record.payload));
        if (!active) return;
        applied.current = record.id;
        if (receipt.errors.length) callbacks.current.onError(receipt.errors);
      }
    })().catch((error) => { if (active) callbacks.current.onError(error); });
    return () => { active = false; };
  }, [client, records, connection]);

  return <AgentUiProvider client={client}>
    <AgentUiHost hostUrl={hostUrl} manifest={manifest}
      config={{ locale: "zh-CN", theme: "light", runtimeMode: "sandbox", container: "chat" }}
      onConnected={() => { applied.current = 0; setConnection((n) => n + 1); }} />
  </AgentUiProvider>;
}
// Mount as <ChatRichUi key={runId} ... />. Change the key/client on run reset.
```

Replay retained history on every connection, including Host reload. The Client serializes sends and deduplicates identical batches. An old async loop may already have submitted a batch when records change; deduplication handles resubmission. Advance the application cursor after receipt.

Mount with runId as the React key. Runtime/manifest upgrades also need a fresh Host/client and an explicit replay/reset decision. A Client connects one Host; that Host can render multiple Surfaces. Do not create independent runtimes for each message of a shared run.

Do not permanently dispose and then reuse a Client in StrictMode-replayed cleanup. Host unmount already detaches the channel/pending work. A non-React owner can call `client.dispose()` when the run actually ends. Apply only after connection; handle both `onError` and `receipt.errors`.

## Step 6: forward complete Actions

`onAction(event)` receives a complete ActionEvent. This callback uses the demo's own business endpoint, not an HTTP API supplied by the library:

```ts
import type { ActionEvent } from "@enterprise/agent-ui/protocol";
async function onAction(event: ActionEvent) {
  const sessionId = "your-current-session-id";
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/actions`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId: event.runId, action: event }),
  });
  if (!response.ok) throw new Error(await response.text());
}
```

Supply the actual session and your identity/CSRF/error handling. The backend parses `actionEventSchema`, checks current run, Surface ownership and authorization, then routes through the Orchestrator to the business service. Results return through the Presenter. See [Events and retries](library-events.en-US.md).

## Public entry points

| Export | Main public APIs | Location |
| --- | --- | --- |
| `/server` | AgentUiAdapter, createHostManifest, builtins, instantiate, validateMessages, AgentUiError | Trusted backend; never execute uploaded code in the main page |
| `/protocol` | UiInput/UiBatch/ActionEvent and batch/normalizedBatch/actionEvent/hostManifest schemas | Runtime validation at transport boundaries |
| `/react` | AgentUiClient, AgentUiProvider, AgentUiHost | Existing React application |

Verify actual Host connection, visible Text, a subsequent patch, a real button Action reaching the backend, result rendering and rejection of old-run events after reset. HTTP acceptance alone does not verify that loop.

## Client and Host details

| API | Purpose / constraint |
| --- | --- |
| new AgentUiClient(runId, onAction?, onError?) | One run's connection/queue; callbacks are synchronous, so catch asynchronous business errors yourself |
| client.apply(batch) | NormalizedBatch → Promise<HostReceipt>, after Host connected |
| client.configure({locale,theme}) | Only these two live settings; not runtimeMode switching |
| client.select(surfaceIds?) | Filter visible Surfaces; omit to remove the filter |
| client.subscribe(listener) | Bridge diagnostics; returns unsubscribe, not a replacement for business Action validation |
| client.detach() | Reconnectable cleanup, normally managed by Host |
| client.dispose() | Permanently close; create a new object to resume |
| adapter.getSurfaceData(surfaceId) | Cloned server Core state, not synchronized unsubmitted browser input |
| adapter.snapshot() / dispose() | Explicit application persistence / end-of-run cleanup |

Provider accepts client/children. Host props are hostUrl, manifest, config, surfaceIds, title and onConnected. title is the iframe accessibility name, not a card title. Host resize reports set height within 32–10000px.

config is Partial<RunConfig>: runtimeMode native/sandbox; theme light/dark; locale zh-CN/en-US; container card/chat/workspace. renderPolicy, readyWhen and readyTimeoutMs configure global policies. componentPolicies supplies per-Surface/component renderPolicy, readyWhen, initialReadyWhen and timeoutMs. Batch policies travel to Host; templates normally generate them for you.

Shared RunConfig also contains actionHandler, latency and outcome. Embedded Host defaults to external: route real operations to the business backend, rather than treating Playground simulation settings as an approval service. Live configure updates only locale/theme; other settings, manifest or runtime changes require a new Host/client. Low-level client.attach connects a MessagePort; ordinary React integration lets Host own it rather than attaching another port.
