# Fresh checkout / 全新检出验证

2026-11-14。本次提交提供 Playground、Risk Heatmap / Expense Approval 示例插件，以及传统 React / Agent UI 两套对照 Demo 的完整本地准备链路。

## 使用 / Run

需要 Node.js 24+、pnpm 10.32.1、Python 3、运行中的 Docker；首次准备需要网络。启动器使用 POSIX 进程组，支持 macOS/Linux，Windows 使用 WSL2。

```sh
pnpm install --frozen-lockfile
pnpm setup:demo
pnpm dev:all
```

打开 http://localhost:5173、http://localhost:5180、http://localhost:5181。Ctrl+C 停止本命令启动的进程。准备应在启动服务之前完成；重新准备后重启运行中的 Playground API，以加载最新插件记录。

`setup:demo` 检查工具、构建受控 Builder、打包 Library、构建 Host、通过真实隔离 Builder 安装两个标准插件，再安装并构建两套 Demo。Docker 不可用时终止，不在本机执行上传源码。`dev:all` 在发布文件缺失时提示先准备，不静默启动不完整的示例。首次准备后，Playground 左侧包含 12 个内置组件和两个标准插件；Counter/Styled Counter 测试安装不属于默认清单。

## 验证 / Verification

从待提交的 Git index 导出独立目录，开始时没有 `node_modules`、`.runtime`、`dist`、Demo 的 `vendor` / `release`。在该目录重新安装依赖并执行准备，没有复制原工作区的安装或发布目录。使用了依赖下载缓存和 Docker 镜像层缓存；不将此结果宣称为冷缓存网络测试。

| 检查 | 结果 |
| --- | --- |
| 冻结锁文件安装 | `pnpm install --frozen-lockfile --offline` 成功，7 个 workspace |
| 首次准备 | `pnpm setup:demo` 成功；两个真实插件记录、Library/Host/发布清单、两套 Demo 依赖和构建均重新生成 |
| 类型与 Lint | `pnpm typecheck`、`pnpm lint` 通过 |
| 单元/集成 | 16 文件 / 66 项通过 |
| 浏览器构建 | Playground、Preview Host、embedded Host、两个 Demo 构建通过；保留已有 chunk 大小提示 |
| 全新 Playground | 独立端口启动该目录 API/Vite；发现恰好两个标准插件，真实 Sandbox DOM、热力图下钻、费用批准、Library 文档入口通过 |
| 仓库外 Demo | `pnpm chatbot:consumer` 将两个准备好的目录复制到另一临时目录、重新 npm ci/build，以实际安装的公开包验证审批与刷新恢复，并检查停止后端口关闭 |
| 文档示例 | `pnpm docs:verify`：12 篇指南、12 个 strict 示例、2 次服务端执行、18 个官方 Core 批次、2 个 Action、42 个链接通过 |
| 两应用对照 | 14 个文件相同、8 个允许差异、0 个未声明差异 |
| 能力画像安装验证 | `pnpm capability:consumer` 从安装包重建消费者，实际静态 Host、颜色、布局、两个 Action 和评分更新通过 |

Playground 检查使用 5273 / 4273 / 3101，仓库外 Demo 使用 5280 / 5281 / 4283，以免影响原工作区运行服务。标准启动地址仍为上方默认地址。浏览器无伪造组件或 Mock 接口响应；Playground 使用其既有 Mock Agent 业务闭环。

## 提交边界 / Files

Git 包含源码、manifest/catalog 源文件、依赖锁、准备/启动/验证脚本和使用说明。以下由准备和验证生成：Library `.tgz`、`dist`、`.runtime`、Demo `vendor` / `release`、发布清单及插件 JS、测试日志/截图/比较结果。新的生成目录已加入 `.gitignore`；此前提交的验收图片保留。

`artifacts/capability/consumer` 内的 JSX、检查脚本、package/锁文件是验证源码；`app.js` 和 `batches.json` 是生成文件。运行 `pnpm capability:consumer` 自动安装实际包并重建，不依赖留下来的 bundle。

本次不更新公网部署，不提交阿里云专用环境配置或历史部署文件。
