# Action 与运行生命周期

## 用户点击后收到的完整数据

报销插件是一个根组件，所以 sourceComponentId 是 root；插件内部区分批准/驳回/退回的动作名。基础 Catalog Button 则使用它自身的组件 ID。sourceComponentId 不等于业务报销单 ID。

下面是 Client.onAction 收到的数据形状。具体 ID 和时间由运行时产生，不应在业务代码写死：

```json
{
  "protocol": "enterprise-agent-ui/1",
  "runId": "run_expense",
  "actionId": "action_001",
  "message": {
    "version": "1.0",
    "action": {
      "name": "expense.approve",
      "surfaceId": "expense_001",
      "sourceComponentId": "root",
      "timestamp": "2026-11-14T08:00:00.000Z",
      "context": {
        "reportId": "EXP-001",
        "comment": "发票已核对，同意报销",
        "idempotencyKey": "intent_exp001_approve_001"
      }
    }
  }
}
```

模板和原始入口都收到这一完整信封。官方部分为 message；protocol/runId/actionId 是本项目桥接协议的外层元数据。`message.action` 允许保留额外字段，不在 Presenter 入口提前压缩为 `{name,context}`。如果业务层只需要更小 DTO，应在记录和校验完整事件后转换。

## 后端的处理顺序

```ts
import { actionEventSchema } from "@aap/agent-ui/protocol";
function readAction(body: unknown, currentRunId: string) {
  const event = actionEventSchema.parse(body);
  if (event.runId !== currentRunId) throw new Error("STALE_RUN");
  return event; // retain the full event for routing / audit
}
```

1. 用业务应用已有身份认证与 CSRF 策略接收请求；sessionId/runId/actionId 不能替代认证。
2. 校验 Schema、当前 run、Surface 是否属于当前会话及其业务实体、是否已 ready。
3. 检查动作白名单与用户权限；根据服务端真实单据状态执行。前端 context 的 amount/role 等都不是可信授权信息。
4. 使用业务幂等键检查同一意图；持久记录结果，再返回领域事件。完整 Action 可以进入审计日志，但按业务隐私策略处理意见等数据。
5. Presenter 编译结果 UI，沿现有 SSE 返回；错误同样形成可见结果，不能永久停在“提交中”。

当前 Demo 的 Presenter 校验完整 Action 后，Orchestrator 检查 Surface/ready，并调用固定 demo-approver 身份的演示服务。真实身份、持久审计和企业权限由生产应用实现。

## actionId 和业务幂等键不同

`actionId` 标识桥接产生的一次事件，便于事件日志和传输去重；不能单独提供业务 exactly-once。用户重试或刷新后重新点击可能形成新 Action。审批服务应使用 context.idempotencyKey 代表“同一单据、同一操作、同一意见”的意图。

Demo 插件为相同动作/单据/意见保留同一意图键，提交中锁定按钮。演示服务对成功结果缓存：相同键与相同内容返回原结果，相同键不同内容拒绝；模拟失败不记成功缓存，因此相同意图可重试。真实服务需要数据库事务和幂等记录，而非仅前端禁用按钮。

例如：失败后 `{status:"error",resultVersion:1}` 解除提交锁；重试成功后 `{status:"approved",resultVersion:2}` 更新表单。`resultVersion` 让重复错误结果仍可触发组件状态恢复。它是业务组件约定，不是 A2UI wire 字段。

## 原始 Button 的事件绑定

[双入口指南](library-inputs.zh-CN.md) 的 raw Button 使用 `action.event.name` 和 context 中的 `{"@path":"/reportId"}`。实际点击时官方 Renderer 解析绑定，生成包含 name、surfaceId、sourceComponentId、timestamp、context 的 Action。插件的 dispatch 同样归一到这条链路。

业务 Action 通常触发后端结果再写 Data Model；不要把任何本地输入变化自动当成“已保存到后端”。插件可以在组件本地保留未提交输入。本版不会把未提交意见草稿持久化到服务器历史，刷新/重建 Host 后可能丢失。

## 三层协议不要混用

| 层 | 例子 | 作用 |
| --- | --- | --- |
| 业务 HTTP / SSE | /api/sessions/:id/events，type:ui/trace/reset | 应用自己传输、恢复和路由 |
| Library 输入/输出 | UiBatch.inputs → NormalizedBatch.messages/componentPolicies | 模板编译、顺序、幂等、运行隔离 |
| 官方 A2UI | version:1.0 与四种 wire command；message.action | Surface、Data Model、绑定和交互 |

Demo 的 HTTP endpoint 是演示后端实现，不是 Library 自动注册的路由；Playground `/api/v1` 又是另一套开发预览服务。Playground Preview API 按 wire message 计序，Library 按 input 计序，不能复用它们的计数器。

## 顺序、重试与回执

- 一个 input 占一个 sequence；一个 a2ui input 可以含多条官方消息；一个模板 patch 可能生成很多消息或 0 条。
- 使用返回的 lastSequence+1 作为下一批起点；batchId 和内容均相同的重试返回 replay:true，内容变化则 BATCH_CONFLICT，跳号报 SEQUENCE_CONFLICT。
- Adapter 先用官方 Core 重放有界历史并试处理新批次，再提交；格式/状态校验失败不推进输入序号。服务端校验不是所有浏览器插件执行的事务回滚承诺。
- Adapter.apply 结果表示服务端校验/应用；Client.apply Promise 的 HostReceipt 表示 Host Core 已处理，需检查 errors。异步插件错误也可能随后经 onError 到达。
- HTTP 202 只是应用接受请求；ACK 也不等于物理屏幕绘制。不把这些时间报告为真实渲染性能。

## 重连与恢复

保留当前 run 的有序输入批次或编译结果。Host 连接完成后重放全部当前 run UI 批次；Client/Host 会处理相同批次重试。业务 SSE 客户端按 event ID 去重，并提供恢复游标。Host 刷新会丢浏览器状态，必须重放创建、数据和 ready，不只发最新 patch。

服务端恢复可保存 `adapter.snapshot()`，再用相同 runId、相同 manifest 创建新 Adapter，依次 `apply(snapshot.batches[i])`；nextSequence 从恢复的回执取得。snapshot 是显式数据，不是自动数据库；保存和加载由应用负责。AgentUiClient 没有 snapshot API，恢复应从业务历史重新供给。

当前 Demo 使用内存：每会话最多保留 5000 个外层事件、进程最多 100 个会话；达到事件上限会报 SESSION_LIMIT，超过会话上限报 DEMO_SESSION_LIMIT；不静默丢弃旧历史。无效游标报 INVALID_CURSOR，丢失或过期历史的恢复策略由业务系统定义。后端重启会丢失会话和业务状态。生产需要自己的持久会话、历史保留与恢复策略。

## Reset、切换模式、语言和主题

reset、新会话、模板/原始入口切换和 Native/Sandbox 切换都创建新 run，销毁旧 Presenter/Adapter 并重新挂载 Host/client，拒绝迟到批次和 Action。当前 Demo 这么做是为了对照一致，并非 raw/template 必须分 run；业务上可以在同一 run 混用。

locale/theme 可以通过 config 或 client.configure 实时更新；不会重建已有组件。不要翻译机器动作名、字段名或用户业务内容。`client.select(surfaceIds)`/Host.surfaceIds 只筛选同一个 runtime 里的可见 Surface，不创建另一个 Core。

## 超时、容量和常见错误

| 情况 | 当前行为 / 处理 |
| --- | --- |
| iframe 未 ready | 15s 后 HOST_LOAD_TIMEOUT；检查 URL、CSP、父 Origin、网络 |
| 初始化未 connected | 15s 后 HOST_CONNECT_TIMEOUT；检查 Host/manifest/运行错误 |
| 批次无应用回执 | 15s 后 HOST_ACK_TIMEOUT；确认连接，使用原 ID 恢复，不盲目跳号 |
| Host 卸载 | detach 关闭 MessagePort、清等待项，相关任务报 HOST_DETACHED |
| client.dispose 后复用 | 需创建新 client；StrictMode cleanup 使用 Host 的 detach 机制 |
| 模板不存在/版本不符 | UNKNOWN_TEMPLATE / TEMPLATE_VERSION；检查同版 manifest |
| 模板数据非法 | INVALID_TEMPLATE_DATA；按错误 details 和 Schema 修复 |
| 原始消息非法 | INVALID_MESSAGES；按官方 Core 的错误修复 |
| binding 被结构改动 | TEMPLATE_BINDING_CHANGED；继续 raw 或重建模板实例 |
| 单批太大/历史太长 | 2,000,000 UTF-8 bytes/批；1000 批、5000 生成消息/run，明确拒绝 |

Adapter 会重放有界历史做校验，成本随历史增长；本版不宣称任意长会话或未经实测的吞吐量。UI loading/error/业务重试应由宿主应用清晰展示；不要把策略 timeout 当成业务自动批准或取消。

继续阅读：[Demo 改造对照](library-demo-migration.zh-CN.md)。
