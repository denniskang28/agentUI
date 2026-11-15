# 从安装到首屏

## 第一步：准备可交付产物

第一次建议直接运行 [Demo 的准备流程](library-deployment.zh-CN.md)。在当前仓库完成构建后，把 `.tgz` 和整套 `release/` 交给现有 Chatbot 项目。不要只复制插件 TSX。以下命令在消费者项目根目录执行：

```sh
npm install ./vendor/enterprise-agent-ui-0.2.0.tgz
```

前端需要 React 19；参考 Demo 使用 Node 24、ESM、TypeScript strict。包未发布到公共 npm registry，不能假定 `npm install @enterprise/agent-ui` 能获取当前交付版本。前后端拆仓时在各自项目安装本地包；后端只导入 `/server` 与 `/protocol` 即可。

## 第二步：后端增加一个 UI Presenter

保留意图识别和 Agent 调用。Agent 可以直接输出 UiInput，也可以继续返回业务数据，再由 Presenter 转换；当前 Demo 选择后者，因此两套 Agent 完全一致。

下面是一个可执行的最小 Node/TypeScript 服务端示例；工作目录需要准备好的 `release/manifest.json`。它只生成首屏批次，不启动 HTTP 服务。使用消费者已有的 TS runner 或先编译为 ESM 运行。

```ts
import { readFile } from "node:fs/promises";
import { AgentUiAdapter, EMBED_PROTOCOL } from "@enterprise/agent-ui/server";
import { hostManifestSchema, type UiInput } from "@enterprise/agent-ui/protocol";

const manifest = hostManifestSchema.parse(
  JSON.parse(await readFile("./release/manifest.json", "utf8")),
);
const runId = "run_001";
const adapter = new AgentUiAdapter(runId, manifest.entries);
let nextSequence = 1;

function present(batchId: string, inputs: UiInput[]) {
  const batch = adapter.apply({
    protocol: EMBED_PROTOCOL, runId, batchId,
    firstSequence: nextSequence, inputs,
  });
  nextSequence = batch.lastSequence + 1;
  return batch;
}

const text = manifest.entries.find((entry) => entry.key === "text");
if (!text) throw new Error("TEXT_NOT_INSTALLED");
const firstBatch = present("batch_1", [{
  type: "template.create", id: "summary_001",
  template: text.key, templateVersion: text.version,
  data: { text: "Hello from Agent" },
}]);
console.log(JSON.stringify(firstBatch));
// adapter.dispose() only when this run ends.
```

示例 `present()` 用于新批次。失败时不推进序号；重试一个已提交批次时应保存并原样重交原 `UiBatch`，包括它原来的 `firstSequence` 和 `batchId`，不能把它重新包装为当前 nextSequence。

Adapter 每个 run 保留一个实例，不能每条消息都 new。当前模板版本从已校验 manifest 取得；`template` 是 `entry.key`，不是 Playground REST API 的场景 templateId。未安装报销插件时，默认内置列表不会凭空出现 `expense.approval-form`。

## 第三步：沿用自己的传输层

将上面 `firstBatch` 的完整返回值通过现有 HTTP 响应、SSE 或 WebSocket 交给浏览器。不要只返回 `messages` 而丢掉 `componentPolicies`、顺序和 run 信息。Adapter 不替你创建 HTTP endpoint。

本 Demo 的外层业务事件是：

```json
{
  "id": 1,
  "runId": "run_001",
  "type": "ui",
  "payload": {
    "batchId": "batch_1",
    "runId": "run_001",
    "firstSequence": 1,
    "lastSequence": 1,
    "messageCount": 1,
    "messages": [
      {
        "version": "1.0",
        "createSurface": {
          "surfaceId": "summary_001",
          "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "components": [
            {
              "id": "root",
              "component": "Text",
              "text": {
                "@path": "/view/text"
              },
              "variant": "body"
            }
          ],
          "dataModel": {
            "view": {
              "text": "Hello from Agent",
              "variant": "body"
            },
            "ready": true,
            "input": "",
            "checked": false,
            "choices": []
          }
        }
      }
    ],
    "componentPolicies": {
      "summary_001": {
        "root": {
          "renderPolicy": "progressive",
          "readyWhen": "/ready"
        }
      }
    },
    "replay": false
  }
}
```

外层 `id` 是业务 SSE 的游标；`firstSequence/lastSequence` 是 Library 的输入序号；`messageCount` 是生成的官方消息数。三者不可互相替代。结构展示采用该 Text 模板当前的默认数据；应用应直接传 Adapter 真实结果，不手工拼装 normalized payload。

## 第四步：加载 Host manifest

后端与前端必须使用同一发布版本的 manifest。浏览器从独立 Host 无凭据获取并校验：

```ts
import { hostManifestSchema } from "@enterprise/agent-ui/protocol";
const hostUrl = "http://127.0.0.1:4183";
const response = await fetch(`${hostUrl}/manifest.json`, { credentials: "omit" });
if (!response.ok) throw new Error(`MANIFEST_HTTP_${response.status}`);
const manifest = hostManifestSchema.parse(await response.json());
```

Host、manifest 和制品的部署见 [部署指南](library-deployment.zh-CN.md)。Host URL 必须与主应用不同 Origin；Host 自带样式，主应用无需导入插件 CSS 或 JavaScript。

## 第五步：替换富 UI 渲染分支

下例负责完整的嵌入和当前 run 历史重放。上层传入按事件 ID 排序、仅含当前 run UI 批次的 `records`；文本和 trace 继续由原聊天 UI 处理。HTTP/SSE 的收发由现有应用提供。

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AgentUiClient, AgentUiHost, AgentUiProvider } from "@enterprise/agent-ui/react";
import { normalizedBatchSchema, type ActionEvent, type HostManifest } from "@enterprise/agent-ui/protocol";

type UiRecord = { id: number; payload: unknown };
type Props = {
  runId: string;
  hostUrl: string;
  manifest: HostManifest;
  records: UiRecord[]; // retained UI batches for this run, sorted by event ID
  onAction: (event: ActionEvent) => Promise<void>;
  onError: (error: unknown) => void;
};
export function ChatRichUi(props: Props) {
  const { runId, hostUrl, manifest, records } = props;
  const callbacks = useRef(props);
  callbacks.current = props;
  const [connection, setConnection] = useState(0);
  const applied = useRef(0);
  const client = useMemo(() => new AgentUiClient(
    runId,
    (event) => { void callbacks.current.onAction(event).catch(callbacks.current.onError); },
    (error) => callbacks.current.onError(error),
  ), [runId]);

  useEffect(() => {
    if (!connection) return;
    let active = true;
    void (async () => {
      for (const record of records) {
        if (!active || record.id <= applied.current) continue;
        const receipt = await client.apply(normalizedBatchSchema.parse(record.payload));
        if (!active) return;
        applied.current = record.id;
        if (receipt.errors.length) callbacks.current.onError(receipt.errors);
      }
    })().catch((error) => { if (active) callbacks.current.onError(error); });
    return () => { active = false; };
  }, [client, records, connection]);

  return <AgentUiProvider client={client}>
    <AgentUiHost hostUrl={hostUrl} manifest={manifest}
      config={{ locale: "zh-CN", theme: "light", runtimeMode: "sandbox", container: "chat" }}
      onConnected={() => { applied.current = 0; setConnection((n) => n + 1); }} />
  </AgentUiProvider>;
}
// Mount as <ChatRichUi key={runId} ... />. Change the key/client on run reset.
```

`onConnected` 每次连接后重放已保留历史，Host 刷新也能恢复。Client 内部按顺序发送、相同批次去重。新的 records 到来时，上一个异步循环可能已经发送一批，去重机制负责重复提交；事件游标仅在回执之后推进。

示例必须以 runId 为 React key 挂载。模式/manifest 版本更换也应重新建立 Host/client，并决定重放或重置。单个 Client 只连接一个 Host；多 Surface 可以在同一个 Host 显示，不要为同一条运行的每个消息复制独立 runtime。

不要在 React StrictMode 可重放的 cleanup 中永久 `dispose()` 后继续复用同一 client；Host 卸载已经 detach 端口和等待任务。非 React 的所有者真正结束运行时可 `client.dispose()`。不要在未连接时调用 apply；`onError` 与 `receipt.errors` 都要接入现有错误展示。

## 第六步：把完整 Action 交回原后端

`onAction(event)` 的入参就是完整 `ActionEvent`。以下是接入 Demo 自有业务 endpoint 的回调写法；不是 Library 内建 HTTP API：

```ts
import type { ActionEvent } from "@enterprise/agent-ui/protocol";
async function onAction(event: ActionEvent) {
  const sessionId = "your-current-session-id";
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/actions`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId: event.runId, action: event }),
  });
  if (!response.ok) throw new Error(await response.text());
}
```

替换 sessionId 并沿用你的身份/CSRF/错误处理。后端用 `actionEventSchema.parse()` 校验，再校验当前 run、Surface 归属和权限。由 Orchestrator 调业务服务，服务结果再次经过 Presenter 返回 UI。见 [完整事件与失败重试](library-events.zh-CN.md)。

## 公开入口速查

| 入口 | 主要公开能力 | 放在哪里 |
| --- | --- | --- |
| `/server` | AgentUiAdapter、createHostManifest、builtins、instantiate、validateMessages、AgentUiError | 受信任业务服务端；不在主页面运行插件 |
| `/protocol` | UiInput/UiBatch/ActionEvent、batchSchema/normalizedBatchSchema/actionEventSchema/hostManifestSchema | 传输边界的类型与运行时校验 |
| `/react` | AgentUiClient、AgentUiProvider、AgentUiHost | 现有 React 应用 |

最小接入完成条件：真实 Host 已连接、文本 Surface 出现、后续 patch 更新、真实按钮 Action 能返回后端、业务结果更新、reset 后拒绝旧 run。不要以“收到 HTTP 202”代替完成闭环。

## Client 与 Host 的使用细节

| API | 用途与约束 |
| --- | --- |
| new AgentUiClient(runId, onAction?, onError?) | 持有一个运行的消息队列和连接；回调同步触发，异步业务 Promise 自行捕获错误 |
| client.apply(batch) | 接收 NormalizedBatch，返回 Promise<HostReceipt>；Host connected 后调用 |
| client.configure({locale,theme}) | 运行中可改的两个配置；不支持用它切 runtimeMode |
| client.select(surfaceIds?) | 筛选显示；省略表示不限制 Surface |
| client.subscribe(listener) | 订阅桥接诊断消息，返回取消订阅函数；不要用它替代 onAction 的业务校验 |
| client.detach() | 可再次连接的清理；Host 通常自动调用 |
| client.dispose() | 永久关闭，不能在原对象上恢复 |
| adapter.getSurfaceData(surfaceId) | 返回服务端官方 Core 数据的克隆；不是浏览器未提交输入的同步读取 |
| adapter.snapshot() / dispose() | 应用自己持久化批次 / 运行结束清理 |

Provider 只有 client/children。Host 的公开 props 为 hostUrl、manifest、config、surfaceIds、title、onConnected。`title` 是 iframe 的无障碍名称，不是业务卡片标题；高度由 Host resize 回报并自动限制在 32–10000px。

config 为 Partial<RunConfig>：runtimeMode 取 native/sandbox；theme 取 light/dark；locale 取 zh-CN/en-US；container 取 card/chat/workspace；renderPolicy、readyWhen、readyTimeoutMs 为全局策略；componentPolicies 可以按 Surface/组件设置 renderPolicy、readyWhen、initialReadyWhen、timeoutMs。组件批次带来的策略会随批次传入 Host。模板通常已经生成策略，不需要重复手填。

RunConfig 为复用平台配置还含 actionHandler、latency、outcome；Embedded Host 缺省 external，应将真实操作交原业务后端，不能把这些 Playground 模拟参数当成生产审批服务。运行中的 configure 只更新 locale/theme；其他配置、manifest 或 runtimeMode 改动需重建 Host/client。底层 client.attach 是连接桥 API，常规 React 接入交给 Host 管理，不手动建立第二条 MessagePort。
