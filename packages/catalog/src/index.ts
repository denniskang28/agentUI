import {
  createMessage,
  patchMessage,
  enterpriseId,
  type Message,
  type Policy,
} from "../../protocol/src/index";
import { enterpriseSchema } from "../../protocol/src/enterprise";
import { capabilityProfileSchema } from "../../protocol/src/capability";
import { insuranceCapabilityExample } from "./capability";
export type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea" | "toggle" | "select" | "color";
  options?: string[];
  wide?: boolean;
};
export interface ComponentEntry {
  key: string;
  name: string;
  component: string;
  category: string;
  icon: string;
  version: string;
  description: string;
  pluginId?: string;
  catalogId?: string;
  schema?: Record<string, unknown>;
  defaults: Record<string, unknown>;
  fields: Field[];
  templates: string[];
  bundleUrl?: string;
  actions?: string[];
  stylesheetUrl?: string;
}
const field = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  wide = false,
  options?: string[],
): Field => ({ key, label, type, wide, options });
export const builtins: ComponentEntry[] = [
  {
    key: "text",
    name: "Text",
    component: "Text",
    category: "基础展示",
    icon: "type",
    version: "0.15.0",
    description: "单段文本，支持标题、正文与说明样式。",
    defaults: {
      text: "本季度整体风险可控，亚太市场风险上升，建议关注新加坡敞口。",
      variant: "body",
    },
    fields: [
      field("text", "文本", "textarea", true),
      field("variant", "样式", "select", false, ["body", "caption"]),
    ],
    templates: ["full"],
  },
  {
    key: "card",
    name: "Card",
    component: "Card",
    category: "基础展示",
    icon: "square",
    version: "0.15.0",
    description: "带标题与正文的内容容器。",
    defaults: {
      title: "Q4 风险摘要",
      body: "7 个区域中 2 个处于高风险，主要来自市场风险。",
      footer: true,
    },
    fields: [
      field("title", "标题", "text", true),
      field("body", "正文", "textarea", true),
      field("footer", "显示来源说明", "toggle", true),
    ],
    templates: ["full"],
  },
  {
    key: "kpi",
    name: "KPI",
    component: "KPI",
    category: "基础展示",
    icon: "gauge",
    version: "1.0.0",
    description: "单个指标及其变化方向。",
    defaults: {
      label: "净风险敞口",
      value: "¥ 4.82 亿",
      delta: "+3.4%",
      trend: "上升",
    },
    fields: [
      field("label", "指标名"),
      field("value", "数值"),
      field("delta", "变化"),
      field("trend", "趋势", "select", false, ["上升", "下降", "持平"]),
    ],
    templates: ["full"],
    catalogId: enterpriseId,
    schema: enterpriseSchema("KPI"),
  },
  ...["Row", "Column"].map((name): ComponentEntry => ({
    key: name.toLowerCase(),
    name,
    component: name,
    category: "布局",
    icon: name === "Row" ? "cols" : "rows",
    version: "0.15.0",
    description: name === "Row" ? "水平排列子组件。" : "垂直排列子组件。",
    defaults: { count: 3, gap: name === "Row" ? 12 : 8, align: "start" },
    fields: [
      field("count", "子组件数", "number"),
      field("gap", "间距 (px)", "number"),
      field("align", "对齐", "select", false, ["start", "center", "end"]),
    ],
    templates: ["full"],
  })),
  {
    key: "datatable",
    name: "DataTable",
    component: "DataTable",
    category: "数据展示",
    icon: "table",
    version: "1.0.0",
    description: "可排序的数据表格。",
    catalogId: enterpriseId,
    schema: enterpriseSchema("DataTable"),
    defaults: {
      title: "待办事项",
      items: [
        { name: "复核新加坡敞口", owner: "Chen", status: "进行中" },
        { name: "更新对冲策略", owner: "Ito", status: "阻塞" },
        { name: "季度报告", owner: "Park", status: "已完成" },
      ],
    },
    fields: [field("title", "标题", "text", true)],
    templates: ["full"],
  },
  {
    key: "chart",
    name: "Chart",
    component: "Chart",
    category: "数据展示",
    icon: "chart",
    version: "1.0.0",
    description: "条形图、折线图与饼图，比较分类数据。",
    catalogId: enterpriseId,
    schema: enterpriseSchema("Chart"),
    defaults: {
      title: "各区域高风险项",
      unit: "项",
      chartType: "bar",
      items: [
        { label: "亚太", value: 6 },
        { label: "欧洲", value: 4 },
        { label: "美洲", value: 7 },
      ],
    },
    fields: [
      field("title", "标题"),
      field("unit", "单位"),
      field("chartType", "图表类型", "select", true, ["bar", "line", "pie"]),
    ],
    templates: ["full"],
  },
  {
    key: "textfield",
    name: "TextField",
    component: "TextField",
    category: "表单与交互",
    icon: "input",
    version: "0.15.0",
    description: "单行文本输入，绑定官方 DataModel。",
    defaults: {
      label: "联系人邮箱",
      placeholder: "name@example.com",
      required: true,
    },
    fields: [
      field("label", "标签"),
      field("placeholder", "占位文字"),
      field("required", "必填", "toggle", true),
    ],
    templates: ["full"],
  },
  {
    key: "checkbox",
    name: "Checkbox",
    component: "CheckBox",
    category: "表单与交互",
    icon: "checkbox",
    version: "0.15.0",
    description: "单个勾选项。",
    defaults: { label: "我已阅读风险提示", checked: false },
    fields: [
      field("label", "标签", "text", true),
      field("checked", "默认勾选", "toggle", true),
    ],
    templates: ["full"],
  },
  {
    key: "choice",
    name: "ChoicePicker",
    component: "ChoicePicker",
    category: "表单与交互",
    icon: "list",
    version: "0.15.0",
    description: "单选或多选列表。",
    defaults: { label: "报告频率", options: "每日, 每周, 每月", multi: false },
    fields: [
      field("label", "标签", "text", true),
      field("options", "选项（逗号分隔）", "text", true),
      field("multi", "允许多选", "toggle", true),
    ],
    templates: ["full"],
  },
  {
    key: "button",
    name: "Button",
    component: "Button",
    category: "表单与交互",
    icon: "pointer",
    version: "0.15.0",
    description: "触发一个 Action 的按钮。",
    defaults: {
      label: "生成报告",
      variant: "primary",
      action: "report.generate",
    },
    fields: [
      field("label", "按钮文字"),
      field("variant", "样式", "select", false, ["primary", "default"]),
      field("action", "Action 名称", "text", true),
    ],
    templates: ["full"],
  },
  {
    key: "capability-profile",
    name: "CapabilityProfile",
    component: "CapabilityProfile",
    category: "数据展示",
    icon: "gauge",
    version: "1.0.0",
    description: "可配置的能力雷达图，支持场景目标、维度明细与评价依据。",
    catalogId: enterpriseId,
    schema: enterpriseSchema("CapabilityProfile"),
    defaults: insuranceCapabilityExample,
    fields: [
      field("title", "标题"),
      field("subjectName", "评估对象"),
      field("subtitle", "对象说明", "text", true),
      field("currentColor", "当前能力颜色", "color"),
      field("targetColor", "目标线颜色", "color"),
      field("fillOpacity", "填充强度 (%)", "number", true),
      field("showDimensions", "显示能力维度明细", "toggle", true),
      field("showDetails", "显示底部评价说明", "toggle", true),
      field("sampleData", "标记为示例数据", "toggle", true),
    ],
    templates: ["full", "progressive", "on_complete", "streaming", "action"],
    actions: ["capability.dimensionSelect", "capability.scenarioChange"],
  },
];
export const templateMeta: Record<string, [string, string]> = {
  full: ["完整数据展示", "一次发送全部数据"],
  progressive: ["渐进加载", "分批发送，逐步出现"],
  on_complete: ["等待完整数据", "Ready 后显示完整表单"],
  streaming: ["持续更新", "按间隔推送数值变化"],
  action: ["操作后返回更新", "用户操作 → Agent 返回更新"],
};
export function instantiate(
  entry: ComponentEntry,
  values: Record<string, unknown> = entry.defaults,
  template = "full",
  surfaceId = "main",
): { messages: Message[]; renderPolicy: Policy } {
  const v = structuredClone(values);
  if (
    entry.component === "CapabilityProfile" &&
    entry.catalogId === enterpriseId
  )
    capabilityProfileSchema.parse(v);
  let components: Record<string, unknown>[] = [];
  if (entry.catalogId === enterpriseId || entry.pluginId)
    components = [
      { id: "root", component: entry.component, data: { "@path": "/view" } },
    ];
  else if (entry.key === "text")
    components = [
      {
        id: "root",
        component: "Text",
        text: { "@path": "/view/text" },
        variant: v.variant,
      },
    ];
  else if (entry.key === "card")
    components = [
      { id: "root", component: "Card", child: "content" },
      {
        id: "content",
        component: "Column",
        children: ["title", "body", ...(v.footer ? ["footer"] : [])],
      },
      { id: "title", component: "Text", text: { "@path": "/view/title" } },
      { id: "body", component: "Text", text: { "@path": "/view/body" } },
      {
        id: "footer",
        component: "Text",
        text: "来源：Agent 风险分析",
        variant: "caption",
      },
    ];
  else if (entry.key === "row" || entry.key === "column") {
    const count = Math.min(20, Math.max(1, Number(v.count) || 1));
    components = [
      {
        id: "root",
        component: entry.component,
        align: v.align,
        metadata: { extensions: { enterpriseLayout: { gap: Number(v.gap) } } },
        children: Array.from({ length: count }, (_, i) => `child${i}`),
      },
      ...Array.from({ length: count }, (_, i) => ({
        id: `child${i}`,
        component: "Text",
        text: `子组件 ${i + 1}`,
      })),
    ];
  } else if (entry.key === "button")
    components = [
      {
        id: "root",
        component: "Button",
        child: "label",
        variant: v.variant,
        action: { event: { name: v.action, context: {} } },
      },
      { id: "label", component: "Text", text: { "@path": "/view/label" } },
    ];
  else if (entry.key === "textfield")
    components = [
      {
        id: "root",
        component: "TextField",
        label: v.label,
        value: { "@path": "/input" },
        placeholder: v.placeholder,
      },
    ];
  else if (entry.key === "checkbox")
    components = [
      {
        id: "root",
        component: "CheckBox",
        label: v.label,
        value: { "@path": "/checked" },
      },
    ];
  else if (entry.key === "choice")
    components = [
      {
        id: "root",
        component: "ChoicePicker",
        label: v.label,
        options: String(v.options)
          .split(/[,，]/)
          .map((s) => ({ label: s.trim(), value: s.trim() })),
        value: { "@path": "/choices" },
        variant: v.multi ? "multipleSelection" : "mutuallyExclusive",
      },
    ];
  const catalogId = entry.catalogId;
  const initial = {
    view: v,
    ready: true,
    input: "",
    checked: v.checked ?? false,
    choices: [],
  };
  if (template === "on_complete")
    return {
      messages: [
        createMessage(
          surfaceId,
          components,
          { ...initial, view: {}, ready: false },
          catalogId,
        ),
        patchMessage(surfaceId, v, "/view"),
        patchMessage(surfaceId, true, "/ready"),
      ],
      renderPolicy: "on_complete",
    };
  if (template === "progressive" || template === "streaming") {
    if (entry.component === "CapabilityProfile") {
      const profile = capabilityProfileSchema.parse(v);
      const ids = profile.dimensions.map((d) => d.id);
      const firstScores = Object.fromEntries(
        ids.map((id, i) => [id, i < 2 ? (profile.scores[id] ?? null) : null]),
      );
      const updatedScores = { ...profile.scores };
      const dimension = profile.dimensions[2];
      const score = updatedScores[dimension.id];
      if (typeof score === "number")
        updatedScores[dimension.id] = Math.min(
          dimension.max ?? 100,
          score + ((dimension.max ?? 100) - (dimension.min ?? 0)) * 0.05,
        );
      return {
        messages: [
          createMessage(
            surfaceId,
            components,
            { ...initial, view: { ...v, scores: firstScores } },
            catalogId,
          ),
          patchMessage(surfaceId, profile.scores, "/view/scores"),
          ...(template === "streaming"
            ? [patchMessage(surfaceId, updatedScores, "/view/scores")]
            : []),
        ],
        renderPolicy: template === "streaming" ? "live" : "progressive",
      };
    }
    const rows = Array.isArray(v.rows) ? v.rows : [];
    const first = {
      ...initial,
      view: { ...v, ...(rows.length ? { rows: rows.slice(0, 3) } : {}) },
    };
    const updated = structuredClone(v);
    if (Array.isArray(updated.rows))
      updated.rows = updated.rows.map((r, i) =>
        i === 1 ? { ...r, market: 86 } : r,
      );
    return {
      messages: [
        createMessage(surfaceId, components, first, catalogId),
        patchMessage(surfaceId, v, "/view"),
        patchMessage(surfaceId, updated, "/view"),
      ],
      renderPolicy: template === "streaming" ? "live" : "progressive",
    };
  }
  return {
    messages: [createMessage(surfaceId, components, initial, catalogId)],
    renderPolicy: "progressive",
  };
}

/** Only return to the form if its generator reproduces the entire message
 * sequence. Arbitrary trees, extra Surfaces and altered stream steps remain
 * hand-authored JSON instead of silently discarding data. */
export function recoverTemplateValues(
  entry: ComponentEntry,
  messages: Message[],
  template: string,
): Record<string, unknown> | null {
  try {
    const create = messages[0]?.createSurface as
      { surfaceId?: string; dataModel?: { view?: unknown } } | undefined;
    const values =
      entry.component === "CapabilityProfile" &&
      (template === "progressive" || template === "streaming")
        ? {
            ...(create?.dataModel?.view as Record<string, unknown>),
            scores: (
              messages[1]?.updateDataModel as { value?: unknown } | undefined
            )?.value,
          }
        : template === "full" || template === "action"
          ? create?.dataModel?.view
          : (messages[1]?.updateDataModel as { value?: unknown } | undefined)
              ?.value;
    if (
      !values ||
      typeof values !== "object" ||
      Array.isArray(values) ||
      !create?.surfaceId
    )
      return null;
    const canonical = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(canonical)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, inner]) => [key, canonical(inner)]),
            )
          : value;
    const generated = instantiate(
      entry,
      values as Record<string, unknown>,
      template,
      create.surfaceId,
    );
    return JSON.stringify(canonical(messages)) ===
      JSON.stringify(canonical(generated.messages))
      ? (structuredClone(values) as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
