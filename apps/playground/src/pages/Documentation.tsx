import {
  apiBase,
  previewOrigin,
} from "../../../../packages/protocol/src/browser-deployment";
import { Markdown } from "../Markdown";
import quickstartZh from "../../../../docs/developer/quickstart.zh-CN.md?raw";
import quickstartEn from "../../../../docs/developer/quickstart.en-US.md?raw";
import apiZh from "../../../../docs/developer/api.zh-CN.md?raw";
import apiEn from "../../../../docs/developer/api.en-US.md?raw";
import pluginsZh from "../../../../docs/developer/plugins.zh-CN.md?raw";
import pluginsEn from "../../../../docs/developer/plugins.en-US.md?raw";
import overviewZh from "../../../../docs/developer/library-overview.zh-CN.md?raw";
import overviewEn from "../../../../docs/developer/library-overview.en-US.md?raw";
import integrationZh from "../../../../docs/developer/library-integration.zh-CN.md?raw";
import integrationEn from "../../../../docs/developer/library-integration.en-US.md?raw";
import inputsZh from "../../../../docs/developer/library-inputs.zh-CN.md?raw";
import inputsEn from "../../../../docs/developer/library-inputs.en-US.md?raw";
import eventsZh from "../../../../docs/developer/library-events.zh-CN.md?raw";
import eventsEn from "../../../../docs/developer/library-events.en-US.md?raw";
import migrationZh from "../../../../docs/developer/library-demo-migration.zh-CN.md?raw";
import migrationEn from "../../../../docs/developer/library-demo-migration.en-US.md?raw";
import deploymentZh from "../../../../docs/developer/library-deployment.zh-CN.md?raw";
import deploymentEn from "../../../../docs/developer/library-deployment.en-US.md?raw";
const guides: Record<string, Record<"zh-CN" | "en-US", string>> = {
  quickstart: { "zh-CN": quickstartZh, "en-US": quickstartEn },
  api: { "zh-CN": apiZh, "en-US": apiEn },
  plugins: { "zh-CN": pluginsZh, "en-US": pluginsEn },
  "library-overview": { "zh-CN": overviewZh, "en-US": overviewEn },
  "library-integration": { "zh-CN": integrationZh, "en-US": integrationEn },
  "library-inputs": { "zh-CN": inputsZh, "en-US": inputsEn },
  "library-events": { "zh-CN": eventsZh, "en-US": eventsEn },
  "library-demo-migration": { "zh-CN": migrationZh, "en-US": migrationEn },
  "library-deployment": { "zh-CN": deploymentZh, "en-US": deploymentEn },
};
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../../packages/i18n/src/index";
import {
  instantiate,
  type ComponentEntry,
} from "../../../../packages/catalog/src/index";
const sections = [
  ["library-overview", "Library 架构与选型"],
  ["library-integration", "从安装到首屏"],
  ["library-inputs", "便捷模板与完整 A2UI"],
  ["library-events", "Action 与运行生命周期"],
  ["library-demo-migration", "现有 Chatbot 的改造对照"],
  ["library-deployment", "打包、部署与运维"],
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
  const [section, setSection] = useState("library-overview"),
    [key, setKey] = useState(selected);
  const current = entries.find((e) => e.key === key) ?? entries[0];
  const reader = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reader.current) reader.current.scrollTop = 0;
  }, [section]);
  return (
    <main className="docs-layout">
      <nav className="docs-nav" aria-label={t("文档")}>
        <strong>API & DOCS</strong>
        {sections.map(([value, label], index) => (
          <div className="docs-nav-item" key={value}>
            {(index === 0 || index === 6) && (
              <strong>
                {index === 0 ? l("Library 接入指南") : l("Playground 开发参考")}
              </strong>
            )}
            <button
              aria-current={section === value ? "page" : undefined}
              onClick={() => setSection(value)}
            >
              {l(label)}
            </button>
          </div>
        ))}
      </nav>
      <div className="docs-main" ref={reader}>
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
                    ["Platform REST API", apiBase],
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
            <Markdown
              onNavigate={(href) => {
                const target = href.replace(/\.(zh-CN|en-US)\.md$/, "");
                if (guides[target]) setSection(target);
              }}
              text={
                section.startsWith("library-")
                  ? guides[section][locale]
                  : guides[section][locale]
                      .replaceAll(
                        "http://localhost:5173/api/v1",
                        `${location.origin}${apiBase}`,
                      )
                      .replaceAll(
                        "http://localhost:5173",
                        new URL(
                          import.meta.env.BASE_URL,
                          location.origin,
                        ).href.replace(/\/$/, ""),
                      )
                      .replaceAll("http://127.0.0.1:4173", previewOrigin)
              }
            />
          )}
        </article>
      </div>
    </main>
  );
}
