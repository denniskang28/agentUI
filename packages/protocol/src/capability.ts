import { z } from "zod";

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
const scores = z.record(z.number().finite().nullable());
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Project enterprise component data, not an extension to the A2UI wire. */
export const capabilityProfileSchema = z
  .object({
    title: z.string().max(120),
    subjectId: id,
    subjectName: z.string().min(1).max(120),
    subtitle: z.string().max(240).optional(),
    modelVersion: z.string().max(60).optional(),
    sampleData: z.boolean().optional(),
    dimensions: z
      .array(
        z
          .object({
            id,
            label: z.string().min(1).max(40),
            min: z.number().finite().optional(),
            max: z.number().finite().optional(),
            description: z.string().max(2000).optional(),
            evidence: z.string().max(2000).optional(),
          })
          .strict(),
      )
      .min(3)
      .max(8),
    scores,
    scenarios: z
      .array(
        z
          .object({
            id,
            label: z.string().min(1).max(80),
            targets: scores,
          })
          .strict(),
      )
      .min(1)
      .max(12),
    scenarioId: id.optional(),
    selectedDimensionId: id.optional(),
    currentColor: color.optional(),
    targetColor: color.optional(),
    fillOpacity: z.number().min(0).max(40).optional(),
    showDimensions: z.boolean().optional(),
    showDetails: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    const ids = new Set<string>();
    data.dimensions.forEach((dimension, index) => {
      if (ids.has(dimension.id))
        issue(["dimensions", index, "id"], "Duplicate dimension ID");
      ids.add(dimension.id);
      if (
        (dimension.max ?? 100) <= (dimension.min ?? 0) ||
        !Number.isFinite((dimension.max ?? 100) - (dimension.min ?? 0))
      )
        issue(["dimensions", index, "max"], "Maximum must exceed minimum");
    });
    const checkScores = (
      values: Record<string, number | null>,
      path: (string | number)[],
    ) => {
      for (const [key, value] of Object.entries(values)) {
        const dimension = data.dimensions.find((d) => d.id === key);
        if (!dimension) issue([...path, key], "Unknown dimension ID");
        else if (
          value !== null &&
          (value < (dimension.min ?? 0) || value > (dimension.max ?? 100))
        )
          issue([...path, key], "Score is outside the dimension range");
      }
    };
    checkScores(data.scores, ["scores"]);
    const scenarioIds = new Set<string>();
    data.scenarios.forEach((scenario, index) => {
      if (scenarioIds.has(scenario.id))
        issue(["scenarios", index, "id"], "Duplicate scenario ID");
      scenarioIds.add(scenario.id);
      checkScores(scenario.targets, ["scenarios", index, "targets"]);
    });
    if (data.scenarioId && !scenarioIds.has(data.scenarioId))
      issue(["scenarioId"], "Unknown scenario ID");
    if (data.selectedDimensionId && !ids.has(data.selectedDimensionId))
      issue(["selectedDimensionId"], "Unknown dimension ID");
  });

export type CapabilityProfileData = z.infer<typeof capabilityProfileSchema>;
