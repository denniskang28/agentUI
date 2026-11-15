# Agent UI 开发者文档 / Developer documentation

首次体验全部本地示例：根目录执行 `pnpm install --frozen-lockfile`、`pnpm setup:demo`、`pnpm dev:all`。需要 Node 24+、pnpm 10.32.1、Python 3 和运行中的 Docker；初始化生成两个示例插件、Library、Host 和 Demo。Fresh checkout: install dependencies, run `pnpm setup:demo`, then `pnpm dev:all` from the repository root. Generated releases are not required in Git.

把当前 Library 放进现有 Chatbot，从下列七篇开始。Playground 的 **API & Docs → Library 接入指南** 展示同一套 Markdown；切换中英文保留当前文章，文章中的链接可直接跳到下一篇。

To embed the library in an existing chatbot, follow these seven articles. Playground **API & Docs → Library integration guides** renders these same files. Locale switching retains the article; guide links navigate within the reader.

| 阅读顺序 / Guide | 简体中文 | English | 内容 / Coverage |
| --- | --- | --- | --- |
| 1. 架构与选型 / Architecture | [中文](library-overview.zh-CN.md) | [English](library-overview.en-US.md) | Web UI、Orchestrator、Agent、Adapter、Host 的职责与选型 |
| 2. 接入步骤 / Integration | [中文](library-integration.zh-CN.md) | [English](library-integration.en-US.md) | 安装、真实 server/React 代码、manifest、传输、Action |
| 3. 双入口 / Inputs | [中文](library-inputs.zh-CN.md) | [English](library-inputs.en-US.md) | 完整批次数据、模板 / raw / 混用、与直接官方 SDK 对照 |
| 4. 事件与生命周期 / Events | [中文](library-events.zh-CN.md) | [English](library-events.en-US.md) | 完整 Action、业务幂等、ready、ACK、恢复、reset、错误 |
| 5. Demo 改造 / Migration | [中文](library-demo-migration.zh-CN.md) | [English](library-demo-migration.en-US.md) | baseline 如何工作、哪些文件改变、相同 Agent 输出如何转换 |
| 6. 打包部署 / Deployment | [中文](library-deployment.zh-CN.md) | [English](library-deployment.en-US.md) | .tgz、Host、插件制品、独立运行、变量、CSP/Cookie、升级 |

| 7. 主题与外观 / Appearance | [中文](library-appearance.zh-CN.md) | [English](library-appearance.en-US.md) | 主题继承、组件覆盖、插件能力与 Playground Library 导出 |

## Playground 开发参考 / Playground reference

- [CapabilityProfile 能力画像：配置、模板、Actions 与 Library 示例 / Configuration and integration](capability-profile.md)

这些是开发调试接口，不是消费者必须依赖的生产业务服务。These describe development services, not required runtime dependencies of your product.

- [Playground Quickstart 中文](quickstart.zh-CN.md) · [English](quickstart.en-US.md)
- [Playground API 中文](api.zh-CN.md) · [English](api.en-US.md)
- [Plugin 开发中文](plugins.zh-CN.md) · [English](plugins.en-US.md)
- [Benchmark 方法中文](benchmarks.zh-CN.md) · [English](benchmarks.en-US.md)

## 代码入口 / Source entry points

- [Library public exports](../../packages/agent-ui/README.md)
- [两套完整 Chatbot / Two standalone chatbots](../../examples/chatbot-comparison/README.md)
- [逐文件对照 / File comparison](../../examples/chatbot-comparison/COMPARISON.md)
- [集成版部署 / Integrated deployment](../../examples/chatbot-comparison/with-agent-ui/DEPLOYMENT.md)

以当前公开包和代码为准；原始 PRD 中的拟议接口不是额外承诺。The current package/code define support; proposed PRD APIs are not additional implemented features.

## 验证文档 / Verify the guides

完成 comparison Demo 的 prepare 和 npm ci 后，在仓库根目录运行：
After preparing/installing the comparison demo, run from repository root:

```sh
pnpm docs:verify
pnpm exec playwright test tests/e2e/documentation.spec.ts
pnpm exec tsx scripts/capture-library-docs.ts
```

后两条需要运行中的 `pnpm dev`。docs:verify 使用已安装的公开包、真实 release manifest 和官方 Core，检查中英文代码的 strict 编译、执行服务端示例、批次与 Action Schema、具体数据状态和篇间链接。报告在 artifacts/library-docs/verification.json；截图在 artifacts/library-docs/visual/。

The last two commands require running dev servers. docs:verify uses the installed public package, genuine release manifest and official Core to typecheck examples, execute server snippets, apply batches, validate Actions/data and check guide links. It writes artifacts/library-docs/verification.json; screenshots are in artifacts/library-docs/visual/.

- [主题、外观与 Library 导出](library-appearance.zh-CN.md) / [Themes, appearance and Library exports](library-appearance.en-US.md)
