# MCP Apps Host — Goal 执行与验收规格

日期：2026-11-18。状态：Goal 已于 2026-11-18 完成；M1–M4 与 MH01–MH15 均已验收。实现、证据和边界记录于 mcp-apps-progress.md、mcp-apps-acceptance.md。

## 1. 目标与范围

在当前系统中增加 MCP Apps Host，使 Playground、可分发 React Library 和现有接入版 Chatbot 同时支持 A2UI 与 MCP Apps，完成真实工具发现、UI 资源读取、隔离渲染、用户交互、工具结果回传和生命周期清理。

沿用当前 A2UI、插件、独立 Preview 和中英文架构。遵守 AGENTS.md、GOAL_EXECUTION_SPEC.md 的工程与验收规则，以及 AGENT_UI_MVP_HANDOFF.md、AGENT_INTEGRATION_API_DESIGN.md、ui/V1_DESIGN_REVIEW.md、I18N_REQUIREMENTS.md 和 repository-privacy.md 的适用约束。原 A2UI M1–M4 的已交付能力作为回归基线，不重建原 MVP。

本次实现 Host。应用发布平台、现有 A2UI 插件转 MCP App、任意 npm 安装、stdio 命令启动、Marketplace、OAuth/SSO 全流程、真实 LLM 和生产多租户不在首版范围。测试用 MCP Server 和示例 App 是验证 Host 的输入，不构成对外 Provider 产品。

首版连接采用 Streamable HTTP；Server 由可信配置提供，凭据从后端环境读取。无 UI 元数据的工具仍显示普通结果。使用内联显示；其他显示模式明确报告不支持，不自动声明全部规范能力。支持自包含 HTML，并实现资源声明与宿主允许策略约束下的外部资源规则。

## 2. 当前系统与 Java Chatbot 的关系

- 当前仓库的后端为 Node/TypeScript。本次在现有 services/api 中增加 MCP Gateway 参考实现；不把整个后端重写为 Java，也不额外引入强制运行的 Node A2UI 模板转换服务。
- A2UI 原始消息继续走已有通道；MCP Apps 使用独立协议、实例和状态。不能将 HTML 转成 A2UI，也不能让 A2UI MessageProcessor 处理 MCP JSON-RPC。
- Host 前端通过可替换的 transport 接口访问后端，不把 Fastify endpoint 写死进 React 组件。现有 Playground 和 Chatbot 使用同一实现。
- 面向 Java Chatbot，交付语言无关的 HTTP/事件契约、完整数据流及 Java HTTP 调用示例。示例需编译/执行验证；不得称为已交付生产 Java Gateway 或 Java SDK。Java 可实现相同契约并持有自己的 MCP Client 连接。
- 对已由编排器执行的工具调用，提供关联同一输入/结果的宿主接口；挂载 View 不得重新执行该调用。Server 会话、UI 资源及 App 后续工具调用应绑定同一连接或显式受控的等价上下文，不能仅凭浏览器传入的 URL 新建任意连接。

## 3. 架构与代码落点

| 模块 | 交付 |
| --- | --- |
| packages/mcp-apps-host | 拟新增独立包；官方 AppBridge 封装、Controller、React 容器、公共类型、transport 接口与 Node Gateway 核心 |
| services/api/src/mcp | Server 配置、连接、工具发现、应用实例、受控调用/资源读取、事件、超时和清理 |
| apps/preview-host | 专用 mcp-sandbox 页面及可信代理；与现有 Native/A2UI 页面分别配置策略 |
| apps/playground | MCP Apps 入口、连接/工具/参数、预览、输入结果及交互日志 |
| examples/chatbot-comparison/with-agent-ui | 同一 Chatbot 中的 A2UI 与 MCP App 卡片及宿主回调 |
| scripts | Host/Library 打包、开发启动、测试 Server 和消费者验证 |
| docs/developer | 中英文 Host 接入、后端契约、部署及 Java 示例说明 |

公共入口拟为 @enterprise/mcp-apps-host/react、/protocol、/server。最终名称及类型在 M1 锁定；这些是本项目新增 API，不是官方 SDK API。消费者只使用公开导出。

## 4. 安全与协议边界

- 主应用只运行可信 React、Controller 和 AppBridge。外部 HTML/JS 只在 Preview 内层 opaque-origin iframe 执行；App 不获得 Native 切换入口。
- 主应用默认 localhost:5173，Preview 默认 127.0.0.1:4173。独立部署也必须不同 Origin、无业务 Cookie/Token，父 Origin 精确允许。
- MCP Sandbox 使用专用文档、路由和响应头。按资源声明与平台策略的交集生成并执行 CSP；处理父页面 CSP 继承，不能靠追加宽松 meta 标签放开旧策略，也不能削弱现有 A2UI 页面。
- 不依赖 document.referrer 完成唯一认证；兼容现有 no-referrer，通过配置与实际消息 origin/source 校验建立绑定。opaque 内层用窗口身份和实例绑定验证，不能只接受 origin=null。
- 严格处理初始化、完整工具输入先于结果、取消、teardown、尺寸和 Host Context；未初始化时缓存待交付输入与结果，资源或工具先完成都不得丢失。
- App 工具调用限定于绑定连接，并校验 app 可见性与平台授权。服务器工具列表不直接等于权限。后端重新校验归属、参数和资源策略，禁止任意 JSON-RPC 透传。
- Server 地址受控，防止通过地址、重定向或 DNS 变化访问未授权目标；本地测试 Server 以明确规则允许。限制资源体积、请求体积、并发、持续时间及事件保留窗口。
- 原始结果为不可信数据；日志和文本以转义方式展示。工具结果 _meta 不自动进入模型上下文；缓存按连接、资源 URI 和适用的身份/策略边界隔离。
- 每实例绑定 appInstanceId、runId、serverConnectionId、toolCallId。请求 ID 只做关联，不作为授权。默认不对副作用工具自动重试；重放记录不重新执行业务工具。
- Reset、关闭、TTL、断线或卸载清理桥接、监听器、任务和资源；teardown 超时仍有界结束，旧实例结果不得进入新实例。
- ui/message、模型上下文更新及外链通过显式宿主回调与能力声明处理；外链校验协议和目标。不支持的权限及能力明确拒绝。开发 Playground 的记录行为不能冒充真实 Agent 执行。
- 首版保持原插件 Builder 和 Docker 限制。加载外部 App HTML 不进入 TSX/ZIP 构建链路。

## 5. M1–M4 连续执行

### M1：兼容验证与契约

1. 记录当前 A2UI/Library 基线、工作树及已知检查失败，保护无关本地资料。
2. 验证真实发布的 MCP SDK、ext-apps 导出与官方示例，锁定精确版本；处理与现有 Zod 3 的依赖边界，不整体升级现有协议代码。
3. 用官方 SDK 运行真实 MCP Server、View、AppBridge 和 Sandbox，验证基本闭环，不用伪 AppBridge 替代。
4. 定义 Gateway/transport、实例状态机、事件恢复、错误码、数据边界及外部调用结果接入接口。

出口：可运行的真实协议验证、兼容记录和固定契约。示例源码/版本必须可追溯。

### M2：Gateway 与隔离运行

1. 实现受控连接、工具发现、UI 资源读取、工具调用和实例事件。
2. 实现专用 Sandbox 页面、响应头策略和来源验证。
3. 实现 React Controller/View、输入结果交付、宿主上下文和清理。
4. 验证真实点击发起工具调用并使 App 更新；覆盖结果先于 View 就绪的情况。

出口：真实 Server → Host → 实际 DOM → 用户点击 → Server → UI 更新；隔离与越权用例通过。

### M3：Playground、Library 与 Chatbot

1. Playground 增加 MCP Apps 页面，沿用现有布局、Token、导航和词典。
2. 提供 Server 选择、工具参数、调用、关闭/重置、输入结果与协议日志；MCP 工具请求与 A2UI Action 有明确来源。
3. 可分发包和独立 Sandbox 发布产物可在仓库外消费者运行，不依赖 Playground 进程。
4. 接入现有 Chatbot，提供 A2UI/MCP Apps 并存场景、消息与上下文回调；验证已执行调用的 View 挂载不触发二次业务执行。
5. 主题/语言变化不重新执行工具、不丢失 App 实例；第三方业务文案不自动翻译。

出口：两个入口复用同一 Host 包，公开导出和独立部署真实可用，中文/英文具备完整平台文案。

### M4：回归、文档与交付

1. 完成单元、真实 HTTP 集成、浏览器协议/DOM/隔离测试与适用的 A2UI 回归。
2. 验证至少一个有来源/版本记录的官方示例 App，以及独立的第二个 App；无需修改 Host 即可切换。错误/恶意输入用独立测试 Server 覆盖，不用它们代替外部兼容验证。
3. 在 1440×900、1280×800、375×812 检查中英文、明暗主题和关键错误状态。新增页面无原型时沿用现有设计，保留截图；已有页面回归不修改 reference。
4. 提供中英文 Quickstart、完整后端契约与事件恢复说明、React 集成、Java HTTP 示例、部署和兼容限制。
5. 从干净的发布产物安装、构建、启动和验证；记录实际命令及结果，不将历史检查当成本次结果。

出口：下列所有必需项有证据后，才能完成 Goal。M1/M2 原型跑通不等于交付完成。

## 6. 必需验收清单

初始全部为未通过；实现时逐项记录结果与证据。

| 编号 | 必需条件 |
| --- | --- |
| MH01 | 正确协商 Apps 能力、发现工具及关联 UI；分页和实际能力按锁定 SDK 处理 |
| MH02 | 正确读取 text/blob HTML、URI/MIME/体积校验及安全元数据；UI-only 资源不依赖必须出现在 resources/list |
| MH03 | 官方 AppBridge、真实初始化、完整输入和结果顺序；提前返回结果也能交付 |
| MH04 | 真实 App 点击调用工具，Server 返回后实际 DOM 更新；普通工具和 UI 故障保留文本结果 |
| MH05 | 外部代码只在隔离 View 执行；主页面/代理/其他实例无非授权访问，凭据不进入 Preview |
| MH06 | CSP、资源域名、来源窗口、工具可见性及实例归属的允许/拒绝均有真实测试 |
| MH07 | 错误、取消、超时、关闭、TTL、断线、Reset、StrictMode 和迟到结果有界清理且不重复副作用 |
| MH08 | 主题、语言、尺寸与已声明的宿主回调正确；未支持能力明确诊断 |
| MH09 | Playground 连接/发现/参数/预览/日志/关闭可用，支持中英文及窄屏 |
| MH10 | 可分发 Host 包通过公开导出在仓库外消费者运行，后端 transport 可替换 |
| MH11 | Chatbot 同时运行 A2UI 与 MCP Apps；挂载已执行调用不再次调用工具 |
| MH12 | 两个独立 App 的真实兼容与协议验证，不为某个 App 写死工具/组件名 |
| MH13 | A2UI、Native/Sandbox 插件、Action、Library、双语和外观等适用回归通过 |
| MH14 | 双语文档、可执行示例、Java 接入契约、完整静态部署与版本配套说明可用 |
| MH15 | 检查结果、截图、兼容限制及安全边界有准确记录；无必需项未完成 |

## 7. 持续记录与验证命令

启动实施时创建并持续更新：

- docs/mcp-apps-progress.md：里程碑、当前问题、下一步和准确命令。
- docs/mcp-apps-compatibility.md：官方规范/SDK 版本、实际导出、第三方 App、opaque-origin 策略兼容范围。
- docs/mcp-apps-acceptance.md：MH01–MH15 状态和证据。
- docs/implementation-decisions.md：重要决策及限制。
- docs/ui/visual-verification.md：新增页面及已有界面的回归。

沿用 pnpm typecheck、pnpm lint、pnpm test、pnpm build、pnpm test:e2e 及适用的 Chatbot/Library 验证命令。新增必要 MCP 定向命令并纳入正常开发/交付流程；本文件不声称这些命令已存在。

当前已知 pnpm lint 会扫描未跟踪的 docs/architecture 生成脚本，前次检查为 49 项错误。启动时重新确认；报告全仓与本次提交范围结果，不能用忽略目录后的通过冒充全仓通过，不擅自重写无关资料。

原始截图、日志、真实环境和私有操作记录按 repository-privacy.md 留在忽略区域。提交可复现的源码、测试和脱敏验收摘要。保留用户未跟踪的部署和架构资料。实现阶段不自动公开部署、推送或发送外部消息。

## 8. 完成条件和启动文本

没有必需项缺失、MH01–MH15 均有真实证据、适用回归和视觉检查完成，才能将 Goal 标记 complete。仅创建本文、通过类型检查或跑通单一示例都不能标记完成。不虚构性能、兼容或 Java 实现完成状态。

可直接使用的启动指令：

> 在当前聊天创建并启动 Goal：依据 docs/MCP_APPS_HOST_GOAL.md，在现有 Agent UI 系统实现 MCP Apps Host，使 Playground、独立 React Library 和接入版 Chatbot 同时支持 A2UI 与 MCP Apps。采用已讨论的独立 Sandbox Proxy、opaque-origin View、官方 AppBridge 和后端 MCP Gateway 设计。当前仓库复用 Node 后端，交付可替换的后端契约及 Java 接入示例。按 M1→M4 连续自主执行，不在里程碑结束等待确认；保持原 A2UI 与插件能力，使用真实 SDK、真实 Server、真实 App 交互和浏览器证据验收。保护现有无关修改与本地私有资料。只有 MH01–MH15 全部满足才能完成 Goal。现在开始。

如果本聊天已有未完成 Goal，先核对其目标和状态；不要覆盖不相关目标或擅自恢复用户暂停的目标。

## 9. 官方依据

- [MCP Apps SDK 与文档](https://apps.extensions.modelcontextprotocol.io/api/)
- [MCP Apps 稳定版规范](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
- [官方 basic-host 示例](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host)

规范日期与实际使用的 npm SDK 版本分别记录；实施时核验实际发布包，不把仓库 main 的接口假定为已发布接口。
