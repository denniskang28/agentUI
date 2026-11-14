# 现有 Chatbot 的改造对照

## 先运行并排的两个应用

代码在 `examples/chatbot-comparison/`，下面只有 baseline 和 with-agent-ui 两套应用；它们不互相 import。先在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm builder:image
pnpm chatbot:prepare
npm ci --ignore-scripts --prefix examples/chatbot-comparison/baseline
npm ci --ignore-scripts --prefix examples/chatbot-comparison/with-agent-ui
npm run build --prefix examples/chatbot-comparison/baseline
npm run build --prefix examples/chatbot-comparison/with-agent-ui
pnpm chatbot:demo
```

打开传统版 `http://localhost:5180` 和集成版 `http://localhost:5181`，独立 Host 是 `http://127.0.0.1:4183`。Ctrl+C 停止这组演示进程。插件准备需要 Docker；已准备的目录可以复制出仓库独立运行，见 [部署指南](library-deployment.zh-CN.md)。

## 不用 Agent UI Library：普通 Chatbot 怎样做

baseline 使用 React 聊天壳 + Fastify HTTP/SSE + 确定性 Orchestrator + Expense/Finance Agent + 内存业务服务。没有使用 A2UI。前端 `web/UiPanel.tsx` 里手写报销表单和风险卡片，自己维护等待、ready、意见输入、提交锁、失败提示和结果状态。

查询 EXP-001 的数据链路是：用户消息 → `/chat` → Orchestrator 路由 → Expense Agent 发 DomainEvent → Presenter 原样输出 → SSE `type:"ui"` → UiPanel 按 kind/phase 判断渲染哪个组件。

两套程序的 Agent 均输出如下领域事件；这里只展示最终 ready 阶段，之前还有 loading 和 data：

```json
{
  "kind": "expense",
  "phase": "ready",
  "surfaceId": "expense_001",
  "data": {
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
```

baseline 把它直接放进外层 StreamEvent.payload。手写卡片收到 ready 后显示字段，点击批准时发送自定义业务动作：

```json
{
  "name": "expense.approve",
  "surfaceId": "expense_001",
  "context": {
    "reportId": "EXP-001",
    "comment": "发票已核对，同意报销",
    "idempotencyKey": "intent_exp001_approve_001"
  }
}
```

同一业务后端执行批准，产生 phase:result 的 DomainEvent，前端再更新卡片。此方式适合组件数量少、应用自己维护所有 UI；新增另一种 Agent 卡片通常需要改 UiPanel 的分支、交互状态和事件转换。已有业务服务本身并不需要为 Library 重写。

## 使用 Library：具体改哪几处

| 文件 / 目录 | baseline | with-agent-ui 的改造 |
| --- | --- | --- |
| package.json / package-lock.json | 普通 React + 后端依赖 | 安装本地 .tgz，增加 Host/deploy 命令 |
| server/ui/adapter.ts | DomainEvent 原样输出，自定义 Action DTO | 载入 manifest，每 run 一个 AgentUiAdapter，领域事件转 UiInput，校验完整 Action |
| web/UiPanel.tsx | 手写 Approval/RiskCard 与状态 | AgentUiClient + Provider + Host，连接后按顺序应用批次，回传 Action |
| release/、vendor/、deploy/、DEPLOYMENT.md | 无额外 Host | 新增发布制品、静态 Host 与独立站点部署配置 |
| server/agents/、server/orchestrator/、server/business/ | 原领域逻辑 | 内容相同，继续用原服务与路由 |
| server/index.ts、shared/、web/App.tsx、web/api.ts 等 | 原聊天传输、页面和业务类型 | 内容相同，外层 HTTP/SSE 不变 |

`pnpm chatbot:compare` 对文件计算 SHA-256，生成 `integration-diff.json`，拒绝未声明的源文件差异。对照说明在同目录 COMPARISON.md。文件相同的事实不等于所有真实项目都能零成本迁移，也不表示测得某个代码减少百分比。

## 后端 Presenter 如何转换同一 Agent 输出

| 领域阶段 | 便捷模板模式 | 原始 A2UI 模式 |
| --- | --- | --- |
| expense loading | template.create，data:{}，on_complete，ready:false | createSurface，ExpenseApprovalForm，绑定 /view；另附 on_complete 策略 |
| expense data | template.patch，完整业务对象，ready 不变 | updateDataModel 写 /view，ready 不变 |
| expense ready | template.patch 完整对象并 ready:true | 更新 /view，再更新 /ready=true |
| expense result | template.patch 服务返回的状态和数据 | updateDataModel 写服务返回的对象 |
| risk ready | 创建 finance.risk-heatmap，live | 原始创建同一个插件 |
| risk update | 原始 updateDataModel 更新 /view（故意演示混用） | 相同的原始数据更新 |
| risk result | template.patch 下钻数据 | 原始数据更新 |
| composition | 无论入口选择，均走原始结构消息 | 两个 Surface 的创建、updateComponents、deleteSurface |

完整命令数据见 [双入口详解](library-inputs.zh-CN.md)。Demo 实际 ready 阶段会再次发送完整报销对象；指南另用空 patch + ready:true 演示“单独完成信号”的等效能力。250ms 到达 data，之后再等待 650ms 到 ready，是演示调度间隔，不是测得的 Library 性能。

Agent 也可以直接输出模板/原始 UI 命令，但应由受信任后端决定允许的 Catalog、Schema、模板版本、run 和序号。不能把模型输出直接作为上传脚本执行。

## 前端怎样由手写卡片变成嵌入

原聊天壳照常收集文本和 UI 事件。with-agent-ui 的 UiPanel 从 `VITE_AGENT_UI_HOST_URL` 拉 manifest，以 runId 建立稳定 Client，在 onConnected 后重放当前运行的有序 UI 事件。每个 event.payload 已是 Adapter 产出的完整 NormalizedBatch，直接 client.apply，不需要在 Chat UI 重建组件树。

onAction 回调原样向原 `/actions` 业务入口发送完整事件。后端保留原始 Action trace，再缩小为相同 BusinessAction 调用相同服务。区别是渲染协议和事件桥，业务成功与否仍由同一个服务决定。完整 React 接线代码在 [接入步骤](library-integration.zh-CN.md)。

新方案引入了独立 Host、manifest、版本匹配和发布制品管理；换来跨 Agent 的统一渲染、模板复用、原始消息能力和隔离插件加载。现有文本消息、用户登录和普通业务页面仍由原应用管理。

## 演示脚本：每一步看什么

1. 两边查询 EXP-001。观察数据到达但未 ready 的等待区，以及 ready 后相同的张三 / 3200 CNY / 两项费用。
2. 填意见并批准。检查 trace：baseline 的自定义 Action 与集成版完整 Action；都等后端结果才显示 approved。
3. 在新会话使用“模拟下次失败”，提交后看到 error，再重试成功；看 idempotencyKey 与 resultVersion。
4. 查询风险。观察 Singapore Market 从 68→76，再点击 Japan Credit=42，后端给出 detail，exposure=12400000。
5. 集成版分别选择便捷模板/原始 A2UI 和 Sandbox/Native。模式切换新建 run；同一发布插件运行在对应隔离层。
6. 执行组合演示。两个 Surface 同时出现；真实按钮新增 note 组件，再删除两个 Surface，验证并非模板专用简化引擎。
7. 切换语言与主题、刷新恢复；未提交的本地意见草稿不保证恢复。展开并导出 trace 看真实传输数据。

## Demo 的 HTTP 接口是谁提供的

以下都是 `server/index.ts` 的业务应用接口，不是 Library SDK endpoint。`:id` 是当前 session.id；应用已有同类接口时复用即可。

| 方法 / 路径 | 请求 / 作用 |
| --- | --- |
| GET /api/session?id=... | 取得或创建会话，返回 id/runId/mode/variant |
| GET /api/sessions/:id/events?after=0 | SSE 历史与增量，事件含 id/runId/type/payload |
| POST /api/sessions/:id/chat | {text,runId}，202 后后台执行 Agent |
| POST /api/sessions/:id/actions | {runId,action}，校验并执行业务，结果通过 SSE |
| POST /api/sessions/:id/reset | {mode}，创建新运行并清理旧运行 |
| POST /api/sessions/:id/fail-next | {}，只为演示下次业务失败 |

浏览器自动重连可用 Last-Event-ID；显式离线重连使用 after。数据仅存内存，进程重启后不能继续旧会话。Demo 使用本地规则匹配意图，不调用真实 LLM、SSO、数据库或财务系统。

## 如果原来已经是纯官方 A2UI

这与 baseline 不同。已有 Agent 的官方 JSON 可以直接包入 `{type:"a2ui",messages:[...]}`，无需先改成模板。把现有应用自己的 Core/Renderer 嵌入、隔离插件和事件通信接入替换为本 Library 的 Adapter + Host/Client，再对齐序号、生命周期和事件信封。以后只对固定场景逐步增加模板，复杂结构保留原始消息。

两种入口共存不削弱已验证的 Action 能力；仍须检查现有 Catalog、组件和可选扩展是否在当前 Host 的支持范围，不能仅凭“JSON 合法”断言所有官方生态交互都已兼容。

继续阅读：[把这套体系部署到你的项目](library-deployment.zh-CN.md)。
