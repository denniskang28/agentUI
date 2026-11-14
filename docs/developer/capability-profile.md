# CapabilityProfile 能力画像 / Capability profile

内置企业组件，组件发现 key 为 `capability-profile`，类型为 `CapabilityProfile`，版本 `1.0.0`，Catalog 为 `urn:enterprise:agent-ui:catalog:1`。在 Playground 的「数据展示」选择 CapabilityProfile 即可渲染。默认数据为虚构保险代理人的六维培养示例；分数、目标与评分标准不是行业认证或真实人员评价。

Built-in enterprise component: discovery key `capability-profile`, type `CapabilityProfile`, component version `1.0.0`, enterprise Catalog `urn:enterprise:agent-ui:catalog:1`. Select it under Data display in Playground. The default six-dimension insurance example is fictional, with illustrative scores and targets.

## 配置 / Configuration

| 字段 / Field | 语义 / Meaning |
| --- | --- |
| `title`, `subjectId`, `subjectName`, `subtitle` | 标题、稳定对象 ID、显示名称和说明 / Title, stable subject ID, name and optional subtitle |
| `dimensions` | 3–8 个维度；稳定 `id`、`label`，可选 `min`/`max`（默认 0/100）、`description`、`evidence` / 3–8 dimensions with stable IDs, labels, optional bounds, description and evidence |
| `scores` | 按维度 ID 对应的原始评分；省略或 null 表示未评估 / Raw scores keyed by dimension ID; missing/null means not assessed |
| `scenarios` | 1–12 个场景；每个有 `id`、`label`、按维度 ID 对应的 `targets` / 1–12 scenarios with stable IDs, labels and per-dimension targets |
| `scenarioId`, `selectedDimensionId` | 初始/当前场景与所选维度；省略时选择第一项 / Initial/current selection; defaults to the first item |
| `currentColor`, `targetColor` | 可选 `#RRGGBB`；省略时跟随宿主主题 / Optional hex colors; omitted values follow the Host theme |
| `fillOpacity` | 填充强度 0–40，默认 12；0 表示仅轮廓 / Fill intensity 0–40, default 12; zero means outline only |
| `showDimensions` | 默认 true；false 隐藏右侧明细并居中雷达图 / Default true; false hides the breakdown and centers the chart |
| `showDetails` | 默认 true；底部评价说明可独立隐藏 / Default true; independently controls assessment details |
| `sampleData`, `modelVersion` | 示例标识与评分模型版本；不计算总分 / Sample-data flag and rubric version; no aggregate score is calculated |

颜色、标题、对象名称、显示开关在模板表单配置。维度、评分、场景目标在 JSON 编辑器配置；不使用简单行编辑器编辑嵌套对象。修改后点击「渲染」。删除颜色字段可恢复跟随主题。

Configure colors, title, subject and visibility in the template form. Use the JSON editor for dimensions, scores and nested scenario targets; then Render. Remove custom color fields to restore theme defaults. Business labels/evidence remain verbatim when the interface language changes.

不同评分范围按各维度 min/max 归一化到雷达图 0–100 刻度，明细保留原始分数。所有维度均为「越高越好」；不同场景的评分比较应使用同一评分模型。缺失分数不补零：保留已有点和明细，完整后显示闭合轮廓；目标不完整时不绘制目标轮廓。重复/未知 ID、超范围分数、无效范围与非 hex 颜色会被拒绝。结构 JSON Schema 可发现；跨字段 ID/范围约束由 Runtime 和模板适配器的同一 Zod schema 校验，原始消息校验不等同于业务数据校验。

Each dimension is normalized using its bounds for plotting, while details retain original scores. All dimensions use “higher is better.” Compare only compatible rubric versions. Missing scores are never zero-filled: the outline waits for complete scores, and the target outline waits for complete targets. Duplicate/unknown IDs, out-of-range scores, invalid ranges and unsafe colors fail validation. Discoverable JSON Schema covers structure; shared Runtime/template Zod validation additionally enforces cross-field constraints. Raw wire validation does not assert business-data validity.

## Library 接入 / Library integration

下面使用随 Library 一起提供的默认值；替换 `dimensions`、`scores`、`scenarios` 即可适配其他场景。实际业务使用 `sampleData: false`，提供自己的评价依据。

Use the bundled defaults, replacing dimensions, scores and scenarios for your domain. Set `sampleData: false` and provide actual evidence for real assessments.

```ts
import { AgentUiAdapter, builtins, EMBED_PROTOCOL } from "@enterprise/agent-ui/server";
import { capabilityProfileSchema, type CapabilityProfileData } from "@enterprise/agent-ui/protocol";

const entry = builtins.find((item) => item.key === "capability-profile")!;
const data: CapabilityProfileData = capabilityProfileSchema.parse({
  ...entry.defaults,
  currentColor: "#4169ad",
  targetColor: "#7b848c",
  fillOpacity: 18,
  showDimensions: false,
  showDetails: true,
});
const adapter = new AgentUiAdapter("capability-run");
const initial = adapter.apply({
  protocol: EMBED_PROTOCOL,
  runId: "capability-run",
  batchId: "profile-1",
  firstSequence: 1,
  inputs: [{
    type: "template.create",
    id: "profile",
    template: entry.key,
    templateVersion: entry.version,
    data,
  }],
});
const update = adapter.apply({
  protocol: EMBED_PROTOCOL,
  runId: "capability-run",
  batchId: "profile-2",
  firstSequence: 2,
  inputs: [{ type: "a2ui", messages: [{
    version: "1.0",
    updateDataModel: { surfaceId: "profile", path: "/view/scores/planning", value: 80 },
  }] }],
});
// Send initial and update through the existing connected AgentUiClient/Host.
console.log(initial.messages.length, update.messages.length);
adapter.dispose();
```

`template.patch` 遵循 Library 的顶层浅更新语义；替换 `scores` 时需要发送希望保留的全部评分。更新单个分数用原始 `updateDataModel` JSON Pointer。切换场景和选择维度使用官方 Core 的绑定路径；颜色、语言和评分更新不重建组件。字面量 data 仅保留本地展示选择。

`template.patch` shallowly replaces top-level fields. Supply the full retained map when patching `scores`; use raw `updateDataModel` for one score. Bound selections are written into official Core; color, language and score patches preserve the instance. Literal unbound data uses local presentation selection.

## Actions 与模板 / Actions and templates

- `capability.scenarioChange`：context 含 `subjectId`, `scenarioId`。/ Context includes subject and selected scenario IDs.
- `capability.dimensionSelect`：context 含 `subjectId`, `scenarioId`, `dimensionId`。/ Context additionally includes the selected dimension ID.

Action 使用现有完整官方信封，携带 Surface、来源组件和时间信息；不是新增 Wire 命令，也不执行保险业务。隐藏明细时，可在保留的底部说明区选择维度；两区都隐藏时仅展示图形。

Actions use the existing full official envelope with Surface, source component and timestamp. They are not new wire commands or business execution. When the breakdown is hidden, the optional detail region provides a dimension picker; hide both for a chart-only view.

发现 API：`GET /api/v1/components/capability-profile`。五种模板 ID 为 `capability-profile~full`、`~progressive`、`~on_complete`、`~streaming`、`~action`。渐进模板从两个已知分数开始，随后补齐；持续更新模板再更新一个分数。on_complete 沿用平台 ready 门控，不把数据完整等同于 ready。

Discovery: `GET /api/v1/components/capability-profile`. Five template suffixes: `full`, `progressive`, `on_complete`, `streaming`, `action`. Progressive starts with two assessed dimensions and then fills the remaining scores; streaming additionally updates a score. Deferred rendering uses the platform’s independent ready condition.

内置可信组件在独立 Host 中由官方 Core/React Renderer 调度，两种 runtimeMode 均可展示；只有上传插件进入额外的 Sandbox iframe。消费新组件需同时更新 Library 包和 embedded Host 静态产物，旧 Host 不具备新实现。本轮是本地交付，无公网部署。

This trusted built-in renders through official Core/React in the separate Host in either runtimeMode. Only uploaded plugins enter the additional Sandbox iframe. Update both the library package and embedded Host assets; older Hosts do not contain the new renderer. This addition is delivered locally.
