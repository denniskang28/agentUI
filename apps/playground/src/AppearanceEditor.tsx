import {
  appearanceCapabilities,
  componentAppearanceSchema,
  themeTokensSchema,
  type ComponentAppearance,
  type AppearanceProperty,
  type ThemeTokens,
} from "../../../packages/protocol/src/appearance";
import { useTranslation } from "../../../packages/i18n/src/index";

const labels: Record<string, string> = {
  fontFamily: "字体",
  typography: "文字层级",
  fontSize: "字号",
  fontWeight: "字重",
  lineHeight: "行高",
  color: "文字颜色",
  backgroundColor: "背景颜色",
  borderColor: "边框颜色",
  borderWidth: "边框宽度",
  borderRadius: "圆角",
  padding: "内边距",
  gap: "间距",
  textAlign: "文字对齐",
  brand: "品牌色",
  text: "正文色",
  muted: "次要文字色",
  background: "背景色",
  surface: "容器色",
  border: "边框色",
  success: "成功色",
  warning: "警告色",
  danger: "危险色",
  density: "间距密度",
};
const choices: Record<string, string[]> = {
  fontFamily: ["system", "sans", "serif", "mono"],
  typography: ["title", "body", "caption"],
  fontWeight: ["400", "500", "600", "700"],
  textAlign: ["start", "center", "end"],
  density: ["compact", "comfortable"],
};
const ranges: Record<string, [number, number, number]> = {
  fontSize: [10, 72, 1],
  fontWeight: [400, 700, 100],
  lineHeight: [1, 3, 0.1],
  borderWidth: [0, 8, 1],
  borderRadius: [0, 48, 1],
  padding: [0, 64, 1],
  gap: [0, 64, 1],
};
function Controls({
  value,
  keys,
  onChange,
  theme = false,
}: {
  value: Record<string, unknown>;
  keys: string[];
  onChange: (next: Record<string, unknown>) => void;
  theme?: boolean;
}) {
  const { t, l } = useTranslation();
  const update = (key: string, next: unknown) => {
    const result = { ...value };
    if (next === "" || next === undefined) delete result[key];
    else result[key] = key === "fontWeight" ? Number(next) : next;
    const parsed = (
      theme ? themeTokensSchema : componentAppearanceSchema
    ).safeParse(result);
    if (parsed.success) onChange(parsed.data);
  };
  return (
    <div className="appearance-fields">
      {keys.map((key) => {
        const options = choices[key];
        const range = ranges[key];
        return (
          <div className="appearance-field" key={key}>
            <label htmlFor={`appearance-${theme ? "theme" : "node"}-${key}`}>
              {l(labels[key] ?? key)}
            </label>
            <div>
              {options ? (
                <select
                  id={`appearance-${theme ? "theme" : "node"}-${key}`}
                  className="input"
                  value={String(value[key] ?? "")}
                  onChange={(event) => update(key, event.target.value)}
                >
                  <option value="">{t("继承主题")}</option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {l(option)}
                    </option>
                  ))}
                </select>
              ) : range ? (
                <input
                  id={`appearance-${theme ? "theme" : "node"}-${key}`}
                  className="input"
                  type="number"
                  min={range[0]}
                  max={
                    theme && key === "fontSize"
                      ? 24
                      : theme && key === "borderRadius"
                        ? 32
                        : range[1]
                  }
                  step={range[2]}
                  placeholder={t("继承主题")}
                  value={(value[key] as number) ?? ""}
                  onChange={(event) =>
                    update(
                      key,
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                    )
                  }
                />
              ) : (
                <>
                  {String(value[key] ?? "").startsWith("#") && (
                    <input
                      id={`appearance-${theme ? "theme" : "node"}-${key}-picker`}
                      type="color"
                      aria-label={`${l(labels[key] ?? key)} ${l("custom")}`}
                      value={String(value[key])}
                      onChange={(event) => update(key, event.target.value)}
                    />
                  )}
                  <select
                    id={`appearance-${theme ? "theme" : "node"}-${key}`}
                    className="input"
                    aria-label={
                      theme
                        ? l(labels[key])
                        : `${l(labels[key])} ${t("语义颜色")}`
                    }
                    value={
                      String(value[key] ?? "").startsWith("#")
                        ? "custom"
                        : String(value[key] ?? "")
                    }
                    onChange={(event) =>
                      update(
                        key,
                        event.target.value === "custom"
                          ? "#148a7d"
                          : event.target.value,
                      )
                    }
                  >
                    <option value="">{t("继承主题")}</option>
                    {(theme
                      ? ["custom"]
                      : [
                          "text",
                          "muted",
                          "brand",
                          "success",
                          "warning",
                          "danger",
                          "background",
                          "surface",
                          "border",
                          "custom",
                        ]
                    ).map((option) => (
                      <option key={option} value={option}>
                        {l(option)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button
                className="btn btn-ghost"
                aria-label={`${t("恢复继承")} ${l(labels[key] ?? key)}`}
                disabled={value[key] === undefined}
                onClick={() => update(key, undefined)}
              >
                ↶
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
export function AppearanceEditor({
  component,
  plugin,
  capabilities: declaredCapabilities,
  value,
  onChange,
}: {
  component: string;
  plugin?: boolean;
  capabilities?: AppearanceProperty[];
  value: ComponentAppearance;
  onChange: (value: ComponentAppearance) => void;
}) {
  const { t, l } = useTranslation();
  const capabilities =
    declaredCapabilities ?? appearanceCapabilities(component, plugin);
  return (
    <div className="field-section appearance-editor">
      <p className="muted">
        {t(
          plugin
            ? "插件仅支持外部容器样式；内部样式由插件声明。"
            : "未设置的外观继承预览主题。",
        )}
      </p>
      {[
        [
          "文字",
          [
            "fontFamily",
            "typography",
            "fontSize",
            "fontWeight",
            "lineHeight",
            "textAlign",
          ],
        ],
        ["颜色", ["color", "backgroundColor", "borderColor"]],
        ["容器", ["borderWidth", "borderRadius", "padding"]],
        ["布局", ["gap"]],
      ].map(([title, keys]) => {
        const fields = (keys as string[]).filter((key) =>
          capabilities.includes(key as AppearanceProperty),
        );
        return (
          fields.length > 0 && (
            <section key={String(title)}>
              <h3>{l(String(title))}</h3>
              <Controls value={value} keys={fields} onChange={onChange} />
            </section>
          )
        );
      })}
      <button className="btn btn-secondary" onClick={() => onChange({})}>
        {t("重置组件外观")}
      </button>
    </div>
  );
}
export function ThemeEditor({
  value,
  onChange,
}: {
  value: ThemeTokens;
  onChange: (value: ThemeTokens) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="field-section appearance-editor">
      <Controls
        theme
        value={value}
        keys={Object.keys(themeTokensSchema.shape)}
        onChange={onChange}
      />
      <button className="btn btn-secondary" onClick={() => onChange({})}>
        {t("恢复默认主题")}
      </button>
    </div>
  );
}
