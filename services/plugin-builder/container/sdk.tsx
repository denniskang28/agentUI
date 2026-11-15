import type { ThemeTokens } from "../../../packages/protocol/src/appearance";
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
const ThemeContext = createContext<{
  mode: "light" | "dark";
  tokens: ThemeTokens;
}>({ mode: "light", tokens: {} });
export function useHostTheme() {
  return useContext(ThemeContext);
}
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
  theme = "light",
  themeTokens = {},
  children,
}: {
  dispatch: HostDispatch;
  locale?: "zh-CN" | "en-US";
  theme?: "light" | "dark";
  themeTokens?: ThemeTokens;
  children: ReactNode;
}) {
  return (
    <ActionContext.Provider value={dispatch}>
      <LocaleContext.Provider value={locale}>
        <ThemeContext.Provider value={{ mode: theme, tokens: themeTokens }}>
          {children}
        </ThemeContext.Provider>
      </LocaleContext.Provider>
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
