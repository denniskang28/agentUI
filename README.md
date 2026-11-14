# Agent UI Playground

[简体中文 Quickstart](docs/developer/quickstart.zh-CN.md) · [English Quickstart](docs/developer/quickstart.en-US.md)

React + TypeScript Playground using the official A2UI v1.0 Core/React runtime. Includes component templates, message playback, isolated TSX/ZIP plugin builds, Native/Sandbox previews, Actions and a local Agent API. 本地 MVP 已通过 J01–J40 验收，支持简体中文 / English；详见 [验收记录](docs/acceptance-report.md)。The local MVP has passed its functional, bilingual and visual acceptance checks.

Requirements: Node.js 24+, pnpm 10.32.1, Python 3, Docker Engine. Docker must be running for plugin builds.

```sh
pnpm install --frozen-lockfile
pnpm builder:image
pnpm demos:package
pnpm dev
```

Open http://localhost:5173. Preview Host: http://127.0.0.1:4173. API: http://127.0.0.1:3001/api/v1. Main and preview intentionally use separate sites; do not replace both hostnames with one hostname. Install demo ZIPs using Plugins → Install demo plugins / 加载示例插件.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

E2E requires the running dev servers and Docker builder image. `pnpm build` creates browser bundles; `pnpm dev` is the supported local run command. Sessions are in memory and disappear on API restart. Plugin artifacts live in ignored `.runtime/plugins`.

| Guide | 简体中文 | English |
|---|---|---|
| Agent Quickstart | [中文](docs/developer/quickstart.zh-CN.md) | [English](docs/developer/quickstart.en-US.md) |
| API Reference | [中文](docs/developer/api.zh-CN.md) | [English](docs/developer/api.en-US.md) |
| Plugin Developer Guide | [中文](docs/developer/plugins.zh-CN.md) | [English](docs/developer/plugins.en-US.md) |
| Benchmark methodology | [中文](docs/developer/benchmarks.zh-CN.md) | [English](docs/developer/benchmarks.en-US.md) |

[OpenAPI](http://localhost:5173/api/v1/openapi.json) · [SDK compatibility](docs/a2ui-compatibility.md) · [Execution requirements](docs/GOAL_EXECUTION_SPEC.md)

The main app never imports uploaded JavaScript. Native executes in Preview Host; Sandbox adds an opaque-origin iframe. The Docker builder has no network, runs as non-root, and has a read-only root filesystem and resource limits. These are local development services, without production authentication or durable sessions.

The original UI ZIP in `docs/ui` is preserved. `.reference` is a separate reference site; start it with `pnpm reference`. Visual comparisons and documented differences are available in [the visual report](docs/ui/visual-verification.md); this does not claim pixel-perfect identity.
