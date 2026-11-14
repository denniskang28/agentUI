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

## 2026-11-14 — CapabilityProfile enterprise component

CapabilityProfile is project-defined in the enterprise Catalog, not an official SDK radar component. Wire 1.0 and Core/React 0.15.0 remain unchanged. It uses public createComponentImplementation, @path and dataContext.set; capability.scenarioChange/capability.dimensionSelect are project business events in the existing full official Action envelope.

The public protocol export supplies capabilityProfileSchema/CapabilityProfileData. Discoverable JSON Schema covers structure; shared Runtime/Adapter Zod validation additionally checks cross-field IDs and scales. Raw wire acceptance alone is not business-data validation. Both Hosts reuse the renderer; trusted built-ins remain in the separate Host in either runtimeMode, while uploaded plugins retain additional Sandbox isolation.

Actual installed tarball + compiled static Host verification: artifacts/capability/consumer/report.json. New component consumers must update package, Host and manifest together; no extra SDK API or function RPC is claimed.
