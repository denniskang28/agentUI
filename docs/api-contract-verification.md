# Agent API 契约核对

2026-11-14。记录已执行的契约检查；不代表整个 Goal 或视觉验收已完成。

## 契约来源

- `services/api/src/contracts.ts`：HTTP 请求的共享 Zod 校验器；服务与 OpenAPI 复用，避免参数定义各自演进。
- `services/api/src/openapi.ts`：OpenAPI 3.1，25 个 path / 27 个操作，含内部 Preview 桥接、上传、示例文件和制品路径。制品操作单独声明 Preview Host 根地址；其余位于 `/api/v1`。
- 官方 Wire 和 Action 使用 `@a2ui/web_core/v1_0` 的公开 `AgentToRendererMessageSchema` / `ActionMessageSchema` 生成自包含结构；原始官方 Schema 端点仍返回原文。不是把平台事件误称为 A2UI 命令。
- 双语 API Reference、Quickstart、Plugin Guide 与真实端点同步；设计文档不再声称服务尚未实现。

## 实际检查

`tests/integration/openapi.test.ts` 五项，使用真实 Fastify 路由、共享校验器和 Docker 构建产物：

1. 每个操作对应真实路由，operationId 唯一，路径参数匹配；请求/响应 JSON Schema 可由 Ajv 2020 编译。不解析远程 Schema，日期格式不在本结构校验器中伪装成已验证。
2. 发现所有组件与模板、实例化、校验、创建/连接/心跳、提交/ACK、Action 轮询、运行错误、Reset/重放、销毁的真实响应符合声明；所有平台事件逐项符合 SessionEvent。
3. null、错误类型、空输入、歧义输入和未知传输字段明确拒绝；协议校验失败仍为 200 / valid=false，模板/批次错误为 422 并保留 details。消息接收只有 202，删除为 204 空体。
4. 通过真正 ZIP 上传、隔离构建、插件发现、制品读取、卸载核对响应；非法 TSX metadata 不再变成 500。
5. 幂等比较忽略 JSON 对象键顺序，保留数组顺序与字段值语义；内容变化仍为 BATCH_CONFLICT。用发现结果在客户端直接生成模板也必须通过官方校验，防止新增 Catalog 元数据改变基础组件消息格式。

`tests/integration/sse.test.ts` 三项使用真实 HTTP：Last-Event-ID 重放、游标过期，以及无需后续请求即可由 TTL / 服务关闭发出 session.destroyed 并结束正在读取的流。到期 ID 保留一小时轻量墓碑，期间返回 410；之后或未知/主动销毁 ID 返回 404。

`tests/e2e/runtime-safety.spec.ts` 真实上传抛错插件：Native / Sandbox 各自通过错误 → 桥接 → Agent SSE run.error → 删除 → 预览清理；保留越权操作、错误隔离和后续恢复检查。`tests/e2e/external-locale.spec.ts` 两项验证外部会话语言切换保留实例，模式重放 / Reset 保留新语言及正确 runId，没有重复 Action。

九个 Python / TypeScript / cURL 接入示例在完整 E2E 中实际驱动预览，不以注入虚假 ACK 替代渲染；部分底层契约测试直接调用内部 ACK 是为了检查接口本身。

## 明确的语义与限制

- HTTP 202 是接收回执；message.applied 是 Core 处理回执；两者都不是插件绘制成功。lastAppliedSequence 包括带错误的处理确认，必须结合 run.error 判断，异步插件错误不推进序号。
- 整批在入队前校验；运行时错误不事务回滚。重试已接收 batchId 不重新执行，修复应发新序号更新或开始新 run。
- TTL 从创建绝对计时，不随心跳续期；5000 条历史限制作用于每个 run。SSE after=0 只取保留窗口；Action 初始 0 若已有 Action 丢出窗口则返回 410。
- 语言不改写协议、机器错误码、JSON Pointer 或业务数据；原始 SDK/第三方诊断保留。工作台模式重放与 Reset 将当前语言带入新 run。
- 插件 JSON Schema 使用 Ajv 默认 draft-07 严格编译；不获取远程 $ref。TSX metadata 400、ZIP/Schema/构建失败 422、Builder 不可用 503、构建超时 504 均写入文档。未放松 Docker、CSP 或 Sandbox 权限。
- 本地单进程/内存会话，不提供持久化或生产授权；内部 bridge 操作只供实际 Preview 使用，Agent 不应制造应用回执。
