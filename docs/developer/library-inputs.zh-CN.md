# 便捷模板与完整 A2UI

## 共同的批次信封

两个入口共用 `UiBatch`：`protocol` 固定为 `enterprise-agent-ui/1`，runId 对应已有 Adapter，batchId 标识一个不可变批次，firstSequence 从 1 开始连续。`inputs` 内可以混合不同命令；每个 input 占一个序号，不按其内部 messages 数量计数。

下文 JSON 数组表示按顺序分别调用 `adapter.apply(batch)` 的多个批次，不是把整个数组一次传给 apply。模板例子和原始例子分别使用 `run_expense` 与 `run_raw` 两个 Adapter。所有业务输入均为 JSON 数据，不发送 React/JavaScript 函数或插件源码。

## 便捷模板：报销从等待到完成

这个例子使用实际发布的 `expense.approval-form@1.0.0`。先按 [部署指南](library-deployment.zh-CN.md) 准备插件，使用 manifest.entries 构造 Adapter。生产代码应像 [接入步骤](library-integration.zh-CN.md) 那样检查版本；这里固定版本用于展示具体数据。

以下五批依次：创建空等待区、完整数据到达但不展示、ready 后展示、服务批准后更新状态、删除。第 4 批仅在业务服务已成功批准时发送，第 5 批是独立的清理示例，不应在用户刚读结果时立即执行。

```json
[
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_expense",
    "batchId": "batch_1",
    "firstSequence": 1,
    "inputs": [
      {
        "type": "template.create",
        "id": "expense_001",
        "template": "expense.approval-form",
        "templateVersion": "1.0.0",
        "data": {},
        "lifecycle": {
          "renderPolicy": "on_complete",
          "ready": false
        }
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_expense",
    "batchId": "batch_2",
    "firstSequence": 2,
    "inputs": [
      {
        "type": "template.patch",
        "id": "expense_001",
        "patch": {
          "reportId": "EXP-001",
          "employee": "张三",
          "department": "销售部",
          "category": "差旅",
          "currency": "CNY",
          "amount": 3200,
          "notes": "上海客户拜访",
          "requireComment": true,
          "items": [
            {
              "date": "2026-11-10",
              "desc": "交通",
              "amount": 1200
            },
            {
              "date": "2026-11-11",
              "desc": "住宿",
              "amount": 2000
            }
          ]
        }
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_expense",
    "batchId": "batch_3",
    "firstSequence": 3,
    "inputs": [
      {
        "type": "template.patch",
        "id": "expense_001",
        "patch": {},
        "ready": true
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_expense",
    "batchId": "batch_4",
    "firstSequence": 4,
    "inputs": [
      {
        "type": "template.patch",
        "id": "expense_001",
        "patch": {
          "status": "approved",
          "resultVersion": 1
        }
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_expense",
    "batchId": "batch_5",
    "firstSequence": 5,
    "inputs": [
      {
        "type": "template.delete",
        "id": "expense_001"
      }
    ]
  }
]
```

`template.create.id` 直接成为 Surface ID。当前模板实例通常使用根组件 `root`，业务数据放 `/view`，完成条件放 `/ready`。这些路径由 Adapter 生成，Agent 只填写 data/patch。编译后的 messages 仍是官方 A2UI，不另建一套 UI 引擎。

| 字段 | 实际语义 |
| --- | --- |
| template | manifest 中 ComponentEntry.key，如 expense.approval-form |
| templateVersion | entry.version 的精确值；不接受“latest”或自动兼容升级 |
| data | 组件业务 Schema；正常创建时与已发布 defaults 合并 |
| lifecycle | 平台策略；缺省 progressive，ready 缺省 true |
| lifecycle.ready:false | on_complete/live 延迟场景允许部分数据，不填入示例业务 defaults |
| lifecycle.timeoutMs | 可选 100–120000ms 的策略超时，不是 HTTP/业务审批超时 |
| patch | 顶层字段浅更新；省略字段不变，数组整体替换，显式 null 保留但仍须符合 Schema |
| ready | patch 的独立完成信号，放在 patch 外；完整数据本身不自动设置它 |

`on_complete` 适合不应半成品展示的审批表单；`progressive` 适合数据已符合 Schema 的逐步内容；`live` 适合持续更新的风险数据。ready=true 或 progressive 时会验证业务 Schema。不能借 ready=false 绕过最终校验。

浅更新例子：`patch:{amount:3500}` 保留 employee；`patch:{items:[...]}` 替换全部 items；`patch:{detail:{summary:"新值"}}` 替换 detail 对象，不递归保留其 region 等字段。如果需要精细更新，使用原始 `updateDataModel` 的 JSON Pointer。

创建模板与修改模板结构是两件事。当前便捷入口选择的是组件的 full 实例化，不接收 Playground 的场景 templateId 或任意模板函数。`Row.count`、`Button.action`、`Text.variant` 等创建时编进组件定义的配置，不会因只 patch `/view` 而重新生成组件树；这类变化要用原始 updateComponents，或删除后重建。先查看组件参考的真实 A2UI JSON 和 Schema，区分动态绑定数据与创建期结构配置。

live 在第一次满足 ready 后保持挂载，即使后续 ready 变 false 也不会重新回到首屏等待；on_complete 则持续检查 ready。策略超时只显示诊断，不执行业务，也不阻止继续接收后续数据。

## 完整 A2UI：四种官方消息与一个真实按钮

下面使用 Basic Catalog，不依赖报销插件。组件树为 Column、Text、Button；按钮的 event context 绑定 `/reportId`。后端收到 `summary.confirm` 后可发送第 2 批。第 3 批增加 note 组件并更新 root.children，第 4 批删除 Surface。

```json
[
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_raw",
    "batchId": "batch_1",
    "firstSequence": 1,
    "inputs": [
      {
        "type": "a2ui",
        "messages": [
          {
            "version": "1.0",
            "createSurface": {
              "surfaceId": "raw_001",
              "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
              "components": [
                {
                  "id": "root",
                  "component": "Column",
                  "children": [
                    "headline",
                    "submit"
                  ]
                },
                {
                  "id": "headline",
                  "component": "Text",
                  "text": {
                    "@path": "/headline"
                  }
                },
                {
                  "id": "submit",
                  "component": "Button",
                  "child": "submit_label",
                  "action": {
                    "event": {
                      "name": "summary.confirm",
                      "context": {
                        "reportId": {
                          "@path": "/reportId"
                        }
                      }
                    }
                  }
                },
                {
                  "id": "submit_label",
                  "component": "Text",
                  "text": "确认 / Confirm"
                }
              ],
              "dataModel": {
                "headline": "请核对 EXP-001",
                "reportId": "EXP-001"
              }
            }
          }
        ]
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_raw",
    "batchId": "batch_2",
    "firstSequence": 2,
    "inputs": [
      {
        "type": "a2ui",
        "messages": [
          {
            "version": "1.0",
            "updateDataModel": {
              "surfaceId": "raw_001",
              "path": "/headline",
              "value": "后端已收到确认"
            }
          }
        ]
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_raw",
    "batchId": "batch_3",
    "firstSequence": 3,
    "inputs": [
      {
        "type": "a2ui",
        "messages": [
          {
            "version": "1.0",
            "updateComponents": {
              "surfaceId": "raw_001",
              "components": [
                {
                  "id": "root",
                  "component": "Column",
                  "children": [
                    "headline",
                    "submit",
                    "note"
                  ]
                },
                {
                  "id": "note",
                  "component": "Text",
                  "text": "新增组件 / Added component"
                }
              ]
            }
          }
        ]
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_raw",
    "batchId": "batch_4",
    "firstSequence": 4,
    "inputs": [
      {
        "type": "a2ui",
        "messages": [
          {
            "version": "1.0",
            "deleteSurface": {
              "surfaceId": "raw_001"
            }
          }
        ]
      }
    ]
  }
]
```

正式代码不要在创建后立刻执行所有四批；在对应业务阶段提交。`updateComponents` 用于结构/属性，`updateDataModel` 用于绑定数据，不能把 `surfaceUpdate` 或自创 `component.complete` 当作 1.0 命令。组件 ID 示例使用 UAX31 兼容的 root/submit_label；Surface ID 的规则与组件 ID 不同。

原始 messages 保留官方字段。`renderPolicy/readyWhen` 属于平台配置，不塞进官方 wire message；按需放在传给 client 的 normalized batch 的 `componentPolicies[surfaceId][componentId]`。这也是原始报销输入需要另外配置 on_complete 的原因。

## 同一个报销插件，两种输入到底差在哪里

便捷入口第 1 批只描述 template、version、data 和 lifecycle。对应的原始创建需要自己从 manifest 取 Catalog/组件身份并指定绑定：

```ts
import type { HostManifest, UiInput } from "@enterprise/agent-ui/protocol";
function createExpenseRaw(manifest: HostManifest): UiInput {
  const entry = manifest.entries.find((item) => item.key === "expense.approval-form");
  if (!entry?.catalogId) throw new Error("EXPENSE_NOT_INSTALLED");
  return { type: "a2ui", messages: [{
    version: "1.0",
    createSurface: {
      surfaceId: "expense_001", catalogId: entry.catalogId,
      components: [{ id: "root", component: entry.component, data: { "@path": "/view" } }],
      dataModel: { ready: false, view: {} },
    },
  }] };
}
// Add a policy to the compiled batch passed to the frontend:
// componentPolicies.expense_001 = {
//   root: { renderPolicy: "on_complete", readyWhen: "/ready" }
// };
```

原始报销后续更新：`updateDataModel` 写 `/view` 为完整业务对象，再写 `/ready` 为 true。审批结果可写 `/view/status` 和 `/view/resultVersion`。便捷入口则写 `template.patch`，由 Adapter 生成同样的官方数据更新及策略。

| 责任 | 直接官方 A2UI SDK（不使用本 Library） | 本 Library 原始入口 | 本 Library 便捷入口 |
| --- | --- | --- | --- |
| 组件树、Catalog 和绑定 | 自行构造并接 SDK | 自行构造，经 Adapter 校验 | 根据发布模板生成 |
| 数据更新 | 官方 updateDataModel | 原始 updateDataModel | template.patch 编译为数据更新 |
| 结构与多 Surface | 自行处理官方命令 | 完整四种消息 | 创建/删除模板实例；结构变化切原始 |
| Action 及交互 | 自接 SDK 回调、传输、生命周期 | 共用完整 Action 桥 | 共用相同完整 Action 桥 |
| 隔离 Host、版本、ACK、恢复 | 应用自行实现 | 共用 Host/Client | 共用 Host/Client |
| Schema 与版本 | 自行管理 | 官方结构校验；插件业务校验仍依组件/服务端 | 模板版本与业务 Schema 额外校验 |

“纯官方 SDK”与“完全不用 A2UI 的手写 React baseline”是不同方案。Demo baseline 是后一种；[Demo 对照](library-demo-migration.zh-CN.md) 分别说明两者，避免把 baseline 称作原生 A2UI。

## 混用：模板创建 → 原始更新 → 模板 patch

风险 Demo 用 template.create 创建 `finance.risk-heatmap@2.1.0`，raw updateDataModel 更新 `/view` 中 Singapore 的市场值 68→76；下钻结果再通过 template.patch 更新 detail。Adapter 会从官方 Core 读取当前 `/view` 再合并 patch，因此不会把刚到达的 76 覆盖回旧值。

```json
{
  "type": "a2ui",
  "messages": [{
    "version": "1.0",
    "updateDataModel": { "surfaceId": "risk_001", "path": "/view/rows/1/market", "value": 76 }
  }]
}
```

此片段是 UiInput，需包在当前 run 的合法 UiBatch 中；假定 risk_001 已创建且第二行是 Singapore。多个 Agent 共用一条 run 写入序列，应由 Orchestrator 汇总并排序，不能各自从 sequence=1 开始。

## 混用的边界

- 同一模板 Surface 可被原始数据更新，随后继续模板 patch。
- 如果原始 updateComponents 改动已有模板组件定义（包括组件类型、绑定或其他原定义字段），Adapter 会使便捷绑定失效，后续 patch 报 TEMPLATE_BINDING_CHANGED。当前检测是保守的，不只检查路径。
- 添加与原模板组件 ID 不冲突的独立节点通常不破坏绑定；是否展示仍由组件树决定。
- 原始 deleteSurface 会清理模板映射；之后 template.patch/delete 失败。重新 template.create 才能建立新实例。
- 纯原始创建不会自动注册便捷模板实例；不能直接给它 template.patch。继续原始路径，或者删除后用模板创建。
- 官方 path 上的 value:null 表示删除；template.patch 的 null 表示保留一个业务 null。选择入口时须区分这两种语义。

便捷入口不发明新的点击、完成或业务事件。需要自定义输入、校验和交互时先发布合适插件，或使用已经验证的官方 Catalog；便捷模板不会自动为任意业务字段生成完整表单。

继续阅读：[Action、结果、重放与生命周期](library-events.zh-CN.md)。
