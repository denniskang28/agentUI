# Chatbot integration acceptance / 接入增量验收

2026-11-14。本记录对应 CHATBOT_INTEGRATION_PLAN.md 第 9 节。旧 MVP 验收保持独立；本次不公开发布包或网站。

## 交付物 / Deliverables

| Item                                   | Location                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Public ESM/declarations/package README | packages/agent-ui，公开 protocol/server/react 三个子路径                       |
| Installable distribution               | 0.1.0 acceptance build. Current release uses `artifacts/packages/aap-agent-ui-0.2.0.tgz`. |
| Independent static Host and manifest   | artifacts/chatbot-release/host、manifest.json、serve-host.mjs                  |
| Two actual Docker-built plugins        | artifacts/chatbot-release/artifacts/{buildId}/                                 |
| Traditional complete chatbot           | examples/chatbot-comparison/baseline                                           |
| Integrated complete chatbot            | examples/chatbot-comparison/with-agent-ui                                      |
| API/data/code comparison               | examples/chatbot-comparison/COMPARISON.md、integration-diff.json               |
| Bilingual install/run/deployment       | comparison README、两子目录 README、with-agent-ui/DEPLOYMENT.md、包 README     |
| Raw browser/consumer evidence          | artifacts/chatbot-checks、artifacts/chatbot-consumer、artifacts/chatbot-visual |

## 计划完成条件 / Plan completion criteria

| #                                    | Evidence / 证据                                                                                                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 真实双入口、保留实例与完整 Action | adapter 单元测试；template/raw × Native/Sandbox 真实审批；失败重试和语言切换保留输入；trace 检查官方 name/surfaceId/sourceComponentId/timestamp/context 信封与后端结果                                                     |
| 2. 混用、生命周期、错误与恢复        | 官方 Core 混用/绑定失效/null/ready/原子拒绝/删除/快照测试；MessageChannel 超时与销毁测试；多 Surface 更新/删除、旧 run 拒绝、SSE 断线游标续传、Host 单独 reload 与刷新恢复；复用 PluginMount 的真实 timer 清理由原回归覆盖 |
| 3. 两套独立可比 Demo                 | 各自 package-lock 和 npm 构建；仓库外两消费者实际审批/刷新；逐文件 SHA256 检查 14 个相同、8 个允许差异、0 个未声明差异                                                                                                     |
| 4. 公开 exports 与脱离源码安装       | 临时目录 npm ci，realpath 校验包位于该目录；Node 直接导入公开 server export；Vite/TS 从 `.tgz` 构建 React 客户端；没有 workspace/源代码解析                                                                                |
| 5. 静态部署与独立运行                | 仓库外直接执行 npm run deploy，Node 内置静态服务器 + demo backend；未启动 Playground/Builder；执行审批、恢复、停止并检查三个端口均关闭                                                                                     |
| 6. 真正制品与隔离                    | 实际 PluginRegistry/受控 Docker 编译并导出两插件；静态 Host 无会话 API/cookie；真实 Host 拒绝不兼容清单与外站制品、CSP 拒绝未允许父 Origin；原隔离/恶意插件浏览器回归通过                                                  |
| 7. 自动检查与回归                    | 见下方真实命令与原始日志；不以构建或 HTTP 200 替代 DOM/Action 验证                                                                                                                                                         |
| 8. 三尺寸双语明暗视觉                | 2 方案 × 2 语言 × 2 主题 × 3 viewport × 2 状态 = 48 张；matrix.json 记录实际尺寸与滚动；8 张索引加单张复核；根文档无横向越界，表内横滚可访问，手机真实审批/下钻测试补充                                                    |
| 9. 双语和可复现命令                  | 包/对照/部署说明中英双语；准备、npm ci/build、独立 deploy、停止、全回归命令实际执行；支持范围与内存/身份/LLM 边界明确                                                                                                      |
| 10. 过程和兼容记录                   | chatbot-integration-progress、a2ui-compatibility、implementation-decisions、acceptance-report、ui/visual-verification 的增量记录；原 ZIP SHA256 未变                                                                       |

## 检查结果 / Verification results

| Command                     | Observed result                                                                |
| --------------------------- | ------------------------------------------------------------------------------ |
| pnpm lint                   | Pass                                                                           |
| pnpm typecheck              | Pass，TypeScript strict                                                        |
| pnpm test                   | 14 files / 61 tests passed                                                     |
| pnpm build                  | Playground/Preview production build passed                                     |
| pnpm chatbot:prepare        | Library JS/declarations/.tgz、Host 和真实 Docker 插件构建/导出通过             |
| 两套 npm ci / npm run build | 独立锁定安装、类型和前端构建通过；集成版安装本地 tarball                       |
| pnpm chatbot:test           | 18 browser tests passed，官方 Core/真实制品/真实后端/DOM 和 Actions            |
| pnpm test:e2e               | 原 52 browser tests passed，含两执行模式插件、API、恢复、Benchmark、文档与隔离 |
| pnpm chatbot:consumer       | 两个仓库外消费者真实安装/构建/审批/恢复及独立部署停止清理通过                  |
| pnpm chatbot:compare        | 14 identical / 8 permitted changes / unexpected=[]                             |
| pnpm chatbot:visual         | 48 genuine fixed-viewport captures，8 review sheets，4 actual SSE traces       |

证据日志在 artifacts/chatbot-checks/{lint,typecheck,test,build,prepare,baseline-build,integrated-build,chatbot-e2e,playground-e2e,visual}.log；消费者 report.json 记录临时目录、逐步状态、包导入和停止结果。测试日志保留实际上游 chunk size / npm 配置提示，不将其伪装为功能失败或性能数字。

## 限制与已解释差异 / Limits and explained differences

- Agent 是确定性本地业务实现，不调用真实 LLM 或财务系统；审批身份固定为 demo-approver，运行时为进程内存，不是生产鉴权或持久数据库。每进程最多 100 演示会话、每会话 5000 SSE 事件；重启丢失状态。/ Deterministic agents, demo identity and process-local storage are intentional.
- 刷新恢复结构、数据、ready 与后端结果；未提交插件草稿不跨刷新持久化。变更模式创建新 run。/ Unsent plugin drafts are not persisted across refresh.
- 完整入口不额外裁剪已验证的四种消息/Action；可选函数 RPC 和未覆盖标准 Catalog 交互不作支持声明。/ Optional RPC and untested catalog behavior remain outside scope.
- 便捷浅 patch、raw-null 删除、独立 ready、输入命令计数与消息数的区别见包 README。Core 应用回执不是实际屏幕绘制完成。/ Application acknowledgement is not a paint measurement.
- 两方案共用聊天壳、业务数据与服务；传统版手写卡片与现有上传插件有不同的内部布局/标签/配色。这是 UI 实现差异，未宣称像素一致、代码缩减百分比或吞吐提升。/ Identical business semantics do not imply identical card styling.
- 窄屏保持风险表内横滚，末列需滚动查看；审批按钮可换行。Host 保留现有 Sandbox 初始高度与提交保护，短风险内容下方可能有保留空间。/ Narrow tables scroll internally; Sandbox retains its existing initial-height protection.
- 业务后端用 tsx 运行源码，需要完整 npm ci 依赖；前端、Library 和 Host 是实际构建产物。Host 未压缩 JS 约 1.3 MB 的 chunk 警告保留，不虚报优化结果。/ Backend source runs with tsx; production identity/storage hardening is a separate scope.
- 本地验证系统为 Node 24、Chromium、Docker；进程组停止脚本验证于当前 macOS 环境，部署说明也提供分别运行命令。/ Process-group lifecycle is verified on the current macOS host.

首次构建需要 registry/已缓存依赖和 Docker。消费者审计的 `npm ci --offline` 使用此前已成功安装的锁定依赖缓存；它证明仓库外独立解析，不代表无缓存机器可断网安装。

Original UI ZIP SHA256: `7b1e5d5f71577e61a8b947dd05903c75da318761a45f48d047af3eb2d78a6b5a`，与原视觉记录相同。参考提取目录未作为应用源码使用或修改。

## 最终核对 / Final audit

十项完成条件全部通过，无遗留的必需验收项。`artifacts/chatbot-checks/summary.json` 汇总真实日志/报告的核对结果；`demo-launcher.json` 记录一键启动三个健康端口、Ctrl+C 后三个端口均关闭、再次启动三个健康端口。当前本地两个 Demo 和 Host 已重新启动，原 Playground 进程保留。

All ten incremental completion criteria passed. The summary references actual test logs and reports; it does not infer functionality from file presence. This completes the local integration scope, while retaining the explicit capability limits above.
