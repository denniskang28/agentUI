import { useId, type ReactNode } from "react";
import {
  appearanceDeclarations,
  appearanceColor,
  fontFamilies,
  themeTokensSchema,
  type ThemeTokens,
} from "../../protocol/src/appearance";
import { useRuntimeEnvironment } from "./policy";

export function themeCss(
  input: ThemeTokens = {},
  selector = "[data-runtime-theme]",
) {
  const tokens = themeTokensSchema.parse(input);
  const vars: Record<string, string> = {
    "--aui-success": "#168553",
    "--aui-warning": "#b66b08",
  };
  const names = {
    brand: "--color-accent",
    text: "--color-text",
    muted: "--color-neutral-700",
    background: "--color-bg",
    surface: "--color-surface",
    border: "--color-divider",
    success: "--aui-success",
    warning: "--aui-warning",
    danger: "--color-danger-500",
  } as const;
  for (const [name, variable] of Object.entries(names)) {
    const value = tokens[name as keyof typeof names];
    if (value) vars[variable] = appearanceColor(value);
  }
  if (tokens.brand) {
    vars["--color-accent-700"] = tokens.brand;
    vars["--color-accent-600"] = tokens.brand;
    for (const [level, percent] of [
      [100, 10],
      [200, 20],
      [300, 35],
    ] as const)
      vars[`--color-accent-${level}`] =
        `color-mix(in srgb, ${tokens.brand} ${percent}%, var(--color-bg))`;
  }
  if (tokens.fontFamily) vars["--font-body"] = fontFamilies[tokens.fontFamily];
  const declarations = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return `${selector}{${declarations};${tokens.fontFamily ? "font-family:var(--font-body);" : ""}${tokens.fontSize ? `font-size:${tokens.fontSize}px;` : ""}}
${tokens.fontFamily ? `${selector} body,${selector} :where(button,input,select,textarea,.a2-text){font-family:var(--font-body)}` : ""}
${tokens.fontSize ? `${selector} .a2-text:not(.caption),${selector} .a2-field,${selector} .btn,${selector} .input{font-size:${tokens.fontSize}px}` : ""}
${tokens.brand ? `${selector} .btn-primary{background:var(--color-accent);border-color:var(--color-accent)}` : ""}
${tokens.borderRadius !== undefined ? `${selector} :where(.a2-card,.btn,.input){border-radius:${tokens.borderRadius}px}` : ""}
${tokens.density ? `${selector} .a2-card{padding:${tokens.density === "compact" ? 12 : 24}px}` : ""}`;
}
export function RuntimeAppearance() {
  const config = useRuntimeEnvironment();
  return <style>{themeCss(config.themeTokens)}</style>;
}

/** A stable display:contents boundary leaves child instances mounted on appearance updates. */
export function AppearanceNode({
  surfaceId,
  componentId,
  children,
}: {
  surfaceId: string;
  componentId: string;
  children: ReactNode;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const config = useRuntimeEnvironment();
  const appearance =
    config.componentAppearances?.[surfaceId]?.[componentId] ?? {};
  const declarations = appearanceDeclarations(appearance);
  const textRule = Object.entries(declarations)
    .filter(([key]) =>
      [
        "font-family",
        "font-size",
        "font-weight",
        "line-height",
        "color",
        "text-align",
      ].includes(key),
    )
    .map(([key, value]) => `${key}:${value}!important`)
    .join(";");
  const rule = Object.entries(declarations)
    .map(([key, value]) => `${key}:${value}!important`)
    .join(";");
  return (
    <div
      data-agent-ui-node={componentId}
      data-appearance-id={id}
      style={{ display: "contents" }}
    >
      <style>
        {rule
          ? `[data-appearance-id="${id}"]>:not(style){${rule}}${textRule ? `[data-appearance-id="${id}"]>:not(style) :where(h1,h2,h3,p,span,strong,td,th,button,label,input,select,textarea){${textRule}}` : ""}`
          : ""}
      </style>
      {children}
    </div>
  );
}
