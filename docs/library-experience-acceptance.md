# Library experience incremental acceptance

2026-11-15。增量 Goal 按 `LIBRARY_EXPERIENCE_GOAL.md` 执行；原 MVP/J01–J40 记录保留。本报告只列真实验证，不将 UI 控件或生成字符串本身视作消费者成功。

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| L01 | 通过 | `appearance-library.spec.ts` 遍历全部当前 Gallery 内置组件，检查发现能力及实际根 DOM 的字号/内边距；组合 Card 标题独立覆盖且正文不变。目录与 API 共用能力元数据。 |
| L02 | 通过 | 真实 computed style 验证字体、字号、字重、行高、文本/背景/边框颜色、边框宽度、圆角、padding、对齐及 Row gap；原有表格/图表/CapabilityProfile DOM 与 Actions 回归。 |
| L03 | 通过 | Text 默认 15px、实例 24px、恢复 15px；语义色/主题字体/基础字号/明暗切换；未配置值保留既有 CSS。两个主题视觉矩阵验证。 |
| L04 | 通过 | 共用 RuntimeAppearance，Preview 与独立 embedded Host 的真实字号/DOM 验证；两个 demo ZIP 经过真实 Docker 构建并在 Native/Sandbox 中接收 mode/font/brand；独立 embedded Host 另外直接检查两模式上传插件的主题与输入，留存截图。 |
| L05 | 通过 | TextField 值和 DOM identity 保留；审批意见/热力图选中状态在主题变更后保留；原有语言、焦点、暂停流、计时器/卸载、Action 和迟到结果测试继续有效；图表保留同一个实例。 |
| L06 | 通过 | 浏览器对照草稿新内容与已渲染旧内容，下载文件与显示代码逐字一致；18 项导出/校验测试覆盖全部内置模板、步骤顺序、多个 Surface、真实 Adapter/Core 最终数据。 |
| L07 | 通过 | `verify-library-experience.ts` 在仓库外临时项目安装实际 `@aap/agent-ui@0.2.0` tarball；五个生成 Node 文件执行、五个生成 React 文件 strict tsc，并运行独立 origin 的静态 Host；没有仓库源码 alias。 |
| L08 | 通过 | 仓库外 template/raw/streaming 三场景渲染；真实 Button → 完整 ActionEvent → 独立后端解析/业务检查 → 保持中的 Adapter.template.patch → React Client → Host 显示 Action confirmed。消费者 report.json passed=true。 |
| L09 | 通过 | 未知插件只展示容器字段，两个示例插件的内部业务配色保持自身合同；现有未知 TSX/ZIP、旧 SDK Hook 使用方式、timer/卸载及样式制品测试通过。文档明确不保证插件硬编码内部样式。 |
| L10 | 通过 | 严格 Schema 拒绝 URL/CSS 注入、未知属性、越界数值及主题自引用；Host 边界测试包含旧客户端版号和非法资产 origin；Core/API/Builder/CSP/opaque frame/Action 安全回归。 |
| L11 | 通过 | 7 份双语 Library 指南；14 个严格 TS 示例及公开包执行；中英文 × 明暗 × 3 尺寸 × 5 状态共 60 张截图，另有 6 张未改写原参考、差异/对照图和 4 张真实插件截图。布局记录无根横向越界、弹窗或底栏超出视口。 |
| L12 | 通过 | typecheck/lint/build、84 单元/集成、70 Playground E2E、18 Chatbot E2E、实际打包/独立消费者、14 份双语指南验证及视觉检查全部通过；无必需项遗留，具体命令和早期失败修复见 progress。 |

## 证据与复现

- 源码测试：`tests/unit/appearance-export.test.ts`、`tests/e2e/appearance-{library,plugins}.spec.ts`，以及原有完整 API/SDK/运行时和聊天浏览器套件。
- 生成消费者：`pnpm chatbot:prepare`，独立 demo 依赖 `npm ci --ignore-scripts` 后 `pnpm library:experience:verify`。本机生成证据在忽略目录 `artifacts/library-experience/consumer/`，含真实安装/运行日志及 template-action/raw/streaming 截图。
- 文档：`pnpm docs:verify`，报告 `artifacts/library-docs/verification.json`：14 guides、46 links、14 strict examples、2 executed server examples、18 batches、2 Actions、2 normalized samples。
- 视觉：`scripts/capture-library-experience.ts`、`scripts/review-library-experience.py`，本地证据 `artifacts/library-experience/visual/`。原 ZIP 校验及人工复核记录见 `docs/ui/visual-verification.md`。

## 明确的交付边界

- 包与独立 Host/manifest 配套为 0.2.0；transport 仍为 enterprise-agent-ui/1，官方 Wire 1.0 / Core 和 React 0.15.0。没有公开发布或部署生产环境。
- 外观是平台 RunConfig，业务 data/schema/官方消息不增加任意 style。未知插件只支持已实现的容器项；内部文字/图形由插件或业务配置负责。
- 导出静态 Node 预处理与 React 示例，接入方仍提供实际 hostUrl、业务后端与稳定 Action 回调。实时服务在整个 run 中保持 Adapter，并负责授权、序号、持久化与清理。
- 模板首条走真实 template.create，后续保留实际 raw 更新；不把未知消息推测为 template.patch。预览快照只包含已经发送的步骤。
- 构建通过但保留 Vite 大 chunk 提示；未把包体大小、截图差异或未采集性能指标包装成性能达标结论。

## 2026-11-16 — 草稿隔离补充验收

修复原验收未覆盖的跨组件自定义响应串用，以及重复选择场景丢稿、恢复示例残留场景旧稿。`draft-sources.spec.ts` 三项新增回归通过，全部内置组件模板逐项经过真实 API/Core 校验；独立模板/自定义稿、空稿保留和真实 Text 渲染均已断言。连同外观/导出、恢复、语言、JSONL 导入和外部 Agent 会话，六组浏览器测试 21/21 通过；类型检查、Lint、构建通过。实际页面复核 CapabilityProfile 切换到 Text 后消息和渲染均属于 Text。详见 progress 的同日记录。


## 2026-11-16 — 双内容来源 × 双输入格式补充验收

- 组件模板与自定义响应都提供 A2UI / Library 便捷模板选择；模板生成真实 create/patch，自定义可任意组合已发现模板、多 Surface、patch/delete，格式与内容来源独立。四类草稿不串用，空稿保留。
- 新增 `library-input.test.ts` 三项真实 API/Adapter/Core 集成验证，逐步比较全部内置场景的 Surface 状态，检查版本、顺序、run ID、重放与删除。`library-input.spec.ts` 11 项检查实际渲染、导入、导出、Native/Sandbox on_complete 与 Action，以及中英文三尺寸。
- 最终全量 Playground E2E **84/84 通过**；单元／集成 **87/87 通过**；typecheck、lint、build、docs:verify 通过。早期失败与修正见 progress，不将早期失败运行当作通过。
- 仓库外实际消费者再次安装真实 0.2.0 包，五套 Node 输出执行、五套 React 严格编译及独立 Host UI 通过。streaming 用真实便捷 create/patch 和 custom_stream_run，验证导出的非默认 runId。报告 `artifacts/library-experience/consumer/report.json` 为 passed=true。
- 12 张固定视口布局图及实际浏览器渲染图完成检查，位置及允许的新增入口差异见 visual-verification。原 ZIP/.reference 未修改。
- 边界：开发编译 API 使用临时 Adapter，并非生产持久会话；编辑器导入 UiInput/UiBatch，导出文档中的配套配置仍单独应用。外部 Agent 预览会话继续为 A2UI；便捷输入最终由相同官方 Runtime 渲染。没有公开发布或升级官方协议版本。
