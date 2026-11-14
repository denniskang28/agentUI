# Library architecture and choices

## What you are integrating

`@enterprise/agent-ui` is a locally distributed library for embedding declarative UI in an existing application. It provides a server adapter, React embedding and a public protocol. Playground is the development/build/debug environment; a deployed chatbot does not need its `/api/v1/preview-sessions` API.

These guides describe implementation 0.1.0, rather than proposed APIs in older design documents. Consumers use the public `/server`, `/react` and `/protocol` exports, never repository source or private SDK paths.

Read [Integration](library-integration.en-US.md), [Templates and raw A2UI](library-inputs.en-US.md), [Events and lifecycle](library-events.en-US.md), [Demo migration](library-demo-migration.en-US.md), then [Deployment](library-deployment.en-US.md). Start with Demo migration if you already own a chatbot.

## System architecture

```text
User → existing Chat Web UI → business backend / Orchestrator → domain Agent
                                         ↑                       ↓ data / UiInput
                                         └── AgentUiAdapter (one per run)
                                                     ↓ NormalizedBatch
Chat Web UI ← existing HTTP / SSE / WebSocket ← business backend
    │ AgentUiProvider + AgentUiHost
    ↓ MessageChannel
Separate, credential-free Embedded Host
    ├─ official A2UI Core: Surface / Data Model / bindings
    ├─ official React Renderer + controlled Catalog
    └─ plugins: Native inside Host; Sandbox inside nested opaque iframe
    ↑ Action → Client.onAction → existing business API → business service
    └──────────────── backend result → UI update batch ─────────────┘
```

`runId` isolates a UI execution, `surfaceId` identifies a UI surface inside it, and `batchId` identifies an idempotent ordered submission. None is a user credential.

| Layer | Application responsibilities | Library / Host responsibilities |
| --- | --- | --- |
| Chat Web UI | Conversation, text stream, login, composer, business navigation | Provider, Host iframe, versioned channel, Action delivery |
| Orchestrator | Intent detection, Agent calls, sessions, authorization, routing | Adapter validates and normalizes both inputs |
| Agent | Domain queries, data generation, choosing approved components | Compile convenience commands; preserve raw A2UI messages |
| Business service | Approval, idempotency, persistence, audit, failures | Reflect results through later messages; does not replace services |
| Embedded Host | Release URL, parent-origin allowlist, static distribution | Core, Renderer, Catalog, plugin isolation and display |
| Playground / Builder | Develop, debug, build and prepare releases | Not part of each deployed chat request |

The server Adapter uses official Core to validate history/state. Host Core owns browser interaction state. Do not introduce another UI engine to replace official Surface/Data Model ownership. Keep normal text on your existing text channel; send rich UI events through the library.

## One expense interaction

1. A user requests EXP-001. The orchestrator detects the expense intent and invokes the Expense Agent.
2. Partial data produces `template.create` with `on_complete` and `ready:false`; the Host displays a waiting state.
3. Complete data produces `template.patch` without changing ready; the form still waits.
4. A separate `ready:true` transition allows interaction and displays the form.
5. Commenting and approving emits a complete A2UI Action. The Client forwards the versioned event, including runId/actionId, to the existing backend.
6. The backend checks identity, Surface ownership, report, permission and business idempotency, then invokes the approval service.
7. Success produces `status:"approved"` and a new `resultVersion`; failure produces an error state. A result batch updates the form.

Receiving an Action, committing the business operation, applying a Core message and painting a frame are separate stages. The backend result determines business success.

## Choosing an input

| Situation | Choice | Reason |
| --- | --- | --- |
| Stable approval form or heatmap, changing only data | Convenience template | Supply published component data without repeating bindings/tree |
| Agent already emits valid A2UI | Raw A2UI | Preserve the four commands, catalogs, trees, bindings and events |
| New layout, composition, structural edits, multiple Surfaces | Raw A2UI | Explicit createSurface/updateComponents/updateDataModel/deleteSurface |
| Template first, then precise data edits or independent components | Mixed | Same Adapter, sequence, Host Core and Action channel |
| Developing a new component | Playground + constrained builder | Verify Schema, interaction and both runtime modes before release |

Templates simplify input; they do not reduce Actions to button names. Both paths preserve `name/surfaceId/sourceComponentId/timestamp/context` and supported extension fields. Raw input is not a promise of every ecosystem feature: this release verifies four official wire commands and project Catalog/plugin Actions. Optional function RPC and unverified Catalog interactions are outside that scope.

Template/raw and Native/Sandbox are independent choices. The first controls UI description; the second controls plugin execution. Native still runs inside the separate Host, never the credentialed main page.

## Installation and deployment pieces

Install the `.tgz` in your application. React consumers supply React 19; server-only usage does not require React. Deploy a separate static release containing Host, manifest and Docker-built plugin JS/validator/CSS. Installing the package alone does not create or launch that Host.

Local comparison: baseline `http://localhost:5180`, integrated chatbot `http://localhost:5181`, Host `http://127.0.0.1:4183`. Playground's 5173/4173 environment is separate. Docker is required for preparing plugins, not for ordinary deployed chat execution.

Continue with [Installation through first render](library-integration.en-US.md).
