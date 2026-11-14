# Agent UI chatbot / Agent UI 接入版

与 baseline 共享相同的业务骨架，通过安装 @enterprise/agent-ui 的 .tgz 使用模板/原始 A2UI 双入口及隔离 Host。先在仓库根目录执行 `pnpm chatbot:prepare`，以生成 vendor/ 与 release/；之后可以将本目录单独复制出去。

Shares the baseline's business skeleton and consumes the packaged @enterprise/agent-ui tarball. Run `pnpm chatbot:prepare` at the repository root to generate vendor/ and release/; then this directory can be copied and run independently.

```sh
npm ci --ignore-scripts
npm run build
```

两个终端 / Two terminals:

```sh
npm run host
```

```sh
NODE_ENV=production npm start
```

打开 http://localhost:5181；Host 在 http://127.0.0.1:4183。开发模式执行 `npm run dev`。Ctrl+C 分别停止。

Open http://localhost:5181; the Host is http://127.0.0.1:4183. Use `npm run dev` for development. Stop processes with Ctrl+C.

切换“便捷模板 / 原始 A2UI”查看两种接入；切换 Sandbox/Native 验证同一插件产物。切换会重置运行并拒绝旧结果。风险场景演示模板创建后原始更新，组合场景演示两个 Surface 的增删。

Switch Template/Raw A2UI and Sandbox/Native. Switching resets the run and rejects stale results. Risk mixes template creation with raw updates; composition adds/updates/deletes two Surfaces.

代码接入点仅 web/UiPanel.tsx 和 server/ui/adapter.ts。前者使用公开 React exports 连接 Host；后者使用 server exports 将业务事件转为有序批次，并验证完整 Action。无需启动 Playground、预览会话 API 或 Builder。

The main integration points are web/UiPanel.tsx and server/ui/adapter.ts. They use public React/server exports, ordered batches and full Actions. Runtime operation requires no Playground, preview-session API or Builder.

本地业务服务和身份为演示实现，不执行真实审批。部署、配置、版本与故障处理见 DEPLOYMENT.md。

Business services/identity are local demo implementations. See DEPLOYMENT.md for configuration, versions and troubleshooting.

## Library 完整使用指南 / Complete library guides

从现有 Chatbot 接入 Library，阅读下面六篇；Playground 的 **API & Docs → Library 接入指南** 同步展示同一份中英文文档。

For existing chatbot integration, follow these six guides, also available in Playground **API & Docs → Library integration guides**.

| 文档 / Guide | 简体中文 | English |
| --- | --- | --- |
| 架构与选型 / Architecture | [中文](../../../docs/developer/library-overview.zh-CN.md) | [English](../../../docs/developer/library-overview.en-US.md) |
| 接入步骤 / Integration | [中文](../../../docs/developer/library-integration.zh-CN.md) | [English](../../../docs/developer/library-integration.en-US.md) |
| 完整 A2UI 与便捷模板 / Inputs | [中文](../../../docs/developer/library-inputs.zh-CN.md) | [English](../../../docs/developer/library-inputs.en-US.md) |
| 事件与生命周期 / Events | [中文](../../../docs/developer/library-events.zh-CN.md) | [English](../../../docs/developer/library-events.en-US.md) |
| Demo 改造对照 / Migration | [中文](../../../docs/developer/library-demo-migration.zh-CN.md) | [English](../../../docs/developer/library-demo-migration.en-US.md) |
| 打包部署 / Deployment | [中文](../../../docs/developer/library-deployment.zh-CN.md) | [English](../../../docs/developer/library-deployment.en-US.md) |

[全部文档 / All documentation](../../../docs/developer/README.md)
