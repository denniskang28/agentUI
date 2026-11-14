# Claude Design V1 设计评审

日期：2026-11-13。

评审对象：`Agent UI Playground v1.zip` 中的 `Agent UI Playground v2.dc.html` 为主，源码对照 `Agent UI Playground.dc.html`。两份存在视觉/样式差异，下列协议与契约问题在两份中均可见。

评审方式：本地打开原型，检查桌面工作台、JSON 切换、审批分步等待、Plugins 和 API & Docs；对照 Handoff 与 Agent API 设计并检查生成消息/代码的逻辑。观察了 1440px 桌面及默认窄视口。本次不是后端验收，未把 Mock 编译、Mock 运行模式或示例指标当成已实现功能。

## 总体判断

可以保留三栏工作台、分类组件库、模板场景、表单/JSON 切换、可折叠调试区，以及 Plugins / API & Docs / Benchmarks 的信息架构。以 ZIP 内 v2 的视觉作为后续基线是合理的。

需要在进入工程实现前完成一轮内容和交互校正，优先保证协议、插件身份、API 示例与 PRD 一致，再完善真实响应入口和渲染策略配置。

## 必须校正

### P1 — 协议示例与已选定的 A2UI v1.0 不一致

证据：JSON 编辑器和 Quickstart 生成 `surfaceUpdate / dataModelUpdate / beginRendering`，绑定使用 `path`，数据写入使用 `contents`，没有 `version: "1.0"`；版本兼容页列出 0.8/0.7。源码入口为 `surface()`、`gen()`、`onJson()` 的相关校验逻辑及 `langCode()`。

影响：用户复制示例后不能按本项目 v1.0 契约接入；“完整展示需要 3 条消息”的界面说明也会误导。

修改：统一成 v1.0 的 `createSurface / updateComponents / updateDataModel / deleteSurface`，包含版本字段，绑定采用 `@path`，更新使用 `value`。完整展示模板可由一条 createSurface 携带组件和初始数据。消息列表、错误文案、模板步骤和接入示例同时更新。

官方依据：[A2UI Messages](https://a2ui.org/concepts/messages/)。实际 Renderer 支持情况仍按 M1 兼容性核实结果落地。

### P1 — Heatmap 被设计成内置组件，缺失双模式插件入口

证据：Heatmap 显示 `a2ui · RiskHeatmap` 和“内置组件”，没有 Native / Sandbox 控件；Plugins 只有 Expense 和 Org Chart。源码 `COMPS` 将 Heatmap 直接归为内置，`isPlugin()` 不识别它为插件。

影响：无法从设计表达“两个业务 Demo 都通过上传安装，并在两种模式测试”的核心要求。

修改：Heatmap 使用已安装插件身份 `finance.risk-heatmap`，Approval 使用 `expense.approval-form`。左侧仍可按业务类别展示 Heatmap，但标记插件来源；插件管理页能找到它，且两者预览都有运行模式切换。统一 Action 名称与 PRD 契约。

### P1 — 插件开发说明自行引入了另一套 SDK/包装契约

证据：Plugins 页声明 `@a2ui/plugin-sdk@0.8`、`manifest.json`、导出 zod schema，并列出未经本项目确认的依赖白名单；Handoff 约定的是本项目 SDK、`plugin.json` 与 JSON Schema Catalog。

影响：插件作者按界面说明编写的包，可能不能通过真正的 Builder 校验；也容易误认为自定义 SDK 是 A2UI 官方接口。

修改：以 Handoff 的实际 Plugin SDK/Packaging 合同为准。未锁定依赖时明确“以平台白名单为准”，不要编造已验证版本。删除“两种模式都不访问真实数据”的绝对承诺，改为“运行于隔离预览环境，不提供宿主认证凭据；输入数据由测试场景提供”。主应用标题中的 Preview Host 标识也应移到预览区域。

### P1 — API 文档和复制示例必须使用同一份契约

证据：原型使用 `/v1/sessions`、`:instantiate`、`ui.applied` 等；当前设计文档采用 `/api/v1/preview-sessions`、`/instantiate`、`message.applied`。提交代码没有 batchId/firstSequence，也没有等待预览连接的步骤。Quickstart 先提交再订阅，对“已应用”事件如何补收没有说明。

影响：复制功能会输出另一套接口，丢失消息顺序、幂等与会话连接语义。

修改：由同一 API 契约生成 Reference 与示例。展示创建会话返回的 previewUrl、连接状态、runId 与最近消息状态；解释 202 为接收，message.applied 为应用成功，不将其等同于实际画面已经可见。支持先订阅再提交，或明确事件补发方式。

复制示例还存在具体缺口：Python 使用 JSON 布尔值/null 的直接文本拼接，部分配置不是合法 Python；Action 示例调用未提供的 parse_sse；TypeScript 同时使用 Node process.env 和浏览器 EventSource，没有明确运行环境。cURL 渐进示例只输出首批消息。完成设计时应将这些标为不完整示意，正式交付前提供完整且可执行的版本。

契约依据：[Agent API 设计](../AGENT_INTEGRATION_API_DESIGN.md)。该契约尚未实现，若实施时调整，应同步更新文档和 UI，不能形成两个版本。

### P1 — 增加“导入实际 Agent 响应”的直接入口

证据：当前只有组件模板内的 JSON 编辑，没有 JSON/JSONL 文件导入入口，也没有清楚的自定义响应工作流；所有预览围绕当前单个选中组件，Surface 固定为 main。

影响：开发者能体验模板，但拿到自己 Agent 的原始响应后，不容易直接验证；多组件组合/多个 Surface 也没有明确的选择与诊断入口。

修改：在 Playground 提供“组件模板 / 自定义响应”入口。自定义响应支持粘贴、导入 JSON/JSONL、校验、渲染；多 Surface 时显示选择器并标记各自状态。不需要把完整编辑器永久放在默认模板视图。

### P1 — 审批需要独立的 on_complete 场景

证据：审批的“渐进加载”只先创建空区域，再一次性推送完整 report/items；界面和运行配置没有 renderPolicy/readyWhen。等待条件只是“还没有 report”。

影响：只能演示延迟到达，无法解释和验证“数据已经部分或全部到达，但组件还不能展示”的核心行为。

修改：增加“数据就绪后展示”模板。平台运行配置显示 `on_complete` 和 readyWhen JSON Pointer；步骤包含部分数据 → 补全数据但 ready=false → ready=true。等待区显示当前条件与状态，ready 满足且 Schema 有效后才显示可操作表单。明确策略属于平台配置。

## 交互与视觉优化

### P2 — 分清草稿、当前预览和模拟状态

- 实际观察：仅从表单切换到 JSON，也会出现“配置已修改，尚未渲染”。切换查看方式不应标记数据发生修改。
- 修改字段后，复制接入代码应明确复制“当前草稿”还是“当前预览”的配置；建议默认草稿，并在预览上标记“尚未应用最新修改”。
- 组件/模板切换应保留编辑草稿，手写 JSON 将丢失时应提示。
- “强制加载中/空数据/失败”移入高级调试或“状态模拟”，强制状态下展示明确标记，避免用户误以为是真实 Runtime 结果。

### P2 — 窄屏导航和文档组件切换

- 窄视口虽有组件库/配置/预览 Tabs，顶栏仍保持桌面导航，右侧项目被截断；改成可用的紧凑导航。
- 窄预览热力图可使用有提示的横向滚动，保留区域名列；避免把全表压到不可读。
- API & Docs 的组件参考应可直接选择组件，不必返回 Playground 改当前选择。
- 参数参考增加必填、默认值、约束及嵌套数组 Schema；版本页区分协议版本、平台 API、Plugin SDK 和组件版本。

## 建议保留

- 分类 Icon + 名称的组件库与搜索。
- 默认表单，JSON 作为可切换视图；运行配置与原始消息分开。
- 选择多步骤模板后才显示播放控件。
- 原型明确标注 Mock，性能不支持的指标显示不可用。
- Native/Sandbox 切换明确告知重建实例与状态重置。
- Approval 的提交、错误、重试与幂等提示。
- 接收回执和应用反馈分开表达的设计方向。

## 复审标准

1. 完整模板生成 v1.0 消息，复制代码与 API Reference 一致。
2. 两个 Demo 都显示插件身份，可从 Plugins 打开并切换运行模式。
3. 自定义 JSON/JSONL 响应可直接导入，多个 Surface 有清楚的检查入口。
4. on_complete 模板能区别数据到达和 ready 条件达成。
5. 切换表单/JSON 不造成虚假未渲染提示，复制代码的配置来源清晰。
6. 桌面和窄屏均能访问所有导航及主要操作。

本次保留原始 ZIP，不直接修改 Claude Design 导出的页面。
