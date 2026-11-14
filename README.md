# Agent UI Playground

[Library 使用文档 / Library guides](docs/developer/README.md) · [简体中文 Quickstart](docs/developer/quickstart.zh-CN.md) · [English Quickstart](docs/developer/quickstart.en-US.md)

React + TypeScript Playground using the official A2UI v1.0 Core/React runtime. Includes component templates, message playback, isolated TSX/ZIP plugin builds, Native/Sandbox previews, Actions and a local Agent API. 本地 MVP 已通过 J01–J40 验收，支持简体中文 / English；详见 [验收记录](docs/acceptance-report.md)。The local MVP has passed its functional, bilingual and visual acceptance checks.

Requirements: Node.js 24+, pnpm 10.32.1, Python 3, Docker Engine. Docker must be running for plugin builds.

从全新检出启动 Playground、示例插件和两套 Chatbot / Fresh checkout with Playground, demo plugins and both chatbots:

```sh
pnpm install --frozen-lockfile
pnpm setup:demo
pnpm dev:all
```

首次准备会通过受控 Docker Builder 安装 Risk Heatmap、Expense Approval，生成 Library/独立 Host，并安装和构建两个 Demo。完成后打开 Playground http://localhost:5173、传统版 http://localhost:5180、框架版 http://localhost:5181；Ctrl+C 停止本命令启动的服务。首次准备需要网络和运行中的 Docker，不依赖已有 `.runtime`、安装包或发布目录。后续日常启动执行 `pnpm dev:all`；代码或插件更新后重新准备。仅体验 Playground 可执行下面的单独启动流程。

Setup installs the two real plugins through the constrained Docker Builder, builds the Library/static Host and installs/builds both demos. First setup requires network access and running Docker. Generated packages, plugin records and releases are recreated locally. Use `pnpm dev:all` on subsequent starts; prepare again after relevant source changes. The standalone Playground flow follows below.

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

| Guide                  | 简体中文                                   | English                                       |
| ---------------------- | ------------------------------------------ | --------------------------------------------- |
| Agent Quickstart       | [中文](docs/developer/quickstart.zh-CN.md) | [English](docs/developer/quickstart.en-US.md) |
| API Reference          | [中文](docs/developer/api.zh-CN.md)        | [English](docs/developer/api.en-US.md)        |
| Plugin Developer Guide | [中文](docs/developer/plugins.zh-CN.md)    | [English](docs/developer/plugins.en-US.md)    |
| Benchmark methodology  | [中文](docs/developer/benchmarks.zh-CN.md) | [English](docs/developer/benchmarks.en-US.md) |

[OpenAPI](http://localhost:5173/api/v1/openapi.json) · [SDK compatibility](docs/a2ui-compatibility.md) · [Execution requirements](docs/GOAL_EXECUTION_SPEC.md)

The main app never imports uploaded JavaScript. Native executes in Preview Host; Sandbox adds an opaque-origin iframe. The Docker builder has no network, runs as non-root, and has a read-only root filesystem and resource limits. These are local development services, without production authentication or durable sessions.

The original UI ZIP in `docs/ui` is preserved. `.reference` is a separate reference site; start it with `pnpm reference`. Visual comparisons and documented differences are available in [the visual report](docs/ui/visual-verification.md); this does not claim pixel-perfect identity.

## Chatbot integration / Chatbot 接入

双入口 Library、独立 Host 和两套可复制的完整 Chatbot 对照在 [接入 Demo](examples/chatbot-comparison/README.md)。首次按文档准备/安装/构建后，运行 `pnpm chatbot:demo`，打开传统版 http://localhost:5180 与框架版 http://localhost:5181；Ctrl+C 停止。框架版提供便捷模板 / 原始 A2UI 和 Sandbox / Native，完整部署见 [DEPLOYMENT.md](examples/chatbot-comparison/with-agent-ui/DEPLOYMENT.md)。

The [comparison demos](examples/chatbot-comparison/README.md) share the web UI, orchestrator, agents and business services while replacing presentation integration. Follow preparation instructions once, then start both with `pnpm chatbot:demo`. The installable library uses public protocol/server/react exports; its static Host and genuine built plugins run independently of Playground/Builder. See [the acceptance record](docs/chatbot-integration-acceptance.md) for installation, deployment, browser, visual and regression evidence.

## Library 完整使用指南 / Complete library guides

从现有 Chatbot 接入 Library，阅读下面六篇；Playground 的 **API & Docs → Library 接入指南** 同步展示同一份中英文文档。

For existing chatbot integration, follow these six guides, also available in Playground **API & Docs → Library integration guides**.

| 文档 / Guide | 简体中文 | English |
| --- | --- | --- |
| 架构与选型 / Architecture | [中文](docs/developer/library-overview.zh-CN.md) | [English](docs/developer/library-overview.en-US.md) |
| 接入步骤 / Integration | [中文](docs/developer/library-integration.zh-CN.md) | [English](docs/developer/library-integration.en-US.md) |
| 完整 A2UI 与便捷模板 / Inputs | [中文](docs/developer/library-inputs.zh-CN.md) | [English](docs/developer/library-inputs.en-US.md) |
| 事件与生命周期 / Events | [中文](docs/developer/library-events.zh-CN.md) | [English](docs/developer/library-events.en-US.md) |
| Demo 改造对照 / Migration | [中文](docs/developer/library-demo-migration.zh-CN.md) | [English](docs/developer/library-demo-migration.en-US.md) |
| 打包部署 / Deployment | [中文](docs/developer/library-deployment.zh-CN.md) | [English](docs/developer/library-deployment.en-US.md) |

[全部文档 / All documentation](docs/developer/README.md)

## Repository privacy / 仓库隐私

Commit source code and sanitized configuration examples. Keep actual deployment settings, environment files, raw logs, browser traces and recovery archives in the ignored local `.private/` directory. See [the repository privacy guide](docs/repository-privacy.md). Local development and demo preparation do not require private operations files.
