# Agent Quickstart

This quickstart covers Playground development preview APIs. To embed the deployable library in your own chatbot, start with [Library architecture](library-overview.en-US.md) and [Integration](library-integration.en-US.md).

The platform accepts A2UI v1.0 JSON, JSON arrays and JSONL. The official Core and React renderer process messages. HTTP sessions, sequence numbers, templates, render policies and the Plugin SDK are project APIs.

## Start the local services

Install Node.js 24+, pnpm 10.32.1, Python 3 and Docker. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm builder:image
pnpm demos:package
pnpm dev
```

Open http://localhost:5173. Preview Host runs at http://127.0.0.1:4173. Use http://localhost:5173/api/v1 for API calls. To use demo plugins, select Install demo plugins on the Plugins page. This uploads real ZIP files and compiles them with Docker.

## Run complete examples

Each client implements full response, progressive updates and a real user Action followed by an Agent update. Run one command at a time and open the printed previewUrl. For action, click the Chinese business label 生成报告 in the preview.

```sh
python3 examples/agent.py --scenario full
python3 examples/agent.py --scenario progressive
python3 examples/agent.py --scenario action

node examples/agent.ts --scenario full
node examples/agent.ts --scenario progressive
node examples/agent.ts --scenario action

bash examples/agent.sh full
bash examples/agent.sh progressive
bash examples/agent.sh action
```

Python and TypeScript accept --locale en-US. Set AGENT_UI_LOCALE=en-US for the cURL client. Switching the platform language does not translate Agent business data.

## Connect your Agent

1. GET /components to discover component keys and templateIds. Newly installed plugins appear through the same API.
2. POST /templates/{templateId}/instantiate with values and an optional surfaceId. The response includes validated messages and scenario configuration.
3. POST /preview-sessions with actionHandler=external and preview configuration. Open the returned previewUrl.
4. Poll the session or subscribe to events. Wait for preview.connected before submitting.
5. POST to the session's /messages endpoint with a unique batchId, current runId, contiguous firstSequence and original A2UI messages.
6. Wait for message.applied, monitor run.error and inspect lastAppliedSequence. The sequence is the highest Core-processed acknowledgement, including failed processing; plugin errors may arrive later. HTTP 202 means accepted, not painted.
7. Receive SSE ui.action or poll GET /actions?after=0. Keep the opaque cursor and return it unchanged next time. Deduplicate by actionId and check runId.
8. Convert your business result into updateDataModel messages and submit the next batch. DELETE the session when finished.

## Messages and platform configuration

```json
{
  "actionHandler": "external",
  "preview": {
    "runtimeMode": "sandbox",
    "locale": "en-US",
    "container": "card",
    "componentPolicies": {
      "approval": {
        "form": { "renderPolicy": "on_complete", "readyWhen": "/complete", "timeoutMs": 15000 }
      }
    }
  }
}
```

componentPolicies addresses each Surface ID and Component ID. readyWhen is a JSON Pointer to a boolean in that Surface's Data Model. on_complete waits for both ready=true and valid business data. live waits for initial readiness, then keeps updating. progressive can display valid partial data as it arrives. Configuration is separate from A2UI wire commands and business data.

To combine catalogs in one Surface, set a default Surface catalogId and specify catalogId on components from other catalogs. Use actual identifiers returned by discovery.

## Troubleshooting and lifecycle

PREVIEW_NOT_CONNECTED: open previewUrl and wait for connection. INVALID_MESSAGES: inspect official diagnostics from /messages/validate. INVALID_TEMPLATE_VALUES: check inputSchema from discovery. SEQUENCE_CONFLICT: query lastReceivedSequence before choosing the next number.

Retry the same request with the same batchId. Reusing an ID for different content conflicts. Reset and mode switching create a new runId and reject old results. Every batch after a reset must include the current runId. Mode switching replays received messages; ordinary Reset clears messages and component instances.

Sessions expire after one hour by default. A preview without a heartbeat for 15 seconds is considered disconnected. API restart loses sessions; installed plugins can reload from the local Registry. Examples retain their sessions for inspection; DELETE /preview-sessions/{sessionId} cleans them up.
