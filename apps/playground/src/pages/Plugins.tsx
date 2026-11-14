import { apiBase } from "../../../../packages/protocol/src/browser-deployment";
import { useEffect, useRef, useState } from "react";
import {
  templateMeta,
  type ComponentEntry,
} from "../../../../packages/catalog/src/index";
import { defaultRun } from "../../../../packages/protocol/src/index";
import {
  useTranslation,
  type TranslationKey,
} from "../../../../packages/i18n/src/index";
import { api } from "../api";
import { Icon } from "../icons";
interface PluginRecord {
  id: string;
  buildId: string;
  bytes: number;
  createdAt: string;
  status: string;
  entry: ComponentEntry;
  manifest: {
    displayName: string;
    version: string;
    componentType: string;
    capabilities: string[];
    actions: string[];
    entry: string;
  };
  schema: {
    properties?: Record<
      string,
      {
        type?: string | string[];
        enum?: unknown[];
        description?: string;
        items?: { type?: string };
      }
    >;
    required?: string[];
  };
}
interface BuildRecord {
  id: string;
  filename: string;
  status: string;
  error?: string;
  createdAt: string;
}
export function Plugins({
  reload,
  notify,
  open,
  onUninstall,
}: {
  reload: () => Promise<void>;
  notify: (text: TranslationKey) => void;
  open: (key: string) => void;
  onUninstall: (id: string) => void;
}) {
  const { t, l, locale } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("schema");
  const [plugins, setPlugins] = useState<PluginRecord[]>([]),
    [builds, setBuilds] = useState<BuildRecord[]>([]),
    [selected, setSelected] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [metadata, setMetadata] = useState(""),
    [uninstall, setUninstall] = useState<string | null>(null);
  const refresh = async () => {
    const result = await api("/plugins");
    setPlugins(
      [...result.plugins].sort((a, b) =>
        a.manifest.displayName.localeCompare(b.manifest.displayName, locale),
      ),
    );
    setBuilds(result.builds);
  };
  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
  }, []);
  const upload = async (uploaded: File) => {
    const form = new FormData();
    if (uploaded.name.endsWith(".tsx")) form.append("metadata", metadata);
    form.append("file", uploaded);
    const response = await fetch(`${apiBase}/plugins`, {
      method: "POST",
      body: form,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`${result.code}: ${result.message}`);
    await reload();
    await refresh();
    setSelected(result.id);
    setFile(null);
    notify("插件已安装");
  };
  const installFile = async (uploaded: File) => {
    setBusy(true);
    setError("");
    try {
      await upload(uploaded);
    } catch (error) {
      setError(String(error));
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const demo = async () => {
    setBusy(true);
    setError("");
    try {
      for (const name of ["finance-risk-heatmap.zip", "expense-approval.zip"]) {
        const response = await fetch(`${apiBase}/demo-files/${name}`);
        if (!response.ok) throw new Error("DEMO_NOT_AVAILABLE");
        await upload(
          new File([await response.blob()], name, { type: "application/zip" }),
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const current = plugins.find((p) => p.id === selected) ?? plugins[0];
  return (
    <main className="secondary-page">
      <div className="page-inner">
        <div className="page-heading">
          <div>
            <h1>Plugins</h1>
            <p>{t("上传、构建与管理自定义组件。")}</p>
          </div>
          <span className="tag tag-outline">
            Docker · esbuild · Plugin SDK 1.0
          </span>
        </div>
        <div className="page-grid">
          <section className="panel" aria-label={t("上传插件")}>
            <h2>{t("上传插件")}</h2>
            <div
              className="upload-drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setFile(e.dataTransfer.files[0] ?? null);
              }}
            >
              <Icon name="upload" size={24} />
              <strong>{t("拖放文件到此处，或点击选择")}</strong>
              <p>{t("最大 5 MB · 仅白名单依赖 · Docker 隔离构建")}</p>
              <label className="btn btn-primary">
                {t("选择 TSX 或 ZIP")}
                <input
                  ref={fileInput}
                  hidden
                  type="file"
                  accept=".tsx,.zip"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <code>
                  {file.name} ·{" "}
                  {new Intl.NumberFormat(locale).format(file.size)} {t("字节")}
                </code>
              )}
            </div>
            {file?.name.endsWith(".tsx") && (
              <label>
                {t("TSX 元数据")}
                <textarea
                  className="input"
                  style={{
                    minHeight: 180,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  placeholder={'{"manifest": {...}, "catalog": {...}}'}
                />
              </label>
            )}
            <div className="plugin-actions">
              <button
                className="btn btn-secondary"
                onClick={() => void demo()}
                disabled={busy}
              >
                <Icon name="file" />
                {t("加载示例插件")}
              </button>
              {file && (
                <button
                  className="btn btn-primary"
                  onClick={() => void installFile(file)}
                  disabled={busy}
                >
                  {t(busy ? "构建中" : "开始构建")}
                </button>
              )}
            </div>
            <div className="upload-requirements">
              <div>
                <strong>{t("允许的依赖")}</strong>
                <code>
                  react@19.3.1 · react-dom@19.3.1 · zod@3.25.76 ·
                  @enterprise/agent-ui-plugin-sdk@1.0
                </code>
              </div>
              <div>
                <strong>{t("不允许")}</strong>
                <span>
                  {t("Node 内置模块、远程导入、自定义构建脚本与任意依赖安装")}
                </span>
              </div>
              <div>
                <strong>.tsx</strong>
                <span>
                  {t(
                    "默认导出 definePlugin，并提供 manifest 与 catalog 元数据",
                  )}
                </span>
              </div>
              <div>
                <strong>.zip</strong>
                <code>plugin.json · catalog.json · src/index.tsx</code>
              </div>
            </div>
            <p className="plugin-isolation-note">
              <Icon name="info" />
              <span>
                {t(
                  "Native 在独立 Preview Host 中运行；Sandbox 在其内进一步隔离。",
                )}
              </span>
            </p>
            {busy && (
              <div role="status" className="accent">
                {t("构建中")}…
              </div>
            )}
            {error && (
              <div role="alert" className="error">
                {t("上传失败")}
                <details open>
                  <summary>{t("详细诊断")}</summary>
                  {error}
                </details>
              </div>
            )}
            <details className="plugin-build-history">
              <summary>
                {t("构建记录")}
                {builds.length > 0 &&
                  ` · ${new Intl.NumberFormat(locale).format(builds.length)}`}
              </summary>
              {builds.length ? (
                builds.map((b) => (
                  <div className="plugin-row" key={b.id}>
                    <Icon name={b.status === "failed" ? "alert" : "check"} />
                    <div>
                      <b>{b.filename}</b>
                      <code>
                        {b.status === "failed"
                          ? t("构建失败")
                          : b.status === "ready"
                            ? t("构建成功")
                            : t("构建中")}
                      </code>
                      {b.error && (
                        <details>
                          <summary>{t("详细诊断")}</summary>
                          <pre>{b.error}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <span className="muted">{t("无记录")}</span>
              )}
            </details>
          </section>
          <section className="panel" aria-label={t("已安装插件")}>
            <h2>{t("已安装插件")}</h2>
            {plugins.length ? (
              <div className="plugin-table-scroll">
                <div
                  className="plugin-table"
                  role="table"
                  aria-label={t("已安装插件")}
                >
                  <div className="plugin-table-header" role="row">
                    {["插件", "版本", "状态", "默认运行", "更新"].map((key) => (
                      <span role="columnheader" key={key}>
                        {l(key)}
                      </span>
                    ))}
                  </div>
                  {plugins.map((plugin) => (
                    <div
                      role="row"
                      aria-selected={current?.id === plugin.id}
                      className="plugin-row plugin-table-row"
                      key={plugin.id}
                      onClick={() => {
                        setSelected(plugin.id);
                        setTab("schema");
                      }}
                    >
                      <span role="cell">
                        <button className="plugin-pick">
                          {plugin.manifest.displayName}
                        </button>
                        <code>{plugin.id}</code>
                      </span>
                      <code role="cell">{plugin.manifest.version}</code>
                      <span role="cell">
                        <span className="tag tag-neutral">{t("就绪")}</span>
                      </span>
                      <span role="cell">
                        {defaultRun.runtimeMode === "native"
                          ? "Native"
                          : "Sandbox"}
                      </span>
                      <time role="cell" dateTime={plugin.createdAt}>
                        {new Intl.DateTimeFormat(locale, {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }).format(new Date(plugin.createdAt))}
                      </time>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted">{t("没有已安装插件")}</p>
            )}
            {current && (
              <div className="plugin-detail">
                <div className="plugin-detail-title">
                  <strong>{current.manifest.displayName}</strong>
                  <span className="tag tag-neutral">
                    v{current.manifest.version}
                  </span>
                  <span className="tag tag-neutral">{t("就绪")}</span>
                </div>
                <dl className="plugin-metadata">
                  <div>
                    <dt>{t("插件 ID")}</dt>
                    <dd>{current.id}</dd>
                  </div>
                  <div>
                    <dt>{t("组件类型")}</dt>
                    <dd>{current.entry.component}</dd>
                  </div>
                  <div>
                    <dt>{t("文件")}</dt>
                    <dd>
                      plugin.js ·{" "}
                      {new Intl.NumberFormat(locale, {
                        maximumFractionDigits: 1,
                      }).format(current.bytes / 1024)}{" "}
                      KB
                    </dd>
                  </div>
                  <div>
                    <dt>{t("依赖")}</dt>
                    <dd>react@19.3.1 · Plugin SDK 1.0</dd>
                  </div>
                </dl>
                <div className="plugin-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => open(current.entry.key)}
                  >
                    <Icon name="ext" />
                    {t("在 Playground 打开")}
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      setMetadata(
                        JSON.stringify(
                          {
                            manifest: {
                              ...current.manifest,
                              entry: "src/index.tsx",
                            },
                            catalog: {
                              catalogId: current.entry.catalogId,
                              dataSchema: current.schema,
                              defaults: current.entry.defaults,
                              fields: current.entry.fields,
                              templates: current.entry.templates,
                              description: current.entry.description,
                              icon: current.entry.icon,
                              category: current.entry.category,
                            },
                          },
                          null,
                          2,
                        ),
                      );
                      fileInput.current?.click();
                    }}
                  >
                    <Icon name="upload" />
                    {t("替换上传")}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setTab("logs")}
                  >
                    {t("查看日志")}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setUninstall(current.id)}
                  >
                    <Icon name="trash" />
                    {t("卸载")}
                  </button>
                </div>
                <div
                  className="seg plugin-detail-tabs"
                  role="group"
                  aria-label={t("插件详情")}
                >
                  {[
                    ["schema", "Schema"],
                    ["actions", "Actions"],
                    ["templates", "模板"],
                    ["logs", "构建日志"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      aria-pressed={tab === key}
                      onClick={() => setTab(key)}
                    >
                      {l(label)}
                    </button>
                  ))}
                </div>
                {tab === "schema" && (
                  <>
                    <div className="plugin-schema-scroll">
                      <table className="plugin-schema">
                        <thead>
                          <tr>
                            <th>{t("字段")}</th>
                            <th>{t("类型")}</th>
                            <th>{t("说明")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(current.schema.properties ?? {}).map(
                            ([key, schema]) => (
                              <tr key={key}>
                                <td>
                                  <code>
                                    {key}
                                    {current.schema.required?.includes(key)
                                      ? " *"
                                      : ""}
                                  </code>
                                </td>
                                <td>
                                  <code>
                                    {schema.enum
                                      ? "enum"
                                      : schema.type === "array"
                                        ? `array<${schema.items?.type ?? "unknown"}>`
                                        : Array.isArray(schema.type)
                                          ? schema.type.join(" | ")
                                          : (schema.type ?? "unknown")}
                                  </code>
                                </td>
                                <td>
                                  {schema.description ??
                                    l(
                                      current.entry.fields.find(
                                        (field) => field.key === key,
                                      )?.label ?? key,
                                    )}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                    <details>
                      <summary>{t("查看完整Schema")}</summary>
                      <pre>{JSON.stringify(current.schema, null, 2)}</pre>
                    </details>
                  </>
                )}
                {tab === "actions" && (
                  <>
                    <code>{current.manifest.capabilities.join(" · ")}</code>
                    {current.manifest.actions.length ? (
                      current.manifest.actions.map((action) => (
                        <code className="plugin-detail-line" key={action}>
                          {action}
                        </code>
                      ))
                    ) : (
                      <p className="muted">{t("该插件未声明 Action。")}</p>
                    )}
                  </>
                )}
                {tab === "templates" &&
                  current.entry.templates.map((key) => (
                    <div className="plugin-detail-line" key={key}>
                      <strong>{l(templateMeta[key]?.[0] ?? key)}</strong>
                      <span> · {l(templateMeta[key]?.[1] ?? key)}</span>
                      <code>template={key}</code>
                    </div>
                  ))}
                {tab === "logs" && (
                  <>
                    <code>
                      {t("构建")} {current.buildId}
                    </code>
                    <time dateTime={current.createdAt}>
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(current.createdAt))}
                    </time>
                    <code>
                      {new Intl.NumberFormat(locale).format(current.bytes)}{" "}
                      {t("字节")} · {t("构建成功")}
                    </code>
                    {builds.find((build) => build.id === current.buildId)
                      ?.error && (
                      <pre>
                        {
                          builds.find((build) => build.id === current.buildId)
                            ?.error
                        }
                      </pre>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      {uninstall && (
        <div className="modal-backdrop">
          <section
            className="dialog confirm-dialog"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <h2>{t("卸载插件？")}</h2>
            </header>
            <p>{t("这会结束当前插件实例；可随时重新上传。")}</p>
            <footer>
              <button
                className="btn btn-secondary"
                onClick={() => setUninstall(null)}
              >
                {t("取消")}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  void api(`/plugins/${uninstall}`, undefined, "DELETE")
                    .then(async () => {
                      onUninstall(uninstall);
                      await reload();
                      await refresh();
                      setUninstall(null);
                      notify("插件已卸载");
                    })
                    .catch((e) => setError(String(e)));
                }}
              >
                {t("卸载")}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
