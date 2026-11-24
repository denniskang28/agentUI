# Actions and run lifecycle

## Complete click payload

Expense is a single root plugin component, so sourceComponentId is root; its action names distinguish approve/reject/requestChanges. A Basic Catalog Button uses its own component ID. A component ID is not a report ID.

Client.onAction receives this shape. Runtime generates actual IDs/timestamps; do not hardcode them:

```json
{
  "protocol": "enterprise-agent-ui/1",
  "runId": "run_expense",
  "actionId": "action_001",
  "message": {
    "version": "1.0",
    "action": {
      "name": "expense.approve",
      "surfaceId": "expense_001",
      "sourceComponentId": "root",
      "timestamp": "2026-11-14T08:00:00.000Z",
      "context": {
        "reportId": "EXP-001",
        "comment": "发票已核对，同意报销",
        "idempotencyKey": "intent_exp001_approve_001"
      }
    }
  }
}
```

Template and raw paths receive the same complete envelope. message contains official Action data; protocol/runId/actionId belong to the embedding bridge. Additional Action fields are retained. Validate and record the complete event before converting it to a smaller business DTO.

## Backend processing

```ts
import { actionEventSchema } from "@aap/agent-ui/protocol";
function readAction(body: unknown, currentRunId: string) {
  const event = actionEventSchema.parse(body);
  if (event.runId !== currentRunId) throw new Error("STALE_RUN");
  return event; // retain the full event for routing / audit
}
```

1. Apply your existing identity and CSRF policy. Session/run/action IDs are not authentication.
2. Validate Schema, current run, Surface ownership, business entity and readiness.
3. Check action allowlist and authorization against server-side state. Client context amounts/roles are not trusted authorization.
4. Check a business idempotency key, execute and persist results, then produce domain events. Apply your privacy policy to audit data such as comments.
5. Compile result UI through the Presenter and return it through the existing stream. Failures must produce a visible result rather than leaving the UI pending forever.

The demo Presenter validates the full event; its Orchestrator checks Surface/readiness and invokes a local service using a fixed demo-approver identity. Production identity, durable audit and authorization remain application responsibilities.

## actionId versus business idempotency

actionId identifies one bridge event for logging/transport deduplication, not exactly-once business execution. Retrying or clicking after reload may create a new Action. Use context.idempotencyKey to represent the same report/action/comment intent.

The demo plugin retains an intent key for unchanged action/report/comment and locks submission while pending. The service caches successful results: same key/content returns the original result; changed content with the same key fails. Simulated failures are not cached as success, so the same intent can retry. Production needs transactional persistent idempotency, not only disabled buttons.

A failed result `{status:"error",resultVersion:1}` releases pending state. A later success `{status:"approved",resultVersion:2}` updates the form. resultVersion also lets repeated errors reset local component state; it is a component business convention, not a wire command.

## Raw Button event bindings

The [raw example](library-inputs.en-US.md) uses action.event.name and a context value bound with `{"@path":"/reportId"}`. The official Renderer resolves it on click and emits name/surfaceId/sourceComponentId/timestamp/context. Plugin dispatch is normalized into the same route.

A business Action normally causes a backend result and Data Model update. Local editing is not automatically a durable save. Plugins may keep local draft input; this release does not persist unsubmitted expense comments in server history, so reload/Host recreation can lose them.

## Three protocol layers

| Layer | Examples | Responsibility |
| --- | --- | --- |
| Application HTTP / SSE | /api/sessions/:id/events; ui/trace/reset | Your transport, recovery and routing |
| Library input/output | UiBatch.inputs → NormalizedBatch.messages/componentPolicies | Compile, order, deduplicate and isolate runs |
| Official A2UI | version:1.0, four wire commands, message.action | Surface, Data Model, bindings and interaction |

Demo endpoints are implemented by its backend, not auto-registered by the library. Playground /api/v1 is a separate development service. Its Preview API counts wire messages; the library counts inputs. Never share these counters.

## Ordering, retries and receipts

- One input occupies one sequence. One raw input may contain multiple messages; one template patch may generate many messages or none.
- Next firstSequence is lastSequence+1. Same ID/content returns replay:true; changed content throws BATCH_CONFLICT; sequence gaps throw SEQUENCE_CONFLICT.
- The Adapter trial-replays bounded history through official Core before committing. Validation failures do not advance input sequence. Server validation is not a transactional rollback guarantee for all browser plugin execution.
- Adapter output acknowledges server processing. Client.apply resolves with HostReceipt after Host Core processing; inspect errors. Asynchronous plugin errors may arrive later through onError.
- HTTP 202 only acknowledges application acceptance. ACK is not physical paint; do not report it as measured render performance.

## Reconnection and recovery

Retain ordered inputs or compiled results for the current run. On Host connection, replay current-run UI history; Client/Host deduplicate identical batches. Application SSE clients deduplicate event IDs and supply a recovery cursor. A reloaded Host needs creation, data and ready history, not just the newest patch.

For server recovery, persist adapter.snapshot(), construct a new Adapter with the same runId/manifest, then apply snapshot.batches in order. Derive the next sequence from receipts. Persistence is explicit application work. AgentUiClient has no snapshot API; supply business history again.

The demo is in-memory, retaining at most 5000 outer events/session and 100 sessions/process. Limits fail explicitly with SESSION_LIMIT / DEMO_SESSION_LIMIT; history is not silently evicted. Invalid cursors fail with INVALID_CURSOR. Your application defines lost/expired-history recovery. Backend restart loses sessions/business state. Production requires its own durable history, retention and recovery strategy.

## Reset, runtime, locale and theme

Reset, new conversation, demo template/raw switching and Native/Sandbox switching create a new run, dispose the old Presenter/Adapter, remount Host/client and reject stale batches/Actions. Template/raw switching resets only to keep demo comparisons consistent; both inputs can coexist in one business run.

Update locale/theme through config or client.configure without recreating components. Do not translate machine action names, field names or user business content. client.select(surfaceIds) / Host.surfaceIds filters visibility within one runtime; it does not create another Core.

## Timeouts, capacity and errors

| Condition | Current behavior / response |
| --- | --- |
| iframe not ready | HOST_LOAD_TIMEOUT after 15s; check URL, CSP, allowed parent origin, network |
| initialization not connected | HOST_CONNECT_TIMEOUT after 15s; check Host/manifest/errors |
| missing batch ACK | HOST_ACK_TIMEOUT after 15s; reconnect/retry original ID, do not skip sequence |
| Host unmount | detach closes MessagePort, clears pending tasks with HOST_DETACHED |
| reuse disposed Client | Create a new Client; use Host detach behavior for StrictMode cleanup |
| missing/wrong template version | UNKNOWN_TEMPLATE / TEMPLATE_VERSION; use matching manifest |
| invalid business data | INVALID_TEMPLATE_DATA; inspect Schema/details |
| invalid raw messages | INVALID_MESSAGES; inspect official Core errors |
| changed template structure | TEMPLATE_BINDING_CHANGED; continue raw or recreate template |
| capacity exceeded | 2,000,000 UTF-8 bytes/batch, 1000 batches and 5000 generated messages/run; reject explicitly |

Validation replays bounded history, so cost grows with history. This release does not claim unlimited sessions or unmeasured throughput. Display loading/errors/retry clearly; a policy timeout is not automatic business approval/cancellation.

Continue with [Demo migration](library-demo-migration.en-US.md).
