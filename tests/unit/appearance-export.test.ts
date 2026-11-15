import { describe, expect, it } from "vitest";
import {
  componentAppearanceSchema,
  themeTokensSchema,
  appearanceDeclarations,
} from "../../packages/protocol/src/appearance";
import { builtins, instantiate } from "../../packages/catalog/src/index";
import { AgentUiAdapter } from "../../packages/agent-ui/src/server";
import { defaultRun } from "../../packages/protocol/src/index";
import { libraryExport } from "../../apps/playground/src/libraryExport";

describe("appearance and generated Library inputs", () => {
  it("rejects CSS injection, URLs, unknown fields, unbounded sizes and self-referencing theme tokens", () => {
    for (const value of [
      { color: "red;display:none" },
      { fontFamily: "url(https://example.com)" },
      { padding: -1 },
      { fontSize: 1000 },
      { position: "fixed" },
      { color: "#ffffff</style>" },
    ])
      expect(componentAppearanceSchema.safeParse(value).success).toBe(false);
    expect(themeTokensSchema.safeParse({ brand: "brand" }).success).toBe(false);
    expect(
      appearanceDeclarations({
        typography: "title",
        fontSize: 24,
        color: "brand",
      }),
    ).toMatchObject({ "font-size": "24px", color: "var(--color-accent)" });
  });
  for (const entry of builtins)
    for (const template of entry.templates)
      it(`exports ${entry.key}/${template} through genuine public adapter and preserves final Core data`, () => {
        const scenario = instantiate(entry, entry.defaults, template);
        const exported = libraryExport({
          messages: scenario.messages,
          entry,
          template: true,
          config: {
            ...defaultRun,
            renderPolicy: scenario.renderPolicy,
            themeTokens: { brand: "#123456" },
            componentAppearances: { main: { root: { fontSize: 20 } } },
          },
          intervalMs: 10,
        });
        const consumer = new AgentUiAdapter("run_001");
        const reference = new AgentUiAdapter("reference");
        try {
          for (const batch of exported.document.batches) consumer.apply(batch);
          reference.apply({
            protocol: "enterprise-agent-ui/1",
            runId: "reference",
            batchId: "all",
            firstSequence: 1,
            inputs: [{ type: "a2ui", messages: scenario.messages }],
          });
          expect(consumer.getSurfaceData("main")).toEqual(
            reference.getSurfaceData("main"),
          );
          expect(exported.document.config.themeTokens?.brand).toBe("#123456");
          expect(exported.document.batches[0].inputs[0].type).toBe(
            "template.create",
          );
        } finally {
          consumer.dispose();
          reference.dispose();
        }
      });
  it("preserves arbitrary raw message fields and multiple Surfaces", () => {
    const messages = [
      ...instantiate(builtins[0], { text: "first" }, "full", "one").messages,
      ...instantiate(builtins[0], { text: "second" }, "full", "two").messages,
    ];
    const exported = libraryExport({
      messages,
      config: defaultRun,
      intervalMs: 0,
    });
    expect(
      exported.document.batches.flatMap((batch) =>
        batch.inputs.flatMap((input) =>
          input.type === "a2ui" ? input.messages : [],
        ),
      ),
    ).toEqual(messages);
  });
});
