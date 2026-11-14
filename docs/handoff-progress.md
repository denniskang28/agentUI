# Handoff progress

## 2026-11-14 — Playground plugin catalog recovery

- 现场复现：Chrome 左侧仅 12 个内置组件，而同一服务的 `/components` 与 `/plugins` 仍返回 4 个实际已安装插件。安装记录和产物未丢失；前端发现列表停留在初始回退值。
- 原逻辑只在挂载时请求一次，失败后仅写入编辑器错误，不重试。改为失败后 1–30 秒退避重试，切页、窗口重新聚焦、恢复联网和页面重新可见时同步；成功清除专用列表提示，刷新失败保留已有列表，未改变的列表保持引用。组件草稿和预览不因列表同步而重置。
- 验证：真实 API 返回的插件重新出现，浏览器显示 16 个组件（含 4 个插件）。新增两项 E2E 只中断网络、不伪造组件数据，覆盖恢复后草稿保留及 Plugins 返回同步；连同 foundation 共 7 项 E2E 通过，typecheck/lint 通过。
- 范围：不改变插件构建、安装记录、官方 Core、预览隔离和 API 契约。

## 当前状态 — 2026-11-14

原 Goal 的 M1–M4 本地 MVP 已完成，中英文要求沿用同一 Goal，J01–J40 均已按实际证据通过。验收表见 `docs/acceptance-report.md`，逐页视觉结论及允许差异见 `docs/ui/visual-verification.md`。不宣称逐像素 100% 相同。

## Done

| 阶段 | 已交付 |
|---|---|
| M1 Foundation | 严格 TypeScript 工程、实际官方 A2UI v1.0 Core/React 集成、分类组件库、表单/JSON 模板、自定义 JSON/JSONL、校验和多 Surface 检查 |
| M2 Streaming / Action | Play/Pause/Step/Reset、progressive/on_complete/live、组件级 Schema/ready 门控、真实 Action、Mock/外部 Agent 闭环、草稿及运行状态保持 |
| M3 Plugins / Isolation | TSX/ZIP 上传、隔离 Docker 构建、动态 Registry、真实替换/卸载、独立 Native Preview Host、进一步隔离的 opaque Sandbox、两个真实 Demo 及未知第三插件 |
| M4 API / Verification | 27 操作 OpenAPI、发现/实例化/校验/会话/消息/事件/Action、幂等/顺序/游标/TTL/销毁、真实 Benchmark、双语文档与可执行示例、J01–J40 及视觉检查 |

中英文覆盖工作台、Preview Host、两个示例插件及核心开发者文档。语言选择持久化，切换保留编辑、播放、焦点、插件局部状态和 Action 历史；locale 是平台配置，不改业务内容或 A2UI Wire。未知插件通过 SDK `useHostLocale()` 自行处理译文。

## Verified

最终代码状态执行结果：

- `pnpm install --frozen-lockfile`：通过。
- `pnpm typecheck`、`pnpm lint`、`pnpm build`：通过。
- `pnpm test`：9 个文件、47 项通过。包含实际 Docker 拒绝构建、ZIP 约束、官方协议/模板、结构化 API 契约、实际 SSE 恢复、TTL 自动关闭和服务退出清理。
- `pnpm test:e2e`：52 项通过，最终运行约 1.5 分钟。验证真实编译 Artifact、官方 Runtime DOM、Native/Sandbox、数据更新、Action、语言/主题/实例保持、异常/越权拒绝、卸载清理、外部重放与九个 Python/TypeScript/cURL 完整场景。
- 中文 25 组参考/实现/未遮罩差异；页面 48 张、关键状态 72 张、恢复状态 24 张、Benchmark 24 张、插件详情 48 张。三视口、明暗、两语布局记录未发现根文档横向越界；人工逐页对照及单张细节复核已完成。
- 原始 ZIP 与 10 份提取文件对照无缺失或改动，证据在 `artifacts/visual/reference-integrity.json`。
- OpenAPI 的 25 路径 / 27 操作与真实服务请求、响应、SSE 事件和 Docker 上传结果对应核验，见 `docs/api-contract-verification.md`。

最后修正包含 Plugins 表格/详情与真实替换上传、Schema enum 数组控件、标题行高、文档左对齐、Benchmark 1100px 宽度、Text 正文尺寸与实际内容高度。截图等待实际渲染，未修改参考或制造测量结果。

## 本地使用

```sh
pnpm install --frozen-lockfile
pnpm builder:image
pnpm demos:package
pnpm dev
```

打开 `http://localhost:5173`，在 Plugins 中选择「加载示例插件」。Preview Host 为 `http://127.0.0.1:4173`，API 为 `http://127.0.0.1:3001/api/v1`（工作台代理 `/api/v1`）。两个站点的 hostname 不要统一。

外部示例：`python3 examples/agent.py --scenario full`，也支持 progressive / action；TypeScript 与 cURL 命令见双语 Quickstart。Action 场景需在脚本打印的 previewUrl 中真实点击。验证命令为 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:e2e`、`pnpm build`。E2E 需已运行开发服务及 Docker Builder。

## 已知限制与后续范围

- 本地开发服务，无生产鉴权或持久会话；API 重启后会话消失，插件制品缓存位于忽略的 `.runtime/plugins`。SSO、生产部署与 Marketplace 属于后续范围。
- 构建保留大包体积提示：主应用约 751 KB、Preview 约 1.3 MB（未压缩 JS）。不隐藏警告；代码分包可后续优化。
- Benchmark 为本机实际测量，浏览器长任务/内存尽力采集；已安装制品的构建次数不可测时为 null，不冒充零或浏览器物理呈现时间。
- 支持范围以兼容性文档及 Gallery 为准，不宣称覆盖标准 Catalog 的全部交互或可选函数 RPC。当前 plain-text Gallery 不使用有 Core peer-range 提示的上游 Markdown Renderer。
- 375px 的热力图、插件表、目录和 Inspector 保留内部滚动；英文没有原始参考图。真实 API/插件身份/Benchmark 和必要窄屏修复是已记录的设计差异。

当前无阻塞本地 MVP 交付的必需事项。后续新增需求应形成新的范围和验收条件。

## 2026-11-14 — CapabilityProfile component addition

已按本次授权将能力画像接入企业 Catalog、Gallery、组件发现/模板 API、官方 Runtime 和 Library。默认虚构保险代理人六维；支持自定义 3–8 维、1–12 场景目标、颜色/填充强度及独立明细/说明开关。绑定选择写入官方 Data Model 并发送完整 Action，缺失分数不补零。用法见 docs/developer/capability-profile.md。

验证：66 项单元/API 测试和新增 4 项 E2E 通过；全量 58 项 E2E 首次 57 通过，1 个 Sandbox Benchmark 等待超时，单项及整组 6 项 Benchmark 复跑通过，未宣称首次全绿。typecheck/lint/build、library:build、embedded Host 构建通过，保留原有大 chunk 提示。12 张固定尺寸/主题/语言截图和配置截图在 artifacts/capability/visual。

已安装实际 .tgz，以公开 server/protocol/react 入口和编译后的独立静态 Host 验证渲染、颜色、隐藏明细、真实 Action、评分 patch 与选择保持。证据在 artifacts/capability/consumer/report.json、installed-host.png。artifacts/chatbot-release 的 Host/内置 manifest 已更新，已有插件制品保留；没有公网部署。旧 Goal 和验收编号不变。
