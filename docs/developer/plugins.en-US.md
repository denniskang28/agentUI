# Plugin Developer Guide

Upload TSX or ZIP source. The platform performs a controlled esbuild compilation and registers the result without redeploying the Playground. The Plugin SDK is a project API, separate from the official A2UI SDK.

## Minimal component

```tsx
import { definePlugin, useHostAction, useHostLocale } from '@enterprise/agent-ui-plugin-sdk';

function Counter({ data }: { data: { value: number } }) {
  const dispatch = useHostAction();
  const locale = useHostLocale();
  return <button onClick={() => dispatch('counter.increment', { value: data.value })}>
    {locale === 'zh-CN' ? '增加' : 'Increment'}: {data.value}
  </button>;
}

export default definePlugin({ id: 'example.counter', version: '1.0.0', Component: Counter });
```

Component receives resolved data. Export identity must exactly match the manifest id/version. useHostAction() returns dispatch(name, context). context must be a JSON object. Declare the Action name in the manifest and enable the agent.action capability.

useHostLocale() returns zh-CN or en-US, defaulting to zh-CN. Locale changes update the existing instance. Do not use locale as a component key. Translate your own fixed labels; the host does not translate business data or third-party names. Keep local edits in React state. Let Agent updates control authoritative state such as approval results.

## ZIP structure

```text
plugin.json
catalog.json
src/index.tsx
src/styles.css
```

Relative TS/TSX/JS/JSX/CSS imports are supported. A ZIP may include one enclosing directory. node_modules, package.json, scripts, binaries, symbolic links and escaping paths are rejected.

plugin.json:

```json
{
  "schemaVersion": "enterprise-plugin/1.0",
  "id": "example.counter",
  "version": "1.0.0",
  "displayName": "Example Counter",
  "entry": "src/index.tsx",
  "catalogFile": "catalog.json",
  "componentType": "ExampleCounter",
  "supportedRenderPolicies": ["progressive", "on_complete", "live"],
  "defaultRenderPolicy": "progressive",
  "actions": ["counter.increment"],
  "capabilities": ["ui.render", "agent.action", "ui.resize"],
  "sdkApiVersion": "1.0"
}
```

catalog.json:

```json
{
  "catalogId": "urn:enterprise:plugin:example.counter",
  "dataSchema": {
    "type": "object",
    "properties": { "value": { "type": "number" } },
    "required": ["value"],
    "additionalProperties": true
  },
  "defaults": { "value": 0 },
  "fields": [{ "key": "value", "label": "Value", "type": "number" }],
  "templates": ["full"],
  "category": "已安装插件",
  "icon": "gauge",
  "description": "An uploaded counter"
}
```

This is the platform upload descriptor. The platform generates an actual official catalog document whose dynamic data property supports Data Model bindings. dataSchema validates resolved business values. GET /catalogs returns generated catalog documents; the upload descriptor is not official wire format.

catalogId must start with urn:. dataSchema must be a JSON Schema object, strictly compiled by Ajv in its default draft-07 dialect; document-local references are supported, remote $ref documents are not fetched. defaults must satisfy dataSchema. fields is a required array; use [] for no form fields. Each entry provides key and label, with optional type, wide and options. Invalid TSX metadata returns 400 / INVALID_METADATA; invalid ZIP JSON, catalog, schema or defaults return 422 and never register a partial plugin.

fields supports text, number, textarea, toggle and select; select may include options. Templates may use full, progressive, streaming, on_complete and action. The generic generator places business values at /view. Custom messages may bind another path.

## Upload and discovery

Select a ZIP on the Plugins page, or run:

```sh
curl --fail-with-body -F file=@examples/dist/unknown-counter.zip http://localhost:5173/api/v1/plugins
```

A single TSX upload also supplies a metadata JSON string containing manifest and catalog. Its source is written to src/index.tsx. Use ZIP when you need relative files. The Playground provides a metadata editor.

A successful response contains buildId, bytes, sha256, status=ready and entry. entry includes component, catalogId, bundleUrl, optional stylesheetUrl and schema. Discovery updates immediately. Failed builds produce diagnostics and never register partial artifacts. Re-uploading the same ID replaces the Registry entry after success; render again to use the new version. Uninstall prevents new instances.

## Native and Sandbox

Native creates a plugin React root inside the separate Preview Host. The main Playground never imports uploaded JavaScript. Sandbox runs the identical artifact in an opaque-origin iframe with only allow-scripts and a nonce-bound MessageChannel for data, theme and locale.

Theme uses data-theme=light/dark and platform CSS variables. Imported CSS becomes a real artifact loaded in both modes. Theme/locale updates preserve the root and local state. Mode switches, Reset and uninstall dispose instances and listeners. Both modes should behave equivalently.

Sandbox cannot access the top-level document, navigate it, make network requests or call platform APIs. Native shares the Preview Host environment; it is not a complete untrusted-code sandbox. That site carries no login credentials or main-app state. Production identity and site isolation need a separate design.

## Rendering, Actions and limits

progressive can display schema-valid partial content. on_complete waits for readiness and valid data; timeout only reports an error and never submits a form. live waits for initial readiness and then continues updating. Use componentPolicies for per-component configuration, separate from wire commands.

Approval interactions should enter pending and suppress duplicate clicks. Generate a stable idempotencyKey for each business intent so the Agent/backend can deduplicate it. Do not turn local pending into approved automatically; wait for an authoritative data.status update. The expense-approval example demonstrates this flow.

The approval example preserves the key for an unchanged retry, and creates a new key when the Action, report or comment changes. When returning another result with the same status (for example, two consecutive error responses), increment data.resultVersion so the plugin can distinguish the new receipt and leave pending. This field belongs to the example's business schema, not the A2UI protocol. Validation messages are derived from the current locale rather than stored as translated strings.

Allowed dependencies: react, react/jsx-runtime, react/jsx-dev-runtime, react-dom, react-dom/client, zod and @enterprise/agent-ui-plugin-sdk. Uploaded npm scripts and arbitrary dependency installs never run. Node built-ins and remote imports are rejected.

Limits: 5 MB compressed ZIP, 100 entries, 10 MB total expansion, 2 MB per extracted file and maximum compression ratio 100. Build timeout is 45 seconds; JS artifacts are limited to 2 MB and CSS to 500 KB. The builder has no network, runs as non-root, and has a read-only root filesystem plus CPU, memory and PID limits. Docker failure never falls back to execution in the main process.

See risk-heatmap, expense-approval and unknown-counter under examples/plugins. Run pnpm demos:package to create uploadable ZIPs.
