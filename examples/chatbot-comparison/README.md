# Chatbot 接入对照 / Chatbot integration comparison

两个完整应用具有相同的 React 聊天界面、HTTP/SSE 后端、Orchestrator、Expense/Finance Agent 和有状态的演示业务服务。Agent 使用确定性本地逻辑，无需模型账户；审批不会操作真实财务系统。

Two complete applications share the chat shell, HTTP/SSE backend, orchestrator, Expense/Finance agents and stateful demo services. Agents use deterministic local logic; no model account or real financial approval is involved.

| 目录 / Directory | UI implementation                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| baseline         | 手写 React 审批/风险组件、自定义业务 DTO 与事件 / Handwritten business cards, DTOs and events                                                     |
| with-agent-ui    | 安装本地 Library，模板/原始 A2UI 双入口，独立 Host，真实构建插件 / Packaged library, template/raw inputs, isolated Host and genuine built plugins |

## 准备 / Prepare

在仓库根目录执行。需要 Node 24、pnpm、Python 3、Docker；构建器不可用时不会降级到本机执行插件源码。

Run from the repository root. Requires Node 24, pnpm, Python 3 and Docker. Plugin builds fail closed when Docker is unavailable.

推荐从全新检出使用统一入口 / Recommended fresh-checkout entry:

```sh
pnpm install --frozen-lockfile
pnpm setup:demo
pnpm dev:all
```

首次准备同时初始化 Playground 中的 Risk Heatmap 和 Expense Approval，生成所有本地安装包及发布制品，并安装/构建两个 Demo。全部启动后打开 localhost:5173、localhost:5180、localhost:5181；Ctrl+C 停止本命令启动的服务。首次准备需要网络与 Docker，后续直接 `pnpm dev:all`。只运行两个 Demo 时用 `pnpm chatbot:demo`。

Setup recreates plugin records and packages/releases from source, then installs/builds both demos. It needs network and Docker on first preparation. Start all services with `pnpm dev:all`; use `pnpm chatbot:demo` for only the two demos and embedded Host. Stop with Ctrl+C.

下面是等价的分步准备流程 / Equivalent manual preparation:

```sh
pnpm install --frozen-lockfile
pnpm builder:image
pnpm chatbot:prepare
npm ci --ignore-scripts --prefix examples/chatbot-comparison/baseline
npm ci --ignore-scripts --prefix examples/chatbot-comparison/with-agent-ui
npm run build --prefix examples/chatbot-comparison/baseline
npm run build --prefix examples/chatbot-comparison/with-agent-ui
```

准备命令真实编译示例插件，并复制可安装 .tgz、Host 和制品到集成版目录。两个子目录之后可以单独复制到仓库外运行。普通聊天运行不需要 Docker、Playground 或其 API。

Preparation builds real plugins and copies the installable tarball, Host and artifacts into the integrated demo. Each subdirectory can then be copied outside this repository. Normal chat execution requires neither Docker nor Playground/API services.

## 运行 / Run

准备并构建后，一条命令同时启动两个应用和独立 Host；Ctrl+C 清理所有子进程。

After preparation/build, one command starts both applications and the separate Host; Ctrl+C cleans up the child processes.

```sh
pnpm chatbot:demo
```

也可以分开运行，三个终端 / Alternatively use three terminals:

```sh
NODE_ENV=production npm start --prefix examples/chatbot-comparison/baseline
```

```sh
npm run host --prefix examples/chatbot-comparison/with-agent-ui
```

```sh
NODE_ENV=production npm start --prefix examples/chatbot-comparison/with-agent-ui
```

访问传统版 http://localhost:5180 与集成版 http://localhost:5181；无凭据 Host 为 http://127.0.0.1:4183。Ctrl+C 停止对应进程。

Open the baseline at http://localhost:5180 and the integration at http://localhost:5181. Credential-free Host: http://127.0.0.1:4183. Stop each process with Ctrl+C.

## 演示路线 / Walkthrough

1. 查询 EXP-001：观察等待区；完整数据到达后仍等待 ready，再出现审批表单。 / Query EXP-001; observe the separate data and ready stages.
2. 填意见并批准、驳回或退回；业务服务确认后更新卡片。 / Comment and approve, reject or request changes; the backend result updates the card.
3. 在开发者记录中模拟下一次操作失败，随后用同一业务意图重试。 / Arm “Fail next action” in the developer trace, then retry.
4. 查看风险，等待 Singapore 市场值变为 76；点击 Japan 信用，查看 Agent 下钻结果。 / View risk, watch Singapore Market change to 76, then drill into Japan Credit.
5. 集成版切换便捷/原始入口和 Sandbox/Native；切换会新建运行、清理旧 UI。 / Switch template/raw or Sandbox/Native; each switch starts a clean run.
6. 演示组合：原始入口创建两个 Surface，真实按钮更新组件，再删除。 / Show composition: create two Surfaces, update components and delete through real Actions.
7. 切换中英文和主题、刷新恢复会话；展开并导出真实消息记录。 / Switch locale/theme, refresh to restore the conversation, inspect/export the actual trace.

## 对照与验证 / Comparison and checks

```sh
pnpm chatbot:compare
pnpm chatbot:test
pnpm chatbot:consumer
pnpm chatbot:visual
```

详见 COMPARISON.md、integration-diff.json 和集成版 DEPLOYMENT.md。安装、部署、视觉矩阵及完整回归的最终验收仍以仓库的 chatbot integration progress/acceptance 文档为准。

See COMPARISON.md, integration-diff.json and the integrated DEPLOYMENT.md. Final installation, deployment, visual and regression evidence is recorded separately in the repository's integration progress/acceptance documents.

## Library 完整使用指南 / Complete library guides

从现有 Chatbot 接入 Library，阅读下面六篇；Playground 的 **API & Docs → Library 接入指南** 同步展示同一份中英文文档。

For existing chatbot integration, follow these six guides, also available in Playground **API & Docs → Library integration guides**.

| 文档 / Guide | 简体中文 | English |
| --- | --- | --- |
| 架构与选型 / Architecture | [中文](../../docs/developer/library-overview.zh-CN.md) | [English](../../docs/developer/library-overview.en-US.md) |
| 接入步骤 / Integration | [中文](../../docs/developer/library-integration.zh-CN.md) | [English](../../docs/developer/library-integration.en-US.md) |
| 完整 A2UI 与便捷模板 / Inputs | [中文](../../docs/developer/library-inputs.zh-CN.md) | [English](../../docs/developer/library-inputs.en-US.md) |
| 事件与生命周期 / Events | [中文](../../docs/developer/library-events.zh-CN.md) | [English](../../docs/developer/library-events.en-US.md) |
| Demo 改造对照 / Migration | [中文](../../docs/developer/library-demo-migration.zh-CN.md) | [English](../../docs/developer/library-demo-migration.en-US.md) |
| 打包部署 / Deployment | [中文](../../docs/developer/library-deployment.zh-CN.md) | [English](../../docs/developer/library-deployment.en-US.md) |

[全部文档 / All documentation](../../docs/developer/README.md)
