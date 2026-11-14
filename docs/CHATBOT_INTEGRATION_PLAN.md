# Chatbot 接入 Library 与双方案 Demo — Goal 执行方案

日期：2026-11-14。状态：本增量已按 Goal 执行；实现、测试、部署与逐项验收见 docs/chatbot-integration-progress.md 和 docs/chatbot-integration-acceptance.md。此处保留原方案与可复用启动文本。

## 1. 交付目标

在现有本地 Playground MVP 上新增可分发的 Chatbot 接入能力：模板便捷入口和原始 A2UI 入口共存，经过同一校验、官方 Core、Renderer、隔离 Host 和 Action 通道。交付两套可独立运行、代码可对照的 Web UI + Orchestrator + Agent Demo，并验证脱离仓库源码的安装与部署。

本方案是新的增量范围，不重写原 M1–M4/J01–J40 的完成记录。继续执行 AGENTS.md、原执行规范、Handoff、API 设计、UI 评审和中英文要求；新增验收单独记录，关联回归证据。

## 2. 产品和架构

业务链路保持：用户 → Chat Web UI → 业务后端/Orchestrator → Domain Agent → Orchestrator → Web UI。点击 Action 沿反向通道返回业务后端。业务执行结果通过同一个有序响应流更新 UI。

Playground 用于发现、模板调试、插件上传编译、Action 检查和故障复现。业务聊天不依赖打开 Playground，也不依赖开发预览会话 API。

框架内部链路：模板命令或原始 A2UI → 规范化/校验 → 有序 A2UI 消息 → 独立 Host → 官方 Core/Renderer → 完整 Action → 业务回调。

## 3. 双入口契约

先实现严格、带版本的公共 TypeScript 类型和运行时 Schema，再开发调用方。本文接口名称是拟议名称；可由执行者按兼容性和代码结构调整，同步示例及文档。

- 模板入口：create、patch、delete，包含实例 ID、明确的模板版本和业务数据。create 映射为稳定 Surface/组件 ID 和绑定；patch 只修改指定业务字段；delete 清理对应 Surface。
- 原始入口：保留官方 createSurface/updateComponents/updateDataModel/deleteSurface 及字段，不改写为私有协议。
- 传输层：conversationId、runId、sequence、batchId/actionId 等关联、顺序、幂等信息放在平台信封中，不混入官方 Wire/Data Model。
- 配置层：runtimeMode、locale、theme、renderPolicy、readyWhen 等独立于官方消息和业务字段。
- 输出层：完整规范化 A2UI Action，以及独立的连接、应用回执、错误和生命周期通知。不能把 Core 应用完成报告为浏览器已绘制。

模板 patch 第一版采用指定顶层业务字段的浅层更新，数组整体替换，null 为显式值，省略字段保持不变。嵌套路径更新使用原始 updateDataModel，避免创造含糊的深合并规则。删除字段和空值不能混淆。

模板业务字段与模板生命周期状态分开。on_complete 的 ready 配置需要独立表达，以支持部分数据 → 完整数据但 ready=false → ready=true；不能用数据存在代替 ready。

两入口统一编译成消息序列。官方 Core 是 Surface/Data Model 的运行时权威；模板映射仅保存模板身份、版本和 ID 关联，不再维护第二套业务运行时状态。

必须定义混用规则：模板创建后可用原始消息更新同一 Surface；原始删除后清除模板映射，后续模板 patch 必须明确报错。原始结构变化若破坏模板绑定，则该实例的模板 patch 拒绝并给出诊断，继续使用原始消息或重新创建实例。校验不得依赖会被数据 patch 污染的历史对象。

完整原始入口表示不额外裁剪当前已支持的 A2UI 能力，不等于宣称覆盖标准全部可选能力。函数 RPC 和完整标准 Catalog 交互继续按实际验证更新兼容性记录。

## 4. 可分发产物

建议三个面向接入方的入口，可复用现有包并调整名称，不强制创建重复实现：

1. React 接入包（拟名 @enterprise/agent-ui-react）：Provider/客户端、消息应用接口、Surface 容器、Action/错误/连接回调；内部管理 iframe、MessageChannel、尺寸、顺序、重置和销毁。一个会话 Runtime 可容纳多个 Surface，聊天消息容器按 Surface 选择展示，避免一条消息建一个不相干 Runtime。
2. 服务端适配包（拟名 @enterprise/agent-ui-server）：发现数据、模板实例化/命令规范化、共享校验、插件制品清单解析和类型；无 React/DOM 副作用，不强制业务后端启动 Playground API。
3. 公共协议类型和 Schema（复用或扩展 protocol）：双入口信封、配置、Action 和错误类型；使用官方 SDK 真实公开导出。

同时交付独立 Host 静态产物和部署配置、版本化插件/Catalog/模板清单、经受控构建产生的插件制品。明确包与 Host/Plugin SDK 的兼容版本，启动时诊断不兼容。

包必须输出可安装的 JS、声明文件和必要 CSS/资源，设置公开 exports，声明 peerDependencies/运行时依赖。浏览器包不可夹带 Node/构建器，服务端包不要求 DOM。禁止让外部使用者依赖仓库 src 路径、TS path alias、workspace 链接或私有深层导入。

生成本地 .tgz，用独立临时目录中的全新消费者安装、typecheck、build、启动并完成浏览器 Action 闭环。测试不能借助 monorepo 源码解析。默认不公开发布 npm 包。

## 5. 两套 Demo 的目录和可比性

目标目录：examples/chatbot-comparison/。两个直接子目录：

```text
examples/chatbot-comparison/
  README.md
  COMPARISON.md
  integration-diff.json
  baseline/
    README.md
    package.json
    web/                  # 原生业务组件与聊天界面
    server/
      orchestrator/       # 意图路由、调用、Action 分发
      agents/             # Expense/Finance Agent
      business/           # 演示审批服务、样例数据
    scripts/
  with-agent-ui/
    README.md
    DEPLOYMENT.md
    package.json
    web/                  # 相同聊天界面，框架接入替换手写渲染
    server/
      orchestrator/
      agents/
      business/
      ui/                 # 消息/模板适配
    deploy/               # Host、制品、反向代理等配置
    scripts/
```

baseline 是正常可用的传统实现，不刻意做成只有文字或不能交互的弱对照：手写 React 审批卡/风险表，通过业务 DTO、业务事件和应用状态更新。

with-agent-ui 使用真实分发包、官方 Runtime、已构建插件和独立 Host；提供“模板入口”和“原始 A2UI 入口”模式选择，两者共用业务结果和 Action 处理。至少演示一次模板创建后通过原始消息更新同一个 Surface。

两套 Demo 不互相 import，均可单独复制、安装和启动。相同业务数据、Agent 业务逻辑、审批服务、主要路由/流式通道、聊天布局/样式保持一致；允许差异仅为 UI 输出适配、渲染、Action 适配、框架配置及必要部署文件。

用一致性脚本检查应相同的文件。COMPARISON.md 列出每个差异文件、原因、输入输出 JSON 和调用链；integration-diff.json 记录预期差异白名单，不用虚构的代码减少百分比证明价值。

## 6. Demo 的真实执行范围

默认使用本地、可重复的 Agent 实现：真实 HTTP 后端、确定性意图识别、模块化 Agent 调用、业务数据查询及有状态的演示审批服务；明确不宣称接入真实 LLM 或企业审批系统。无需 API Key 即可复现，预留 Agent adapter 替换点，但真实模型接入不是完成前提。

至少两个意图：报销审批、风险概览，验证 Orchestrator 确实路由到不同 Agent。界面展示开发用消息/Action 日志或可导出 trace，清楚标明方向和模式，不把协议细节强塞进普通用户操作流程。

主要验收场景：

- 查询 EXP-001，数据分批到达；完整但未 ready 时继续等待；ready 后出现表单。
- 批准/驳回/退回、失败与重试、连续点击去重；仅业务服务确认后显示成功。
- 风险数据连续更新，点击下钻，由对应 Agent 返回详情。
- 原始入口组合多个组件/Surface，新增或替换组件，再删除 Surface。
- 模板/原始两模式对同一业务结果产生一致的语义结果；Action 字段不被削减。
- 消息/Action 顺序、幂等、断线重连、刷新恢复；恢复策略由执行者明确并测试，不能只保留最后一份 data 丢弃结构或 ready 状态。
- 重置新 run 后拒绝迟到结果，删除实例清理 iframe、端口、计时器和监听器。

演示后端验证用户/会话/Surface/业务对象关联，使用明确标注的演示身份与权限规则；不将 sessionId 当授权。内存状态的重启行为要说明，不冒充生产 SSO 或持久化。

## 7. 部署路径

路径 A：本地开发。构建和打包 library → 通过原有上传/受控 Builder 流程安装示例插件 → 导出批准使用的制品/清单 → 启动两个 Demo 与独立 Host。提供可执行的一键编排脚本、分别启动命令、端口和健康检查。保留原 Playground/Preview 的默认地址及隔离约束，Demo 可配置受控端口/Origin。

路径 B：构建产物部署。使用 .tgz 安装前后端包 → 构建业务 web/server → 部署独立无业务凭据的 Host 与插件静态制品 → 配置 hostUrl、精确 parent Origin、CSP、制品基址和版本清单 → 启动业务后端与 web，验证 SSE/Action。提供本地可复现的部署编排，具体静态服务器和打包工具由执行者选择。

发布运行链路不启动 Playground，也不启动 Builder。插件构建在开发/发布阶段完成；不可把手写 React 模块塞进 Demo 冒充上传插件。Docker 不可用时构建失败关闭，不使用本机 esbuild 偷跑未知源码。

凭据留在业务站点/后端；主页面不导入上传代码；Host 运行在独立 Origin，Native 仅在 Host，Sandbox 在其内 opaque-origin iframe。消息桥接校验精确 Origin、source、会话/实例关联及消息 Schema；不使用通配 Origin 作为部署捷径。Sandbox 制品访问与业务 API 权限隔离。

DEPLOYMENT.md 必须包含：产物清单、真实安装命令、配置示例、静态响应头、资源 URL/CORS、启动/停止、升级兼容、清理与常见故障。对 cookie domain 和无凭据 Host 的部署关系作明确说明。

## 8. 执行阶段

- M1 契约与提取：检查真实 SDK/现有导出，冻结双入口和混用语义，提取核心能力、配置化 Host，先做最小包消费者贯通。
- M2 Library：完成模板规范化、原始消息透传校验、React/服务端入口、Action 和生命周期；Playground 尽可能复用公共能力，避免两套 Runtime 分叉。
- M3 对照 Demo：先做 baseline，再复制相同业务骨架并只替换接入点；完成两入口和混用场景、交互日志、差异清单。
- M4 部署与验收：产出 .tgz/Host/插件资源及部署编排；脱离源码验证，双 Demo E2E 和 Playground 回归，补齐双语说明与证据。

阶段连续推进，不在阶段末等待确认。常规命名、工具选择、修复和重构自行决定，记录取舍。只对确需外部凭据、工具强制人工操作等不可推断事项提出具体需求；不将普通实现选择当阻塞。

## 9. 完成条件

1. 模板与原始入口均通过真实 Core/Renderer 工作；增量更新保留输入和实例，完整 Action 到真实后端，再驱动 DOM 变化。
2. 混用、结构变化、多 Surface、删除、ready 策略、错误、重连、重置和资源清理都有必要的真实测试。
3. 两套 Demo 都能独立安装运行；相同流程、数据、业务逻辑有对照证据，baseline 不依赖框架。
4. 集成 Demo 必须通过打包 library 的公开 exports 工作；独立消费者不能读取 monorepo 源码。
5. 脱离开发服务器的 Host 静态部署可运行，框架 Demo 无需启动 Playground/预览会话 API/Builder。
6. 示例插件来自实际受控构建产物，隔离边界、Origin、CSP 和敏感 API 权限通过真实浏览器检查。
7. pnpm lint/typecheck/build/test/test:e2e 及新增 package/deployment/consumer 检查通过；按受影响范围验证，不为低影响实现细节堆积镜像测试。
8. 1440×900、1280×800、375×812 下，两套 Demo 主要状态的中英文、明暗主题截图可检查；原 Playground 相关回归和参考材料完整性保持。
9. 双语安装、迁移、部署、协议和对照文档中的命令经执行验证；记录支持范围，不宣称未验证的完整标准能力或性能提升。
10. 更新 progress、compatibility、decisions、acceptance、visual evidence；新增范围未完成不得将 Goal 标记 complete。

## 10. Goal 启动文本

按以下文本创建本次增量 Goal，而不是重新启动旧 MVP Goal：

> 依据 docs/CHATBOT_INTEGRATION_PLAN.md，在现有 Agent UI Playground MVP 上自主完成双入口 Chatbot 接入 Library、独立部署 Host、以及 examples/chatbot-comparison 下 baseline 和 with-agent-ui 两套可独立运行的 Web UI + Orchestrator + Agent 对照 Demo。模板便捷入口与原始 A2UI 入口共用真实官方 Core/Renderer，保留完整已支持消息和 Action 语义，明确混用和生命周期规则。交付可安装构建包、真实插件制品、脱离源码的消费者与部署验证、双语接入/对照/部署文档、真实测试及视觉证据。遵循 AGENTS.md 和原规范边界，常规决策、实现、修复和工具选择自行完成，M1–M4 连续推进，不在阶段结束等待确认。不得公开发布、购买服务、对外发送消息或删除无关资料；仅完成本地可复现交付。所有新增完成条件和相关原有回归通过后才完成 Goal。现在开始执行。

创建 Goal 之前应重新查询当前 Goal 状态：没有现存 Goal 时创建；已有未完成 Goal 时确认其范围关系并避免覆盖或丢弃工作。实施期间维护任务状态，不能将写完本方案等同于已经交付。
