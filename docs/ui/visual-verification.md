# UI 视觉验收

2026-11-14。完成本地 MVP 的逐页视觉复核。未发现尚未解释的明显布局、字体、间距或组件样式偏差；本结论不代表逐像素 100% 相同。中文以 ZIP 中 v2 为基线，英文没有原始参考图。

## 基线及方法

原始 `Agent UI Playground v1.zip` 保留，`.reference` 与应用分站运行，未改动参考代码。`artifacts/visual/reference-integrity.json` 记录 ZIP SHA256 `7b1e5d5f71577e61a8b947dd05903c75da318761a45f48d047af3eb2d78a6b5a`，10 份提取文件与 ZIP 对比 missing / changed 均为空。

固定 Chromium、zh-CN、同一初始 Heatmap 数据、视口和主题，对照 1440×900、1280×800、375×812。等真实插件绘制、Registry 和状态就绪后截图。25 组左右对照与原始差异图均未遮罩，未排除时间戳、运行 ID 或真实性能数值；像素统计仅用于排查，不解释为还原率。

逐页查看中文对照，结合英文页面索引检查布局变化，再用单张截图复核文字、控件和错误细节。已查看的单张包括中英文桌面 Playground、窄屏预览、插件上传与详情四类标签、文档正文、Benchmark 配置/结果、复制代码/模式切换、审批完成及 Schema/未知组件错误。没有把索引或根节点无溢出单独作为验收结论。

## 页面结论

| 页面 | 1440 / 1280 明暗主题 | 375 明暗主题 | 说明 |
|---|---|---|---|
| Playground | 通过 | 通过 | 三栏、工具栏、模板、表单、预览和 Inspector 沿用参考；新增入口和运行反馈见允许差异 |
| Plugins | 通过 | 通过 | 两列上传/管理、紧凑表格、选中详情、元数据与标签页；窄屏纵向排列，表格内部滚动 |
| API & Docs | 通过 | 通过 | 桌面目录及左对齐正文；窄屏目录内部横向滚动，正文正常换行，内容更新为真实双语接口 |
| Benchmarks | 通过 | 通过 | 1100px 页面宽度；真实配置、预览、结果及诊断扩展沿用同一 Token；窄屏两列配置/单列结果 |
| Text 完整渲染 | 1440 浅色通过 | 不作为额外参考矩阵 | 实际文字完成后对照；正文 15px，使用实际内容高度 |

英文四页同样覆盖上述三视口及两主题，文案可读、主要操作可访问，未发现根页面横向越界或按钮被长文案遮挡。较长操作行允许换行；插件标识、原始 Schema、业务数据和代码保留原文。

## 已修正的差异

- 保留参考系统字体、Token、图标路径、热力图色阶、左栏 228px / 中栏 440px、顶栏 56px 和收起 Inspector 35px；顶部选中导航恢复中性灰背景。
- 标题显式采用参考行高 1.12，消除继承正文行高造成的卡片下移。实际计算值的对照见 `artifacts/visual/heading-layout-comparison.json`。
- 文档目录恢复 220px；正文左对齐、20px/28px 内边距、22px 标题，移除导致正文额外右移的自动居中。Benchmark 恢复参考 1100px 最大宽度。
- Plugins 从疏松列表/大段 JSON 改为参考表格与详情布局；完整 Schema 和构建记录保留在折叠区。替换上传、日志和模板展示真实数据。
- Heatmap 数组字段按业务 Schema enum 显示区域组下拉；数值/删除列保持紧凑。编辑控件实际生成 Wire，不是截图专用控件。
- 去掉预览内重复的 Sandbox 标签及高度桥接累加空隙。Text 使用参考 15px 正文，移除 Host 的 32px 最低内容高度，避免短文本额外留白；仍限制最高内容高度。
- 修复截图时序：原 Text 参考等待条件误匹配编辑框，现等待预览中的 p；实现 Text 等待真实 frame 两次动画帧。Benchmark 重置实际 secondary-page 滚动区并等待 Sandbox 绘制。原参考内容、业务数据和测量结果未被修改。

## 由已确认需求允许的差异

- 主品牌旁移除错误的 Preview Host 标识，真实 Host 位于独立站点；增加语言、自定义响应、插件模式与真实 API 会话入口。
- Heatmap/Approval 来自真实上传 Registry；身份、版本、默认 Sandbox、Schema、Actions、时间和构建体积采用实际值。原型的 Org Chart 等 Mock 项目不冒充已安装功能。
- 统一 A2UI v1.0、实际 SDK 和 API；完整展示不伪造为必须三条消息。Inspector、业务错误和消息计数来自真实运行。
- 文档保留目录/正文结构，更新为双语完整 Quickstart、组件/API/插件/兼容说明；不保留错误接口及不完整的 Mock 示例。
- Benchmark 增加真实负载/实例配置、顺序 Compare Both、独立可见预览、结果及操作分段。参考的静态数值和按钮不足以表达这些边界，允许新增面板和页面增长；不伪造性能值。
- 窄屏修复原型导航及正文裁切；保留热力图、插件表、Inspector 和目录的内部滚动。内部横向内容并非全列同时可见，可使用滚动访问；不将根页面无越界解释为全部内容都同时可见。
- 未知组件占位、Schema/协议错误及恢复是必需功能补全，参考没有全部状态；沿用原 Token。第三方/官方诊断保留原始详情。
- 英文沿用同一布局与 Token，允许必要的局部换行；不虚构英文参考或翻译 Agent 业务数据。

## 证据位置与复现

| 目录（artifacts/visual 下） | 内容 |
|---|---|
| reference / implementation / diff | 25 组中文截图、未遮罩差异图与左右对照 |
| layout-matrix | 中英文 × 四页 × 三尺寸 × 明暗，共 48 张及布局记录 |
| ui-states | 两语 × 三尺寸 × 明暗 × 六状态，共 72 张：复制、模式切换、语法错误、卸载、等待、审批完成 |
| recovery-states | Schema 错误与未知组件，共 24 张及布局记录 |
| benchmarks | 配置/结果，共 24 张、四份未改写的本机测量 JSON 及布局记录 |
| plugin-details | Schema / Actions / 模板 / 构建日志，共 48 张及布局记录 |
| review-sheets | 八张索引；便于定位，不能替代单张细节检查 |

上述捕获记录未发现根文档横向越界；关键弹窗按钮没有超出视口。真实交互、焦点、草稿和实例保持由 52 项 E2E 验证补充，截图不用于替代行为测试。最终生产构建、类型、Lint、47 项单元/集成及 52 项 E2E 通过。

复现：先运行 `pnpm reference` 和 `pnpm dev`，安装示例插件，再运行 `pnpm visual:reference:matrix`、`pnpm visual:reference`、`pnpm visual:capture`、`pnpm visual:matrix`、`pnpm visual:states`、`pnpm exec tsx scripts/capture-recovery-states.ts`、`pnpm exec tsx scripts/capture-benchmarks.ts`、`pnpm exec tsx scripts/capture-plugin-details.ts`。最后用 Python/Pillow 执行 `scripts/visual_contact_sheets.py` 和 `scripts/visual_diff.py`。Pillow 仅用于证据生成，不是应用运行依赖。

## 2026-11-14 — CapabilityProfile visual evidence

Reference is the six-dimension insurance card approved in this chat: teal score outline/fill, neutral dashed target, dimension rows, subject/scenario controls and evidence region. This new component has no counterpart in the original ZIP; ZIP/.reference remain untouched. Intentional differences include generic title without insurance-only branding, existing Host typography/spacing, theme defaults, configurable dimensions and missing-score state.

artifacts/capability/visual contains 12 actual screenshots at 1440×900 / 1280×800 / 375×812, both locales and themes, plus configured-chart-only-1440.png showing custom colors and hidden breakdown. All use the same fictional input. Business labels remain verbatim in English mode; platform labels translate. Browser checks find no component horizontal overflow and verify independent display switches. Mobile uses existing Preview tab/scroll regions.

Inspected full-size Chinese desktop light and English mobile dark against the approved card for colors, spacing, labels and layout. artifacts/capability/consumer/installed-host.png also shows the genuine installed Library + static Host with custom colors and centered chart. No similarity percentage or fabricated English reference is claimed.
