import { useSyncExternalStore } from "react";
export type Locale = "zh-CN" | "en-US";
export const english = {
  允许的依赖: "Allowed dependencies",
  不允许: "Not allowed",
  "Node 内置模块、远程导入、自定义构建脚本与任意依赖安装":
    "Node built-ins, remote imports, custom build scripts and arbitrary dependency installs",
  "默认导出 definePlugin，并提供 manifest 与 catalog 元数据":
    "Default-export definePlugin and provide manifest and catalog metadata",
  "Native 在独立 Preview Host 中运行；Sandbox 在其内进一步隔离。":
    "Native runs in the separate Preview Host; Sandbox adds another isolation boundary inside it.",
  默认运行: "Default mode",
  更新: "Updated",
  "插件 ID": "Plugin ID",
  组件类型: "Component type",
  文件: "File",
  依赖: "Dependencies",
  替换上传: "Replace upload",
  查看日志: "View logs",
  插件详情: "Plugin details",
  模板: "Templates",
  构建日志: "Build log",
  字段: "Field",
  类型: "Type",
  查看完整Schema: "View full schema",
  "该插件未声明 Action。": "This plugin declares no Actions.",
  会话已过期: "Session expired",
  会话已结束: "Session ended",
  处理中: "Processing",
  长任务数量: "Long tasks",
  长任务总时长: "Long task duration",
  错误数: "Errors",
  构建错误数: "Build errors",
  加载错误数: "Load errors",
  渲染错误数: "Render errors",
  桥接错误数: "Bridge errors",
  测量错误数: "Measurement errors",
  操作分段耗时: "Action timing stages",
  "在实时预览中点击交互组件；Mock 响应提交后记录分段耗时。没有真实点击时显示不可用。":
    "Interact with a component in the live preview. Stages are recorded after the Mock response commits. Unavailable until a real interaction occurs.",
  "点击到 Host": "Click to Host",
  "Host 到工作台": "Host to Playground",
  "Mock 等待与响应": "Mock wait and response",
  "响应到 UI 提交": "Response to UI commit",
  "首次显示检查第一个实例的 React 提交及两次动画帧后的显示机会，不能代表屏幕像素已经呈现；冷启动为新实例，浏览器缓存保持自然状态。更新延迟从 Preview Host 收到数据到全部实例实际提交，不含绘制；原始数据另保留往返耗时。被覆盖、跳过及失败的更新不计入 P50/P95。":
    "First render observes the first instance's React commit and display opportunity after two animation frames, not physical pixel presentation. Cold load uses a fresh instance with normal browser caching. Update latency runs from Preview Host receiving data to every instance's actual commit, excluding paint. Raw results also retain round-trip time. Superseded, skipped and failed updates are excluded from P50/P95.",
  "大数据使用可视窗口；不适用负载规模的组件使用原始模板。运行测试会清理工作台原有预览，避免背景实例干扰。长任务仅采集 Preview Host 可观察的条目，内存为浏览器尽力提供的堆快照，均不能精确归因到单个 Sandbox；不支持时显示不可用。":
    "Large data uses a visible window; other components use their original fixture. Running a benchmark clears the Playground preview to avoid background interference. Long tasks cover entries observable by Preview Host; memory is a best-effort browser heap snapshot. Neither can be attributed precisely to an individual Sandbox. Unsupported metrics are unavailable.",
  测试模式: "Run mode",
  数据规模: "Data size",
  单元格: "cells",
  记录: "records",
  实例数: "Instances",
  实时预览: "Live preview",
  测试完成: "Completed",
  测试失败: "Failed",
  已停止: "Stopped",
  冷启动就绪: "Cold instance ready",
  首次内容显示: "First content render",
  更新提交中位数: "Update commit P50",
  更新提交长尾: "Update commit P95",
  被覆盖的更新: "Superseded updates",
  跳过的更新: "Skipped updates",
  实际发送频率: "Actual send frequency",
  "测量插件自身 React 提交及两次动画帧后的显示机会，不能代表屏幕像素已经呈现；冷启动为新实例，浏览器缓存保持自然状态。更新延迟含工作台与预览桥接，不含绘制。被覆盖、跳过及失败的更新不计入 P50/P95。":
    "Measures the plugin's own React commit and the display opportunity after two animation frames, not physical pixel presentation. Cold load uses a fresh instance with normal browser caching. Update latency includes Playground and preview messaging, excluding paint. Superseded, skipped and failed updates are excluded from P50/P95.",
  "大数据使用可视窗口；不适用负载规模的组件使用原始模板。运行测试会清理工作台原有预览，避免背景实例干扰。内存与操作往返采集尚不可用。":
    "Large data uses a visible window; components without a scalable data fixture use their original template. Running a benchmark clears the Playground preview to avoid background interference. Memory and Action timing are not yet available.",
  "当前消息无法映射回表单，请继续编辑 JSON 或恢复模板。":
    "These messages cannot be mapped to the form. Continue editing JSON or restore the template.",
  不支持的组件: "Unsupported component",
  "此组件尚未安装，其他组件可继续使用。":
    "This component is not installed. Other components remain available.",
  主导航: "Main navigation",
  运行模式: "Runtime mode",
  浅色: "Light",
  深色: "Dark",
  本地: "Local",
  消息进度: "{applied}/{total} messages",
  创建界面并载入初始数据: "Create surface and load initial data",
  更新路径: "Update {path}",
  构建: "Build",
  字节: "bytes",
  消息超过大小限制: "Messages exceed the 2 MB limit",
  消息数量超出范围: "Provide between 1 and 1,000 messages",
  消息必须是对象: "Each message must be a JSON object",
  JSON语法错误: "JSON syntax error at line {line}, column {column}",
  JSONL语法错误: "JSONL syntax error at line {line}, column {column}",
  定位到错误: "Go to line {line}, column {column}",
  初始确认: "Initial ACK",
  更新往返中位数: "Update RTT P50",
  更新往返长尾: "Update RTT P95",
  "测量主工作台到 Preview Host、官方 Core 再到确认回执的毫秒耗时；不包含插件就绪或浏览器绘制。本次内存与操作往返指标不可用。":
    "Measures milliseconds from the Playground to Preview Host, official Core and the ACK. Excludes plugin readiness and browser paint. Memory and Action RTT are unavailable in this run.",
  "外部会话由 Agent 提供组件与消息。":
    "The Agent supplies components and messages for this external session.",
  等待数据超时: "Data readiness timed out",
  "未提交任何操作；可以继续接收数据或重置。":
    "No action was submitted. Continue receiving data or reset.",
  应用运行配置: "Apply run configuration",
  "支持 componentPolicies 按 Surface ID / Component ID 设置独立策略。":
    "Use componentPolicies to configure policies by Surface ID / Component ID.",
  组件库: "Components",
  搜索组件: "Search components",
  收起组件库: "Collapse library",
  展开组件库: "Expand library",
  上传插件: "Upload plugin",
  基础展示: "Basic display",
  布局: "Layout",
  数据展示: "Data display",
  表单与交互: "Forms & interaction",
  已安装插件: "Installed plugins",
  文档: "Docs",
  插件: "Plugin",
  场景模板: "Scenario templates",
  完整数据展示: "Complete data",
  一次发送全部数据: "Send all data at once",
  渐进加载: "Progressive loading",
  "分批发送，逐步出现": "Send batches progressively",
  等待完整数据: "Wait for complete data",
  "Ready 后显示完整表单": "Show form when ready",
  持续更新: "Live updates",
  按间隔推送数值变化: "Push value changes at intervals",
  操作后返回更新: "Update after action",
  "用户操作 → Agent 返回更新": "User action → Agent update",
  表单: "Form",
  JSON: "JSON",
  运行配置: "Run configuration",
  消息步骤: "Message steps",
  完整消息序列: "Full message sequence",
  暂停: "Pause",
  继续: "Resume",
  播放: "Play",
  下一步: "Next step",
  重置: "Reset",
  间隔: "Interval",
  尚未发送: "Not sent",
  已应用: "Applied",
  "配置已修改，尚未渲染": "Draft changed, not rendered",
  组件配置: "Component configuration",
  渲染: "Render",
  渲染并播放: "Render & play",
  恢复示例: "Restore example",
  复制接入代码: "Copy integration code",
  当前草稿: "Current draft",
  当前预览: "Current preview",
  复制: "Copy",
  已复制: "Copied",
  关闭: "Close",
  取消: "Cancel",
  确认切换: "Switch mode",
  切换运行模式: "Switch runtime mode",
  "切换模式将销毁当前实例，并重放相同消息。":
    "Switching mode destroys the current instance and replays the same messages.",
  卡片: "Card",
  对话: "Chat",
  工作区: "Workspace",
  桌面: "Desktop",
  平板: "Tablet",
  手机: "Mobile",
  切换预览主题: "Toggle preview theme",
  切换界面明暗主题: "Toggle app theme",
  调试面板: "Inspector",
  聚焦预览: "Focus preview",
  退出聚焦: "Exit focus",
  尚未渲染: "Not rendered",
  "填写左侧配置，然后点击「渲染」。":
    "Edit the configuration, then select Render.",
  等待预览连接: "Waiting for preview connection",
  就绪: "Ready",
  运行中: "Running",
  已暂停: "Paused",
  已完成: "Complete",
  运行失败: "Run failed",
  "外部 Agent": "External Agent",
  "Mock Agent": "Mock Agent",
  预览面板: "Preview",
  模板配置: "Configuration",
  组件模板: "Component templates",
  自定义响应: "Custom response",
  "导入 JSON / JSONL": "Import JSON / JSONL",
  "粘贴 Agent 响应，支持单条消息、数组或 JSONL。":
    "Paste an Agent response: a single message, array or JSONL.",
  格式化: "Format",
  校验: "Validate",
  校验通过: "Validation passed",
  校验失败: "Validation failed",
  恢复模板: "Restore template",
  消息: "Messages",
  组件树: "Tree",
  数据: "Data",
  操作: "Actions",
  日志: "Logs",
  指标: "Metrics",
  导出: "Export",
  无记录: "No records",
  "所有 Surface": "All surfaces",
  添加: "Add",
  删除: "Delete",
  行数据: "Rows",
  平台运行配置: "Platform run configuration",
  处理方式: "Action handler",
  响应延迟: "Response delay",
  处理结果: "Mock result",
  成功: "Success",
  拒绝: "Reject",
  错误: "Error",
  渲染策略: "Render policy",
  就绪条件: "Ready condition",
  "仅平台配置，不属于 A2UI 消息。":
    "Platform configuration only; not an A2UI message.",
  文本: "Text",
  样式: "Style",
  标题: "Title",
  正文: "Body",
  显示来源说明: "Show source note",
  指标名: "Metric name",
  数值: "Value",
  变化: "Change",
  趋势: "Trend",
  上升: "Up",
  下降: "Down",
  持平: "Flat",
  子组件数: "Children",
  "间距 (px)": "Gap (px)",
  对齐: "Alignment",
  单位: "Unit",
  图表类型: "Chart type",
  标签: "Label",
  占位文字: "Placeholder",
  必填: "Required",
  默认勾选: "Checked by default",
  "选项（逗号分隔）": "Options (comma-separated)",
  允许多选: "Allow multiple selections",
  按钮文字: "Button text",
  "Action 名称": "Action name",
  数据时间: "As of",
  显示风险等级图例: "Show risk legend",
  报销单号: "Report ID",
  员工: "Employee",
  部门: "Department",
  费用类别: "Expense category",
  金额: "Amount",
  币种: "Currency",
  备注: "Notes",
  驳回或退回时必须填写意见: "Require a comment when rejecting or returning",
  区域与风险值: "Regions and risk values",
  费用明细: "Expense details",
  区域组: "Group",
  区域: "Region",
  信用: "Credit",
  市场: "Market",
  流动性: "Liquidity",
  操作风险: "Operational",
  日期: "Date",
  说明: "Description",
  名称: "Name",
  负责人: "Owner",
  状态: "Status",
  分类: "Category",
  "单段文本，支持标题、正文与说明样式。":
    "A text block with body and caption styles.",
  "带标题与正文的内容容器。": "A content container with a title and body.",
  "单个指标及其变化方向。": "A single metric and its trend.",
  "水平排列子组件。": "Arrange child components horizontally.",
  "垂直排列子组件。": "Arrange child components vertically.",
  "可排序的数据表格。": "A sortable data table.",
  "条形图、折线图与饼图，比较分类数据。":
    "Compare categories using bar, line and pie charts.",
  "单行文本输入，绑定官方 DataModel。":
    "A text field bound to the official DataModel.",
  "单个勾选项。": "A single checkbox.",
  "单选或多选列表。": "A single- or multiple-choice list.",
  "触发一个 Action 的按钮。": "A button that dispatches an Action.",
  插件管理: "Plugin management",
  "上传、构建与管理自定义组件。": "Upload, build and manage custom components.",
  上传新插件: "Upload new plugin",
  加载示例插件: "Install demo plugins",
  卸载: "Uninstall",
  "在 Playground 打开": "Open in Playground",
  构建记录: "Build history",
  构建中: "Building",
  构建失败: "Build failed",
  构建成功: "Build succeeded",
  "选择 TSX 或 ZIP": "Choose TSX or ZIP",
  "拖放文件到此处，或点击选择": "Drop a file here, or click to browse",
  "最大 5 MB · 仅白名单依赖 · Docker 隔离构建":
    "Up to 5 MB · Allowlisted dependencies · Docker isolated build",
  开始构建: "Build plugin",
  "组件 Schema": "Component schema",
  源码: "Source",
  版本: "Version",
  能力: "Capabilities",
  没有已安装插件: "No plugins installed",
  选择一个插件查看详情: "Select a plugin to view details",
  插件已安装: "Plugin installed",
  插件已卸载: "Plugin uninstalled",
  上传失败: "Upload failed",
  "TSX 元数据": "TSX metadata",
  "卸载插件？": "Uninstall plugin?",
  "这会结束当前插件实例；可随时重新上传。":
    "This ends the plugin instance. You can upload it again anytime.",
  快速开始: "Quickstart",
  组件参考: "Component reference",
  "API 参考": "API reference",
  插件开发: "Plugin development",
  版本兼容: "Compatibility",
  发现组件: "Discover components",
  创建预览会话: "Create preview session",
  等待连接后提交消息: "Submit messages after preview connects",
  "接收 Action 并返回更新": "Receive an Action and send an update",
  选择组件: "Select component",
  参数: "Parameters",
  默认值: "Default value",
  约束: "Constraints",
  代码示例: "Code example",
  选择语言: "Select language",
  性能基准: "Benchmarks",
  "在两种运行模式下测量真实预览性能。":
    "Measure real preview performance in both runtime modes.",
  测试配置: "Configuration",
  测试组件: "Component",
  "更新频率 (Hz)": "Update frequency (Hz)",
  "持续时间 (s)": "Duration (s)",
  顺序对比: "Compare both",
  同时比较两种模式: "Compare both modes",
  依次运行两种模式: "Run both modes sequentially",
  开始测试: "Run benchmark",
  停止: "Stop",
  测试结果: "Results",
  暂无测试结果: "No benchmark results",
  "导出 JSON": "Export JSON",
  测量范围: "Measurement scope",
  不可用: "Unavailable",
  样本数: "Samples",
  首次绘制: "First paint",
  数据更新: "Data update",
  内存: "Memory",
  操作往返: "Action round trip",
  连接失败: "Connection failed",
  组件渲染失败: "Component render failed",
  "数据已接收；等待 ready 条件与组件 Schema 校验通过。":
    "Data received; waiting for the ready condition and valid component data.",
  数据校验失败: "Invalid component data",
  没有匹配的组件: "No matching components",
  详细诊断: "Diagnostic details",
  数据为空: "No data",
  已连接: "Connected",
  未连接: "Disconnected",
  "按区域 × 风险类别展示风险值；点击单元格发出 drilldown Action 并展示明细。":
    "Risk exposure by region and category. Select a cell to request details.",
  "费用报销审批：等待数据 → 填写意见 → 提交 Mock 审批。":
    "Expense approval: wait for data, add a comment and submit a Mock decision.",
  低: "Low",
  中: "Medium",
  高: "High",
  极高: "Critical",
  "亚太 APAC": "Asia Pacific · APAC",
  "欧洲 EMEA": "Europe · EMEA",
  "美洲 AMER": "Americas · AMER",
  风险明细: "Risk details",
  "等待 Agent 返回明细": "Waiting for Agent details",
  费用报销审批: "Expense approval",
  待审批: "Pending approval",
  已批准: "Approved",
  已驳回: "Rejected",
  已退回: "Changes requested",
  审批意见: "Comment",
  请输入审批意见: "Enter a comment",
  批准: "Approve",
  驳回: "Reject",
  退回修改: "Request changes",
  提交中: "Submitting",
  请填写审批意见: "A comment is required",
  "审批失败，请重试": "Approval failed. Please retry.",
  审批结果: "Decision",
  等待数据: "Waiting for data",
  审批单已处理: "This report has been processed",
  合计: "Total",
  消息计数: "{count} 条消息",
  等待条件: "等待条件：{path}",
  当前运行: "当前运行：{id}",
} as const;
export type TranslationKey = keyof typeof english;
export const chinese: Record<TranslationKey, string> = {
  ...(Object.fromEntries(
    Object.keys(english).map((key) => [key, key]),
  ) as Record<TranslationKey, string>),
  消息计数: "{count} 条消息",
  等待条件: "等待条件：{path}",
  当前运行: "当前运行：{id}",
  消息进度: "{applied}/{total} 条消息",
  更新路径: "更新 {path}",
  JSON语法错误: "JSON 第 {line} 行、第 {column} 列语法错误",
  JSONL语法错误: "JSONL 第 {line} 行、第 {column} 列语法错误",
  定位到错误: "定位到第 {line} 行、第 {column} 列",
  消息超过大小限制: "消息超过 2 MB 限制",
  消息数量超出范围: "消息数必须为 1–1,000",
  消息必须是对象: "每条消息必须是 JSON 对象",
};
export const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  "zh-CN": chinese,
  "en-US": {
    ...english,
    消息计数: "{count} messages",
    等待条件: "Waiting for: {path}",
    当前运行: "Current run: {id}",
  },
};
export function translate(
  locale: Locale,
  key: TranslationKey,
  values: Record<string, string | number> = {},
) {
  const template =
    locale === "en-US" &&
    key === "消息计数" &&
    new Intl.PluralRules(locale).select(Number(values.count)) === "one"
      ? "{count} message"
      : dictionaries[locale][key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name] ?? `{${name}}`),
  );
}
export function label(locale: Locale, value: string) {
  return Object.hasOwn(english, value)
    ? translate(locale, value as TranslationKey)
    : value;
}
export function initialLocale(saved: string | null, language: string): Locale {
  return saved === "zh-CN" || saved === "en-US"
    ? saved
    : language.toLowerCase().startsWith("en")
      ? "en-US"
      : "zh-CN";
}
let locale: Locale = "zh-CN";
try {
  if (typeof window !== "undefined")
    locale = initialLocale(
      localStorage.getItem("agent-ui.locale"),
      navigator.language,
    );
} catch {
  /* Storage may be unavailable in opaque frames. */
}
const listeners = new Set<() => void>();
export function getLocale() {
  return locale;
}
export function setLocale(next: Locale, persist = true) {
  if (next !== locale) {
    locale = next;
    listeners.forEach((fn) => fn());
  }
  if (typeof document !== "undefined") document.documentElement.lang = next;
  try {
    if (persist) localStorage.setItem("agent-ui.locale", next);
  } catch {
    /* Session-only preference. */
  }
}
export function useLocale() {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getLocale,
    () => "zh-CN" as Locale,
  );
}
export function useTranslation() {
  const locale = useLocale();
  return {
    locale,
    t: (key: TranslationKey, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    l: (value: string) => label(locale, value),
  };
}
