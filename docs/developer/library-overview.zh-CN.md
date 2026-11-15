# Library 架构与选型

## 先确定你要接入什么

`@enterprise/agent-ui` 是把声明式 UI 放入现有业务应用的本地分发 Library。它提供服务端适配器、React 嵌入入口和公共协议。Playground 是开发、构建和调试工具；你的 Chatbot 运行时不需要连接 Playground 的 `/api/v1/preview-sessions`。

本文按当前 0.2.0 代码说明，不把早期设计稿中的拟议 API 当成可调用接口。安装产物使用公开的 `/server`、`/react`、`/protocol` 三个 exports，不能从仓库 `src` 或官方 SDK 私有路径导入。

建议顺序：[接入步骤](library-integration.zh-CN.md) → [双入口详解](library-inputs.zh-CN.md) → [事件与生命周期](library-events.zh-CN.md) → [Demo 改造对照](library-demo-migration.zh-CN.md) → [打包与部署](library-deployment.zh-CN.md)。已有 Chatbot 的开发者可先读 Demo 改造对照。

## 系统整体架构

```text
用户 → 现有 Chat Web UI → 业务后端 / Orchestrator → 领域 Agent
                                       ↑              ↓ 业务数据或 UiInput
                                       └── AgentUiAdapter（每 run 一个）
                                                   ↓ NormalizedBatch
Chat Web UI ← 现有 HTTP / SSE / WebSocket ← 业务后端
    │ AgentUiProvider + AgentUiHost
    ↓ MessageChannel
独立、无业务凭据的 Embedded Host
    ├─ 官方 A2UI Core：Surface / Data Model / 绑定
    ├─ 官方 React Renderer + 受控 Catalog
    └─ 插件：Native 在 Host 内；Sandbox 在嵌套 opaque iframe 内
    ↑ Action → Client.onAction → 原业务 API → Orchestrator → 业务服务
    └──────────────── 后端结果 → UI 更新批次 ────────────────┘
```

这里的 `runId` 是一次 UI 运行的隔离标识，`surfaceId` 是其中一块独立 UI 的标识，`batchId` 是有序提交批次的幂等标识。它们不是用户身份凭据。

| 层 | 你继续负责的内容 | Library / Host 负责的内容 |
| --- | --- | --- |
| Chat Web UI | 消息列表、文本流、登录、输入框、业务导航 | Provider、Host iframe、版本化通信、Action 回传 |
| Orchestrator | 意图识别、Agent 调用、会话、权限、业务路由 | Adapter 校验并统一模板和原始消息 |
| Agent | 业务查询、生成数据、选择已允许组件 | 便捷命令编译为官方 A2UI；原始入口保留消息结构 |
| 业务服务 | 审批、幂等、存储、审计、失败处理 | 不替代业务服务；通过后续消息反映结果 |
| Embedded Host | 发布地址、Origin 白名单、静态资源交付 | Core、Renderer、Catalog、插件隔离和显示 |
| Playground / Builder | 开发期组件调试、受控构建和发布准备 | 不参与部署后的每条聊天请求 |

服务端 Adapter 内的官方 Core 用于消息历史和状态校验；浏览器 Host 内的官方 Core 管理实际交互状态。不要另外建立一份用来代替官方 Surface/Data Model 的 UI 引擎。文本消息可以继续沿用原来的纯文本通道；只有富 UI 事件进入 Library。

## 一次报销请求如何闭环

1. 用户输入“查询 EXP-001”，后端识别报销意图并调用 Expense Agent。
2. Agent 先产出部分数据。Presenter 发 `template.create`，设 `on_complete` 和 `ready:false`，Host 显示等待状态。
3. Agent 产出完整数据。Presenter 发 `template.patch`，仍不提交 ready，表单继续等待。
4. 业务确认可以交互，单独发送 `ready:true`。Host 显示审批表单。
5. 用户填写意见并点击“批准”。插件生成完整 A2UI Action；Client 将带 runId/actionId 的事件交回原业务后端。
6. 后端校验身份、Surface 归属、报销单、操作权限和业务幂等键，调用审批服务。
7. 服务成功后产生 `status:"approved"` 和新 `resultVersion`；失败则产生错误状态。Presenter 将结果更新为批次，表单显示服务确认的状态。

不是“按钮点击后前端自己认定审批完成”。网络层收到 Action、业务操作成功、Core 应用消息、屏幕绘制是不同阶段。

## 什么时候用哪种入口

| 场景 | 选择 | 理由 |
| --- | --- | --- |
| 固定审批表单、标准风险热力图，只变化数据 | 便捷模板 | 只填已发布组件 Schema，无需重复组件树和数据绑定 |
| 已有 Agent 输出合法 A2UI | 原始 A2UI | 保留四种官方命令、Catalog、组件树、绑定和事件定义 |
| 新布局、动态组合、增删组件、多 Surface | 原始 A2UI | 明确控制 createSurface/updateComponents/updateDataModel/deleteSurface |
| 模板先创建，之后精细更新数据或增加独立组件 | 混用 | 共用同一 Adapter、序列、Host Core、Action 链路 |
| 开发和验证一个新组件 | Playground + 受控插件构建 | 验证 Schema、交互、Native/Sandbox 后发布到 Host |

便捷模板简化的是 UI 的输入写法，不会把输出 Action 压成只有按钮名。两种入口都通过同一事件桥传回完整 `name/surfaceId/sourceComponentId/timestamp/context` 及支持的扩展字段。不过“原始入口”不代表任意 A2UI 生态能力都已经实现：本版验证了四种官方消息和项目 Catalog/插件 Action；可选函数 RPC、未验证的 Catalog 交互不在承诺范围。

Native/Sandbox 与模板/原始是两个独立维度：前者决定插件在哪里运行，后者决定 Agent 如何描述 UI。Native 也只在独立 Host 内运行，主 Chat 页面不加载上传 JavaScript。

## 需要安装和部署哪些东西

业务前后端安装 `.tgz`；前端使用 React 19，服务端可单独使用，不要求 React。另部署一套发布目录：Host 静态站点、manifest、经过 Docker 构建的插件 JS/validator/CSS。仅安装 npm 包不会自动生成或启动 Host。

本地对照 Demo：传统版 `http://localhost:5180`；集成版 `http://localhost:5181`；独立 Host `http://127.0.0.1:4183`。原 Playground 的 5173/4173 是另外一套开发环境，不应混配。准备插件时需要 Docker，部署后正常聊天不需要 Builder 或 Playground 服务。

继续阅读：[从安装到首屏](library-integration.zh-CN.md)。
