import {
  useEffect,
  useRef,
  useState,
  Component,
  type ReactNode,
  type ComponentType,
} from "react";
import {
  createComponentImplementation,
  type ReactA2uiComponentProps,
  type ReactCatalogComponent,
} from "@a2ui/react";
import {
  basicCatalog,
  Catalog,
  enterpriseApis,
  enterpriseId,
  DynamicValueSchema,
  fallbackCatalogId,
  unsupportedApi,
} from "../../protocol/src/index";
import type { ComponentEntry } from "../../catalog/src/index";
import type { RunConfig } from "../../protocol/src/index";
import { z } from "zod";
import type { ValidateFunction } from "ajv";
import { useTranslation, getLocale, label } from "../../i18n/src/index";
import { ComponentPolicy, useRuntimeEnvironment } from "./policy";
import { isJsonEnvelope, isPluginAction } from "../../protocol/src/bridge";
import { CommitProbe, useRuntimeMeasurement } from "./measurement";
import type { MeasurementStage } from "../../protocol/src/measurement";
import { validateEnterprise } from "../../protocol/src/enterprise";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);
type Props = ReactA2uiComponentProps<Record<string, any>>;
function withPolicy(
  api: Parameters<typeof createComponentImplementation>[0],
  View: ComponentType<Props>,
  validate?: (data: unknown) => { valid: boolean; errors?: unknown },
  measuredPlugin = false,
) {
  return createComponentImplementation(api, (props: Props) => (
    <ComponentPolicy
      context={props.context}
      data={props.props.data}
      validate={validate}
    >
      {measuredPlugin ? (
        <View {...props} />
      ) : (
        <CommitProbe
          target={{
            surfaceId: props.context.dataContext.surface?.id ?? "",
            componentId: props.context.componentModel.id,
          }}
        >
          <View {...props} />
        </CommitProbe>
      )}
    </ComponentPolicy>
  ));
}
export class RenderBoundary extends Component<
  { children: ReactNode; onError?: (error: string) => void },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  componentDidCatch(e: Error) {
    this.props.onError?.(e.message);
  }
  render() {
    return this.state.error ? (
      <div role="alert" className="error">
        {label(getLocale(), "组件渲染失败")}：{this.state.error}
      </div>
    ) : (
      this.props.children
    );
  }
}
function Table({
  data,
  dispatch,
}: {
  data: Record<string, any>;
  dispatch: (name: string, context: Record<string, unknown>) => void;
}) {
  const { l, locale } = useTranslation();
  const [sort, setSort] = useState({ key: "", asc: true });
  const [scrollTop, setScrollTop] = useState(0);
  const rows = [...(data.items ?? [])];
  if (sort.key)
    rows.sort(
      (a, b) =>
        new Intl.Collator(locale, { numeric: true }).compare(
          String(a[sort.key]),
          String(b[sort.key]),
        ) * (sort.asc ? 1 : -1),
    );
  const keys: string[] =
    data.columns?.map((c: { key: string }) => c.key) ??
    Object.keys(rows[0] ?? {});
  const virtual = rows.length > 100;
  const start = virtual ? Math.max(0, Math.floor(scrollTop / 44) - 3) : 0;
  const end = virtual ? Math.min(rows.length, start + 18) : rows.length;
  return (
    <div>
      <h3>{data.title}</h3>
      <div
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={virtual ? { maxHeight: 440, overflow: "auto" } : undefined}
      >
        <table>
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k}>
                  <button
                    disabled={
                      data.columns?.find(
                        (c: { key: string; sortable?: boolean }) => c.key === k,
                      )?.sortable === false
                    }
                    onClick={() =>
                      setSort({
                        key: k,
                        asc: sort.key === k ? !sort.asc : true,
                      })
                    }
                  >
                    {data.columns?.find(
                      (c: { key: string; label: string }) => c.key === k,
                    )?.label ??
                      l(
                        (
                          {
                            name: "名称",
                            owner: "负责人",
                            status: "状态",
                          } as Record<string, string>
                        )[k] ?? k,
                      )}{" "}
                    {sort.key === k ? (sort.asc ? "↑" : "↓") : "↕"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {virtual && (
              <tr aria-hidden>
                <td
                  colSpan={keys.length}
                  style={{ height: start * 44, padding: 0, border: 0 }}
                />
              </tr>
            )}
            {rows.slice(start, end).map((row, offset) => {
              const i = start + offset;
              return (
                <tr
                  key={row.id ?? i}
                  tabIndex={0}
                  style={virtual ? { height: 44 } : undefined}
                  onClick={() =>
                    dispatch(data.rowAction ?? "table.rowClick", {
                      rowIndex: i,
                      row,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      dispatch(data.rowAction ?? "table.rowClick", {
                        rowIndex: i,
                        row,
                      });
                    }
                  }}
                >
                  {keys.map((k) => (
                    <td
                      key={k}
                      style={
                        virtual
                          ? {
                              whiteSpace: "nowrap",
                              maxWidth: 240,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }
                          : undefined
                      }
                    >
                      {String(row[k])}
                    </td>
                  ))}
                </tr>
              );
            })}
            {virtual && (
              <tr aria-hidden>
                <td
                  colSpan={keys.length}
                  style={{
                    height: (rows.length - end) * 44,
                    padding: 0,
                    border: 0,
                  }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Chart({
  data,
  dispatch,
}: {
  data: Record<string, any>;
  dispatch: (name: string, context: Record<string, unknown>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const items = data.items ?? [];
    const type = data.chartType ?? "bar";
    chart.setOption({
      color: ["#148a7d", "#82bdb3", "#b9d8d0"],
      tooltip: {},
      grid: { left: 32, right: 12, top: 24, bottom: 28 },
      ...(type === "pie"
        ? { legend: { bottom: 0 } }
        : {
            xAxis: { type: "category", data: items.map((v: any) => v.label) },
            yAxis: { type: "value" },
          }),
      series: [
        {
          type,
          data:
            type === "pie"
              ? items.map((v: any) => ({
                  name: v.label,
                  value: Number(v.value),
                }))
              : items.map((v: any) => Number(v.value)),
          barMaxWidth: 42,
        },
      ],
    });
    chart.on("click", (event) =>
      dispatch(data.clickAction ?? "chart.select", {
        dataIndex: event.dataIndex,
        name: event.name,
        value: event.value,
      }),
    );
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [data]);
  return (
    <div>
      <h3>{data.title}</h3>
      <div
        ref={ref}
        style={{ height: 240, width: "100%" }}
        role="img"
        aria-label={`${data.title} · ${data.chartType ?? "bar"}`}
      />
    </div>
  );
}
export async function makeCatalogs(
  entries: ComponentEntry[],
  _config: RunConfig,
  onError: (error: string) => void,
) {
  const overrides: ReactCatalogComponent[] = Array.from(
    basicCatalog.components.values(),
  ).map((api) => {
    if (
      ![
        "Text",
        "Column",
        "Row",
        "Card",
        "Button",
        "TextField",
        "CheckBox",
        "ChoicePicker",
      ].includes(api.name)
    )
      return api;
    const View = ({
      props: p,
      buildChild,
      context,
      metadata,
    }: Props): ReactNode => {
      const name = api.name;
      if (name === "Text")
        return (
          <span className={`a2-text ${p.variant ?? ""}`}>
            {String(p.text ?? "")}
          </span>
        );
      if (name === "Column" || name === "Row")
        return (
          <div
            className={`a2-${name.toLowerCase()}`}
            style={{
              alignItems: p.align ?? "stretch",
              justifyContent: p.justify ?? "start",
              gap: Number(
                (
                  metadata?.extensions?.enterpriseLayout as
                    { gap?: number } | undefined
                )?.gap ?? 12,
              ),
            }}
          >
            {(Array.isArray(p.children) ? p.children : []).map((id: string) => (
              <div key={id}>{buildChild(id)}</div>
            ))}
          </div>
        );
      if (name === "Card")
        return <div className="a2-card">{buildChild(p.child)}</div>;
      if (name === "Button")
        return (
          <button
            className={`btn ${p.variant === "primary" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => void p.action()}
          >
            {buildChild(p.child)}
          </button>
        );
      if (name === "TextField")
        return (
          <label className="a2-field">
            {p.label}
            <input
              className="input"
              placeholder={p.placeholder}
              value={p.value ?? ""}
              onChange={(e) =>
                context.dataContext.set(
                  context.componentModel.properties.value["@path"],
                  e.target.value,
                )
              }
            />
          </label>
        );
      if (name === "CheckBox")
        return (
          <label className="a2-check">
            <input
              type="checkbox"
              checked={Boolean(p.value)}
              onChange={(e) =>
                context.dataContext.set(
                  context.componentModel.properties.value["@path"],
                  e.target.checked,
                )
              }
            />
            {p.label}
          </label>
        );
      if (name === "ChoicePicker")
        return (
          <fieldset>
            <legend>{p.label}</legend>
            {(p.options ?? []).map((o: { label: string; value: string }) => (
              <label className="a2-check" key={o.value}>
                <input
                  type={
                    p.variant === "multipleSelection" ? "checkbox" : "radio"
                  }
                  checked={p.value?.includes(o.value) ?? false}
                  onChange={(e) => {
                    const value =
                      p.variant === "multipleSelection"
                        ? e.target.checked
                          ? [...(p.value ?? []), o.value]
                          : (p.value ?? []).filter((s: string) => s !== o.value)
                        : [o.value];
                    context.dataContext.set(
                      context.componentModel.properties.value["@path"],
                      value,
                    );
                  }}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        );
      return <div className="muted">{name}</div>;
    };
    return withPolicy(api, View);
  });
  const base = new Catalog(
    basicCatalog.id,
    "1.0",
    overrides,
    Array.from(basicCatalog.functions.values()),
    { ...basicCatalog, defs: basicCatalog.defs },
  );
  const enterprise = new Catalog(
    enterpriseId,
    "1.0",
    enterpriseApis.map((api) =>
      withPolicy(
        api,
        ({ props, context }) => {
          const data = (props.data as Record<string, any>) ?? {};
          return api.name === "KPI" ? (
            <div className="kpi">
              <div className="muted">{data.label}</div>
              <strong>
                {typeof data.value === "number"
                  ? new Intl.NumberFormat(getLocale()).format(data.value)
                  : data.value}
                {data.unit && ` ${data.unit}`}
              </strong>
              <span className="accent">
                {data.delta}
                {data.delta && data.trend ? " · " : ""}
                {data.trend}
                {data.status && ` · ${data.status}`}
              </span>
            </div>
          ) : api.name === "DataTable" ? (
            <Table
              data={data}
              dispatch={(name, payload) =>
                void context.dispatchAction({
                  event: { name, context: payload },
                })
              }
            />
          ) : (
            <Chart
              data={data}
              dispatch={(name, payload) =>
                void context.dispatchAction({
                  event: { name, context: payload },
                })
              }
            />
          );
        },
        (data) => validateEnterprise(api.name, data),
      ),
    ),
  );
  const plugins = await Promise.all(
    entries
      .filter((e) => e.pluginId && e.bundleUrl)
      .map(async (entry) => {
        const { default: validate } = (await import(
          /* @vite-ignore */ entry.bundleUrl!.replace(
            /plugin\.js$/,
            "validator.js",
          )
        )) as { default: ValidateFunction };
        const View = ({ props, context }: Props) => {
          const { locale } = useTranslation();
          const environment = useRuntimeEnvironment();
          return (
            <RenderBoundary onError={onError}>
              <PluginMount
                entry={entry}
                surfaceId={context.dataContext.surface?.id ?? ""}
                componentId={context.componentModel.id}
                data={props.data}
                mode={environment.runtimeMode}
                theme={environment.theme}
                locale={locale}
                dispatch={(name, payload) =>
                  void context.dispatchAction({
                    event: { name, context: payload ?? {} },
                  })
                }
                onError={onError}
              />
            </RenderBoundary>
          );
        };
        return new Catalog(entry.catalogId!, "1.0", [
          withPolicy(
            {
              name: entry.component,
              schema: z.object({ data: DynamicValueSchema }),
            },
            View,
            (data) => ({
              valid: Boolean(validate(data)),
              errors: validate.errors,
            }),
            true,
          ),
        ]);
      }),
  );
  const fallback = new Catalog(fallbackCatalogId, "1.0", [
    createComponentImplementation(unsupportedApi, ({ props }) => {
      const { t } = useTranslation();
      return (
        <div role="note" className="unsupported-component">
          <strong>
            {t("不支持的组件")}: {props.originalType}
          </strong>
          <p>{t("此组件尚未安装，其他组件可继续使用。")}</p>
          <code>{props.originalCatalogId}</code>
        </div>
      );
    }),
  ]);
  return [base, enterprise, ...plugins, fallback];
}
interface PluginEnvironment {
  locale: string;
  requestId?: string;
  onError?: (error: string) => void;
  onProbe?: (detail: {
    requestId: string;
    stage: MeasurementStage;
    visible: boolean;
    at: number;
  }) => void;
}
interface Mounted {
  update: (data: unknown, environment?: PluginEnvironment) => void;
  unmount: () => void;
}
interface PluginModule {
  mount: (
    node: HTMLElement,
    data: unknown,
    dispatch: (name: string, context?: Record<string, unknown>) => void,
    environment?: PluginEnvironment,
  ) => Mounted;
}
function PluginMount({
  surfaceId,
  componentId,
  entry,
  data,
  mode,
  theme,
  locale,
  dispatch,
  onError,
}: {
  surfaceId: string;
  componentId: string;
  entry: ComponentEntry;
  data: unknown;
  mode: "native" | "sandbox";
  theme: string;
  locale: string;
  dispatch: (name: string, context?: Record<string, unknown>) => void;
  onError: (error: string) => void;
}) {
  const probe = useRuntimeMeasurement();
  const requestId = probe.requestId;
  const root = useRef<HTMLDivElement>(null);
  const [mountError, setMountError] = useState("");
  const { t } = useTranslation();
  const mounted = useRef<Mounted | null>(null);
  const port = useRef<MessagePort | null>(null);
  const nonceRef = useRef("");
  const latest = useRef({
    data,
    dispatch,
    onError,
    locale,
    theme,
    requestId,
    probe,
    surfaceId,
    componentId,
  });
  latest.current = {
    data,
    dispatch,
    onError,
    locale,
    theme,
    requestId,
    probe,
    surfaceId,
    componentId,
  };
  useEffect(() => {
    let disposed = false;
    let frame: HTMLIFrameElement | undefined;
    let stylesheet: HTMLLinkElement | undefined;
    const nonce = crypto.randomUUID();
    const fail = (error: string) => {
      if (!disposed) {
        const diagnostic = error.startsWith("PLUGIN_")
          ? error
          : `PLUGIN_RENDER_ERROR: ${error}`;
        setMountError(diagnostic);
        latest.current.onError(diagnostic);
      }
    };
    const dispatchAllowed = (
      name: string,
      context: Record<string, unknown> = {},
      inputAt?: number,
    ) => {
      if (disposed) return;
      if (!isPluginAction({ name, context }, entry.actions ?? [])) {
        latest.current.onError(
          "PLUGIN_ACTION_REJECTED: undeclared or invalid action",
        );
        return;
      }
      if (typeof inputAt === "number" && Number.isFinite(inputAt))
        latest.current.probe.input?.(
          {
            surfaceId: latest.current.surfaceId,
            componentId: latest.current.componentId,
          },
          inputAt,
        );
      latest.current.dispatch(name, context);
    };
    const onProbe: NonNullable<PluginEnvironment["onProbe"]> = (detail) => {
      if (
        !disposed &&
        typeof detail.requestId === "string" &&
        ["ready", "commit", "paint"].includes(detail.stage) &&
        typeof detail.visible === "boolean"
      )
        latest.current.probe.report(
          detail.requestId,
          {
            surfaceId: latest.current.surfaceId,
            componentId: latest.current.componentId,
          },
          detail.stage,
          detail.visible,
          detail.at,
        );
    };
    nonceRef.current = nonce;
    if (mode === "native") {
      if (entry.stylesheetUrl) {
        stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = entry.stylesheetUrl;
        document.head.append(stylesheet);
      }
      void import(/* @vite-ignore */ entry.bundleUrl!)
        .then((module: PluginModule) => {
          if (disposed || !root.current) return;
          mounted.current = module.mount(
            root.current,
            latest.current.data,
            dispatchAllowed,
            {
              locale: latest.current.locale,
              onError: fail,
              requestId: latest.current.requestId,
              onProbe,
            },
          );
        })
        .catch((e) => fail(`PLUGIN_LOAD_ERROR: ${String(e)}`));
    } else if (root.current) {
      frame = document.createElement("iframe");
      frame.title = entry.name + " Sandbox";
      frame.setAttribute("sandbox", "allow-scripts");
      frame.style.cssText = "border:0;width:100%;height:440px;display:block";
      const safeUrl = JSON.stringify(
        new URL(entry.bundleUrl!, location.origin).href,
      ).replace(/</g, "\\u003c");
      const pluginStyles = entry.stylesheetUrl
        ? `<link rel="stylesheet" href="${entry.stylesheetUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}">`
        : "";
      frame.srcdoc = `<!doctype html><html data-theme="${theme}"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' http://127.0.0.1:4173; style-src 'unsafe-inline' http://127.0.0.1:4173; connect-src 'none'; img-src data:; font-src 'none'; form-action 'none'; base-uri 'none'"><link rel="stylesheet" href="http://127.0.0.1:4173/runtime.css">${pluginStyles}</head><body style="margin:0"><div id="plugin"></div><script type="module">const loading=import(${safeUrl}).then(module=>({mount:module.mount})).catch(error=>({error:String(error)}));let port,instance,contentCommitted=false,inputAt;addEventListener('click',()=>{inputAt=performance.timeOrigin+performance.now()},true);function reportSize(){if(document.body.scrollHeight>0)contentCommitted=true;if(contentCommitted)port?.postMessage({nonce:${JSON.stringify(nonce)},type:'resize',height:document.body.scrollHeight})}addEventListener('message',e=>{if(e.source!==parent||e.data?.nonce!==${JSON.stringify(nonce)}||!e.ports[0]||port)return;port=e.ports[0];port.onmessage=async e=>{try{const m=e.data;if(m.nonce!==${JSON.stringify(nonce)})return;if(m.type==='update'){const loaded=await loading;if(!loaded.mount){port.postMessage({nonce:${JSON.stringify(nonce)},type:'error',message:'PLUGIN_LOAD_ERROR: '+loaded.error});return}document.documentElement.dataset.theme=m.theme;if(instance)instance.update(m.data,{locale:m.locale,requestId:m.requestId});else instance=loaded.mount(document.getElementById('plugin'),m.data,(name,context)=>{port.postMessage({nonce:${JSON.stringify(nonce)},type:'action',name,context,inputAt});inputAt=undefined},{locale:m.locale,requestId:m.requestId,onProbe:detail=>port.postMessage({nonce:${JSON.stringify(nonce)},type:'probe',...detail}),onCommit:()=>{contentCommitted=true;reportSize()},onError:message=>port.postMessage({nonce:${JSON.stringify(nonce)},type:'error',message})});}if(m.type==='dispose'){instance?.unmount();port.close()}}catch(error){port.postMessage({nonce:${JSON.stringify(nonce)},type:'error',message:String(error)})}};port.postMessage({nonce:${JSON.stringify(nonce)},type:'ready'})});parent.postMessage({type:'sandbox.ready',nonce:${JSON.stringify(nonce)}},'http://127.0.0.1:4173');addEventListener('error',e=>port?.postMessage({nonce:${JSON.stringify(nonce)},type:'error',message:e.message}));new ResizeObserver(reportSize).observe(document.body);</script></body></html>`;
      const onMessage = (event: MessageEvent) => {
        if (
          event.source !== frame?.contentWindow ||
          event.origin !== "null" ||
          event.data?.nonce !== nonce ||
          event.data.type !== "sandbox.ready"
        )
          return;
        const channel = new MessageChannel();
        port.current = channel.port1;
        channel.port1.onmessage = (e) => {
          if (disposed) return;
          const m = e.data;
          if (!isJsonEnvelope(m, 65536) || m.nonce !== nonce) return;
          if (m.type === "ready")
            channel.port1.postMessage({
              nonce,
              type: "update",
              data: latest.current.data,
              locale: latest.current.locale,
              theme: latest.current.theme,
              requestId: latest.current.requestId,
            });
          else if (m.type === "action" && typeof m.name === "string")
            dispatchAllowed(m.name, m.context, m.inputAt);
          else if (m.type === "probe")
            onProbe(m as Parameters<typeof onProbe>[0]);
          else if (m.type === "error") fail(String(m.message));
          else if (m.type === "resize" && Number.isFinite(m.height) && frame)
            frame.style.height = `${Math.max(32, Math.min(2000, m.height))}px`;
        };
        frame.contentWindow?.postMessage({ nonce }, "*", [channel.port2]);
      };
      window.addEventListener("message", onMessage);
      root.current.append(frame);
      return () => {
        disposed = true;
        window.removeEventListener("message", onMessage);
        port.current?.postMessage({ nonce, type: "dispose" });
        port.current?.close();
        port.current = null;
        frame?.remove();
      };
    }
    return () => {
      disposed = true;
      mounted.current?.unmount();
      mounted.current = null;
      stylesheet?.remove();
    };
  }, [entry.bundleUrl, mode]);
  useEffect(() => {
    mounted.current?.update(data, { locale, requestId });
    port.current?.postMessage({
      nonce: nonceRef.current,
      type: "update",
      requestId,
      data,
      locale,
      theme,
    });
  }, [data, locale, theme, requestId]);
  useEffect(() => {
    if (mountError) {
      mounted.current?.unmount();
      mounted.current = null;
      port.current?.postMessage({ nonce: nonceRef.current, type: "dispose" });
      port.current?.close();
      port.current = null;
    }
  }, [mountError]);
  return (
    <>
      <div
        ref={root}
        onClickCapture={() =>
          probe.input?.(
            { surfaceId, componentId },
            performance.timeOrigin + performance.now(),
          )
        }
        data-plugin={entry.pluginId}
        data-mode={mode}
        hidden={!!mountError}
      />
      {mountError && (
        <div role="alert" className="error">
          {t("组件渲染失败")}
          <details>
            <summary>{t("详细诊断")}</summary>
            {mountError}
          </details>
        </div>
      )}
    </>
  );
}
