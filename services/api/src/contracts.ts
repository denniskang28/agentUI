import { ActionMessageSchema } from "@a2ui/web_core/v1_0";
import { z } from "zod";
import { runConfigSchema } from "../../../packages/protocol/src/index";

const candidates = z.array(z.record(z.unknown()));
export const templateRequestSchema = z
  .object({
    values: z.record(z.unknown()).optional(),
    surfaceId: z.string().min(1).max(100).optional(),
  })
  .strict();
const prior = candidates.max(5000).optional();
export const validationRequestSchema = z.union([
  z.object({ text: z.string().min(1), prior }).strict(),
  z.object({ messages: candidates.min(1).max(1000), prior }).strict(),
]);
export const previewRequestSchema = runConfigSchema
  .omit({ actionHandler: true, latency: true, outcome: true })
  .partial()
  .extend({
    runtimeMode: z.enum(["sandbox", "native"]).default("sandbox"),
    container: z.enum(["card", "chat", "workspace"]).default("card"),
    locale: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
  });
export const sessionRequestSchema = z
  .object({
    actionHandler: z.enum(["external", "mock"]).default("external"),
    preview: previewRequestSchema.default({
      runtimeMode: "sandbox",
      container: "card",
      locale: "zh-CN",
    }),
  })
  .strict();
export const messageBatchSchema = z
  .object({
    batchId: z.string().min(1).max(100),
    firstSequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    runId: z.string().min(1).optional(),
    messages: candidates.min(1).max(1000),
  })
  .strict();
export const resetRequestSchema = runConfigSchema
  .partial()
  .extend({ replay: z.boolean().optional() });
export const ackRequestSchema = z
  .object({
    runId: z.string().min(1),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    errors: z.array(z.unknown()).default([]),
  })
  .strict();
export const actionRequestSchema = z
  .object({
    runId: z.string().min(1),
    action: ActionMessageSchema.shape.action,
  })
  .strict();

export const runtimeErrorRequestSchema = z
  .object({
    runId: z.string().min(1),
    error: z
      .object({
        code: z.string().min(1).max(100),
        message: z.string().max(65536),
      })
      .strict(),
  })
  .strict();
