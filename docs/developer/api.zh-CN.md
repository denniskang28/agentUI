# API 参考

基础地址：http://localhost:5173/api/v1。直接访问 API 服务也可使用 http://127.0.0.1:3001/api/v1。请求和普通响应使用 application/json，SSE 使用 text/event-stream，插件上传使用 multipart/form-data。

OpenAPI 3.1：GET /openapi.json。请求 Schema 与服务校验器共用定义，响应和 SSE 事件 Schema 对应已实现契约；OpenAPI 内自包含消息 Schema 来自官方 SDK 的公开 Zod 导出。原始官方 Wire Schema：GET /schemas/agent-to-renderer.json。Catalog 文档：GET /catalogs 或 GET /catalogs/{编码后的 catalogId}。

## 发现与模板

GET /components 返回 components 数组，包含 key、component、catalogId、protocolVersion、版本、source、availability、supportedRenderPolicies、defaultRenderPolicy、defaults、fields、schema、wireSchema、inputSchema、actions 和 templateIds。插件的 schema 描述已解析业务 data；wireSchema 描述 A2UI 组件属性及动态绑定。catalogSchemaUrl 指向带定义的完整 Catalog 文档。

GET /components/{componentKey} 查看单个组件。GET /templates/{templateId} 查看默认输入、消息序列及渲染策略。POST /templates/{templateId}/instantiate 接受 values 的局部覆盖和可选 surfaceId；平台合并 defaults、校验输入并生成消息。

```json
{ "values": { "text": "Hello from Agent" }, "surfaceId": "report" }
```

POST /messages/validate 要求 messages（1–1000 个对象）与非空 text 字符串恰好提供一项，可选 prior 最多 5000 个消息对象。未知顶层字段、null、两项同时提交均返回 400。text 支持单条、数组和 JSONL。响应为 valid、errors；HTTP 200 且 valid=false 表示协议/Catalog 校验失败，请求 JSON 或参数本身非法则返回 400。这里验证官方 Wire、Catalog 和消息引用/顺序；动态绑定后的业务数据还会在 Preview 的组件边界校验。JSONL 语法错误提供原始行号。

语法解析失败返回 HTTP 400，稳定 code 为 JSON_SYNTAX / JSONL_SYNTAX；details 包含从 1 开始的 line、column，从 0 开始的 offset（JavaScript UTF-16 字符位置），以及原始 diagnostic。MESSAGE_TOO_LARGE、MESSAGE_COUNT、MESSAGE_OBJECT 分别表示输入大小、消息数、消息对象类型不合法。UI 按所选语言显示摘要，原始诊断与机器字段保持原样。

## 创建与查询会话

POST /preview-sessions 接受 actionHandler（external 默认，或 mock）和 preview。preview 可设置 runtimeMode、container、locale、theme、renderPolicy、readyWhen、readyTimeoutMs、componentPolicies；不传时采用平台默认值。locale 仅支持 zh-CN / en-US，API 默认 zh-CN。其他默认值：runtimeMode=sandbox、container=card、theme=light、renderPolicy=progressive、readyWhen=/ready。readyTimeoutMs 可省略（Runtime 默认 15 秒），显式传入须为 100–120000 ms 整数。componentPolicies 为 Surface ID → component ID → 规则，包含 renderPolicy、可选 readyWhen/initialReadyWhen 和 timeoutMs；未知请求/配置字段返回 400。

返回 sessionId、runId、previewUrl、expiresAt、status、lastReceivedSequence、lastAppliedSequence、config。GET /preview-sessions/{sessionId} 返回同样的当前状态。打开 previewUrl 后等 connected，再提交消息。

## 提交消息

```json
{
  "batchId": "batch-001",
  "runId": "使用会话返回的当前标识",
  "firstSequence": 1,
  "messages": [
    {
      "version": "1.0",
      "createSurface": {
        "surfaceId": "hello",
        "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
        "components": [{ "id": "root", "component": "Text", "text": { "@path": "/title" } }],
        "dataModel": { "title": "Hello from Agent" }
      }
    }
  ]
}
```

POST /preview-sessions/{sessionId}/messages 返回 202 和 batchId、runId、firstSequence、lastSequence、status=accepted。每条消息占一个序号。下批从 lastSequence+1 开始。相同 batchId 与相同解析后 JSON 请求可重试；对象键顺序和空白不影响幂等，数组顺序、字段是否存在及其值（含 runId）影响幂等；同 ID 改内容返回 BATCH_CONFLICT。

初始运行兼容省略 runId，但应始终传入。Reset 后省略会返回 RUN_ID_REQUIRED，旧 runId 返回 STALE_RUN。整批入队前通过官方校验；运行期间的组件错误不承诺事务回滚。

请求体最多 2 MB，每批 1–1000 条消息，每个 run 的已接收历史最多 5000 条消息（Reset 开始新历史）。插件上传压缩文件最多 5 MB。会话默认 TTL 一小时，事件和 Action 各保留最近 500 条，预览 15 秒无心跳视为断开。TTL 从创建起绝对计时，心跳不会续期。到期无需后续请求即发出 session.destroyed（reason=expired）、关闭 SSE 并释放会话数据。清理后一小时内查询过期 ID 返回 SESSION_EXPIRED / 410，之后为 SESSION_NOT_FOUND / 404；主动销毁或未知 ID 返回 404。API 内存会话不跨重启保存。

## SSE 与 Action 轮询

GET /preview-sessions/{sessionId}/events?after=0 建立 SSE。恢复时优先使用 Last-Event-ID 请求头，也可传 after；该事件 ID 是递增整数。after=0 仅取当前保留窗口，不保证完整历史；非零游标落在窗口之前返回 410，未来或非法游标返回 400。服务端保活注释不是事件。

事件字段为 id、type、runId、timestamp、payload。类型包括 preview.connected、messages.queued、message.applied、run.error、ui.action、run.reset、session.destroyed。

GET /preview-sessions/{sessionId}/actions?after=0 返回 actions、cursor、runId。后续把 cursor 原样传给 after；它独立于 SSE ID，不应解析、加一或与其他会话交换。cursor 过期返回 410，错误或跨会话游标返回 400。

ui.action 的 payload 包含 actionId、actionHandler、action。规范化消息位于 payload.action，其中 version=1.0，action 包含 name、surfaceId、sourceComponentId、timestamp、context。这些平台元数据不混入原始 A2UI 数据模型。

按 actionId 去重、核对 event.runId 后处理；消息可能至少一次交付。external 不运行 Mock Rule，mock 由本地规则产生后续数据。message.applied 表示 Core 处理且未报告 Core 错误，不代表插件绘制完成。lastAppliedSequence 为最高已确认/已处理序号，包含报告错误的 ACK，不是成功渲染数量。run.error 带 sequence 和 errors，涵盖 Core 以及稍后发生的插件加载/渲染/桥接错误；异步插件错误不推进确认序号。恢复前同时检查事件和会话：可用 updateComponents 替换错误组件、updateDataModel 修正数据，或 Reset 开始新运行；重发已接受 batchId 只返回原回执，不会重新执行。

## 重置与销毁

DELETE /preview-sessions/{sessionId} 返回 204，销毁会话并通知已连接预览。预览页面内部使用 connect、heartbeat、ack、action、error、reset 端点实现桥接；Agent 不应伪造这些回执。

工作台 Reset 清空运行；模式切换创建新 runId，重放相同已接收消息。所有迟到 Action/结果按 runId 拒绝。刷新预览会重连并从已接收历史恢复；API 重启需创建新会话。

## 上传与错误

GET /plugins 返回 plugins 和 builds。POST /plugins 上传 file；TSX 额外提交 metadata 字符串，其 JSON 包含 manifest 和 catalog。ZIP 自带 plugin.json / catalog.json。DELETE /plugins/{pluginId} 卸载。

TSX metadata 必须包含合法的严格 manifest 与 catalog 描述，非法 metadata 返回 400 / INVALID_METADATA；ZIP 中的非法 JSON、catalog 数据/默认值或 JSON Schema 返回结构化 422，构建标记失败且不注册残缺插件。字段与限制见插件开发指南。

错误响应为 code、message、requestId；按错误附带 details，包括请求 issues、模板/Schema errors、批次 firstSequence/runId 或 JSON/JSONL 位置。机器字段和原始诊断不翻译。常见状态：400 参数或游标错误；404 组件/模板/会话不存在；409 未连接、批次冲突、序号冲突、旧运行；410 会话/游标过期；413 大小限制；415 文件类型；422 Wire/业务 Schema/构建失败；503 Docker 构建器不可用；504 隔离构建超时。

已知 Catalog 中的未知组件类型显示单组件占位，其他组件仍可更新和交互；后续 updateComponents 可用已支持类型替换它。占位是平台渲染适配，不是新增的 A2UI 命令或可发现组件。原始消息、业务数据及导出保持原样；Inspector 的组件树显示实际解析结果。未知 Catalog、已知组件的非法属性和非法 ID 仍按官方 Core 规则报错。

平台仅监听本机，不带生产身份认证。允许工作台和 Preview Host 的固定 Origin；opaque Sandbox 只能读取构建产物，不能调用会话 API。
