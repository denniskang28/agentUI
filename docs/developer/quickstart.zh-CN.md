# Agent 接入快速开始

本平台接收 A2UI v1.0 JSON / JSON Array / JSONL。消息由官方 Core 与 React Renderer 处理。HTTP 会话、消息序号、模板、渲染策略和 Plugin SDK 是本项目接口。

## 启动本地服务

需要 Node.js 24+、pnpm 10.32.1、Python 3 和 Docker。项目根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm builder:image
pnpm demos:package
pnpm dev
```

主页面为 http://localhost:5173，Preview Host 为 http://127.0.0.1:4173，API 为 http://localhost:5173/api/v1。插件示例需要先在 Plugins 页面点击「加载示例插件」，这会实际上传 ZIP 并通过 Docker 编译。

## 运行完整示例

以下三种客户端均提供完整响应、渐进更新、真实点击 Action 后返回更新三个场景。一次运行一个命令；打开脚本打印的 previewUrl。action 场景需要点击预览中的「生成报告」。

```sh
python3 examples/agent.py --scenario full
python3 examples/agent.py --scenario progressive
python3 examples/agent.py --scenario action

node examples/agent.ts --scenario full
node examples/agent.ts --scenario progressive
node examples/agent.ts --scenario action

bash examples/agent.sh full
bash examples/agent.sh progressive
bash examples/agent.sh action
```

Python/TypeScript 示例可指定 --locale en-US；cURL 示例使用 AGENT_UI_LOCALE=en-US 环境变量。切换平台语言不会翻译 Agent 返回的业务数据。

## 接入自己的 Agent

1. GET /components，按 componentKey 发现组件及 templateIds。安装未知插件后同一个接口会返回它。
2. POST /templates/{templateId}/instantiate，传入 values 和可选 surfaceId，获取合法消息及 scenario 配置。
3. POST /preview-sessions，指定 actionHandler=external 和 preview 配置，打开返回的 previewUrl。
4. 查询会话或订阅 events，等待 preview.connected；预览未连接时不能提交。
5. POST 会话的 /messages，传入唯一 batchId、当前 runId、连续 firstSequence 和原始 A2UI messages。
6. 等待 message.applied，同时监听 run.error 并查询 lastAppliedSequence；序号包含 Core 报告错误的确认，插件错误也可能稍后到达。HTTP 202 只表示接收，不代表 UI 已绘制。
7. 使用 SSE ui.action，或 GET /actions?after=0。保存返回的不透明 cursor，下一次原样传回；按 actionId 去重，并核对 runId。
8. 将业务结果转为 updateDataModel 后提交下一批。结束后 DELETE 会话。

## 消息和平台配置

```json
{
  "actionHandler": "external",
  "preview": {
    "runtimeMode": "sandbox",
    "locale": "zh-CN",
    "container": "card",
    "componentPolicies": {
      "approval": {
        "form": { "renderPolicy": "on_complete", "readyWhen": "/complete", "timeoutMs": 15000 }
      }
    }
  }
}
```

componentPolicies 按 Surface ID、Component ID 寻址。readyWhen 是 Surface Data Model 的布尔字段 JSON Pointer。on_complete 同时等待 ready=true 和数据 Schema 有效；live 首次就绪后持续更新。progressive 可逐步补全有效的部分数据。配置不是 A2UI Wire 命令，不应塞进业务 Data Model。

同一 Surface 可组合不同 Catalog 的组件：Surface 设置默认 catalogId，来自其他 Catalog 的组件显式设置自己的 catalogId。使用发现接口返回的真实标识。

## 排错与生命周期

PREVIEW_NOT_CONNECTED：打开 previewUrl 并等待连接。INVALID_MESSAGES：先调用 /messages/validate 查看官方诊断。INVALID_TEMPLATE_VALUES：检查发现接口中的 inputSchema。SEQUENCE_CONFLICT：查询 lastReceivedSequence 后决定下一序号，不盲目跳号。

相同 batchId 和相同请求内容可安全重试；不同内容复用 batchId 会冲突。Reset 或切换模式后 runId 更新，旧结果会被拒绝。重置后所有批次必须携带当前 runId。模式切换重放已接收消息，普通 Reset 清空消息和实例。

会话默认一小时过期；预览 15 秒无心跳视为断开。API 重启后会话失效，已安装插件可从本地 Registry 恢复。示例为方便检查会保留会话，可用 DELETE /preview-sessions/{sessionId} 清理。
