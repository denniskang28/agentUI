# A2UI compatibility and implementation evidence

Verified locally on 2026-11-14. Package versions are pinned in `package.json` and `pnpm-lock.yaml`.

| Layer | Actual installed API | Decision |
|---|---|---|
| Wire | A2UI `version: "1.0"` | `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`; bindings use `@path`, data patches use `value` |
| Core | `@a2ui/web_core@0.15.0`, public `@a2ui/web_core/v1_0` export | `MessageProcessor`, `processMessagesWithErrors`, `getSurfaces`, `SurfaceModel.dataModel` own runtime state |
| React | `@a2ui/react@0.15.0`, public root export | `A2uiSurface` and `createComponentImplementation` work with the v1.0 Core's shared Surface/Node interfaces despite type references to v0_9 |
| Basic catalog | v1.0 `basicCatalog` | Preserve official schemas and catalog identity. Supply project React views for the gallery components; retain official implementations for other Basic entries |
| Enterprise catalog | `urn:enterprise:agent-ui:catalog:1` | Project-defined KPI/DataTable/Chart. This catalog and project Plugin SDK are not official A2UI APIs |

The processor option uses `version: "1.0"`, not a guessed `"v1.0"`. React's generic binder resolves an Action into a callable closure; the Button view invokes that closure. It must not pass the closure back to `dispatchAction` as though it were an object. Component-created plugin Actions use `context.dispatchAction({event:{name,context}})`.

`dataModel.subscribe` and the official React Node resolver keep input and component instances stable across patches. `renderPolicy`, `readyWhen`, locale, runtime mode, playback sequence, session IDs and HTTP batch IDs belong to the platform configuration. They are not extra wire commands.

Plugin `dataSchema` describes resolved business data; its component wire schema declares a dynamic `data` property so an Agent can bind `{"@path":"/view"}`. JSON Schema validators are generated server-side with pinned Ajv and bundled into plain ESM. Preview Host imports those modules under CSP without `unsafe-eval`; the browser does not compile an uploaded schema at runtime.

Verified unknown-type behavior: Core's default validation accepts a component type absent from a known Catalog, while the official React renderer returns no content for that node. The platform Preview adapter maps only such nodes to an inert placeholder implementation in `urn:enterprise:agent-ui:render-fallback:1`, then processes it through the same official Core/Renderer. This internal Catalog is not advertised to Agents. Raw messages remain unchanged; missing Catalogs and invalid known schemas are not converted into placeholders. Native/Sandbox plugin loading is unaffected. Official v1.0 permits a Surface with no default Catalog, in which case each component must name its Catalog; the adapter does not invent a default.

Core's DataModel takes ownership of assigned objects. Validation and Preview clone message inputs before processing, preserving the original initial snapshot when later patches change it. Evidence includes `tests/unit/fallback.test.ts`, `tests/e2e/unknown-components.spec.ts` and `tests/e2e/recovery-lifecycle.spec.ts`.

Evidence: `tests/unit/protocol.test.ts`, `tests/e2e/foundation.spec.ts`, `tests/e2e/plugins.spec.ts`, `tests/e2e/external-agent.spec.ts`. Initial foundation run passed four browser tests; subsequent plugin/CSP regression results are recorded in `handoff-progress.md`. These tests exercise real package exports, rendered DOM, data binding and Actions.

Outside the verified MVP scope: optional renderer/agent function RPC and complete standard-catalog interaction coverage beyond the gallery. These are not claimed supported merely because the upstream package exports types. The implemented recovery, replay, partial-data policies and failure boundaries have passed the tests listed in the acceptance report. The `@a2ui/markdown-it@0.2.2` transitive peer range reports a 0.14 Core peer mismatch; the current gallery Text view uses plain text and does not depend on that renderer.

Primary references inspected: [official client integration guide](https://a2ui.org/guides/client-integration/) and installed public declarations/implementation. The actual npm exports and browser tests take precedence over stale version examples in package READMEs.

## 2026-11-14 — standalone Chatbot integration

The 0.1.0 integration build introduced public protocol/server/react exports and declarations. Official v1_0 Core and React 0.15.0 remain the owners of validation, Surfaces, binding and Actions. No private SDK import or invented SDK API is introduced. The separate embedded Host reuses the original Runtime Catalog/PluginMount, with an explicit asset-origin Context rather than a second renderer.

A real template partial-data scenario exposed a binder edge: views could retain the initial empty object after granular `/view/field` patches. PolicyView subscribes to the official DataModel, resolves the original `data` binding through public dataContext and clones each notification snapshot before passing it to the view/policy. This keeps plugin instances and local input stable without replacing Core state. Both new dual-entry tests and the original 52 browser tests exercise the change.

Convenience patch shallowly updates supplied business fields; arrays replace, omitted fields remain and explicit null is preserved. Raw v1.0 path-null still deletes. Data readiness is separate from data completeness. Template/raw can update the same Surface; raw structure changes invalidating the binding reject later convenience patches, and raw deletion clears the identity mapping. Input sequence and generated wire-message count are deliberately distinct.

The package/Host use transport enterprise-agent-ui/1, Host version 0.1.0 and Plugin SDK 1.0. Parent/source/version/manifest/assets/run/order are checked. Full normalized Action metadata and JSON extension fields survive the public callback; no optional function RPC or untested full Catalog support is inferred. Install/build/use of the actual tarball was verified outside the repository, including independent static Host deployment. See chatbot-integration-acceptance.md and the package README for exact limits and evidence.

中文：双入口是平台适配层，共用官方 Core/Renderer；便捷入口不替代原始消息或裁减完整 Action。绑定通知适配只读取公开 DataModel，不维护另一套业务状态。支持范围和单版本配套部署约束均以真实消费者与浏览器验证为准。

## 2026-11-14 — Public library guide compatibility verification

The first six bilingual library guides documented the 0.1.0 public exports, enterprise-agent-ui/1 envelopes, official wire 1.0, Core/Renderer 0.15.0 and Plugin SDK 1.0. They explicitly limit claims to verified commands/Catalog/plugin Actions; optional function RPC is not claimed. No SDK/protocol implementation or compatibility version was changed by this documentation work.

pnpm docs:verify loads the standalone consumer's installed @aap/agent-ui package and real release manifest. Both language variants' TypeScript examples pass strict checking. Documented raw create/updateDataModel/updateComponents/delete and expense template readiness/result/deletion batches execute through official Core. Displayed normalized Text output is compared exactly with Adapter output, including creation defaults and policies. Complete Action samples are validated without dropping source/context metadata. See artifacts/library-docs/verification.json.

## 2026-11-14 — CapabilityProfile enterprise component

CapabilityProfile is project-defined in the enterprise Catalog, not an official SDK radar component. Wire 1.0 and Core/React 0.15.0 remain unchanged. It uses public createComponentImplementation, @path and dataContext.set; capability.scenarioChange/capability.dimensionSelect are project business events in the existing full official Action envelope.

The public protocol export supplies capabilityProfileSchema/CapabilityProfileData. Discoverable JSON Schema covers structure; shared Runtime/Adapter Zod validation additionally checks cross-field IDs and scales. Raw wire acceptance alone is not business-data validation. Both Hosts reuse the renderer; trusted built-ins remain in the separate Host in either runtimeMode, while uploaded plugins retain additional Sandbox isolation.

Actual installed tarball + compiled static Host verification: artifacts/capability/consumer/report.json. New component consumers must update package, Host and manifest together; no extra SDK API or function RPC is claimed.

## 2026-11-15 — Library appearance and generated consumers

Library package and matching static Host/manifest are now 0.2.0. Transport remains `enterprise-agent-ui/1`, official wire 1.0, Core/React 0.15.0 and Plugin SDK protocol 1.0. Installed public declarations and the existing v1.0 Basic Catalog were checked: no generic component `style` field is assumed. `themeTokens` and `componentAppearances[surfaceId][componentId]` are strict project RunConfig configuration, exported through `@aap/agent-ui/protocol`. Official Core still owns all Surface/business data; appearance updates do not replay messages or replace it.

Both Hosts use one Runtime implementation. A stable component boundary applies only validated declarations; node IDs never become arbitrary selectors. Native plugins receive the theme environment; opaque Sandbox frames receive validated generated CSS and `{mode,tokens}` through the existing authenticated channel. The optional `useHostTheme()` SDK hook is additive; old artifacts without it continue to mount. Unknown plugins advertise container properties only. Canvas/SVG business graphics, risk scales and plugin hard-coded internals retain their own business contracts.

Client and Host must be upgraded together. Both handshake and manifest versions reject incompatible combinations; the Host boundary test explicitly rejects a 0.1.0 client. Configure accepts theme/appearance through the existing strict Host channel. Fonts use controlled local presets, colors use semantic names or six-digit hexadecimal values, numeric properties have bounds; arbitrary CSS, resource URLs and unknown fields are rejected.

Generated convenience inputs use a real versioned `template.create` followed by the actual raw updates. Raw JSON/JSONL remains raw, preserving multiple Surfaces and message order. No raw message is mislabeled `template.patch`. Installed 0.2.0 tarball verification strictly compiles generated Node/React files outside the repository and runs template, raw and progressive input against a separate compiled Host. A real button Action is forwarded whole to an independent backend, authorized, normalized by the retained Adapter and rendered as the confirmed result. See `library-experience-acceptance.md` and the local consumer report for evidence and limits.


## 2026-11-16 — Playground Library input execution

Playground now offers Library convenience inputs independently of template-generated versus custom content. template.create/patch/delete and UiBatch remain the project's public Library contract, not official A2UI wire commands. The development compile endpoint uses the existing genuine AgentUiAdapter/Core, returns per-batch official messages and policies, and disposes its temporary state. Preview still uses the existing official Core/React renderer in the isolated Host. Native/Sandbox is an independent execution boundary. Package/Host stay at 0.2.0; official Wire/Core versions are unchanged. Actual all-scenario Core, 84-browser-case and independent installed-consumer verification passed; see the same-date Library progress/acceptance entries.
