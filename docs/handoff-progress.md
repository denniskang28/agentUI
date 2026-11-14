# Handoff progress

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
