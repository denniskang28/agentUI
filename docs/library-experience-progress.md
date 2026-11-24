# Library experience incremental Goal — progress

2026-11-15。用户明确授权启动后创建了实际持续 Goal，按 `LIBRARY_EXPERIENCE_GOAL.md` 连续执行 M1–M4，无阶段确认停顿。原 MVP 完成记录保留。

## M1 — 契约

已核对锁定安装的官方 v1.0 Basic Catalog 与公共 Core/React API。主题/外观作为项目 RunConfig 扩展，业务 Surface/Data Model 仍由官方 Core 拥有；不新增虚构的通用官方 style。严格字体/颜色/数字 Schema、公开类型、能力元数据和 OpenAPI 已接通。Library/Host/manifest 同步为 0.2.0，wire/Core/Plugin SDK 版本不变。

18 项新增单元验证包含非法值拒绝、全部内置模板通过真实 Adapter/Core 的数据一致性、raw 多 Surface 和版本/步骤保留。M1 完成。

## M2 — 共享渲染

Preview 与 embedded Host 共用 RuntimeAppearance 和稳定节点边界，更新无需重建业务实例。SDK 新增可选 useHostTheme；Native 通过环境对象、Sandbox 通过既有可信通道和受控 CSS 接收主题。Docker builder 镜像已重建，两个 demo ZIP 均实际上传构建。ECharts 保留实例；Host intrinsic #root 尺寸变化上报已修正。所有 Gallery 内置根节点及各支持属性、Card 子节点、TextField identity/value、两插件/两模式状态与主题均经真实 DOM 检查。M2 完成。

## M3 — Playground 与双语

便捷模板支持内容/外观切换、按稳定 Surface/componentId 配置、各项恢复继承及节点重置；切换组件保留草稿。预览主题面板独立于工作台外壳。Library Inputs / Node / React 使用所选草稿或实际已发送的预览快照，可复制/下载并进入第七篇双语指南。组合节点键采用 JSON pair，避免路径分隔符碰撞；配置不会写入业务 data。

浏览器检查真实导出快照及文件内容；新控件双语与三尺寸/两主题矩阵完成。M3 完成。

## M4 — 实际消费者与回归

- `pnpm typecheck`、`pnpm lint`、`pnpm build`：通过；生产构建保留 Vite 大 chunk 提示。
- `pnpm test`：17 files、84 tests 通过。
- `NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 pnpm test:e2e`：最终 70/70 通过，包含真实 API/官方 Core/DOM/Actions、Builder 和隔离回归。
- 同样回环代理例外下 `pnpm chatbot:test`：最终 18/18 通过，包含 Host 旧版号拒绝、原始消息、未知资产/CSP、Native/Sandbox、移动端、Action 结果和重连。
- `pnpm chatbot:prepare`：实际生成 `aap-agent-ui-0.2.0.tgz`、编译独立 Host、批准的真实插件制品与同步 demo 输入；`npm ci --ignore-scripts` 安装该 tarball 后运行验证。
- `pnpm library:experience:verify`：仓库外全新消费者通过。生成的 Node 和 React 严格编译/执行；真实 template/raw/streaming、完整 Action 后端确认与渲染，以及 Native/Sandbox 插件主题直接检查。具体最新步骤见本地 `artifacts/library-experience/consumer/report.json`。
- `pnpm chatbot:consumer`：两套原有独立消费者实际安装/编译/UI/部署用例 passed=true。`pnpm chatbot:compare`：14 identical / 8 allowed differences / 0 unexpected。
- `pnpm docs:verify`：14 guides、46 links、14 strict TS examples、2 executed server examples、14 JSON blocks、18 batches、2 Actions、2 normalized、2 fragments 通过，使用安装的公共包。
- `capture-library-experience.ts`：60 张实现矩阵、6 张未改写参考；布局记录通过。`review-library-experience.py`：4 张索引、6 组未遮罩差异/左右对照。另有 4 张真实插件及独立消费者截图；人工复核记录见 visual-verification。
- `git diff --check`：通过。原 ZIP SHA256 与既有记录一致，未改 ZIP 或 `.reference`。

## 调试与修正记录

早期失败如实保留在执行历史，不等同最终通过：外观边界最初放在 policy 外导致样式不到实际 View，随后改到 View 内；错误定位器、词典覆盖及下载文本编码已修复。首次全量运行遇到本地 Python 请求被代理 502，以及源码修改触发 HMR 干扰草稿测试；使用回环 NO_PROXY 并冻结源码后重跑。

现有聊天演示曾保留部署子路径构建，根路径服务无法加载；两 demo 重新 build 后正常。旧 Host 测试版号和旧 conversation localStorage key 已更新，同时保留明确旧版拒绝测试。Chromium 嵌套 frame 自动滚动期间的点击未落到网格；移动测试先明确滚动外层和网格并等待绘制，再进行真实点击和 Action/结果断言。审批测试用 1000ms 的真实配置延迟观察 submitting，避免在跨 iframe 调度后错过 200ms 短态；仍检查双击只发一次、重试幂等及真实结果。

视觉发现窄屏面板开关被覆盖、未设置颜色呈现误导默认色，以及放大字体时 Host 高度不更新，均已修正。重拍还修正了截图早于样式/resize/paint 和原参考 mock loader 未完成的等待条件，没有修改原始截图或参考源以掩盖差异。

## 交付状态

功能和必需验证已完成；具体 L01–L12 与适用边界见 `library-experience-acceptance.md`。无本增量 Goal 必需实现遗留。生成证据和本机运维路径留在忽略目录，不纳入公共源码；未执行公网发布或生产部署。

## 2026-11-16 — 组件草稿串用回归修复

用户报告所有自定义响应都显示 CapabilityProfile。实际浏览器复现：先打开 CapabilityProfile 的自定义响应，再打开 Text 的自定义响应，仍显示前者。原因是自定义 JSON 使用全局状态，且仅首次进入时初始化；原有外观草稿测试未覆盖这条切换路径。

自定义 JSON 现按组件保存，与该组件的模板 JSON 独立，主动清空也会保留。外部 Agent 的会话消息继续使用独立会话状态。草稿合并读取最新状态，避免异步文件导入覆盖后来编辑的其他字段；导入完成后不会迟到切换其他组件的编辑模式。同时修复两个实际复现的模板问题：重复点击已选场景会丢失当前 JSON 编辑；恢复示例后切回其他场景会重新带出旧 JSON。

新增 `tests/e2e/draft-sources.spec.ts` 的三个回归在修复前全部失败，修复后通过：遍历全部内置组件，以 CapabilityProfile 为第一项，逐项检查模板组件类型、真实 API/Core 校验和各自自定义响应；验证编辑稿/空稿跨组件保留、实际 Preview 渲染且不覆盖模板；验证场景切换保留 JSON、重复点击无损及恢复示例清除所有场景覆盖。

最终运行 draft-sources、appearance-library、recovery-lifecycle、i18n-lifecycle、external-agent 和 external-locale 六组真实浏览器测试，21/21 通过，包含 JSONL 导入恢复和真实外部 Python Agent 消息/Action。`pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过，构建保留原有大 chunk 提示。另在实际 Playground 页面复核 CapabilityProfile → Text → 自定义响应，编辑器显示 Text 消息，Preview 显示对应文本。用户也反馈模板 JSON 已恢复正常。该记录是上述原始验收后的增量回归证据，不将原有 70 项计数改写成此次全量重跑。


## 2026-11-16 — Playground 真正的便捷输入入口

根据用户澄清，旧“组件模板”只是场景生成器，不能等同于直接运行 Library 输入。保留“组件模板 / 自定义响应”，增加独立的“A2UI / Library 便捷模板”输入格式选择，两个内容来源均支持两种格式。组件表单和场景生成 create/patch；自定义输入支持任意发现模板、多 Surface、patch/delete、单输入／数组／批次／JSONL，不受 Gallery 选中组件限制。两种格式的手写模板稿与自定义稿独立保留，表单编辑只清除当前格式的手写覆盖。

POST /api/v1/library/compile 在临时真实 AgentUiAdapter 中校验整个序列后销毁，保留 run/sequence/batch 与去重语义，限制输入数、请求和编译输出；没有上传脚本执行。按输入批次播放实际生成的官方消息，并同步每步 componentPolicies，保留 on_complete、暂停／继续／单步及模式重放。调试区继续显示实际官方消息。外部 Agent 会话保持原始 A2UI。

Library 草稿导出保留真实输入，生成 Node/React 使用实际 runId；预览导出只含已发送步骤，附加 Mock Action 更新时回退实际 raw 消息，避免丢业务结果。Library JSON 的外观节点通过真实编译发现，非法草稿阻止复制／下载。中英文指南及 OpenAPI 同步说明格式、开发编译 API 与导入边界。

新增三项集成测试检查所有内置场景逐步 Core Surface 状态等价（patch 可能展开为多条官方消息，不要求字符串相同）、JSONL 多 Surface/删除/非法版本，以及批次序号、run 和重放。新增 11 项浏览器用例覆盖四份草稿、真实渲染、导入恢复、原始输入导出、两模式 on_complete 审批 Action、中英文三尺寸布局。12 张布局截图和实际浏览器渲染图在 `artifacts/library-experience/input-formats/`。

`pnpm test`：18 files、87 tests 通过。typecheck/lint/build 和 docs:verify 通过，构建保留既有大 chunk 提示。独立消费者再次在仓库外安装真实 0.2.0 tarball，五组生成的 Node/React 编译／执行与实际 Host 均通过；streaming 场景改用真实 template.create/patch 和 custom_stream_run，明确验证非默认 runId。报告 `artifacts/library-experience/consumer/report.json` 为 passed=true。

早期失败如实记录：新增测试曾遗漏 Native 模式确认、使用错误状态文案／不唯一定位器及错误移动 Tab 定位器，均已更正。一次全量测试期间编辑服务源码触发 API 自动重启，三个会话测试收到空响应；随后冻结产品源码。另一次 Sandbox 在嵌套 iframe 刚挂载 resize 后指针未触发审批，截图仍为待审批且无 Action；新增链路测试改用真实键盘激活并断言后端结果，既有两模式插件套件继续验证指针点击。最终全量结果在补充验收中记录。


冻结源码后的最终全量 `NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 pnpm test:e2e`：84/84 通过（2.5m），包含上述 11 项新用例及原有真实 API、插件上传构建、Action、性能采集和运行隔离回归。最后的 typecheck/lint/build、docs:verify、87 项单元／集成和真实独立消费者均通过，`git diff --check` 通过。开发服务保留运行于 localhost:5173 和独立 127.0.0.1:4173；未做外部发布。

## 2026-11-25 — AAP Agent UI 包名迁移

- 接入包改为 `@aap/agent-ui@0.2.0`，分发文件为 `aap-agent-ui-0.2.0.tgz`。`/react`、`/server`、`/protocol` 继续作为公开入口，Host 握手和批次仍使用 `enterprise-agent-ui/1`。
- `pnpm chatbot:prepare` 生成新包与配套 Host，两个消费示例使用更新后的锁文件安装。`pnpm docs:verify` 通过 14 个 strict TypeScript 示例。`pnpm capability:consumer` 使用实际安装包和独立 Host 验证渲染、Action 回传和流式更新。
- `pnpm test` 通过 97 项，文档浏览器测试通过 3 项。独立 Chatbot 消费验证使用空闲端口重跑，通过 18 项浏览器测试。
