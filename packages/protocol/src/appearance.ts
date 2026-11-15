import { z } from "zod";

/** Project configuration, never an extra property on an official wire component. */
export const appearanceColorSchema = z.union([
  z.enum([
    "text",
    "muted",
    "brand",
    "success",
    "warning",
    "danger",
    "background",
    "surface",
    "border",
  ]),
  z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a semantic color or #RRGGBB"),
]);
export const fontSchema = z.enum(["system", "sans", "serif", "mono"]);
const pixels = (max: number) => z.number().finite().min(0).max(max);
export const componentAppearanceSchema = z
  .object({
    fontFamily: fontSchema.optional(),
    typography: z.enum(["title", "body", "caption"]).optional(),
    fontSize: z.number().finite().min(10).max(72).optional(),
    fontWeight: z
      .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
      .optional(),
    lineHeight: z.number().finite().min(1).max(3).optional(),
    color: appearanceColorSchema.optional(),
    backgroundColor: appearanceColorSchema.optional(),
    borderColor: appearanceColorSchema.optional(),
    borderWidth: pixels(8).optional(),
    borderRadius: pixels(48).optional(),
    padding: pixels(64).optional(),
    gap: pixels(64).optional(),
    textAlign: z.enum(["start", "center", "end"]).optional(),
  })
  .strict();
export type ComponentAppearance = z.infer<typeof componentAppearanceSchema>;
export type AppearanceProperty = keyof ComponentAppearance;
export const appearanceProperties = Object.keys(
  componentAppearanceSchema.shape,
) as AppearanceProperty[];
const componentId = z.string().min(1).max(128);
export const componentAppearancesSchema = z.record(
  componentId,
  z.record(componentId, componentAppearanceSchema),
);
export const themeTokensSchema = z
  .object({
    fontFamily: fontSchema.optional(),
    fontSize: z.number().finite().min(10).max(24).optional(),
    brand: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    text: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    muted: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    background: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    surface: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    border: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    success: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    warning: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    danger: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    borderRadius: pixels(32).optional(),
    density: z.enum(["compact", "comfortable"]).optional(),
  })
  .strict();
export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export const fontFamilies = {
  system:
    '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
  sans: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
  serif: 'Georgia, "Songti SC", "SimSun", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;
const colors = {
  text: "--color-text",
  muted: "--color-neutral-700",
  brand: "--color-accent",
  background: "--color-bg",
  surface: "--color-surface",
  border: "--color-divider",
  success: "--aui-success",
  warning: "--aui-warning",
  danger: "--color-danger-500",
} as const;
export function appearanceColor(value: z.infer<typeof appearanceColorSchema>) {
  return value.startsWith("#")
    ? value
    : `var(${colors[value as keyof typeof colors]})`;
}
export function appearanceDeclarations(
  value: ComponentAppearance,
): Record<string, string | number> {
  const style = componentAppearanceSchema.parse(value);
  const output: Record<string, string | number> = {};
  if (style.typography)
    Object.assign(output, {
      "font-size":
        style.typography === "title"
          ? "20px"
          : style.typography === "caption"
            ? "12px"
            : "14px",
      "font-weight": style.typography === "title" ? 600 : 400,
      "line-height": 1.5,
    });
  for (const [key, entry] of Object.entries(style)) {
    if (entry === undefined || key === "typography") continue;
    const cssKey = key.replace(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`,
    );
    output[cssKey] =
      key === "fontFamily"
        ? fontFamilies[entry as keyof typeof fontFamilies]
        : ["color", "backgroundColor", "borderColor"].includes(key)
          ? appearanceColor(entry as z.infer<typeof appearanceColorSchema>)
          : [
                "fontSize",
                "borderWidth",
                "borderRadius",
                "padding",
                "gap",
              ].includes(key)
            ? `${entry}px`
            : entry;
  }
  if (style.borderWidth !== undefined) output["border-style"] = "solid";
  return output;
}
export function appearanceCapabilities(
  component: string,
  plugin = false,
): AppearanceProperty[] {
  const container: AppearanceProperty[] = [
    "backgroundColor",
    "borderColor",
    "borderWidth",
    "borderRadius",
    "padding",
  ];
  if (plugin) return container;
  const text: AppearanceProperty[] = [
    "fontFamily",
    "typography",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "color",
    "textAlign",
  ];
  return ["Row", "Column"].includes(component)
    ? [...text, ...container, "gap"]
    : [...text, ...container];
}
