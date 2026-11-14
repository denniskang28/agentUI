import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";
export type HostDispatch = (
  name: string,
  context?: Record<string, unknown>,
) => void;
const ActionContext = createContext<HostDispatch>(() => {
  throw new Error("Plugin must be mounted by Preview Host");
});
const LocaleContext = createContext<"zh-CN" | "en-US">("zh-CN");
export function useHostAction() {
  return useContext(ActionContext);
}
export function useHostLocale() {
  return useContext(LocaleContext);
}
export function HostProvider({
  dispatch,
  locale = "zh-CN",
  children,
}: {
  dispatch: HostDispatch;
  locale?: "zh-CN" | "en-US";
  children: ReactNode;
}) {
  return (
    <ActionContext.Provider value={dispatch}>
      <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
    </ActionContext.Provider>
  );
}
export function definePlugin<T>(plugin: {
  id: string;
  version: string;
  Component: ComponentType<{ data: T }>;
}) {
  return plugin;
}
