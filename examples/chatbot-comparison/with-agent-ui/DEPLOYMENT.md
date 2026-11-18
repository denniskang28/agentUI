# 部署 / Deployment

## 产物 / Artifacts

`pnpm chatbot:prepare` 在仓库根目录构建以下产物，并复制到本目录：

Preparation builds and copies these artifacts:

| Path                                 | Purpose                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| vendor/enterprise-agent-ui-0.1.0.tgz | 前后端公开 Library / Public frontend/server package                                      |
| release/host/                        | 官方 Core/React Renderer 与隔离插件 Host 的静态站点 / Static isolated Host               |
| release/artifacts/{buildId}/         | Docker 实际编译的 plugin.js、预编译 validator.js 和可选 CSS / Genuine compiled artifacts |
| release/manifest.json                | Host/SDK/模板/组件版本及制品位置 / Versioned manifest                                    |
| release/serve-host.mjs               | 仅用 Node 内置模块的静态服务器 / Dependency-free Node static server                      |

`.tgz` 包含 ESM、类型声明和公开 protocol/server/react exports。业务代码不能导入仓库 src 或 SDK 私有路径。插件只在受控构建器编译；运行时只加载发布制品。

The package contains ESM, declarations and public exports. Consumers must not import repository source or private SDK paths. Plugins are compiled by the constrained builder; runtime loads approved artifacts only.

## 独立运行 / Standalone

将包含 vendor/、release/ 的整个 with-agent-ui 目录复制到任意新目录：

Copy the whole prepared directory, including vendor/ and release/, outside the repository:

```sh
npm ci --ignore-scripts
npm run build
npm run deploy
```

打开 http://localhost:5181。`npm run deploy` 同时启动业务应用与独立 Host，Ctrl+C 清理子进程。Docker 仅用于准备插件，不是运行前提。

Open http://localhost:5181. Deploy starts the application and independent Host; Ctrl+C stops its child processes. Docker is needed for plugin preparation only.

## 地址与响应头 / Addresses and headers

| Configuration           | Default                                     | Stage                                        |
| ----------------------- | ------------------------------------------- | -------------------------------------------- |
| VITE_AGENT_UI_HOST_URL  | http://127.0.0.1:4183                       | 前端构建 / frontend build                    |
| DEMO_PORT               | 5181                                        | 后端运行 / backend runtime                   |
| DEMO_PUBLIC_ORIGIN      | http://localhost:5181                       | 后端 Origin 校验 / backend Origin validation |
| AGENT_UI_HOST_PORT      | 4183                                        | Host 运行 / Host runtime                     |
| AGENT_UI_PARENT_ORIGINS | http://localhost:5180,http://localhost:5181 | 精确允许的父 Origin / exact parent origins   |
| AGENT_UI_RELEASE_DIR    | serve-host.mjs 所在目录 / script directory  | Host 静态制品目录 / release root             |

自定义部署示例 / Custom deployment example:

```sh
VITE_AGENT_UI_HOST_URL=https://ui-host.example.test npm run build
DEMO_PUBLIC_ORIGIN=https://chat.example.test NODE_ENV=production npm start
```

另一个终端 / Another terminal:

```sh
AGENT_UI_PARENT_ORIGINS=https://chat.example.test npm run host
```

用你自己的 TLS 反向代理转发到两个本地端口；deploy/nginx.example.conf 提供示意，域名和证书须按实际环境配置。示例配置不表示已经公开部署。

Use your TLS reverse proxy for the two local ports; deploy/nginx.example.conf is illustrative. Configure actual names/certificates yourself. This delivery does not publish a public site.

Host 服务设置 CSP、精确 frame-ancestors、no-referrer、Permissions-Policy 和 nosniff。只为无凭据的公共静态制品设置通配 CORS，业务 API 不在这个站点。opaque Sandbox 需要读取这些静态制品，不能调用业务/会话 API。

The Host sets CSP, exact frame-ancestors, no-referrer, Permissions-Policy and nosniff. Wildcard CORS is only for public credential-free static assets, not business APIs. Opaque Sandbox frames can read artifacts but have no session/business API on the Host.

## Cookie、版本和生命周期 / Cookies, versions and lifecycle

Host 必须是独立 Origin，部署时也要避免让业务认证 cookie 的 Domain 覆盖 Host；优先使用独立站点和业务 host-only cookie。不向 Host 注入登录 Token、Authorization 或企业会话。

Use a separate Host origin and avoid authentication cookie domains covering it; prefer a separate site and host-only business cookies. Do not inject authentication tokens into the Host.

Native 在 Host 内运行；Sandbox 再隔离为 opaque iframe。主 chatbot 不 import 上传 JS。MessageChannel 建立前校验父 Origin、source 和协议版本；后续校验 run、批次和 Action。Host 清单中的插件地址仅允许本 Host 的 /artifacts 路径。

Native runs in the Host; Sandbox adds an opaque iframe. The chatbot never imports uploaded JavaScript. Bridge setup verifies origin/source/version; messages verify run/batch/Action. Manifest assets are restricted to this Host's artifact paths.

本版 client/Host 为 0.1.0，协议 enterprise-agent-ui/1，Core 0.15.0，Plugin SDK 1.0；模板锁定实际组件版本。升级时一起替换包、Host、manifest 和相应制品，再重新构建消费者。运行中的旧 run 先销毁再创建；不要把不同发布版本的文件混放。

Client/Host 0.1.0, transport enterprise-agent-ui/1, Core 0.15.0, Plugin SDK 1.0. Templates pin actual component versions. Upgrade package, Host, manifest and artifacts together, rebuild the consumer and recreate active runs.

刷新通过 SSE 历史重放恢复结构、数据及 ready；API 进程重启会丢失内存会话和业务状态。输入事件和生成的消息使用不同计数，不混用。组件应用回执不等于屏幕绘制完成。演示身份、内存存储不是生产认证/数据库实现。

Refresh replays SSE history, including structure/data/ready. Server restart clears in-memory sessions and business state. Input sequence and generated message count differ. Core application receipts do not prove physical paint. Demo identity/storage are not production authentication/database implementations.

## 故障处理 / Troubleshooting

- Host 无法连接：检查健康接口 /health、前端 hostUrl、allowedParents、frame-ancestors 和端口。 / Check health, URL, allowed origins, CSP and ports.
- 插件加载失败：检查 manifest 中的 buildId、JS/validator/CSS 的 HTTP 状态和 MIME。 / Check artifact IDs, HTTP status and MIME types.
- 一直等待 ready：检查业务数据 Schema 和单独的 ready 更新，展开诊断。 / Inspect data schema and the separate ready transition.
- 旧运行/序号冲突：开始新运行或按历史顺序恢复，不盲目跳号。 / Reset or replay in order; do not skip sequences.
- 本地包更新仍加载旧代码：重新准备并执行 npm ci，替换本地构建缓存。 / Prepare and run npm ci again after package changes.
- Docker 不可用：只影响插件准备；启动 Docker 后重试构建，不在本机执行上传源码。 / Docker is required for preparation; never bypass isolation.

停止用 Ctrl+C；删除演示状态可清除浏览器 conversation localStorage，或重启演示后端。生成的 vendor/release/dist 可通过准备和构建命令重建。

Stop with Ctrl+C. Clear conversation localStorage or restart the backend to discard demo state. Generated vendor/release/dist are reproducible from preparation/build commands.

完整部署指南 / Full guide: [中文](../../../docs/developer/library-deployment.zh-CN.md) · [English](../../../docs/developer/library-deployment.en-US.md).

MCP Apps 使用同一独立 Preview 发布包中的专用 `/mcp-sandbox.html`，由导出的静态服务器设置独立响应头；不能使用普通 SPA fallback 替代。后端环境 `MCP_SERVERS_JSON` 配置受控 Server；外部 UI 域名还需 Preview `MCP_RESOURCE_ORIGINS`，与资源声明和 Gateway 策略同时匹配。`AGENT_UI_PARENT_ORIGINS` 必须包含真实 Chatbot Origin。发布时重新生成联合 release 和两个 vendor 包，再 `npm ci && npm run build`。生产认证/连接用户归属由业务系统提供。

MCP Apps uses the dedicated sandbox route and headers in the same separate Preview release. Configure trusted MCP_SERVERS_JSON in the business backend, MCP_RESOURCE_ORIGINS in Preview when needed, and exact Chatbot origins in AGENT_UI_PARENT_ORIGINS. Rebuild the combined release and both vendor tarballs before npm ci/build. A generic SPA fallback without sandbox headers is insufficient. Business authentication and user ownership remain deployment responsibilities. [Complete deployment contract](../../../docs/developer/mcp-apps-host.en-US.md).
