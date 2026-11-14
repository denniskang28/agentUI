# Traditional chatbot / 传统 Chatbot

完整的 React Web UI + Fastify HTTP/SSE 后端 + Orchestrator + Expense/Finance Agent；审批和风险卡片直接手写在 web/UiPanel.tsx，不依赖 Agent UI Library。

A complete React/Fastify chatbot with an orchestrator and two deterministic domain agents. Cards are handwritten in web/UiPanel.tsx; this application does not depend on Agent UI.

在本目录执行 / Run in this directory:

```sh
npm ci --ignore-scripts
npm run build
NODE_ENV=production npm start
```

打开 http://localhost:5180。开发模式执行 `npm run dev`。Node 24+；Ctrl+C 停止。

Open http://localhost:5180. Use `npm run dev` for development. Requires Node 24+. Stop with Ctrl+C.

点击查询报销，填写意见后审批；点击风险并下钻。开发者记录可模拟一次失败并导出真实消息。支持中英文、明暗主题和刷新恢复。

Query an expense and approve it, or explore risk. The developer trace can arm a single failure and export actual messages. Locale/theme switching and conversation refresh recovery are supported.

这是本地演示：演示身份固定为审批人，数据和会话仅存内存，重启后失效；不连接 LLM、SSO 或真实财务系统。生产认证和持久化由业务应用实现。

This local demo uses a fixed approver identity and in-memory state. Restart clears sessions. It does not connect to an LLM, SSO or financial system; production authentication/persistence belong to the business application.

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
