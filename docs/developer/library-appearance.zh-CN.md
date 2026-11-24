# 主题、组件外观与 Playground 导出

Library 与独立 Host 必须同步使用 0.2.0。主题和外观属于本项目配置，不是新增的官方 A2UI 字段。

## 在便捷模板中配置

选择组件和场景，在“内容”填写业务数据；切到“外观”，选择需要调整的 Surface/componentId，再设置文字、颜色、容器或布局。未设置的属性保留组件默认值并继承主题；每项右侧箭头恢复继承，“重置组件外观”清除当前节点的覆盖。

“预览主题配置”设置整个预览的字体、基础字号、品牌/状态色、背景、圆角和密度，与工作台自身的明暗主题分开。改变外观或主题会更新已有实例，不需要重新渲染，不清空输入；内容改变仍遵循草稿/渲染流程。

## 配置合同

主题通过 `RunConfig.themeTokens`，组件覆盖通过 `RunConfig.componentAppearances[surfaceId][componentId]` 传递。组件覆盖优先，主题其次，组件默认值最后。字体只接受 system/sans/serif/mono；组件颜色接受语义名称或 #RRGGBB，主题颜色接受 #RRGGBB。值和额外字段由公共 Schema 严格校验，不接受任意 CSS、选择器或远程字体。

```ts
import { hostConfigSchema } from "@aap/agent-ui/protocol";

const config = hostConfigSchema.parse({
  runtimeMode: "sandbox", renderPolicy: "progressive", readyWhen: "/ready",
  theme: "light", locale: "zh-CN", actionHandler: "external",
  latency: 0, outcome: "success",
  themeTokens: { fontFamily: "system", fontSize: 16, brand: "#335577" },
  componentAppearances: {
    main: { title: { typography: "title", color: "brand", fontSize: 24 } }
  }
});
console.log(config);
```

将配置传给 `AgentUiHost` 的 config。挂载后可用 `client.configure({themeTokens, componentAppearances})` 更新；清除覆盖传 `{}`，而不是省略字段。配置中的节点必须对应真实消息中的 ID。不同组件支持项由发现元数据 appearance 声明；文字大小影响 DOM 文本，图形内部仍遵循组件自己的业务配置。

## Library 导出

“复制接入代码”选择“当前草稿”或“当前预览”，再选择 Library Inputs、Library Node 或 Library React。可分别下载 ui-input.json、server.ts、AgentUiExample.tsx。配置与消息使用同一快照；预览导出的是实际已经发送的消息，播放未结束时不会包含尚未发送的步骤。

Node 文件读取配套 release/manifest.json 和 ui-input.json，经过 Adapter 生成 normalized.json。React 文件读取该输出，连接后按顺序应用，重连重放完整历史。便捷模板首条为 template.create，后续保持真实原始更新；自定义 JSON/JSONL 作为 a2ui 输入保留。没有丢失原始协议的字段。

提供独立、无凭据的 hostUrl 和稳定的 onAction 回调。回调把完整 ActionEvent 交给后端，经业务授权后返回 NormalizedBatch[]；示例会应用这些结果。实时业务在后端保持每 run 一个 Adapter，使用下一个输入序号和新 batchId。导出的静态 Node 预处理脚本在结束时 dispose，实时服务应在 run 结束时才 dispose。

## 插件与升级

未知和旧插件默认只开放外部容器属性，不能保证其内部文字、canvas 或硬编码颜色被覆盖。全局主题传到 Native Preview 和 opaque Sandbox；本项目 Plugin SDK 的 `useHostTheme()` 提供 `{mode, tokens}`，插件可读取主题并使用 `--font-body`、`--color-accent` 等 Host CSS tokens。两个示例插件已接入该环境；业务风险色阶继续由业务配置管理。

包、Host、manifest 配套部署 0.2.0；0.1.0 Host 不被静默当作支持新配置。Plugin SDK 协议仍为 1.0，此次 hook 为可选增加，旧制品不强制重写。主业务页面不导入插件 JS。

[接入步骤](library-integration.zh-CN.md) · [打包部署](library-deployment.zh-CN.md)
