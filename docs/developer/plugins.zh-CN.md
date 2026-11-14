# 插件开发指南

插件通过 TSX 或 ZIP 上传；平台实际执行受控 esbuild 构建，安装后无需重部署工作台。Plugin SDK 是本项目 API，不是官方 A2UI SDK。

## 最小组件

```tsx
import { definePlugin, useHostAction, useHostLocale } from '@enterprise/agent-ui-plugin-sdk';

function Counter({ data }: { data: { value: number } }) {
  const dispatch = useHostAction();
  const locale = useHostLocale();
  return <button onClick={() => dispatch('counter.increment', { value: data.value })}>
    {locale === 'zh-CN' ? '增加' : 'Increment'}: {data.value}
  </button>;
}

export default definePlugin({ id: 'example.counter', version: '1.0.0', Component: Counter });
```

Component 接收已解析 data。definePlugin 的 id/version 必须与 Manifest 完全一致。useHostAction() 返回 dispatch(name, context)，context 必须为 JSON 对象，Action 名必须在 Manifest 中声明，并声明 agent.action capability。

useHostLocale() 返回 zh-CN 或 en-US，默认 zh-CN。语言变化更新已有实例，不重新挂载；不要用 locale 作为组件 key。插件自行翻译固定文案，宿主不会翻译业务数据和第三方名称。局部编辑状态用 React state 保存；审批完成等权威状态由 Agent 的数据更新驱动。

## ZIP 文件

```text
plugin.json
catalog.json
src/index.tsx
src/styles.css
```

可按需导入相对路径 TS/TSX/JS/JSX/CSS 文件。ZIP 也可有单层外包装目录。禁止 node_modules、package.json、脚本、二进制、符号链接和越界路径。

plugin.json：

```json
{
  "schemaVersion": "enterprise-plugin/1.0",
  "id": "example.counter",
  "version": "1.0.0",
  "displayName": "Example Counter",
  "entry": "src/index.tsx",
  "catalogFile": "catalog.json",
  "componentType": "ExampleCounter",
  "supportedRenderPolicies": ["progressive", "on_complete", "live"],
  "defaultRenderPolicy": "progressive",
  "actions": ["counter.increment"],
  "capabilities": ["ui.render", "agent.action", "ui.resize"],
  "sdkApiVersion": "1.0"
}
```

catalog.json：

```json
{
  "catalogId": "urn:enterprise:plugin:example.counter",
  "dataSchema": {
    "type": "object",
    "properties": { "value": { "type": "number" } },
    "required": ["value"],
    "additionalProperties": true
  },
  "defaults": { "value": 0 },
  "fields": [{ "key": "value", "label": "Value", "type": "number" }],
  "templates": ["full"],
  "category": "已安装插件",
  "icon": "gauge",
  "description": "An uploaded counter"
}
```

这是平台上传描述格式。平台生成实际官方 Catalog 文档：组件属性为动态 data，支持绑定到 Data Model；dataSchema 校验绑定解析后的业务值。GET /catalogs 可取得生成的 Catalog，不能把上传描述格式冒充官方 Wire。

catalogId 必须以 urn: 开头；dataSchema 必须为 JSON Schema 对象，使用 Ajv 默认 draft-07 方言进行严格校验（可用文档内部引用，不获取远程 $ref）。defaults 必须满足 dataSchema。fields 为必填数组，不需要表单字段时传 []；每项提供 key、label，可选 type、wide、options。非法 TSX metadata 返回 400 / INVALID_METADATA；ZIP 中非法 JSON、Catalog、Schema 或默认值返回 422，构建不会注册残缺插件。

fields 支持 text、number、textarea、toggle、select，select 可带 options。模板可使用 full、progressive、streaming、on_complete、action。内置生成器默认将业务参数放在 /view；自己提交消息时可绑定其他路径。

## 上传与发现

Plugins 页面选择 ZIP 上传，或运行：

```sh
curl --fail-with-body -F file=@examples/dist/unknown-counter.zip http://localhost:5173/api/v1/plugins
```

单文件 TSX 上传额外提供 metadata 字符串，内容为 {manifest, catalog}。单文件入口固定写入 src/index.tsx，不支持缺失的相对文件；有相对导入时使用 ZIP。工作台提供元数据编辑入口。

上传返回 buildId、bytes、sha256、status=ready、entry。entry 包含 component、catalogId、bundleUrl、可选 stylesheetUrl 和 schema；发现 API 立即可用。编译失败显示构建诊断，不注册半成品。同 ID 重传成功后替换 Registry 条目；已有运行需重新渲染以使用新版本。卸载后不能再创建该组件。

## Native 与 Sandbox

Native 在独立 Preview Host 创建插件 React root；工作台主页面不导入上传代码。Sandbox 使用相同产物，在仅 allow-scripts 的 opaque-origin iframe 中执行，通过带实例 nonce 的 MessageChannel 接收数据、主题和语言。

主题使用 data-theme=light/dark 和平台 CSS 变量；导入的 CSS 会作为真实构建产物在两种模式加载。语言/主题变化保留 root 和局部 state；切换运行模式、Reset 或卸载则销毁实例和监听器。两种模式都应提供相同行为。

Sandbox 不允许访问顶层文档、越权导航、网络请求或平台 API。Native 属于 Preview Host 的执行环境，不能当作完全不可信代码的隔离沙箱；该站点不承载登录凭据或主工作台状态。生产部署需要另行设计身份和站点隔离。

## 渲染、Action 与限制

progressive 可显示 Schema 有效的部分内容；on_complete 同时等待 ready 条件和 Schema 有效，超时只报错，不提交表单；live 首次 Ready 后持续接收更新。组件级配置通过 componentPolicies 指定，不增加 Wire 命令。

审批等敏感交互应进入 pending 并抑制重复点击；每次业务意图生成稳定 idempotencyKey，供 Agent/后端幂等处理。不要在插件本地把 pending 直接改成 approved；等待 Agent 更新权威 data.status。示例 expense-approval 展示了这个流程。

审批示例对同一意图的重试保留原 key；Action、单号或意见变化时生成新 key。连续返回相同 status（例如两次 error）时，Agent 应递增 data.resultVersion，让插件识别新的回执并结束 pending。该字段属于示例的业务 Schema，不是 A2UI 命令。校验提示按当前 locale 显示，不将已翻译的字符串存为状态。

依赖白名单：react、react/jsx-runtime、react/jsx-dev-runtime、react-dom、react-dom/client、zod 和 @enterprise/agent-ui-plugin-sdk。不执行上传的 npm scripts、不安装任意依赖，不允许导入 Node 内置模块或远程模块。

ZIP 最大 5 MB、100 个条目、解压总计 10 MB、单文件 2 MB、压缩比最多 100。构建超时 45 秒，JS 产物最大 2 MB、CSS 最大 500 KB。构建器无网络、非 root、只读根目录、限制 CPU/内存/PID。Docker 不可用时构建失败，不降级在主进程执行。

可参考 examples/plugins 下的 risk-heatmap、expense-approval、unknown-counter；pnpm demos:package 生成可上传 ZIP。
