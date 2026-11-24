# Packaging, deployment and operation

## Two build commands

pnpm library:build produces public ESM entry points, declarations and artifacts/packages/aap-agent-ui-0.2.0.tgz. It does not create a complete plugin Host release.

pnpm chatbot:prepare builds the package, packages demo sources, syncs controlled runtime dependencies, builds Embedded Host, installs/builds two genuine demo plugins through Docker Builder, then exports/copies package, manifest, Host and artifacts into with-agent-ui. Package-only builds do not compile plugins; a complete plugin release requires Docker.

From repository root:

```sh
pnpm install --frozen-lockfile
pnpm builder:image
pnpm chatbot:prepare
```

Preparation uses Node 24, pnpm 10.32.1, Python 3 and Docker. Builds fail closed if Docker is unavailable. Do not execute uploaded scripts on the host or install arbitrary plugin dependencies. Builder is network-disabled, non-root, read-only-root and resource-limited. Deployed applications consume approved static artifacts.

## Release layout

```text
examples/chatbot-comparison/with-agent-ui/
  package.json + package-lock.json
  vendor/aap-agent-ui-0.2.0.tgz
  release/
    host/                  HTML, Host bundles, runtime.css, controlled dependencies
    artifacts/{buildId}/   plugin.js, validator.js, optional plugin.css
    manifest.json          Host/SDK/component versions, Catalog, Schema, asset URLs
    serve-host.mjs         Node-built-in-only static server
  server/ + shared/        business backend and Presenter
  web/                     existing shell and Host integration
  deploy/run.mjs           start/stop application and Host
  deploy/nginx.example.conf
```

Original release output is artifacts/chatbot-release; tarball output is artifacts/packages. vendor/release/dist are reproducible outputs, not source to edit. Plugin TSX, original ZIPs, Playground API and Docker daemon are not chat runtime dependencies.

Manifest entries include built-ins and built plugins. Validate a custom plugin through the real upload/build flow, including Schema, Actions and both runtimes, then export matching release artifacts. The current chatbot:prepare export explicitly installs two demos; it is not a generic CLI exporting every uploaded Playground plugin. Extend trusted release configuration/export code, never let an Agent choose arbitrary bundle URLs.

## Run outside the repository

After prepare, copy the complete with-agent-ui directory, retaining vendor/release/lockfile:

```sh
npm ci --ignore-scripts
npm run build
npm run deploy
```

Open http://localhost:5181; check Host at http://127.0.0.1:4183/health. Ctrl+C stops both processes. Playground, Preview API and Docker are not needed here.

The demo runs backend TypeScript with tsx; build typechecks and builds the frontend only. Server sources remain in the delivery. Install devDependencies, including tsx/Vite; npm ci --omit=dev does not support this start command. A product may compile server JS and adjust dependencies separately; this demo does not claim a bundled backend.

Baseline runs independently with npm ci --ignore-scripts, npm run build and NODE_ENV=production npm start; it needs neither Library nor Host.

## Adopt artifacts in an existing product

1. Put the tarball in your vendor directory or controlled artifact store; install it and commit package/lock files.
2. Deploy the complete release to a separate credential-free Host, retaining host/artifacts/manifest paths.
3. Load the same manifest on the business backend, create one Adapter/run and use your existing transport.
4. Configure frontend Host URL, validate its manifest, embed Provider/Host/Client and forward complete Actions.
5. Configure both CSPs, exact parent origins, authentication cookie scope and HTTPS; verify the full interaction loop.

You do not need to move the demo's business system into your product. Its two integration files are the main reference. The published server library is Node/TypeScript; another backend language needs its own equivalent integration, not an assumed Python/Java SDK.

## Build-time and runtime configuration

| Variable | Default | Stage / purpose |
| --- | --- | --- |
| VITE_AGENT_UI_HOST_URL | http://127.0.0.1:4183 | Frontend build; embedded into browser JS |
| DEMO_PORT | 5181 | Business server runtime port |
| DEMO_PUBLIC_ORIGIN | http://localhost:5181 | Business API Origin check |
| AGENT_UI_HOST_PORT | 4183 | Static Host runtime port |
| AGENT_UI_PARENT_ORIGINS | http://localhost:5180,http://localhost:5181 | Exact comma-separated embedding origins, no path or trailing slash |
| AGENT_UI_RELEASE_DIR | Directory containing serve-host.mjs | Release root containing host/artifacts/manifest |

From a prepared integrated demo, configure your actual names, certificates and proxy. These example domains are not deployed services:

```sh
VITE_AGENT_UI_HOST_URL=https://agent-ui.example-host.test npm run build
DEMO_PUBLIC_ORIGIN=https://chat.example.test DEMO_PORT=5181 NODE_ENV=production npm start
```

In another terminal:

```sh
AGENT_UI_PARENT_ORIGINS=https://chat.example.test AGENT_UI_HOST_PORT=4183 npm run host
```

Terminate TLS at a reverse proxy pointing business traffic at 5181 and Host traffic at 4183. Adapt deploy/nginx.example.conf. Both Node servers bind loopback by default. Changing a VITE variable requires rebuilding; restarting the backend does not rewrite the browser bundle.

## Origins, CSP, cookies and assets

Host must have a different origin from the authenticated chatbot. Prefer a separate site with host-only business cookies. Cookie Domain must not cover the Host; different ports alone do not isolate cookies. Never inject Authorization, login tokens or enterprise browser credentials into it.

Main application CSP must allow Host iframe through frame-src and manifest fetch through connect-src. Host requires exact frame-ancestors and host-config.json allowedParents. Handshake checks origin/source/protocol/Host version/document identity.

The supplied server sets CSP, nosniff, no-referrer and Permissions-Policy. Current script/style policy allows self and required unsafe-inline, without unsafe-eval. Public assets use Access-Control-Allow-Origin:* so opaque Sandbox frames can read credential-free JS/validator/CSS. Do not copy that policy onto authenticated business APIs. Host exposes no /api business endpoints.

Plugin URLs are restricted to this Host's /artifacts/{buildId}/ paths, not arbitrary remote assets. Serve correct JS/CSS/JSON MIME. Native runs inside this Host; Sandbox adds an opaque nested iframe. Neither runs uploaded JS in the main application.

Credential isolation does not hide data deliberately passed to a plugin. Supply only data needed for authorized display/interaction.

## Versions, upgrades and rollback

| Piece | Current paired version |
| --- | --- |
| npm package / Embedded Host | 0.2.0 / 0.2.0 |
| Embed transport | enterprise-agent-ui/1 |
| Official wire | 1.0 |
| Official Core / React Renderer | 0.15.0 / 0.15.0 |
| Project Plugin SDK | 1.0 |
| Demo templates | expense.approval-form 1.0.0; finance.risk-heatmap 2.1.0 |

Release package, Host, manifest, plugins and consumer frontend together. Do not combine a new manifest with an old Host. Replacing a same-name tarball without updating lock integrity also fails: prepare, update consumer installation/lock, npm ci and rebuild. Versioned directories and atomic proxy switching are deployment options; cross-version live migration is not implemented. Dispose old runs, mount fresh Host/Client and apply your business compatibility policy during upgrade/rollback.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Blank iframe / HOST_LOAD_TIMEOUT | /health, Host URL, frame-src, frame-ancestors, allowedParents, actual parent origin |
| Manifest unavailable | /manifest.json status/MIME/CORS and matching package/Host version |
| UNKNOWN_TEMPLATE / TEMPLATE_VERSION | Correct release entries, exact key/version, genuine plugin installation |
| Blank plugin | plugin.js/validator.js/CSS status/MIME; onError and browser errors |
| Complete data still waiting | /ready=true, policy path, business Schema |
| Approval stays pending | Complete Action delivery, run/Surface/authorization checks, result SSE |
| Missing UI after reload | History contains create/data/ready, not just newest patch |
| Package looks stale | Tarball/lock integrity aligned; reinstall/rebuild, not only browser cache |
| Docker preparation failure | Repair/start controlled Builder; never execute uploaded source on the host |

Use actual network/logs/Core errors/DOM. Host bundle size warnings are not measured cold-start latency. The library supplies no production LLM, identity provider, durable database, approval system or automatic tenant isolation; those remain business application responsibilities.

Return to [Architecture](library-overview.en-US.md) or [Integration](library-integration.en-US.md).
