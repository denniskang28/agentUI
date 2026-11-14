import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ReactA2uiComponentProps } from "@a2ui/react";
import {
  defaultRun,
  pointer,
  type RunConfig,
  type RenderRule,
} from "../../protocol/src/index";
import { useTranslation } from "../../i18n/src/index";

export const RuntimeEnvironment = createContext<RunConfig>(defaultRun);
export const useRuntimeEnvironment = () => useContext(RuntimeEnvironment);
export function resolveRule(
  config: RunConfig,
  surfaceId: string,
  componentId: string,
): RenderRule {
  return (
    config.componentPolicies?.[surfaceId]?.[componentId] ?? {
      renderPolicy: config.renderPolicy,
      readyWhen: config.readyWhen,
      timeoutMs: config.readyTimeoutMs ?? 15000,
    }
  );
}

/** Coordinates platform policy around an official bound component, never a second data model. */
export function ComponentPolicy({
  context,
  data,
  validate,
  children,
}: {
  context: ReactA2uiComponentProps<Record<string, unknown>>["context"];
  data?: unknown;
  validate?: (data: unknown) => { valid: boolean; errors?: unknown };
  children: ReactNode;
}) {
  const config = useRuntimeEnvironment();
  const { t } = useTranslation();
  const model = context.dataContext.dataModel;
  const [surfaceData, setSurfaceData] = useState<unknown>(() => model.get("/"));
  useEffect(() => {
    const sub = model.subscribe<unknown>("/", setSurfaceData);
    setSurfaceData(model.get("/"));
    return () => sub.unsubscribe();
  }, [model]);
  const rule = resolveRule(
    config,
    context.dataContext.surface?.id ?? "",
    context.componentModel.id,
  );
  const readyPath =
    rule.renderPolicy === "live"
      ? (rule.initialReadyWhen ?? rule.readyWhen ?? config.readyWhen)
      : (rule.readyWhen ?? config.readyWhen);
  const validation = validate?.(data) ?? { valid: true };
  const ready = pointer(surfaceData, readyPath) === true && validation.valid;
  const [liveReady, setLiveReady] = useState(false);
  useEffect(() => {
    if (rule.renderPolicy === "live" && ready) setLiveReady(true);
  }, [ready, rule.renderPolicy]);
  const waiting =
    rule.renderPolicy === "on_complete"
      ? !ready
      : rule.renderPolicy === "live" && !liveReady && !ready;
  const [timedOut, setTimedOut] = useState(false);
  const timeout = rule.timeoutMs ?? config.readyTimeoutMs ?? 15000;
  useEffect(() => {
    if (!waiting) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), timeout);
    return () => clearTimeout(timer);
  }, [waiting, timeout, readyPath]);
  if (waiting)
    return (
      <div
        data-component-policy={context.componentModel.id}
        role={timedOut ? "alert" : "status"}
        className={timedOut ? "error" : "waiting"}
      >
        <strong>{t(timedOut ? "等待数据超时" : "等待完整数据")}</strong>
        <p>
          {t(
            timedOut
              ? "未提交任何操作；可以继续接收数据或重置。"
              : "数据已接收；等待 ready 条件与组件 Schema 校验通过。",
          )}
        </p>
        {!timedOut && (
          <>
            <div className="skeleton" />
            <div className="skeleton" />
          </>
        )}
        {!validation.valid && (
          <details>
            <summary>{t("详细诊断")}</summary>
            <pre>{JSON.stringify(validation.errors)}</pre>
          </details>
        )}
      </div>
    );
  if (!validation.valid)
    return (
      <div role="alert" className="error">
        {t("数据校验失败")}
        <details>
          <summary>{t("详细诊断")}</summary>
          <pre>{JSON.stringify(validation.errors)}</pre>
        </details>
      </div>
    );
  return children;
}
