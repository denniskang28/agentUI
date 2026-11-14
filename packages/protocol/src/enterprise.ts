import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
const scalar = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export const enterpriseDataSchemas = {
  KPI: z
    .object({
      label: z.string(),
      value: z.union([z.string(), z.number().finite()]),
      unit: z.string().optional(),
      delta: z.string().optional(),
      trend: z.string().optional(),
      status: z.enum(["normal", "warning", "critical"]).optional(),
    })
    .passthrough(),
  DataTable: z
    .object({
      title: z.string().optional(),
      columns: z
        .array(
          z
            .object({
              key: z.string().min(1),
              label: z.string(),
              sortable: z.boolean().optional(),
            })
            .strict(),
        )
        .max(50)
        .optional(),
      items: z.array(z.record(scalar)).max(10000),
      rowAction: z.string().min(1).max(100).optional(),
    })
    .passthrough(),
  Chart: z
    .object({
      title: z.string().optional(),
      unit: z.string().optional(),
      chartType: z.enum(["bar", "line", "pie"]),
      items: z
        .array(
          z
            .object({ label: z.string(), value: z.number().finite() })
            .passthrough(),
        )
        .max(10000),
      clickAction: z.string().min(1).max(100).optional(),
    })
    .passthrough(),
} as const;
export function enterpriseSchema(name: string) {
  const schema =
    enterpriseDataSchemas[name as keyof typeof enterpriseDataSchemas];
  return schema ? zodToJsonSchema(schema, { $refStrategy: "none" }) : undefined;
}
export function validateEnterprise(name: string, data: unknown) {
  const schema =
    enterpriseDataSchemas[name as keyof typeof enterpriseDataSchemas];
  const result = schema.safeParse(data);
  return {
    valid: result.success,
    errors: result.success ? [] : result.error.issues,
  };
}
