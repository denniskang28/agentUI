import { z } from "zod";
import {
  runConfigSchema,
  type Json,
  type Message,
} from "../../protocol/src/index";
import type { ComponentEntry } from "../../catalog/src/index";
export { capabilityProfileSchema } from "../../protocol/src/capability";
export type { CapabilityProfileData } from "../../protocol/src/capability";

export const EMBED_PROTOCOL = "enterprise-agent-ui/1" as const;
export const HOST_VERSION = "0.1.0" as const;
export type { Json, Message, ComponentEntry };
export type { RunConfig, RenderRule } from "../../protocol/src/index";
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.string(),
    z.number().finite(),
    z.array(jsonSchema),
    z.record(jsonSchema),
  ]),
);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/);
const data = z.record(jsonSchema);
const rule = z
  .object({
    renderPolicy: z.enum(["progressive", "on_complete", "live"]),
    ready: z.boolean().optional(),
    timeoutMs: z.number().int().min(100).max(120000).optional(),
  })
  .strict();
export const inputSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("template.create"),
      id,
      template: z.string().min(1),
      templateVersion: z.string().min(1),
      data,
      lifecycle: rule.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("template.patch"),
      id,
      patch: data,
      ready: z.boolean().optional(),
    })
    .strict(),
  z.object({ type: z.literal("template.delete"), id }).strict(),
  z
    .object({
      type: z.literal("a2ui"),
      messages: z.array(z.record(z.unknown())).min(1).max(1000),
    })
    .strict(),
]);
export type UiInput = z.infer<typeof inputSchema>;
export const batchSchema = z
  .object({
    protocol: z.literal(EMBED_PROTOCOL),
    runId: id,
    batchId: id,
    firstSequence: z.number().int().positive(),
    inputs: z.array(inputSchema).min(1).max(1000),
  })
  .strict();
export type UiBatch = z.infer<typeof batchSchema>;
export const actionSchema = z
  .object({
    version: z.literal("1.0"),
    action: z
      .object({
        name: z.string().min(1).max(200),
        surfaceId: z.string().min(1),
        sourceComponentId: z.string().min(1),
        timestamp: z.string().datetime(),
        context: data,
      })
      .passthrough(),
  })
  .passthrough();
export type A2uiAction = z.infer<typeof actionSchema>;
export const actionEventSchema = z
  .object({
    protocol: z.literal(EMBED_PROTOCOL),
    runId: id,
    actionId: id,
    message: actionSchema,
  })
  .strict();
export type ActionEvent = z.infer<typeof actionEventSchema>;
export const hostConfigSchema = runConfigSchema;
export interface HostManifest {
  protocol: typeof EMBED_PROTOCOL;
  hostVersion: typeof HOST_VERSION;
  sdkVersion: "0.15.0";
  pluginSdkVersion: "1.0";
  entries: ComponentEntry[];
}
export interface BatchReceipt {
  batchId: string;
  runId: string;
  firstSequence: number;
  lastSequence: number;
  messageCount: number;
  replay: boolean;
}
/** Input sequences count adapter commands, not generated A2UI messages. */
export const normalizedBatchSchema = z
  .object({
    batchId: id,
    runId: id,
    firstSequence: z.number().int().positive(),
    lastSequence: z.number().int().positive(),
    messageCount: z.number().int().nonnegative(),
    replay: z.boolean(),
    messages: z.array(z.record(z.unknown())).max(5000),
    componentPolicies: runConfigSchema.shape.componentPolicies.unwrap(),
  })
  .strict()
  .refine(
    (batch) =>
      batch.lastSequence >= batch.firstSequence &&
      batch.messageCount === batch.messages.length,
    "Invalid sequence or message count",
  );
export type NormalizedBatch = z.infer<typeof normalizedBatchSchema>;
export const hostManifestSchema = z
  .object({
    protocol: z.literal(EMBED_PROTOCOL),
    hostVersion: z.literal(HOST_VERSION),
    sdkVersion: z.literal("0.15.0"),
    pluginSdkVersion: z.literal("1.0"),
    entries: z
      .array(
        z
          .object({
            key: z.string(),
            name: z.string(),
            component: z.string(),
            category: z.string(),
            icon: z.string(),
            version: z.string(),
            description: z.string(),
            pluginId: z.string().optional(),
            catalogId: z.string().optional(),
            schema: z.record(z.unknown()).optional(),
            defaults: z.record(z.unknown()),
            fields: z.array(
              z.object({ key: z.string(), label: z.string() }).passthrough(),
            ),
            templates: z.array(z.string()),
            actions: z.array(z.string()).optional(),
            bundleUrl: z.string().optional(),
            stylesheetUrl: z.string().optional(),
          })
          .passthrough(),
      )
      .max(1000),
  })
  .strict();
export class AgentUiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AgentUiError";
  }
}
/** Canonical JSON retains array order, nulls and field presence for idempotency. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
