# Codex 启动提示词

请先完整阅读同目录的 `AGENT_UI_MVP_HANDOFF.md`，这是已确认范围的 Enterprise Agent UI Runtime & Plugin Playground MVP 1.0 Handoff。

你的任务是按照 Handoff 中的 M1→M4 实施真实可运行的 React + TypeScript 项目，优先复用 A2UI 官方 Core/React Renderer。**第一步先核实当前官方 A2UI SDK 的 API 与 v1.0 React 支持状况，产出 `docs/a2ui-compatibility.md`，不要虚构接口。**

本项目四大核心验收能力是：

1. 输入 A2UI JSON/JSONL，使用真正的 A2UI SDK 渲染与流式回放。
2. 通过上传 TSX/ZIP 源码进行验证、隔离编译、动态注册、实时显示，不需要重新部署 Playground。
3. 每个上传的 Plugin 都能自由切换 **Native React（在独立 Preview Host 中）** 或 **Sandboxed iframe** 模式，使用相同 SDK、数据与交互。
4. 两个 Demo Plugin（Risk Heatmap/Expense Approval）和一个未知第三插件，均通过实际上传入口和 E2E 自动化验证。

请严格用 TypeScript strict、模块化 Monorepo、真实自动化测试；不得静态硬编码两个插件或向主 Playground 注入未经审核的 JS。`renderPolicy`/`readyWhen`、Plugin Manifest、Plugin Host Bridge 是**本项目扩展**，不要当作 A2UI 官方消息定义。

开始时列出当前仓库状态、实现顺序、需要执行的实际命令；先交付 M1 并跑通测试，再逐里程碑继续推进。每个里程碑产出 `docs/handoff-progress.md`。遇到缺失能力优先通过 Adapter 实现，并记录权衡。可自行排错并最多尝试 5 种方案，但涉及扩大不可信插件权限、运行未知脚本、引入外部网络等安全风险不得自行绕过。

2026-11-13 补充需求：Playground 默认采用分类组件 Icon 列表 → 场景模板表单/JSON → 渲染预览的流程，多消息场景提供步骤配置。另请阅读 `AGENT_INTEGRATION_API_DESIGN.md`，交付 Agent 开发者的组件/模板发现、消息校验、预览会话、消息提交及 Action 回传 API，以及 OpenAPI/API Reference、Agent Quickstart 和经过实际测试的 cURL/Python/TypeScript 示例。这些是平台接口，不是 A2UI 官方 REST API；不要求真实企业 Orchestrator 联调。
