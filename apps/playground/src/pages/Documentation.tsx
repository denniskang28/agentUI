import { Markdown } from "../Markdown";
import quickstartZh from "../../../../docs/developer/quickstart.zh-CN.md?raw";
import quickstartEn from "../../../../docs/developer/quickstart.en-US.md?raw";
import apiZh from "../../../../docs/developer/api.zh-CN.md?raw";
import apiEn from "../../../../docs/developer/api.en-US.md?raw";
import pluginsZh from "../../../../docs/developer/plugins.zh-CN.md?raw";
import pluginsEn from "../../../../docs/developer/plugins.en-US.md?raw";
const guides: Record<string, Record<"zh-CN" | "en-US", string>> = {
  quickstart: { "zh-CN": quickstartZh, "en-US": quickstartEn },
  api: { "zh-CN": apiZh, "en-US": apiEn },
  plugins: { "zh-CN": pluginsZh, "en-US": pluginsEn },
};
import { useState } from "react";
import { useTranslation } from "../../../../packages/i18n/src/index";
import {
  instantiate,
  type ComponentEntry,
} from "../../../../packages/catalog/src/index";
const sections = [
  ["quickstart", "快速开始"],
  ["components", "组件参考"],
  ["api", "API 参考"],
  ["plugins", "插件开发"],
  ["compatibility", "版本兼容"],
];
export function Documentation({
  entries,
  selected,
}: {
  entries: ComponentEntry[];
  selected: string;
}) {
  const { t, l, locale } = useTranslation();
  const [section, setSection] = useState("quickstart"),
    [key, setKey] = useState(selected);
  const current = entries.find((e) => e.key === key) ?? entries[0];
  return (
    <main className="docs-layout">
      <nav className="docs-nav" aria-label={t("文档")}>
        <strong>API & DOCS</strong>
        {sections.map(([value, label]) => (
          <button
            aria-current={section === value ? "page" : undefined}
            key={value}
            onClick={() => setSection(value)}
          >
            {l(label)}
          </button>
        ))}
      </nav>
      <div className="docs-main">
        <article className="docs-article">
          <h1>{l(sections.find(([value]) => value === section)?.[1] ?? "")}</h1>
          {section === "components" ? (
            <>
              <label>
                {t("选择组件")}
                <select
                  className="input"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                >
                  {entries.map((e) => (
                    <option value={e.key} key={e.key}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <h2>{current.name}</h2>
              <p>{l(current.description)}</p>
              <code>
                {current.catalogId ??
                  "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"}{" "}
                · {current.component}
              </code>
              <h2>{t("默认值")}</h2>
              <pre>{JSON.stringify(current.defaults, null, 2)}</pre>
              {current.schema && (
                <>
                  <h2>{t("组件 Schema")}</h2>
                  <pre>{JSON.stringify(current.schema, null, 2)}</pre>
                </>
              )}
              <h2>A2UI JSON</h2>
              <pre>
                {JSON.stringify(instantiate(current).messages, null, 2)}
              </pre>
            </>
          ) : section === "compatibility" ? (
            <>
              <table>
                <thead>
                  <tr>
                    <th>{t("名称")}</th>
                    <th>{t("版本")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["A2UI wire", "1.0"],
                    ["@a2ui/web_core", "0.15.0"],
                    ["@a2ui/react", "0.15.0"],
                    ["Platform REST API", "/api/v1"],
                    ["Enterprise Plugin SDK", "1.0"],
                    ["React", "19.3.1"],
                  ].map(([name, value]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>Core v1_0 MessageProcessor + React A2uiSurface.</p>
            </>
          ) : (
            <Markdown text={guides[section][locale]} />
          )}
        </article>
      </div>
    </main>
  );
}
