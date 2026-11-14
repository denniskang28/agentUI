# Chatbot integration Goal progress / 增量交付记录

2026-11-14。本次增量按 CHATBOT_INTEGRATION_PLAN.md 执行。最终完成条件的逐项核对见 chatbot-integration-acceptance.md；不改写原 MVP J01–J40 的历史记录。

## M1 — 公共契约与官方 SDK

已实现单个可分发包 `@enterprise/agent-ui@0.1.0`，公开 `/protocol`、`/server`、`/react`。三入口独立构建为 ESM，附类型声明和 README；不要求接入方读取仓库 src、使用 TS alias 或 workspace 链接。服务端入口无需 React/DOM。版本锁定 Core/React Renderer 0.15.0、Plugin SDK 1.0、transport enterprise-agent-ui/1。

模板 create/patch/delete 和原始四种消息共用真实 Core；完整规范化 Action 保留来源、时间戳、context 与扩展字段。序号按输入命令计数，生成消息数独立记录。明确定义浅更新、数组替换、null、ready、混用失效、幂等、原子拒绝、快照恢复和运行上限。

## M2 — Library 与独立 Host

服务端适配器通过官方 MessageProcessor 校验历史，试处理成功后提交，保存不可变输入历史；模板身份映射不复制一套业务运行时。Host 复用原有 Catalog、Renderer、Policy 和 PluginMount，由自己的 Core 管理交互状态。

主页面只连接独立 Host、转发批次与完整 Action。Host 校验父 Origin/source、协议和版本、清单、制品地址、顺序和 run；Native 仅在 Host，Sandbox 为其内 opaque iframe。插件地址限制在本 Host 的批准制品目录。握手、加载、应用超时与卸载清理均有边界。

实际排查并修复：

- 相同文档的重复 ready/probe 曾造成重新握手循环；用 documentId 区分重复通知与真正的 Host reload。
- 官方对象绑定的初始空对象在细粒度数据 patch 后未更新消费视图。PolicyView 订阅官方 DataModel，重新解析公开 dataContext binding 并复制通知快照，保留插件实例；没有修改 SDK 或维护第二套数据。
- v1.0 path-null 表示删除；模板显式 null 改为浅合并后的 /view 替换，保留约定语义。
- 主/预览 Vite 共享缓存曾产生 Outdated Optimize Dep 504；三个应用使用独立 cacheDir，根类型检查排除生成 dist。

## M3 — 两套独立完整 Demo

`examples/chatbot-comparison/baseline` 与 `with-agent-ui` 均有自己的 package/lock、React 聊天页、HTTP/SSE 服务、Orchestrator、Expense/Finance Agent 和有状态业务服务。两套不互相 import。14 个文件逐字节相同，8 个允许差异，没有未声明差异；差异集中在 UI/Action 适配、依赖和部署。

业务：分离 loading/data/ready、批准/驳回/退回、失败重试、相同意图去重、流式风险更新、Agent 下钻、多个 Surface 的结构变更与删除。风险场景包含模板创建 → 原始更新 → 模板下钻 patch。演示明确使用确定性本地 Agent、固定演示身份及内存服务，不宣称真实 LLM/企业审批/SSO。

刷新重放全部结构/数据/ready 历史，Host 单独 reload 也能恢复。浏览器 offline/online 显式关闭/重建 SSE，并按最后事件游标续传。重置创建新 run，迟到结果和 Action 被拒绝。后端校验会话关联、Surface 归属与 ready、业务对象和意图键；被删除的 Surface 不接受旧 Action。风险数值从服务端状态取值。

## M4 — 制品、部署、证据

- `pnpm chatbot:prepare` 输出实际 `.tgz`、Host 静态站点、清单与两种真正经过无网络受控 Docker Builder 编译的插件；复制 vendor/release 到集成 Demo。
- `npm ci --ignore-scripts && npm run build && npm run deploy` 可在复制出去的集成目录运行。Host 服务器仅依赖 Node 内置模块；运行不需要 Playground/API/Builder。
- `pnpm chatbot:consumer` 在仓库外全新临时目录安装/构建两套应用，检查包真实路径，直接导入公开 server export，启动真正独立 deploy，执行审批和刷新恢复，再验证三个子进程端口清理。
- 更新本地同版本 .tgz 后同步 lock integrity，再执行 npm ci，避免 npm 继续复用旧 tarball。消费者测试使用已缓存的锁定依赖离线安装；首次普通 npm ci 仍需 registry 或相应离线缓存。
- 宽屏/窄屏、中英文、明暗的 48 张真实状态截图、8 张索引和 4 份实际 SSE trace，位置 artifacts/chatbot-visual；手机风险表根文档越界已修复，表内保留横向滚动。
- 整页截图曾造成跨域嵌套 iframe 的离屏栅格失真，DOM 尺寸和固定视口截图正常。最终证据使用三种固定 viewport、实际页面滚动，不改 UI/CSS 或遮罩；matrix.json 记录 viewport/scrollY/documentWidth。

## 验证入口

原始日志在 artifacts/chatbot-checks，独立消费者在 artifacts/chatbot-consumer。执行命令：

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm chatbot:prepare
npm ci --ignore-scripts --prefix examples/chatbot-comparison/baseline
npm ci --ignore-scripts --prefix examples/chatbot-comparison/with-agent-ui
npm run build --prefix examples/chatbot-comparison/baseline
npm run build --prefix examples/chatbot-comparison/with-agent-ui
pnpm chatbot:demo
pnpm chatbot:compare
pnpm chatbot:test
pnpm chatbot:consumer
pnpm chatbot:visual
pnpm test:e2e
```

截图索引脚本 scripts/chatbot_contact_sheets.py 使用 Pillow，仅证据生成需要，不是应用运行依赖。

## 范围与工作区

启动时已有 Playground/API/Preview 部署相关未提交修改，保留并按默认配置复用；后来同工作区的部署兼容修复也保留。本 Goal 对已有 runtime 的实质变化为资源 Origin Context 与官方绑定通知适配，并有原 52 项 E2E 回归。原 ZIP 和 `.reference` 不修改。本次只做本地交付，不发布 npm 或公开网站。

Optional function RPC、完整标准 Catalog 交互、生产鉴权/持久化/真实模型与审批不在验证范围。历史校验会重放受限 run，不宣称吞吐提升。Host 约 1.3 MB 未压缩包的构建警告保留；业务后端以安装的 tsx 运行 TypeScript，npm ci 需完整依赖，前端和框架 Host/Library 则构建成部署产物。

The delivery uses real packaged exports, official Core/Renderer and constrained plugin artifacts. Demos share business logic while replacing only presentation integration. Standalone installation, deployment, browser Actions, recovery, security boundaries, visual states and the original Playground regression are recorded separately; no production authentication, persistence, LLM, optional function RPC or performance claim is implied.

## 最终状态 / Final status

M1–M4 与十项新增验收均通过；无剩余必需工作。最终为 61 单元/集成、18 Chatbot 浏览器、52 原有浏览器回归通过，仓库外消费者 8 步通过，48 视口截图完成并复核，一键启动/停止/重启通过。具体逐项证据见 chatbot-integration-acceptance.md 与 artifacts/chatbot-checks/summary.json。Demo 已以 pnpm chatbot:demo 重新启动，本次 Goal 可完成。
