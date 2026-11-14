# API Reference

Base URL: http://localhost:5173/api/v1. Direct API access is available at http://127.0.0.1:3001/api/v1. Use application/json for ordinary requests and responses, text/event-stream for SSE, and multipart/form-data for uploads.

OpenAPI 3.1: GET /openapi.json. Request validators are shared with the server; response and SSE event schemas describe the implemented contract. The self-contained OpenAPI message schemas come from the official SDK’s public Zod exports. Unmodified official wire schema: GET /schemas/agent-to-renderer.json. Catalog documents: GET /catalogs or GET /catalogs/{URL-encoded catalogId}.

## Discovery and templates

GET /components returns a components array with key, component, catalogId, protocolVersion, version, source, availability, supportedRenderPolicies, defaultRenderPolicy, defaults, fields, schema, wireSchema, inputSchema, actions and templateIds. A plugin schema describes resolved business data; wireSchema describes A2UI component properties and dynamic bindings. catalogSchemaUrl identifies the complete catalog document and definitions.

GET /components/{componentKey} reads one component. GET /templates/{templateId} reads its default input, message sequence and render policy. POST /templates/{templateId}/instantiate accepts partial values and an optional surfaceId. The platform merges defaults, validates input and generates messages.

```json
{ "values": { "text": "Hello from Agent" }, "surfaceId": "report" }
```

POST /messages/validate accepts exactly one of messages (1–1000 objects) or a nonempty text string, plus optional prior (up to 5000 message objects). Unknown top-level fields, null and ambiguous bodies return 400. text accepts one JSON message, an array or JSONL. The result contains valid and errors. HTTP 200 with valid=false reports a protocol/catalog failure; malformed request JSON or parameters return 400. This validates official wire format, catalogs and message references/order. Resolved business data is also checked at the Preview component boundary. JSONL syntax errors report original line numbers.

Syntax parsing failures return HTTP 400 with stable JSON_SYNTAX / JSONL_SYNTAX codes. details contains one-based line and column, zero-based offset (JavaScript UTF-16 positions), and the original diagnostic. MESSAGE_TOO_LARGE, MESSAGE_COUNT and MESSAGE_OBJECT identify invalid input size, message count and object type. The UI localizes the summary while preserving diagnostic details and machine fields.

## Create and inspect sessions

POST /preview-sessions accepts actionHandler (external by default, or mock) and preview. preview supports runtimeMode, container, locale, theme, renderPolicy, readyWhen, readyTimeoutMs and componentPolicies. Omitted fields use platform defaults. Supported locales are zh-CN and en-US; the API defaults to zh-CN. Defaults: runtimeMode=sandbox, container=card, theme=light, renderPolicy=progressive and readyWhen=/ready. readyTimeoutMs is optional (the Runtime uses 15 seconds when omitted); explicit values must be integers from 100 to 120000 ms. componentPolicies maps Surface IDs to component IDs and rules with renderPolicy, optional readyWhen/initialReadyWhen and timeoutMs. Unknown request/configuration fields return 400.

The response contains sessionId, runId, previewUrl, expiresAt, status, lastReceivedSequence, lastAppliedSequence and config. GET /preview-sessions/{sessionId} returns current state. Open previewUrl and wait for connected before submitting.

## Submit messages

```json
{
  "batchId": "batch-001",
  "runId": "current identifier returned by the session",
  "firstSequence": 1,
  "messages": [
    {
      "version": "1.0",
      "createSurface": {
        "surfaceId": "hello",
        "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
        "components": [{ "id": "root", "component": "Text", "text": { "@path": "/title" } }],
        "dataModel": { "title": "Hello from Agent" }
      }
    }
  ]
}
```

POST /preview-sessions/{sessionId}/messages returns 202 with batchId, runId, firstSequence, lastSequence and status=accepted. Each message consumes one sequence number. Start the next batch at lastSequence+1. Retry the same parsed JSON request using the same batchId. Object key order and whitespace do not matter; array order and the presence/value of fields, including runId, do matter. Different content with an existing ID returns BATCH_CONFLICT.

An initial run accepts an omitted runId for compatibility; always include it. After reset, omission returns RUN_ID_REQUIRED and a previous ID returns STALE_RUN. The whole batch is validated before queuing. Runtime component errors do not provide transactional rollback.

Request bodies are limited to 2 MB, each batch to 1–1000 messages, and each run’s received history to 5000 messages (Reset starts a new history). Compressed uploads are limited to 5 MB. Default session TTL is one hour; events and Actions each retain the latest 500 entries. A preview without a heartbeat for 15 seconds is disconnected. TTL is absolute from creation and is not extended by heartbeats. At expiry the server emits session.destroyed with reason=expired, closes existing SSE connections and frees session data without requiring another request. Expired IDs return SESSION_EXPIRED / 410 for one hour after cleanup, then SESSION_NOT_FOUND / 404. Explicitly destroyed or unknown IDs return 404. Sessions do not survive API restart.

## SSE and Action polling

GET /preview-sessions/{sessionId}/events?after=0 opens SSE. Resume with Last-Event-ID, or after as a fallback. SSE event IDs are increasing integers. after=0 requests the retained window, not a guarantee of the complete session history; a nonzero cursor older than that window returns 410. A future or malformed cursor returns 400. Server keepalive comments are not events.

Each event has id, type, runId, timestamp and payload. Types include preview.connected, messages.queued, message.applied, run.error, ui.action, run.reset and session.destroyed.

GET /preview-sessions/{sessionId}/actions?after=0 returns actions, cursor and runId. Return cursor unchanged as after on the next request. This cursor is independent of SSE IDs: do not parse it, increment it or reuse it for another session. Expired cursors return 410; malformed or cross-session cursors return 400.

The ui.action payload contains actionId, actionHandler and action. The normalized message at payload.action has version=1.0 and action fields name, surfaceId, sourceComponentId, timestamp and context. Platform metadata is separate from the business Data Model.

Deduplicate actionId and check event.runId before processing. Delivery can be at least once. external does not also execute Mock Rules; mock uses local rules to produce follow-up data. message.applied confirms Core processing without reported Core errors, not completed plugin paint. lastAppliedSequence is the highest acknowledged/processed sequence, including an ACK that reported errors; it is not a count of successful renders. run.error carries sequence and errors for Core or later plugin load/render/bridge failures; asynchronous plugin errors do not advance the acknowledged sequence. Inspect both events and session state before recovery. Replace a failed component with updateComponents, fix its data with updateDataModel, or reset the run; resending an accepted batchId only returns its original receipt and does not rerun it.

## Reset and destroy

DELETE /preview-sessions/{sessionId} returns 204, destroys the session and notifies connected previews. The preview page uses internal connect, heartbeat, ack, action, error and reset routes for its bridge. Agents should not fabricate these receipts.

Playground Reset clears a run. Mode switching creates a new runId and replays the same received messages. Late Actions/results are rejected by runId. Refresh reconnects and restores received history. API restart requires a new session.

## Uploads and errors

GET /plugins returns plugins and builds. POST /plugins uploads file. A TSX upload also supplies metadata as a JSON string containing manifest and catalog; a ZIP includes plugin.json and catalog.json. DELETE /plugins/{pluginId} uninstalls a plugin.

TSX metadata must contain a valid strict manifest and catalog descriptor; malformed metadata returns 400 / INVALID_METADATA. Invalid ZIP JSON, catalog data/defaults or JSON Schema return structured 422 errors; the build remains failed and no partial plugin is installed. See the Plugin Developer Guide for descriptor fields and limits.

Errors contain code, message and requestId. Applicable errors add details: request issues, template/schema errors, batch firstSequence/runId, or JSON/JSONL source positions. These machine fields and original diagnostic text are not translated. Common statuses: 400 invalid parameters/cursor; 404 missing component/template/session; 409 connection, batch, sequence or run conflict; 410 expired session/cursor; 413 size limit; 415 file type; 422 wire/business schema or build failure; 503 unavailable Docker builder; 504 isolated-build timeout.

An unknown component type within a known Catalog displays a component placeholder while other components keep updating and responding to input. A later updateComponents can replace it with a supported type. This placeholder is a platform rendering adapter, not another A2UI command or discoverable component. Original messages, business data and exports stay intact; the Inspector tree shows the resolved rendering state. Unknown Catalogs, invalid properties on known components and invalid IDs still report official Core errors.

The API listens locally without production authentication. Only fixed main/Preview Host origins are allowed. Opaque Sandbox frames may read artifacts, but cannot call session APIs.
