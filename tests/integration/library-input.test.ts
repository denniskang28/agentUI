import { AgentUiAdapter } from "../../packages/agent-ui/src/server";
import { beforeAll, afterAll, it, expect } from "vitest";
import { createServer } from "../../services/api/src/server";
import { builtins, instantiate } from "../../packages/catalog/src/index";
import { scenarioInputs } from "../../packages/agent-ui/src/playground-input";
let server: Awaited<ReturnType<typeof createServer>>;
beforeAll(async () => {
  server = await createServer();
});
afterAll(async () => {
  await server.app.close();
});
const compile = (value: unknown) =>
  server.app.inject({
    method: "POST",
    url: "/api/v1/library/compile",
    payload: {
      text: typeof value === "string" ? value : JSON.stringify(value),
    },
  });
it("all builtin scenarios compile to the same genuine A2UI messages and preserve policies", async () => {
  for (const entry of builtins)
    for (const scenario of entry.templates) {
      const expected = instantiate(entry, entry.defaults, scenario);
      const response = await compile(
        scenarioInputs(entry, expected.messages, expected.renderPolicy),
      );
      expect(
        response.statusCode,
        `${entry.key}/${scenario}: ${response.body}`,
      ).toBe(200);
      const result = response.json();
      const actual = new AgentUiAdapter("actual");
      const reference = new AgentUiAdapter("reference");
      try {
        for (let i = 0; i < expected.messages.length; i++) {
          for (const [adapter, messages, runId] of [
            [actual, result.steps[i].messages, "actual"],
            [reference, [expected.messages[i]], "reference"],
          ] as const)
            adapter.apply({
              protocol: "enterprise-agent-ui/1",
              runId,
              batchId: `b${i}`,
              firstSequence: i + 1,
              inputs: [{ type: "a2ui", messages }],
            });
          expect(
            actual.getSurfaceData("main"),
            `${entry.key}/${scenario}/${i}`,
          ).toEqual(reference.getSurfaceData("main"));
        }
      } finally {
        actual.dispose();
        reference.dispose();
      }
      expect(result.steps[0].componentPolicies.main.root.renderPolicy).toBe(
        expected.renderPolicy,
      );
    }
});
it("custom JSONL supports multiple Surfaces, patches and deletion, rejects incompatible inputs", async () => {
  const entry = builtins.find((e) => e.key === "text")!;
  const create = (id: string) => ({
    type: "template.create",
    id,
    template: entry.key,
    templateVersion: entry.version,
    data: { text: id },
  });
  const response = await compile(
    [
      create("first"),
      create("second"),
      { type: "template.patch", id: "second", patch: { text: "Updated" } },
      { type: "template.delete", id: "first" },
    ]
      .map((x) => JSON.stringify(x))
      .join("\n"),
  );
  expect(response.statusCode).toBe(200);
  expect(response.json().steps[2].messages[0].updateDataModel.value).toBe(
    "Updated",
  );
  expect(response.json().steps[3].messages[0].deleteSurface.surfaceId).toBe(
    "first",
  );
  for (const value of [
    { ...create("a"), templateVersion: "unknown" },
    { type: "template.patch", id: "missing", patch: {} },
    { version: "1.0", createSurface: {} },
  ])
    expect((await compile(value)).statusCode).toBeGreaterThanOrEqual(400);
});
it("batch identity, sequencing and run IDs are checked by the actual Adapter", async () => {
  const batch = {
    protocol: "enterprise-agent-ui/1",
    runId: "custom_run",
    batchId: "b1",
    firstSequence: 1,
    inputs: [
      {
        type: "template.create",
        id: "custom",
        template: "text",
        templateVersion: builtins.find((e) => e.key === "text")!.version,
        data: { text: "One" },
      },
    ],
  };
  const response = await compile([batch, batch]);
  expect(response.statusCode).toBe(200);
  expect(response.json().steps[1].messages).toEqual([]);
  expect(
    (
      await compile([batch, { ...batch, batchId: "b2", firstSequence: 3 }])
    ).json().code,
  ).toBe("SEQUENCE_CONFLICT");
  expect(
    (await compile([batch, { ...batch, runId: "other" }])).json().code,
  ).toBe("STALE_RUN");
});
