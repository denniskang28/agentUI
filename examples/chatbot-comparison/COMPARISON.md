# 代码与数据对照 / Code and data comparison

两套应用不互相 import。`pnpm chatbot:compare` 逐文件计算 SHA-256，一致文件及允许的差异记录于 integration-diff.json；未声明的差异导致命令失败。报告统计文件事实，不宣称代码减少比例或性能提升。

The applications do not import each other. The comparison command checks source-file SHA-256 values and rejects undeclared differences. The report describes files, not invented savings or benchmark results.

| File                                                | baseline                                                    | with-agent-ui                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| shared/domain.ts、shared/i18n.ts                    | 相同业务类型/词典 / Same types and dictionary               | 相同 / Identical                                                              |
| server/business、server/agents、server/orchestrator | 相同数据、审批规则、Agent、路由 / Same data and logic       | 相同 / Identical                                                              |
| server/index.ts                                     | 相同会话、SSE、业务入口 / Same transport and routes         | 相同 / Identical                                                              |
| web/App.tsx、api.ts、main.tsx、style.css            | 相同聊天壳、传输、样式 / Same shell and transport           | 相同 / Identical                                                              |
| server/ui/adapter.ts                                | 输出业务 DTO，读取自定义 Action / Business DTOs and Actions | 包适配器编译模板/原始输入，校验完整 Action / Package adapter and full Actions |
| web/UiPanel.tsx                                     | 手写卡片、交互状态、事件 / Handwritten cards and state      | 公开 React 包、Host、批次回执 / Public package and isolated Host              |
| package.json、lock                                  | 普通 React/服务端依赖 / Standard app dependencies           | 增加本地包和 Host 启动命令 / Package and Host launch                          |
| deploy、DEPLOYMENT.md                               | 无额外 Host / No extra Host                                 | Host 配置和部署说明 / Host deployment                                         |

## 相同的 Agent 业务输出 / Same domain output

Expense Agent 第一次发出 `loading`，随后发出完整 `data`，最后发出 `ready`。以下数据在两套程序的 business/services.ts 中相同：

Both agents emit loading, complete data and ready as separate domain stages:

```json
{
  "reportId": "EXP-001",
  "employee": "张三",
  "department": "销售部",
  "category": "差旅",
  "currency": "CNY",
  "amount": 3200,
  "notes": "上海客户拜访",
  "requireComment": true,
  "items": [
    { "date": "2026-11-10", "desc": "交通", "amount": 1200 },
    { "date": "2026-11-11", "desc": "住宿", "amount": 2000 }
  ]
}
```

传统版传输业务事件 `kind=expense, phase=ready, surfaceId, data`，UiPanel 自己解释这些字段。

The baseline transports domain DTOs and interprets their fields in handwritten React cards.

集成版由 `server/ui/adapter.ts` 编译 Agent 的业务输出。便捷创建为：

The integrated presentation adapter creates a template command:

```json
{
  "type": "template.create",
  "id": "expense_example",
  "template": "expense.approval-form",
  "templateVersion": "1.0.0",
  "data": {},
  "lifecycle": { "renderPolicy": "on_complete", "ready": false }
}
```

数据和 ready 通过后续 patch 分别发送。原始模式直接创建 `ExpenseApprovalForm`，绑定 `data: {"@path":"/view"}`，通过 updateDataModel 更新数据及 ready。两个入口输出同一类规范化批次，前端只转发，Host 使用官方 Core/Renderer。

Data and ready arrive in later patches. Raw mode creates the component directly, binds `/view` and uses updateDataModel. Both entry points compile to the same normalized transport and official Host runtime.

## Action 对照 / Actions

传统版自行发送 `name, surfaceId, context`。集成版保留：

The integration retains the complete normalized Action:

```json
{
  "protocol": "enterprise-agent-ui/1",
  "runId": "current_run",
  "actionId": "unique_action",
  "message": {
    "version": "1.0",
    "action": {
      "name": "expense.approve",
      "surfaceId": "expense_example",
      "sourceComponentId": "root",
      "timestamp": "2026-11-14T08:00:00.000Z",
      "context": {
        "reportId": "EXP-001",
        "comment": "同意",
        "idempotencyKey": "stable_business_intent"
      }
    }
  }
}
```

上例 ID/时间为说明值。两套最终调用相同的业务服务；服务校验演示审批身份、报销单、Surface 归属和业务幂等键。失败结果允许重试，不把 pending 直接改成批准。

IDs/timestamps above are illustrative. Both implementations call the same business service with ownership and idempotency checks. Pending becomes approved only after backend confirmation.

## 混用和能力边界 / Mixing and limits

风险场景先用模板创建，随后用原始 updateDataModel 更新，再以模板返回下钻结果。组合场景使用原始 createSurface/updateComponents/deleteSurface，演示模板之外的结构能力。

Risk uses template creation, a raw streamed update and a template drilldown result. Composition uses raw structural messages and multiple Surfaces.

便捷命令不是官方协议；输入序号按命令计数，messageCount 单独记录生成的 A2UI 条数。完整标准 Catalog 交互和可选函数 RPC 尚不在已验证能力范围内。刷新恢复消息历史及权威业务状态，插件局部未提交草稿不承诺跨刷新持久化。

Convenience commands are platform interfaces. Input sequence counts commands; messageCount counts generated A2UI messages. Optional function RPC and full standard-catalog interaction coverage are not claimed. Refresh restores history and authoritative business results; unsent local form drafts are not persisted across refresh.
