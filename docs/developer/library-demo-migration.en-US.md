# Migrating an existing chatbot

## Run the two applications side by side

`examples/chatbot-comparison/` contains independent baseline and with-agent-ui applications. They do not import each other. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm builder:image
pnpm chatbot:prepare
npm ci --ignore-scripts --prefix examples/chatbot-comparison/baseline
npm ci --ignore-scripts --prefix examples/chatbot-comparison/with-agent-ui
npm run build --prefix examples/chatbot-comparison/baseline
npm run build --prefix examples/chatbot-comparison/with-agent-ui
pnpm chatbot:demo
```

Open baseline http://localhost:5180 and integration http://localhost:5181; Host is http://127.0.0.1:4183. Ctrl+C stops this demo group. Preparation requires Docker. Prepared directories run outside the repository; see [Deployment](library-deployment.en-US.md).

## Without the library: conventional chatbot

Baseline uses React, Fastify HTTP/SSE, deterministic orchestration, Expense/Finance Agents and in-memory business services. It does not use A2UI. web/UiPanel.tsx handwrites the expense form and heatmap, managing waiting/readiness, comment input, submission lock, errors and results.

Flow: user → /chat → Orchestrator routing → Expense Agent DomainEvent → passthrough Presenter → SSE type:ui → UiPanel dispatching by kind/phase.

Both Agents produce the same domain event. This shows ready, following earlier loading/data events:

```json
{
  "kind": "expense",
  "phase": "ready",
  "surfaceId": "expense_001",
  "data": {
    "reportId": "EXP-001",
    "employee": "张三",
    "department": "销售部",
    "category": "差旅",
    "currency": "CNY",
    "amount": 3200,
    "notes": "上海客户拜访",
    "requireComment": true,
    "items": [
      {
        "date": "2026-11-10",
        "desc": "交通",
        "amount": 1200
      },
      {
        "date": "2026-11-11",
        "desc": "住宿",
        "amount": 2000
      }
    ]
  }
}
```

Baseline places it directly in StreamEvent.payload. The handwritten card displays ready data and sends a custom business Action:

```json
{
  "name": "expense.approve",
  "surfaceId": "expense_001",
  "context": {
    "reportId": "EXP-001",
    "comment": "发票已核对，同意报销",
    "idempotencyKey": "intent_exp001_approve_001"
  }
}
```

The same backend service approves and emits a result DomainEvent. This approach suits a small, application-owned card set; new card types typically add rendering/state/event branches to UiPanel. Existing business services do not need rewriting to adopt the library.

## With the library: exact integration changes

| File / directory | Baseline | Integrated change |
| --- | --- | --- |
| package.json / lock | Standard dependencies | Local .tgz plus Host/deploy commands |
| server/ui/adapter.ts | DomainEvent passthrough and custom Action | Manifest, one AgentUiAdapter/run, DomainEvent → UiInput, full Action validation |
| web/UiPanel.tsx | Handwritten Approval/RiskCard | Client + Provider + Host, connection/replay/receipts, full Action callback |
| release/, vendor/, deploy/, DEPLOYMENT.md | No extra Host | Release artifacts and separate-origin Host deployment |
| server/agents/, orchestrator/, business/ | Domain logic | Identical contents and services |
| server/index.ts, shared/, web/App.tsx, web/api.ts, etc. | Chat transport/shell/types | Identical; outer HTTP/SSE unchanged |

pnpm chatbot:compare computes SHA-256, writes integration-diff.json and rejects undeclared source differences. See COMPARISON.md. Identical files are evidence for this demo, not a universal zero-cost migration or a measured percentage of code saved.

## How Presenter translates the same domain output

| Domain stage | Template mode | Raw mode |
| --- | --- | --- |
| expense loading | Empty template.create, on_complete, ready:false | ExpenseApprovalForm createSurface, /view binding, separate policy |
| expense data | Full patch; ready unchanged | Write /view; ready unchanged |
| expense ready | Full patch plus ready:true | Write /view then /ready=true |
| expense result | Patch service-confirmed result | Write returned data |
| risk ready | Create live finance.risk-heatmap | Create same plugin directly |
| risk update | Raw updateDataModel on /view, deliberately mixed | Same raw update |
| risk result | Template drilldown patch | Raw data update |
| composition | Raw structure regardless of selected input | Create/update/delete two Surfaces |

[Input guide](library-inputs.en-US.md) includes complete batches. The demo resends complete expense data at ready; the guide also demonstrates equivalent empty patch + ready:true. Data arrives after a 250ms demo delay, then ready after another 650ms. These are scheduling intervals, not measured library performance.

Agents may emit UI commands directly, but the trusted backend must govern Catalogs, Schemas, template versions, runs and sequence. Model output is not executable uploaded code.

## Frontend replacement

The shell still collects text/UI events. Integrated UiPanel loads the manifest from VITE_AGENT_UI_HOST_URL, creates a stable run-scoped Client and replays ordered UI history after onConnected. Each payload is already a complete NormalizedBatch; Chat UI does not rebuild trees.

onAction forwards the full event to the existing /actions endpoint. The backend retains the original trace, then converts to the same BusinessAction for the same service. Business success still comes from that service. See [Integration](library-integration.en-US.md) for full React wiring.

The new approach adds Host deployment, manifest/version alignment and artifact management. It provides shared rendering, reusable templates, raw messages and isolated plugins. The application retains text, identity and ordinary business pages.

## Walkthrough and evidence to inspect

1. Query EXP-001 in both. Observe complete data still waiting for ready, then the same employee, 3200 CNY and two items.
2. Comment/approve. Compare custom baseline and complete integrated Action traces; both wait for confirmed results.
3. In a new session arm the next failure, submit, observe error and retry successfully. Inspect idempotencyKey/resultVersion.
4. Query risk. Watch Singapore Market 68→76, then click Japan Credit=42. The backend returns detail with exposure=12400000.
5. Switch Template/Raw and Sandbox/Native. Each switch creates a fresh run with the same release plugins.
6. Run composition: two Surfaces, a real button adding note, another deleting both. This verifies structural capability beyond templates.
7. Switch locale/theme and reload. History recovers, but unsent comments are not guaranteed. Export trace to inspect actual payloads.

## Who provides the HTTP endpoints

These are business application routes in server/index.ts, not library SDK endpoints. Use session.id for :id and reuse equivalents in your own application.

| Method / path | Request / purpose |
| --- | --- |
| GET /api/session?id=... | Get/create session: id/runId/mode/variant |
| GET /api/sessions/:id/events?after=0 | SSE history/increments: id/runId/type/payload |
| POST /api/sessions/:id/chat | {text,runId}; 202 then Agent work |
| POST /api/sessions/:id/actions | {runId,action}; validated service call and SSE result |
| POST /api/sessions/:id/reset | {mode}; fresh run and old-run cleanup |
| POST /api/sessions/:id/fail-next | {}; demo-only next failure |

Automatic SSE reconnect uses Last-Event-ID; explicit offline reconnect uses after. State is in-memory and lost on restart. Intent matching is local and deterministic; there is no real LLM, SSO, database or financial integration.

## If you already use the official SDK

This is different from baseline. Wrap existing official messages in `{type:"a2ui",messages:[...]}` without first converting them to templates. Replace application-specific SDK embedding, isolation/channel plumbing with Adapter + Host/Client, aligning ordering, lifecycle and event envelopes. Add templates incrementally for stable scenarios and retain raw for complex layouts.

Coexistence preserves verified Action capabilities. Check your existing Catalog/components/extensions against current Host support: valid JSON alone does not prove every ecosystem interaction is compatible.

Continue with [Deploying into your project](library-deployment.en-US.md).
