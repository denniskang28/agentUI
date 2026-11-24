# MCP Apps Host 接入

适用版本：`@enterprise/mcp-apps-host@0.1.0`，Node 24+、React 19、TypeScript strict。A2UI 使用原有 `@aap/agent-ui`，两个通道互不转换。MCP Apps 使用 ext-apps 2.0.4、Client/Server 2.4.0 和 Node Transport 2.1.2；新包独立依赖 Zod 4，现有 A2UI Zod 3 不变。

## 本地运行和发布产物

```sh
pnpm install --frozen-lockfile
pnpm mcp:dev
# http://localhost:5173 → MCP Apps
# Preview: http://127.0.0.1:4173
# 演示 Server: 127.0.0.1:3002、3003；负向协议验收夹具: 3004
pnpm mcp:build
```

如果开发服务已在运行，直接打开上述地址。重复启动会在创建子进程前列出占用端口并退出；需要重启时，先在原启动终端按 Ctrl+C，再运行命令。不要同时运行两份 `mcp:dev`，也不要与占用相同端口的 `pnpm dev` / `mcp:demo` 同时启动。

安装 `artifacts/packages/enterprise-mcp-apps-host-0.1.0.tgz`。浏览器只导入 `/react` 和 `/protocol`；Node 导入 `/server`。包内 `dist/mcp-sandbox.html`、`dist/mcp-sandbox.js` 是独立 Preview 资源。不要把 HTML 注入主应用 DOM。

`pnpm chatbot:prepare` 生成 A2UI 和 MCP 联合发布内容；示例 Chatbot 使用 vendor 的真实安装包，不依赖仓库源码。之后在示例目录执行 `npm ci && npm run build`。`npm run deploy` 启动业务后端和静态 Preview。配置 `MCP_SERVERS_JSON` 后，点击 Chatbot 的 **MCP App**；已有 A2UI 卡片继续独立工作。演示编排器是确定性逻辑，不声称连接了 LLM。

## React 和可替换后端

```tsx
import {McpAppView, httpTransport} from '@enterprise/mcp-apps-host/react';
// connection 和 appId 来自自己的、经过用户授权的业务后端。
const transport = useMemo(() => httpTransport('/api/mcp', connection, appId),
  [connection.id, connection.ownerToken, appId]);
return <McpAppView transport={transport}
  sandboxUrl="https://preview.example.net/mcp-sandbox.html"
  locale="zh-CN" theme="light"
  onMessage={message => sendToOrchestrator(message)}
  onContextUpdate={context => updateOrchestratorContext(context)} />;
```

保持 transport 身份稳定；挂载 View 仅获取快照，不执行初始工具。主题/语言变更通过官方 Host Context 通知，不重建业务调用。业务文案由第三方 App 决定，不自动翻译。可自行实现 `HostTransport` 替换 HTTP：snapshot、callTool、readResource、events(after)、destroy 均使用公开类型，支持 AbortSignal。View 卸载关闭桥接、移除监听器；实例属于业务后端/会话，在关闭卡片、Reset、会话结束时调用 destroy/disconnect。StrictMode 重放 effect 不会执行工具，也不会提前永久销毁实例。

`McpAppsPanel` 是可选的双语开发工作台。生产 Chatbot 使用 `McpAppView` 并接入自己的聊天、授权及上下文逻辑。Playground 的消息/上下文回调只记录，不冒充 Agent 执行。外链仅在显式 `onOpenLink` 回调时宣告支持，Host 检查 HTTP(S)，业务方仍须执行目标允许策略。仅 inline 模式；浏览器权限、嵌套 App 和其他显示模式不支持。

## Node Gateway 与已执行的 Agent 调用

```ts
import {installMcpRoutes} from '@enterprise/mcp-apps-host/server';
const gateway = await installMcpRoutes(fastify, [{
 id:'reports',name:'Reports',url:'https://mcp.example.net/mcp',
 allowedTools:['report','approve'],headers:{Authorization:process.env.MCP_AUTH!},
 resourceDomains:['https://static.example.net'],connectDomains:[]
}], '/api/mcp');
const connection = await gateway.connect('reports');
// 可信编排器在同一 Client 会话执行一次：
const result = await gateway.callForHost(connection.id,connection.ownerToken,
 {name:'report',arguments:{id:'R-1'}});
const app = await gateway.attach(connection.id,connection.ownerToken,
 {runId:'run-1',requestId:'call-1',tool:'report',arguments:{id:'R-1'}},result);
// 仅把 connection capability + app.id 返回授权的当前用户。
```

也可以通过 `create`/HTTP `/apps` 让 Gateway 执行初始工具。两条入口择一，不能先执行再调用 create。attach 不开放浏览器 HTTP 路由；编排器负责证明结果来自同一连接的同一业务调用。不自动重试副作用工具。MCP Server 凭据仅在后端，绝不发送到 Preview；ownerToken 是浏览器业务通道的连接能力令牌，不是 MCP Server 凭据。生产必须在 installMcpRoutes 外层添加用户认证、连接归属、CSRF/Origin 和速率控制；当前本地工作台以能力令牌保护实例，不构成生产多租户方案。

## HTTP / 事件契约（Java 同样适用）

所有 JSON；错误为 `{code,message}` 和 HTTP 4xx/5xx，初始异步工具错误位于 snapshot.status/error。Host UI 收到普通工具结果或资源错误时保留文本。除创建连接/列举受控 Server 外，均需 `x-mcp-owner: <ownerToken>`。没有任意 Server URL 或任意 JSON-RPC 代理接口。

| 方法和路径（以 /api/mcp 为根） | 输入 / 输出 |
|---|---|
| GET /servers | 受控 `{id,name}[]`，不含地址/凭据 |
| POST /connections | `{serverId}` → `{id,serverId,ownerToken,tools}` |
| GET、DELETE /connections/:c | 描述 / 断开及清理所有实例 |
| POST /connections/:c/apps | `{runId,requestId,tool,arguments:{}}` → AppSnapshot |
| GET、DELETE /connections/:c/apps/:a | 最新快照 / 销毁 |
| POST …/:a/tool-calls | `{name,arguments?}` → 官方 CallToolResult；校验 app 可见性与服务端 allowlist |
| POST …/:a/resource-reads | `{uri}` → 官方 ReadResourceResult；限发现/关联资源 |
| POST …/:a/cancel | `{}` → `{cancelled:true}`；运行中任务取消，迟到结果丢弃 |
| GET …/:a/events?after=N | 按实例递增 GatewayEvent[] |

AppSnapshot 包含 id（appInstanceId）、serverConnectionId、runId、toolCallId、tool、input、status、result?、error?、resource?、resourceError?。resource 包含 uri、html、有效 csp。status：running → complete/error/cancelled。App 内后续工具结果通过该请求响应与 `app.tool.result` 事件返回，不覆盖初始 result。

事件结构：`{id,type,appInstanceId,runId,at,payload}`。初始游标0，按返回最大 id 递增；每实例保留500个。过期游标返回410 EVENT_CURSOR_EXPIRED：重新读取快照后建立新实例/重新绑定，不重放业务工具。非法/未来游标400。轮询和挂载均无副作用；不要根据日志重放 tools/call。_meta 可以返回 App，但不要自动写入 LLM 上下文。连接硬 TTL 1小时，最多50连接、100个创建 requestId；请求/响应约2MB、单实例同时一个工具、两个资源读取，工具超时15秒，UI/代理初始化10秒，teardown最多等待500ms。示例无跨进程持久化；服务重启后连接404，用户显式重连。

相同 requestId、同一完整创建数据返回同一实例（保留至连接断开）；改数据409 REQUEST_CONFLICT。关闭后的旧 ID 不可再读。取消已完成初始调用不回滚业务。异常断线最终以请求超时/连接错误诊断；后端 TTL/断开负责资源释放。连接允许工具列表和 app/model 可见性取交集；浏览器无权扩大。

Java 业务后端可以调用此契约，也可以自己实现契约并通过 Java MCP Client 持有连接。React 无需 Node 模板翻译服务；原始 A2UI 直接走 A2UI 通道。本仓库只交付 Node Gateway 和可编译执行的 Java HTTP 客户端示例，不提供 Java Gateway/SDK。见 `examples/mcp/java`。

## 独立 Preview 部署

必须使用独立 Origin（示例 `127.0.0.1:4183` 与 `localhost:5181`），不设置业务 Cookie/认证头；HTTPS 生产环境两端均用 HTTPS。公开静态资源中不能放秘密。代理内部 iframe 只有 allow-scripts，origin 为 opaque；主页面不能切换成 Native 执行外部 App。

部署 `/mcp-sandbox.html`、`/mcp-sandbox.js` 和 `/host-config.json`（`{allowedParents:["https://chat.example.com"]}`）。服务 HTML 时调用公开 `sandboxHeaders(new URL(request.url,origin),allowedParents,allowedExternalOrigins)` 生成 HTTP CSP、Permissions-Policy、no-referrer、nosniff、no-store，失败返回403。查询 parentOrigin 必须精确匹配；csp 查询仅可收紧部署允许的精确 Origin，不能增加允许域。参考 `scripts/serve-embedded-host.ts`，`pnpm chatbot:prepare` 会导出可直接运行的静态服务器，已有 A2UI 页面保留独立策略。仅复制 HTML 到普通静态目录、遗漏动态响应头是不完整部署。

资源 `_meta.ui.csp` 与 Gateway `resourceDomains/connectDomains` 求交集；Preview 再以 `MCP_RESOURCE_ORIGINS` 约束。不支持 wildcard、frameDomains、baseUriDomains、浏览器权限。支持 text/blob 单个完整 HTML，URI 必须匹配 ui://，MIME 必须 text/html;profile=mcp-app；UI-only URI 不要求出现在 resources/list。HTML 体积及整个返回值限制都会执行。未宣告域名默认拒绝。opaque iframe 不支持 App 依赖 Cookie、localStorage 或直接访问父 DOM 的做法。父绑定使用显式配置与 postMessage 的 origin/source，不依赖 referrer。

Server URL 仅来自可信配置，远程必须 HTTPS、公开 IP；DNS 在连接建立时校验并固定，重定向拒绝。本地演示必须显式 allowLocal。不要把不可信用户提供的 URL/allowLocal/允许域写入配置。Builder、上传插件的 Docker 约束与参考 ZIP 不受此通道影响。

## 验证

```sh
pnpm typecheck
pnpm test
pnpm mcp:dev
# 另一个终端
pnpm exec playwright test tests/e2e/mcp-apps.spec.ts
pnpm chatbot:prepare
MCP_SERVERS_JSON='[{"id":"expense-demo","name":"Expense","url":"http://127.0.0.1:3002/mcp","allowLocal":true,"allowedTools":["expense_dashboard","approve_expense"]}]' pnpm chatbot:consumer
```

官方示例源码、许可证和 commit/blob 来源位于 examples/mcp/official-quickstart；测试输入不构成 Provider 产品。验收证据与已知范围见 docs/mcp-apps-acceptance.md、mcp-apps-compatibility.md。
