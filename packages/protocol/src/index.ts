import {
  MessageProcessor,
  basicCatalog,
  Catalog,
  DynamicValueSchema,
} from "@a2ui/web_core/v1_0";
import { z } from "zod";
import { parse as parseWithLocation, type ParseError } from "jsonc-parser";

export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type Message = { version: "1.0"; [key: string]: unknown };
export type Policy = "progressive" | "on_complete" | "live";
const jsonPointer = z
  .string()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/"), "Expected a JSON Pointer");
export const renderRuleSchema = z
  .object({
    renderPolicy: z.enum(["progressive", "on_complete", "live"]),
    readyWhen: jsonPointer.optional(),
    initialReadyWhen: jsonPointer.optional(),
    timeoutMs: z.number().int().min(100).max(120000).optional(),
  })
  .strict();
export type RenderRule = z.infer<typeof renderRuleSchema>;
export const runConfigSchema = z
  .object({
    runtimeMode: z.enum(["native", "sandbox"]),
    renderPolicy: z.enum(["progressive", "on_complete", "live"]),
    readyWhen: jsonPointer,
    readyTimeoutMs: z.number().int().min(100).max(120000).optional(),
    componentPolicies: z.record(z.record(renderRuleSchema)).optional(),
    theme: z.enum(["light", "dark"]),
    locale: z.enum(["zh-CN", "en-US"]),
    actionHandler: z.enum(["mock", "external"]),
    latency: z.number().int().min(0).max(30000),
    outcome: z.enum(["success", "reject", "error"]),
    container: z.enum(["card", "chat", "workspace"]).optional(),
  })
  .strict();
export interface RunConfig {
  runtimeMode: "native" | "sandbox";
  renderPolicy: Policy;
  readyWhen: string;
  readyTimeoutMs?: number;
  componentPolicies?: Record<string, Record<string, RenderRule>>;
  theme: "light" | "dark";
  locale: "zh-CN" | "en-US";
  actionHandler: "mock" | "external";
  latency: number;
  outcome: "success" | "reject" | "error";
  container?: "card" | "chat" | "workspace";
}
export const defaultRun: RunConfig = {
  runtimeMode: "sandbox",
  renderPolicy: "progressive",
  readyWhen: "/ready",
  theme: "light",
  locale: "zh-CN",
  actionHandler: "mock",
  latency: 800,
  outcome: "success",
  container: "card",
};
export const enterpriseId = "urn:enterprise:agent-ui:catalog:1";
export const enterpriseApis = ["KPI", "DataTable", "Chart"].map((name) => ({
  name,
  schema: z.object({ data: DynamicValueSchema }),
}));
export const enterpriseCatalog = new Catalog(
  enterpriseId,
  "1.0",
  enterpriseApis,
);
export class MessageParseError extends Error {
  readonly statusCode = 400;
  constructor(
    readonly code:
      | "MESSAGE_TOO_LARGE"
      | "MESSAGE_COUNT"
      | "MESSAGE_OBJECT"
      | "JSON_SYNTAX"
      | "JSONL_SYNTAX",
    readonly line = 1,
    readonly column = 1,
    readonly offset = 0,
    readonly diagnostic = "",
  ) {
    super(
      `${code} at line ${line}, column ${column}${diagnostic ? `: ${diagnostic}` : ""}`,
    );
    this.name = "MessageParseError";
  }
}
function syntaxLocation(text: string, error: unknown) {
  const diagnostic = String(error);
  const errors: ParseError[] = [];
  // JSON.parse remains the acceptance gate. This strict diagnostic pass supplies
  // offsets consistently across engines, including errors without V8 positions.
  parseWithLocation(text, errors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: false,
  });
  let offset = errors[0]?.offset ?? text.length;
  offset = Math.min(text.length, Math.max(0, offset));
  const before = text.slice(0, offset).split("\n");
  return {
    offset,
    line: before.length,
    column: before.at(-1)!.length + 1,
    diagnostic,
  };
}
export function parseMessages(text: string): Message[] {
  if (
    text.length > 2_000_000 ||
    new TextEncoder().encode(text).byteLength > 2_000_000
  )
    throw new MessageParseError("MESSAGE_TOO_LARGE");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (original) {
    const lines = text.split(/\r?\n/);
    // A pretty-printed JSON object/array is one document. Independent complete
    // objects on individual lines identify JSONL, even if another line is bad.
    const isJSONL =
      lines.filter((line) => line.trim()).length > 1 &&
      !/[{[]\s*$/.test(lines.find((line) => line.trim()) ?? "") &&
      lines.some((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed && typeof parsed === "object" && !Array.isArray(parsed);
        } catch {
          return false;
        }
      });
    if (!isJSONL) {
      const location = syntaxLocation(text, original);
      throw new MessageParseError(
        "JSON_SYNTAX",
        location.line,
        location.column,
        location.offset,
        location.diagnostic,
      );
    }
    let lineOffset = 0;
    value = text
      .split("\n")
      .map((line, i) => {
        const start = lineOffset;
        lineOffset += line.length + 1;
        if (!line.trim()) return undefined;
        try {
          return JSON.parse(line);
        } catch (error) {
          const location = syntaxLocation(line, error);
          throw new MessageParseError(
            "JSONL_SYNTAX",
            i + 1,
            location.column,
            start + location.offset,
            location.diagnostic,
          );
        }
      })
      .filter((line) => line !== undefined);
  }
  const messages = Array.isArray(value) ? value : [value];
  if (!messages.length || messages.length > 1000)
    throw new MessageParseError("MESSAGE_COUNT");
  if (messages.some((v) => !v || typeof v !== "object" || Array.isArray(v)))
    throw new MessageParseError("MESSAGE_OBJECT");
  return messages as Message[];
}
export function validateMessages(
  messages: unknown[],
  prior: unknown[] = [],
  extraCatalogs: Catalog<any>[] = [],
) {
  const processor = new MessageProcessor(
    [basicCatalog, enterpriseCatalog, ...extraCatalogs],
    undefined,
    { version: "1.0", reportErrorsOnly: true },
  );
  try {
    const errors = [
      ...processor.processMessagesWithErrors(structuredClone(prior)),
      ...processor.processMessagesWithErrors(structuredClone(messages)),
    ];
    return {
      valid: errors.length === 0,
      errors: errors.map(
        (e) => JSON.parse(JSON.stringify(e)) as Record<string, unknown>,
      ),
    };
  } catch (e) {
    return { valid: false, errors: [{ message: String(e) }] };
  } finally {
    processor.dispose();
  }
}
export function pointer(data: unknown, path: string): unknown {
  if (path === "" || path === "/") return data;
  return path
    .split("/")
    .slice(1)
    .reduce<unknown>(
      (v, key) =>
        v &&
        typeof v === "object" &&
        Object.hasOwn(v, key.replace(/~1/g, "/").replace(/~0/g, "~"))
          ? (v as Record<string, unknown>)[
              key.replace(/~1/g, "/").replace(/~0/g, "~")
            ]
          : undefined,
      data,
    );
}
export function createMessage(
  surfaceId: string,
  components: unknown[],
  dataModel: unknown,
  catalogId = basicCatalog.id,
): Message {
  return {
    version: "1.0",
    createSurface: { surfaceId, catalogId, components, dataModel },
  };
}
export function patchMessage(
  surfaceId: string,
  value: unknown,
  path = "/",
): Message {
  return { version: "1.0", updateDataModel: { surfaceId, path, value } };
}
export { basicCatalog, Catalog, DynamicValueSchema };
export {
  fallbackCatalog,
  fallbackCatalogId,
  unsupportedApi,
  processWithFallback,
} from "./fallback";
