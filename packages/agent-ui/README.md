# Agent UI embedding / 嵌入接入

Built-in capability radar / 内置能力画像：[`CapabilityProfile` configuration, templates and Actions](../../docs/developer/capability-profile.md). The public protocol entry exports `capabilityProfileSchema` and `CapabilityProfileData`; discover the template through `builtins` (`key: capability-profile`). Update the package and separate Host together.

Local distribution 0.1.0. One package exposes three independent public entry points:
本地分发版本 0.1.0，一个包提供三个公开入口：

| Import                          | Purpose / 用途                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `@enterprise/agent-ui/server`   | Trusted template/raw adapter, official Core validation and replay / 服务端适配与历史恢复 |
| `@enterprise/agent-ui/react`    | React Provider, isolated Host and MessageChannel client / 前端隔离接入                   |
| `@enterprise/agent-ui/protocol` | Public transport types and runtime schemas / 公共类型与 Schema                           |

Install the supplied tarball with Node 24. Server-only consumers do not need React. React consumers supply React 19. Host CSS, Core/Renderer, Plugin SDK and approved plugin assets are delivered separately in the static release; the chatbot does not load plugin JavaScript.

Node 24 安装随附 `.tgz`。仅服务端使用不需要 React；React 调用方提供 React 19。Host 的样式、Core/Renderer、Plugin SDK 和批准使用的制品随独立静态产物部署；业务主页面不加载上传 JS。

```sh
npm install ./vendor/enterprise-agent-ui-0.1.0.tgz
```

## Server / 后端

```ts
import { AgentUiAdapter, EMBED_PROTOCOL } from "@enterprise/agent-ui/server";
import { hostManifestSchema } from "@enterprise/agent-ui/protocol";
import { readFile } from "node:fs/promises";

const manifest = hostManifestSchema.parse(
  JSON.parse(await readFile("./release/manifest.json", "utf8")),
);
const adapter = new AgentUiAdapter("run_001", manifest.entries);
const entry = manifest.entries.find((e) => e.key === "expense.approval-form")!;

// Agent output → adapter → return the compiled batch through your HTTP/SSE stream.
// Agent 输出经过适配器后，把返回批次通过自己的 HTTP/SSE 发给前端。
const first = adapter.apply({
  protocol: EMBED_PROTOCOL,
  runId: "run_001",
  batchId: "batch_1",
  firstSequence: 1,
  inputs: [
    {
      type: "template.create",
      id: "expense_001",
      template: entry.key,
      templateVersion: entry.version,
      data: { reportId: "EXP-001" },
      lifecycle: { renderPolicy: "on_complete", ready: false },
    },
  ],
});
// Partial data is allowed while deferred; ready=true validates the complete data.
// 等待期间允许不完整数据；ready=true 时验证完整业务 Schema。
const second = adapter.apply({
  protocol: EMBED_PROTOCOL,
  runId: "run_001",
  batchId: "batch_2",
  firstSequence: 2,
  inputs: [
    {
      type: "template.patch",
      id: "expense_001",
      patch: {
        reportId: "EXP-001",
        employee: "张三",
        department: "销售部",
        category: "差旅",
        amount: 3200,
        currency: "CNY",
        notes: "上海客户拜访",
        requireComment: true,
        items: [
          { date: "2026-11-10", desc: "交通", amount: 1200 },
          { date: "2026-11-11", desc: "住宿", amount: 2000 },
        ],
      },
      ready: true,
    },
  ],
});
console.log(first, second);
// Keep one adapter per run; persist snapshot().batches and replay into a fresh
// adapter for recovery. Dispose only when the run ends.
// 每个 run 一个适配器；保存并重放 snapshot().batches，运行结束后 dispose。
adapter.dispose();
```

Raw input uses `{type:'a2ui', messages:[...]}` inside the same batch. It preserves official `version:'1.0'` messages without reducing their fields. The complete runnable comparison demo includes raw creation, streaming, Actions, structural changes and deletion, as well as template-create → raw-update → template-patch of one risk Surface.

原始入口在同一个 inputs 中使用 `{type:'a2ui', messages:[...]}`，保留官方 1.0 消息。完整 Demo 展示原始创建、流式更新、Action、结构修改和删除，以及同一风险 Surface 的模板创建 → 原始更新 → 模板 patch。

## React / 前端

Use `AgentUiProvider` with a stable `AgentUiClient(runId, onAction, onError)` and render `AgentUiHost({hostUrl,manifest,config,onConnected})`. Call `client.apply(normalizedBatch)` for each server batch **after** `onConnected`. On each connection, replay the full current-run history in order; retries are deduplicated. `client.select(surfaceIds)` selects which Surfaces to display within the same Host. A Host may render multiple Surfaces.

使用稳定的 `AgentUiClient(runId,onAction,onError)`、Provider 与 Host。Host 参数包含独立站点 `hostUrl`、已校验 `manifest`、`config` 和 `onConnected`。连接完成后按顺序 `client.apply(batch)`；每次重连重放当前运行历史，重复批次自动去重。`client.select(surfaceIds)` 可筛选同一 Host 中展示的多个 Surface。

`config` contains `locale`, `theme`, `runtimeMode` and other platform configuration. Locale/theme changes preserve component instances. To change run/runtime, mount a fresh Host/client and replay/reset deliberately. The Host component detaches ports and pending work on unmount. `client.dispose()` permanently closes a client; React StrictMode effect replay must not reuse a disposed client. Handshake/load/application timeouts are reported through `onError`; application receipts describe Core processing, not physical screen paint.

`config` 中传 locale/theme/runtimeMode 等配置。语言与主题更新保留组件实例；改变运行或执行模式时建立新 Host/client。卸载清理端口和等待任务；dispose 后不可复用，注意 StrictMode 的 effect 重放。加载、握手与应用超时通过 onError 报告；应用回执只表示 Core 处理完成。

The Action callback receives the entire versioned event. Forward it unchanged to your orchestrator, validate `actionEventSchema`, check run/surface/business ownership and authorization, then perform the business operation. Update UI only from the backend result. Do not trust a browser Action as authorization.

Action 回调接收完整信封，包括 actionId、runId、官方 name/surfaceId/sourceComponentId/timestamp/context 及扩展字段。原样交给后端，使用 actionEventSchema 校验并检查关联与权限，再执行业务；后端确认后更新界面。

## Semantics / 语义

- Input sequence counts commands; generated `messageCount` is separate. A batch ID must not be reused for different content. Gaps, stale runs and conflicting retries fail explicitly. / 输入序号按命令计数，与生成消息数分开；跳号、旧 run、冲突重试明确报错。
- Template patch shallowly updates supplied top-level business fields, replaces arrays and preserves explicit null. Missing fields stay unchanged. Nested changes use raw messages. Official v1.0 path-null deletes a field. / patch 为顶层浅更新；数组替换、null 保留、省略不变；嵌套操作走原始消息，原始 path-null 表示删除。
- Business data and readiness are separate. Deferred full data with ready=false still waits. / 完整数据不等于 ready。
- Raw updates of a template Surface remain visible to later template patches through official Core. Raw binding changes invalidate convenience patching; raw deletion removes the template mapping. / 同一 Surface 可混用；原始结构破坏绑定后拒绝模板 patch，原始删除清理映射。
- The server Core validates history; the Host Core owns interactive UI state. No second business runtime replaces either. / 服务端 Core 校验历史，Host Core 管理交互状态。
- Local limits: 2 MB/batch, 1000 batches/5000 messages per run. History validation replays the bounded history; no throughput claim is made. / 每批 2 MB，每 run 1000 批/5000 消息；历史回放校验，不宣称性能提升。

## Deployment and supported scope / 部署与范围

Client/Host must both use 0.1.0, transport `enterprise-agent-ui/1`, Core/React Renderer 0.15.0, Plugin SDK 1.0 and pinned manifest template versions. Deploy Host on a separate credential-free origin with exact parent-origin allowlist and CSP; keep business cookies/tokens off that site. Native executes only there; Sandbox uses a nested opaque-origin iframe. Do not deploy the Host below your authenticated chatbot's origin.

包与 Host 版本配套部署，清单锁定模板。Host 使用无业务凭据的独立 Origin、精确父站点白名单及 CSP，业务 cookie Domain 不覆盖 Host。Native 只在 Host 运行，Sandbox 增加 opaque iframe 隔离。

Four official wire commands and the project's verified Catalog/plugin Actions are supported. Optional function RPC and untested standard Catalog interactions are outside the verified scope. This library supplies no LLM, production identity provider, durable storage or enterprise approval service.

支持四种官方消息与本项目已验证的 Catalog/插件 Action；可选函数 RPC 和未验证 Catalog 交互不在承诺范围。本包不提供 LLM、生产鉴权、持久数据库或企业审批服务。

See the prepared standalone demo's README, COMPARISON.md and DEPLOYMENT.md for working frontend/server code, normal React comparison, artifact layout, launch/stop commands, headers, cookie rules and upgrades. Preparation requires the controlled Docker builder; deployed chat runtime requires neither Playground nor Builder.

完整前后端接入、传统 React 对照、制品清单、启动/停止、响应头、Cookie 与升级见随附 Demo 文档。准备插件需要受控 Docker Builder；已部署聊天运行不依赖 Playground/Builder。

## Library 完整使用指南 / Complete library guides

从现有 Chatbot 接入 Library，阅读下面六篇；Playground 的 **API & Docs → Library 接入指南** 同步展示同一份中英文文档。

For existing chatbot integration, follow these six guides, also available in Playground **API & Docs → Library integration guides**.

| 文档 / Guide | 简体中文 | English |
| --- | --- | --- |
| 架构与选型 / Architecture | [中文](../../docs/developer/library-overview.zh-CN.md) | [English](../../docs/developer/library-overview.en-US.md) |
| 接入步骤 / Integration | [中文](../../docs/developer/library-integration.zh-CN.md) | [English](../../docs/developer/library-integration.en-US.md) |
| 完整 A2UI 与便捷模板 / Inputs | [中文](../../docs/developer/library-inputs.zh-CN.md) | [English](../../docs/developer/library-inputs.en-US.md) |
| 事件与生命周期 / Events | [中文](../../docs/developer/library-events.zh-CN.md) | [English](../../docs/developer/library-events.en-US.md) |
| Demo 改造对照 / Migration | [中文](../../docs/developer/library-demo-migration.zh-CN.md) | [English](../../docs/developer/library-demo-migration.en-US.md) |
| 打包部署 / Deployment | [中文](../../docs/developer/library-deployment.zh-CN.md) | [English](../../docs/developer/library-deployment.en-US.md) |

[全部文档 / All documentation](../../docs/developer/README.md)
