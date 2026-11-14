# Agent Developer API — 接入设计

日期：2026-11-13；实施同步：2026-11-14。状态：API 已实现并进行契约验收，整体 Goal 尚未完成。本文保留设计目标；准确的字段、响应与状态码见运行服务的 GET /api/v1/openapi.json，以及双语 docs/developer/api.zh-CN.md / api.en-US.md。

2026-11-14 追加：按 `docs/I18N_REQUIREMENTS.md`，创建会话支持可选的 `preview.locale`（`zh-CN` / `en-US`，默认 `zh-CN`），查询返回最终配置。locale 属于平台配置，不能改写 A2UI 消息、Action 标识或业务数据；错误 `code` 保持稳定。面向开发者的核心接入说明提供中英文。

## 1. 接入目标

Agent 开发者能发现当前可用组件，取得 Schema 和可运行模板，发送 A2UI 消息，在预览中验证结果，接收 UI Action 并返回后续更新。无需修改 Playground 源码，也无需了解插件内部 React/iframe 实现。

两条入口共用同一消息校验与 Runtime：

- 模板入口：选择组件和场景 → 填参数 → 实例化成 A2UI 消息 → 提交。
- 协议入口：Agent 自行生成 A2UI 消息 → 校验 → 提交。

本 API 是开发测试用的平台接口。A2UI 负责消息语义；REST、SSE、会话 ID、序号和幂等字段是平台的传输约定。未来业务 Host 可复用 Runtime Adapter，开发者不必永久依赖 Playground 服务。

## 2. Agent API

统一前缀 `/api/v1`，与现有插件构建 API 分开列出；后续版本迁移必须有说明。

| Method | Path | 作用 |
|---|---|---|
| GET | `/components` | 列出当前可用组件、分类、图标标识、Catalog/组件版本、插件来源和模板 ID |
| GET | `/components/:componentKey` | 返回确切 Schema、绑定规则、Actions、支持的渲染策略及可用性 |
| GET | `/templates/:templateId` | 返回输入 Schema、默认值、场景步骤及示例消息 |
| POST | `/templates/:templateId/instantiate` | 将参数转成已校验的 A2UI 消息和独立 Scenario 配置；不执行渲染 |
| POST | `/messages/validate` | 校验单 JSON、数组或 JSONL；返回消息索引、行号、JSON Pointer 和错误说明 |
| POST | `/preview-sessions` | 创建开发预览会话，选择外部 Agent 或 Mock 处理 Action |
| GET | `/preview-sessions/:sessionId` | 返回会话状态、过期时间、最近接收/应用序号 |
| POST | `/preview-sessions/:sessionId/messages` | 顺序提交一批 A2UI 消息 |
| GET | `/preview-sessions/:sessionId/events` | SSE 订阅接收状态、应用结果、Action 和错误 |
| GET | `/preview-sessions/:sessionId/actions?after=:cursor` | 以游标读取 Action；作为 SSE 的简单替代，不会读取即删除 |
| DELETE | `/preview-sessions/:sessionId` | 销毁会话及关联 Surface、实例、监听器和未完成任务 |

`componentKey` 是 URL 安全、由平台返回的不透明标识；业务身份仍由 Catalog ID、componentType、组件版本和可选插件版本确定。Agent 使用发现结果，不拼接插件 ID 猜测路径。

## 3. 最小接入流程

1. 调用组件和模板 API，取得现有组件、输入 Schema 和示例。
2. 调用模板实例化 API，或直接构造 A2UI 消息。
3. 创建预览会话，打开返回的 Playground 预览地址；等待预览连接。
4. 订阅事件，然后提交初始消息。开发者可以看到实际 UI 和消息应用结果。
5. 需要流式展示时，依次提交数据更新。模板中的延迟由 Playground Simulator 或客户端调度，不注入 A2UI 消息。
6. 用户点击组件后，外部脚本接收 Action，执行业务/测试逻辑，再提交后续 A2UI 更新。

创建会话的请求：

```json
{
  "actionHandler": "external",
  "preview": {
    "runtimeMode": "sandbox",
    "container": "card"
  }
}
```

响应示意（配置和序号等完整字段见 OpenAPI）：

```json
{
  "sessionId": "preview-demo-001",
  "runId": "run-demo-001",
  "status": "waiting_for_preview",
  "previewUrl": "http://localhost:5173/playground?session=preview-demo-001",
  "expiresAt": "2026-11-13T07:00:00Z"
}
```

预览连接后，初始消息的提交信封示意（实际组件定义从模板实例化获取）：

```json
{
  "batchId": "batch-001",
  "runId": "run-demo-001",
  "firstSequence": 1,
  "messages": [
    {
      "version": "1.0",
      "createSurface": {
        "surfaceId": "demo-001",
        "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
        "components": [
          { "id": "root", "component": "Text", "text": { "@path": "/headline" } }
        ],
        "dataModel": { "headline": "Hello from Agent" }
      }
    }
  ]
}
```

`batchId`、`firstSequence` 是本平台字段；`messages` 内保留原始 A2UI 消息。会话内每个消息占一个连续序号，本例下批从 2 开始。

## 4. 运行语义与反馈

- **提交与显示分开**：HTTP `202` 表示消息被接收；应用成功通过 `message.applied` 反馈，不能将接收回执当成可见渲染完成。渲染指标按实际可测能力单独报告。
- **单一顺序**：每个会话一个消息写入序列；预览未连接时返回明确的不可提交状态，调用方收到连接事件后用同一 batchId 重试。
- **批次校验**：入队前校验整批格式与基于当前状态可检查的顺序/引用约束；失败整批拒绝。Runtime 错误单独报告，不能承诺对已应用消息事务回滚。
- **重试**：相同 batchId 和相同内容返回原回执，不重复入队；同 ID 不同内容、序号冲突返回 `409`。拒绝跳号；运行失败后先查询已应用状态，恢复策略在实现文档中明确。
- **Action 路由**：external 与 mock 二选一；external 模式不会同时执行 Mock Rule。每个 Action 有稳定 actionId，附带 runId/来源信息及规范化 A2UI payload。
- **事件恢复**：SSE 使用事件 ID，支持 Last-Event-ID；Action 轮询使用独立的不透明游标。均按至少一次交付处理，客户端按 ID 去重。事件保留窗口有限；游标过期返回 `410`，不静默漏消息。
- **生命周期**：API 明确会话 TTL、最大消息/字节数和事件保留窗口。预览断开、刷新、会话销毁、服务重启的行为需说明；MVP 无数据库，重启后会话失效。
- **运行隔离**：事件携带 runId；Reset/切换模式产生新运行标识并拒绝旧运行的迟到更新，不能把旧 Action 的结果写进新实例。
- **错误**：返回 code、message、requestId，以及适用的 messageIndex、sequence、JSON Pointer、JSONL line。构建、校验、加载、应用错误可区分。
- **本地边界**：服务默认监听回环地址，限制允许访问的 Origin；sessionId 是关联标识，不是授权凭证。远程暴露需要另行设计身份验证，不将企业认证范围隐式加入 MVP。

运行事件的 type 属于平台外层信封，例如 `preview.connected`、`message.applied`、`ui.action`、`run.error`；它们不是新增的 A2UI Wire 命令。Action 消息作为 payload 原样保留，不把 runId 等元数据随意塞入官方消息结构。

## 5. 文档和开发者体验交付

- **Agent Quickstart**：启动服务、发现组件、打开预览、提交首条消息、查看更新、接收 Action、关闭会话；包括实际可执行的安装/运行命令。
- **OpenAPI + API Reference**：请求/响应 Schema、Content-Type、错误码、状态码、版本与兼容策略；SSE payload 及游标语义提供单独说明。
- **三种完整示例**：一次完整响应、渐进更新、用户交互闭环；分别提供 cURL、Python、TypeScript 示例。优先使用 HTTP 标准库或成熟客户端，不要求开发者安装平台专属 SDK。
- **组件参考**：参数 Schema、必填字段、默认值、数据绑定方式、支持的 Action、示例；已上传插件的参考由 Registry 同步更新。
- **模板复制入口**：每个组件模板有“复制 A2UI JSON”“复制 API 请求”“查看接入文档”；导出结果复用当前参数和选定的组件/模板版本。
- **问题排查**：未连接、Unknown Component、Schema 错误、序号冲突、重复 Action、超时、会话失效和 SDK 不支持能力的诊断路径。

文档中的命令和示例要由自动化测试执行，避免 API、组件 Schema、模板和文档各自演进。本文的设计目标不作为全部验收已通过的声明；实际测试、限制和剩余工作见 docs/acceptance-report.md。

## 6. 验收

- 外部 Python 或 TypeScript 脚本可以发现一个组件、通过模板生成消息、使真实预览显示并更新。
- 实际点击 UI 后，脚本接收对应 Action，提交结果，真实组件变化；不能仅测试伪造 Action。
- 上传未知第三插件后，发现 API 返回其 Schema/模板，外部脚本可以使用它。
- 断线恢复、幂等重试、顺序错误、过期会话及过期事件游标都有测试。
- 所有接入示例运行通过；无须真实 LLM 或企业 Orchestrator。
