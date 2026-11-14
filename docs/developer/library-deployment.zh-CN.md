# 打包、部署与运维

## 两种构建命令，解决不同问题

`pnpm library:build` 仅构建公开 ESM 入口、类型声明并打包，输出 `artifacts/packages/enterprise-agent-ui-0.1.0.tgz`。它不会生成一整套可显示插件的 Host 发布环境。

`pnpm chatbot:prepare` 会先构建 Library，再打包示例源码、同步受控 runtime 依赖、构建 Embedded Host、通过真实 Docker Builder 安装/编译两个示例插件，最后导出并复制 .tgz、manifest、Host 和插件制品到 with-agent-ui。仅构建 Library 不需要编译插件；准备完整插件发布需要 Docker。

从源码准备完整发布，在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm builder:image
pnpm chatbot:prepare
```

准备环境使用 Node 24、pnpm 10.32.1、Python 3、Docker。Docker 不可用时停止构建，不在宿主执行上传脚本或临时安装任意依赖。Builder 禁网、非 root、只读根目录，有 CPU/内存/时间/输出限制。业务运行环境只消费已经批准的静态制品。

## 交付目录与文件去向

```text
examples/chatbot-comparison/with-agent-ui/
  package.json + package-lock.json
  vendor/enterprise-agent-ui-0.1.0.tgz
  release/
    host/                  index.html、Host bundles、runtime.css、受控 runtime 依赖
    artifacts/{buildId}/   plugin.js、validator.js、可选 plugin.css
    manifest.json          Host/SDK/组件版本、Catalog、Schema、制品 URL
    serve-host.mjs         仅 Node 内置模块的静态服务器
  server/ + shared/        原业务后端及 Library Presenter
  web/                     原聊天壳及 Host 接入
  deploy/run.mjs           启动业务服务与 Host，处理退出
  deploy/nginx.example.conf
```

原始发布副本在 `artifacts/chatbot-release/`，npm 包在 `artifacts/packages/`。vendor/release/dist 属于可重建产物，不编辑它们替代源码。不要把 plugin TSX、原始 ZIP、Playground API 或 Docker daemon 暴露为 Chatbot 的运行依赖。

manifest 的 entries 包含内置组件和已构建插件。自定义插件应先通过 Playground 的真实上传/构建链路验证 Schema、Actions、Native/Sandbox，再使用受控发布流程生成匹配的 Host manifest/制品。当前 chatbot:prepare 的导出脚本明确安装两个示例插件；它不是自动导出所有工作台上传插件的通用发布 CLI。扩展发布清单时修改受信任的发布配置/导出流程，而不是让 Agent 动态指定任意 bundle URL。

## 把集成版复制到新项目运行

完成 prepare 后，复制整个 with-agent-ui 目录到仓库外，保留 vendor/、release/ 和锁文件。在新目录执行：

```sh
npm ci --ignore-scripts
npm run build
npm run deploy
```

打开 `http://localhost:5181`；`http://127.0.0.1:4183/health` 是独立 Host 健康检查。Ctrl+C 停止应用与 Host 子进程。此时不用启动 Playground、Preview API 或 Docker。

当前独立 Demo 的 start 使用 tsx 运行 TypeScript 服务端，build 只做 tsc 校验和前端 Vite 构建；后端源文件仍在交付中。运行需要完整安装，包括 tsx/Vite 等 devDependencies，不能直接 `npm ci --omit=dev` 然后期待它启动。生产产品可另行把后端编译成 JS 并调整部署依赖，本 Demo 不伪称已生成后端单文件。

baseline 可单独运行 `npm ci --ignore-scripts`、`npm run build`、`NODE_ENV=production npm start`；没有 Library 和 Host 依赖。

## 把 Library 放入已有项目

1. 将 .tgz 放进你自己的 vendor/ 或受控制品仓库，安装后提交 package.json 和锁文件。
2. 将 release 作为一个完整版本部署到无业务凭据的独立 Host；保留 host/artifacts/manifest 的相对路径。
3. 业务后端读取同版 manifest，给每 run 建立 Adapter，将结果放入已有传输。
4. 业务前端设置 Host URL，加载同版 manifest，使用 Provider/Host/Client，完整 Action 回到自己的后端。
5. 配置两边 CSP、父 Origin 白名单、认证 cookie 范围和 HTTPS；验证完整交互闭环。

这个步骤不要求把整个 Demo 业务系统搬进产品。可以只参考两个接入文件；现有编程语言不同的后端需要自行实现等价服务适配，当前公开服务端 Library 是 Node/TypeScript 包，没有 Python/Java SDK。

## 配置项：构建时和运行时分开

| 配置 | 默认值 | 生效阶段 / 用途 |
| --- | --- | --- |
| VITE_AGENT_UI_HOST_URL | http://127.0.0.1:4183 | 前端构建时；编进静态 JS 的 Host URL |
| DEMO_PORT | 5181 | 业务后端监听端口 |
| DEMO_PUBLIC_ORIGIN | http://localhost:5181 | 业务 API 的 Origin 校验 |
| AGENT_UI_HOST_PORT | 4183 | 独立静态 Host 端口 |
| AGENT_UI_PARENT_ORIGINS | http://localhost:5180,http://localhost:5181 | 允许嵌入的精确 Origin，逗号分隔，不包含路径或结尾 / |
| AGENT_UI_RELEASE_DIR | serve-host.mjs 所在目录 | 静态发布根目录，包含 host/、artifacts/、manifest.json |

下面是在准备好的 with-agent-ui 目录中的自定义配置示例，域名、TLS 证书与代理由部署者配置，不代表已发布到这些地址：

```sh
VITE_AGENT_UI_HOST_URL=https://agent-ui.example-host.test npm run build
DEMO_PUBLIC_ORIGIN=https://chat.example.test DEMO_PORT=5181 NODE_ENV=production npm start
```

另一个终端：

```sh
AGENT_UI_PARENT_ORIGINS=https://chat.example.test AGENT_UI_HOST_PORT=4183 npm run host
```

TLS 反向代理将业务站点转到本机 5181，独立 Host 站点转到 4183。附带 nginx.example.conf 是示意，需按真实域名、证书、网络环境调整。两个示例 Node 服务默认只监听 127.0.0.1。更改 VITE 变量后要重新构建；仅重启后端不会更改浏览器 bundle 中的 Host URL。

## Origin、CSP、Cookie 和静态资源

Host 必须与登录 Chatbot 不同 Origin；优先使用独立站点并让业务认证为 host-only cookie，不能把业务 cookie 的 Domain 设成同时覆盖 Host。单纯不同端口不隔离 Cookie。不要向 Host 传 Authorization、登录 Token 或浏览器存储中的企业凭据。

主应用 CSP 需允许 iframe 到 Host（frame-src）以及拉 manifest（connect-src）；Host 使用精确 frame-ancestors 和 host-config.json allowedParents。跨窗口握手校验 origin、source、协议/Host 版本和文档 ID，不能用任意消息替代连接。

提供的 Host 服务器设置 CSP、nosniff、no-referrer、Permissions-Policy；目前 script/style 允许 self 和所需 unsafe-inline，不启用 unsafe-eval。静态公共资源允许 `Access-Control-Allow-Origin:*`，是为 opaque Sandbox 获取无凭据的 JS/validator/CSS；不能照搬到业务 API 的鉴权 CORS。Host 没有 /api 业务端点。

插件制品 URL 必须落在本 Host 的 `/artifacts/{buildId}/`，不接受远程任意 URL；使用正确的 JavaScript/CSS/JSON MIME。Native 执行在此独立 Host 的上下文；Sandbox 在更内层 opaque iframe。两者都不能进入主应用 JS 上下文。

不向插件发送业务认证凭据并不意味着插件看不到分配给它的业务数据。仅传显示和交互所需的数据，并按自己的数据访问策略授权。

## 版本升级和回滚

| 项目 | 当前配套值 |
| --- | --- |
| npm 包 / Embedded Host | 0.1.0 / 0.1.0 |
| 嵌入传输 | enterprise-agent-ui/1 |
| 官方 wire | 1.0 |
| 官方 Core / React Renderer | 0.15.0 / 0.15.0 |
| 项目 Plugin SDK | 1.0 |
| 演示插件模板 | expense.approval-form 1.0.0；finance.risk-heatmap 2.1.0 |

把 package、Host、manifest、制品和消费者前端构建作为同一个发布集合。不能只换 manifest 而让旧 Host 使用新插件；也不能保持旧 tarball integrity 锁文件却替换同名 .tgz。重新 prepare、更新消费者安装锁文件、npm ci 并重建。部署者可用版本化目录并原子切换代理；当前脚本未实现跨版本热迁移。升级/回滚时终止旧 run，新建 Host/client，按业务兼容策略恢复或开始新会话。

## 故障排查顺序

| 症状 | 检查 |
| --- | --- |
| 空白 iframe / HOST_LOAD_TIMEOUT | /health、hostUrl、frame-src、frame-ancestors、allowedParents、父页面真实 Origin |
| manifest 无法获取 | /manifest.json 200、JSON MIME、CORS、与 package/Host 版本一致 |
| UNKNOWN_TEMPLATE / TEMPLATE_VERSION | 服务端是否读取发布 entries；key/version 是否精确匹配；插件是否真实安装 |
| 插件空白 | /artifacts/{buildId}/plugin.js、validator.js、CSS 的 200/MIME；Host 的 onError 和浏览器错误 |
| 数据齐全还在等待 | /ready 是否 true；策略路径是否正确；业务 Schema 是否通过 |
| 点击后卡在提交中 | 完整 Action 是否到业务 API、run/Surface/权限是否通过、服务结果是否发回 SSE |
| 刷新后缺 Surface | 重放是否包含 create/data/ready；是否只缓存最后 patch |
| 本地包仍像旧版本 | .tgz 与 lock integrity 是否同步；重新安装构建；不要只清浏览器缓存 |
| Docker 准备失败 | 启动/修复受控 Builder 后重试，禁止降级为宿主执行插件源码 |

排查使用真实网络、日志、官方 Core 错误与 DOM，不以 Mock 性能值代替证据。Host 当前 bundle 有构建体积提示；不把它写成已经测得的冷启动耗时。Library 不提供生产 LLM、SSO、持久数据库、财务审批服务或自动多租户隔离；这些继续在业务系统实施。

返回：[架构与选型](library-overview.zh-CN.md) · [接入步骤](library-integration.zh-CN.md)。
