# MVP 验收记录

2026-11-14。M1–M4 本地 MVP 验收完成，J01–J40 均通过。各行证据与下列交付边界共同构成结论；不宣称生产部署或逐像素 100% 相同。

## 最新完整工程检查

- `pnpm lint`、`pnpm typecheck`、`pnpm build`：通过。浏览器包仍有大于 500 KB 的体积提示，未隐藏提示。
- `pnpm test`：9 个文件、47 项通过，包含实际 Docker 拒绝构建和真实 HTTP SSE 恢复，以及未知类型适配、历史快照不变和表单恢复边界。
- `pnpm test:e2e`：最终完整回归 52 项通过（约 1.5 分钟），包含官方 Runtime DOM、真实上传/构建产物、真实 Action、双模式 CSS/语言/主题、外部会话重放、资源清理及九个可执行接入场景。
- 已增加双插件组合、真实抛错/越权操作、双语 JSONL 错误定位、播放状态保持及审批重试测试；本轮最新完整检查覆盖这些改动。最终视觉修正后的完整浏览器回归也已通过。

## 原有验收项

| ID | 状态 | 当前证据 / 尚缺内容 |
|---|---|---|
| J01 | 通过 | foundation.spec.ts：官方 Text/Card/Row 实际 DOM |
| J02 | 通过 | policies.spec.ts：同批有序更新、跨 Catalog 单 Surface、后续数据绑定 |
| J03 | 通过 | i18n-lifecycle.spec.ts：实际选择 JSONL 文件，校验、按序播放并看到真实绑定更新；空行保留原始位置 |
| J04 | 通过 | JSON/JSONL 稳定错误码和行列/offset；双语提示、错误行高亮、点击定位选择错误字符，修正后恢复真实渲染 |
| J05 | 通过 | recovery-lifecycle.spec.ts：错误版本与已知组件非法属性在同一编辑器显示官方诊断，修正后恢复真实渲染；API 整批拒绝已验证 |
| J06 | 通过 | unknown-components.spec.ts：已知 Catalog 的未知子组件/根组件显示双语占位，邻近组件绑定、输入和 Action 继续工作，后续替换为已支持组件可恢复；原消息保持不变 |
| J07 | 通过 | i18n-lifecycle.spec.ts：暂停超过两个消息间隔仍为 1/3；Next 仅一条，Resume 后完成；中途切换语言不重启 |
| J08 | 通过 | plugins.spec.ts：每次 Next 仅应用一条，数据齐但 ready=false 时继续等待 |
| J09 | 通过 | 外部 Reset 清空 Surface/历史；recovery-lifecycle.spec.ts 在 800ms Mock 回执到达前 Reset 并重建运行，超过延迟后新历史仍只有初始消息，旧回调未污染新实例 |
| J10 | 通过 | 渐进更新及语言切换后，Heatmap 的局部选中状态和同一插件实例保留；真实用户 Action 不重复 |
| J11 | 通过 | plugins/policies：未 Ready 不挂载审批 iframe；超时不审批 |
| J12 | 通过 | ready 与 Schema 双门控、超时恢复后真实审批表单显示 |
| J13 | 通过 | KPI/DataTable/Chart Schema、绑定、排序、行点击和图表点击真实 Action |
| J14 | 通过 | plugins.spec.ts：未知 TSX + 元数据实际编译、加载和交互 |
| J15 | 通过 | plugin-assets.spec.ts：多文件 ZIP 含 CSS，实际产物在双模式应用 |
| J16 | 通过 | plugin-security.test.ts：真实 Docker 拒绝 Node 依赖、越界导入及语法错误 |
| J17 | 通过 | Heatmap、未知 CSS 插件在独立 Preview Host 的 Native DOM 与交互 |
| J18 | 通过 | 多插件真实 opaque Sandbox DOM 与交互 |
| J19 | 通过 | 同产物切换模式；CSS、locale、theme 同步；外部消息重放及旧 run 拒绝 |
| J20 | 通过 | Heatmap 真实 gridcell 点击、下钻参数及 Mock 返回详情 |
| J21 | 通过 | approval-results.spec.ts：两个模式的 Pending、Approved、Rejected、退回和错误重试均实际执行；连续 error 回执用业务 resultVersion 区分 |
| J22 | 通过 | composed-plugins/approval-results：实际快速双击仅提交一次；同一意图重试复用 key，新的 Action/意见生成新 key |
| J23 | 通过 | runtime-safety.spec.ts：真正上传并执行抛错插件，两种模式显示组件错误后仍可正常使用工作台 |
| J24 | 通过 | runtime-safety.spec.ts：真正执行父页面访问、顶层导航、跨站 fetch、未声明/循环 Action，两种模式均拒绝 |
| J25 | 通过 | ZIP 路径、符号链接、文件数、解压尺寸、依赖目录与脚本文件安全测试 |
| J26 | 通过 | 第三插件通过单 TSX 和多文件 ZIP 两条真实通路动态发现/运行 |
| J27 | 通过 | benchmarks.spec.ts 六项：真实上传产物、单模式/顺序 Compare Both、Cold/首实例显示/全实例提交 P50/P95、真实 Action 分段；万级负载/五实例/60 Hz、停止/销毁、加载失败恢复。长任务/内存尽力采集，Build 不在运行中为 null，范围写入双语测量文档；实际导出 JSON 位于 artifacts/visual/benchmarks |
| J28 | 通过 | recovery-lifecycle.spec.ts：渲染后刷新重新加载内置 Fixture；真实未知插件在 Native/Sandbox 的外部会话刷新后重放消息并建立新的局部状态 |
| J29 | 通过 | composed-plugins.spec.ts：两种模式中两个真正上传插件共享 Surface，独立业务数据/策略/Actions，删除后卸载子实例 |
| J30 | 通过 | recovery-lifecycle.spec.ts：真实未知插件 30 次更新后保持一个实例/计时器；删除 Surface 清理 Native interval，Sandbox frame 销毁；重新建立、刷新后经 UI 卸载清空外部运行；Reset 取消旧 Mock |
| J31 | 通过 | 11 内置模板生成/校验与表单/JSON 实际渲染；精确模板可恢复表单值，复杂多 Surface 消息保留 JSON 并解释；切换组件保留草稿，模板/场景恢复边界有单元测试 |
| J32 | 通过 | Python/TypeScript/cURL 各 full/progressive/action 示例驱动真实预览 |
| J33 | 通过 | 真正点击 → 外部脚本接收 → 返回 updateDataModel；Mock 不重复处理 |
| J34 | 通过 | 幂等/序号/TTL/旧 run 单元集成；真实 SSE Last-Event-ID 恢复与游标过期；独立 Action 游标 |
| J35 | 通过 | 九个文档示例通过；recovery-lifecycle.spec.ts 的独立 API 客户端发现真实新上传插件的身份、Schema、模板，在两种模式实际渲染、更新和接收 Action。27 操作 OpenAPI 契约审计通过，见 api-contract-verification.md |

## 中英文追加验收

| ID | 状态 | 当前证据 / 尚缺内容 |
|---|---|---|
| J36 | 通过 | 类型化词典/变量完整性、语言优先级与持久化通过；四页平台文案统一 t/l，Schema/代码/业务内容与第三方诊断保留原文；新增插件详情与 Benchmark 文案已进入词典，完整 E2E 与双语布局捕获通过 |
| J37 | 通过 | foundation/i18n-lifecycle/composed-plugins：草稿、JSON、业务原文、输入和焦点、播放进度、插件局部选择、Action 记录保留；无重复 Action |
| J38 | 通过 | 两个示例插件在 Native/Sandbox 内切换固定文案并保留状态；未知单 TSX / CSS ZIP 插件两种模式通过 SDK locale 测试 |
| J39 | 通过 | 48 张双语页面、72 张关键状态、24 张恢复状态、24 张 Benchmark 与 48 张插件详情；三视口/两主题。25 组中文未遮罩对照、英文布局及单张细节复核，修正标题/正文位置/页面宽度/Text 尺寸；无未解释明显偏差，见 ui/visual-verification.md |
| J40 | 通过 | 双语 Quickstart/API/Plugin/Benchmark 文档接入 UI；九个可执行示例通过；27 操作 OpenAPI 请求/响应/事件与真实服务、上传产物核对通过；协议/业务原文保真，见 api-contract-verification.md |

## 最终交付核对

- J01–J40 均有实际证据；原 Handoff Definition of Done 的协议、模板、流式、插件隔离、Action、Benchmark、API、文档、双语与测试要求均对应上述行通过。
- 标题行高、文档左对齐、Benchmark 宽度及 Text 高度修正后，类型、Lint、生产构建和 52 项完整 E2E 再次通过。单元/集成最终为 9 文件 / 47 项通过。
- API 契约五项与 SSE 三项覆盖真实响应、TTL 自动关闭、关闭服务与结构化错误；九个完整外部示例和未知插件发现接入通过。
- 视觉结论保留真实接口、已上传插件身份、英文换行、窄屏内部滚动与真实 Benchmark 扩展等已确认差异；原始 ZIP 未改动，不报告无法证明的还原百分比。
- 本地启动命令、地址、复现方式和已知限制在 README / handoff-progress.md；核心接入说明提供中文与英文版本。浏览器大包警告保留，本地服务不含生产鉴权或持久会话。

无尚未完成的必需验收项。上述后续范围不作为已交付能力。

## Chatbot integration — separate incremental acceptance

本次新增范围独立于上述原 MVP J01–J40。模板/原始 A2UI 双入口包、独立静态 Host、两套完整 Chatbot、真实构建插件、仓库外消费者、部署/停止、完整 Action、恢复和双语视觉证据的十项完成条件逐项记录于 [chatbot-integration-acceptance.md](chatbot-integration-acceptance.md)。

原 52 项浏览器回归已在共享 runtime 修改后通过；本次单元/集成为 14 文件/61 项。两应用代码对照为 14 相同/8 允许差异/0 未声明差异。新范围的最终浏览器和消费者结果见该独立验收及 artifacts/chatbot-checks、artifacts/chatbot-consumer 的实际日志。本地部署 Demo 使用演示身份和内存状态，不增加生产认证、真实 LLM 或可选函数 RPC 的能力声明。

## Library documentation — incremental acceptance (2026-11-14)

| Requirement | Evidence / result |
| --- | --- |
| Complete library guidance in Playground | Six canonical bilingual guides; Library is the default API & Docs group; existing Playground reference retained |
| Integration and overall architecture | Actual public package imports, server/React examples, complete batch transport, Host/manifest responsibilities |
| Full A2UI and convenience coexistence | Complete expense template and four-command raw sequences, choices/comparison, mixed updates, structural and null boundaries |
| Events and lifecycle | Full Action, ownership/authorization, business idempotency, ready vs data, ACK vs paint, replay/reset/disposal/errors |
| Baseline versus integration | Actual domain payload and Actions, file-level migration, same Agents/orchestration/business services, walkthrough |
| Packaging and deployment | Tarball/Host/plugin release, standalone run, build/runtime variables, Cookie/CSP/Origin, versions and troubleshooting |
| README discovery | Root + package + comparison + both applications link canonical guides |
| Executable documentation | pnpm docs:verify: 12 strict examples, 2 server executions, 18 real Core batches, 42 links; report in artifacts/library-docs |
| Browser behavior | 3 documentation E2E: retained original guides, library navigation/language, narrow code/table scrolling and no root overflow |
| Regression / build | typecheck/lint/build pass; 61 tests in 14 files pass; compare 14 identical / 8 allowed differences |
| Visual evidence | 26 actual states, 3 review sheets; both languages/themes, fixed 1440×900 / 1280×800 / 375×812 |

No production deployment or additional protocol capability is implied. Build emits existing large-chunk notices. Existing MVP/Chatbot acceptance remains separately scoped above.

## 2026-11-14 — CapabilityProfile incremental acceptance

| 范围 | 实际证据 |
| --- | --- |
| Catalog/API | capability-profile、五种模板、两个 Action 和 color 字段可发现；真实 Fastify 测试 |
| 数据/就绪 | ID、范围、颜色校验；缺失分数保留，deferred 不完整输入与 ready 校验；capability unit/API tests |
| DOM/交互 | 场景与维度真实点击、Action、评分/config patch、语言切换保留状态；新增 4 E2E |
| 外观 | 自定义颜色与填充、隐藏明细居中、说明独立开关；12 张双语/明暗/固定尺寸截图及配置截图 |
| Library | 实际打包安装，以公开 React client + 编译静态 Host 验证 Action 和更新；artifacts/capability/consumer/report.json |
| 回归 | 66 单元/API 测试通过；全量 E2E 首次 57/58，1 个 Sandbox Benchmark 等待超时后单项及整组 6 项 Benchmark 复跑通过 |

新组件范围独立于原 J01–J40。默认人物、分数与目标均为示例，不是实际能力测量。本轮为本地交付。

## 2026-11-14 — Runnable fresh checkout

补齐两套对照 Demo、构建/启动/验证源码与双语指南。新增 `pnpm setup:demo` 与 `pnpm dev:all`，默认准备两个真实示例插件；生成发布产物不纳入本次提交。已从独立待提交快照重新安装和准备，验证实际 Playground 插件交互、仓库外两套 Demo、66 项单元/集成测试及文档示例。准确命令、环境和测试边界见 [fresh-checkout-acceptance.md](fresh-checkout-acceptance.md)。

## 2026-11-14 — Repository privacy verification

Local lint, TypeScript strict checking and all 66 unit/integration tests passed after replacing actual server addresses with reserved test values. Raw generated evidence and real operations files are retained locally under an ignored directory; public source, reproducible commands and the original design archive remain available. All reachable local commits are checked for internal deployment markers, machine-specific paths, credential patterns and the former personal email. Pattern scanning is not a guarantee against every possible secret; generated screenshots and traces are excluded from public history. See `repository-privacy.md`.
