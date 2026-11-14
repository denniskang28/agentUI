import { describe, expect, it } from "vitest";
import { capabilityProfileSchema } from "../../packages/agent-ui/src/protocol";
import { AgentUiAdapter } from "../../packages/agent-ui/src/server";
import { EMBED_PROTOCOL } from "../../packages/agent-ui/src/protocol";
import {
  builtins,
  instantiate,
  recoverTemplateValues,
} from "../../packages/catalog/src/index";
import { insuranceCapabilityExample } from "../../packages/catalog/src/capability";
import { validateMessages } from "../../packages/protocol/src/index";

const entry = builtins.find((e) => e.key === "capability-profile")!;
describe("capability profile data contract", () => {
  it("allows incomplete deferred data and validates the completed payload when ready becomes true", () => {
    const adapter = new AgentUiAdapter("deferred-profile");
    const batch = (sequence: number, inputs: unknown[]) =>
      adapter.apply({
        protocol: EMBED_PROTOCOL,
        runId: adapter.runId,
        batchId: `b-${sequence}`,
        firstSequence: sequence,
        inputs,
      });
    try {
      batch(1, [
        {
          type: "template.create",
          id: "profile",
          template: entry.key,
          templateVersion: entry.version,
          data: { dimensions: [] },
          lifecycle: { renderPolicy: "on_complete", ready: false },
        },
      ]);
      expect(adapter.getSurfaceData("profile")).toEqual({
        ready: false,
        view: { dimensions: [] },
        input: "",
        checked: false,
        choices: [],
      });
      batch(2, [
        {
          type: "template.patch",
          id: "profile",
          patch: structuredClone(insuranceCapabilityExample),
          ready: true,
        },
      ]);
      expect(adapter.getSurfaceData("profile")).toMatchObject({
        ready: true,
        view: { scores: { planning: 68 } },
      });
    } finally {
      adapter.dispose();
    }
  });
  it("validates every real template through official Core and recovers full stream configuration", () => {
    for (const template of entry.templates) {
      const { messages } = instantiate(entry, entry.defaults, template);
      expect(validateMessages(messages), template).toEqual({
        valid: true,
        errors: [],
      });
      expect(
        recoverTemplateValues(entry, messages, template),
        template,
      ).toEqual(entry.defaults);
    }
  });
  it("rejects ambiguous dimension IDs, invalid scales, unrelated targets, missing scenarios and unsafe colors", () => {
    for (const mutate of [
      (d: typeof insuranceCapabilityExample) => {
        d.dimensions[1].id = d.dimensions[0].id;
      },
      (d: typeof insuranceCapabilityExample) => {
        d.dimensions[0].max = 0;
      },
      (d: typeof insuranceCapabilityExample) => {
        d.scores.knowledge = 101;
      },
      (d: typeof insuranceCapabilityExample) => {
        d.scenarios[0].targets.unknown = 10;
      },
      (d: typeof insuranceCapabilityExample) => {
        d.scenarioId = "missing";
      },
      (d: typeof insuranceCapabilityExample) => {
        d.currentColor = "url(https://example.com)";
      },
    ]) {
      const data = structuredClone(insuranceCapabilityExample);
      mutate(data);
      expect(capabilityProfileSchema.safeParse(data).success).toBe(false);
    }
    const partial = structuredClone(insuranceCapabilityExample);
    partial.scores.planning = null;
    delete partial.scores.needs;
    expect(capabilityProfileSchema.safeParse(partial).success).toBe(true);
  });
  it("applies template creation, raw score updates and display patches through the embedded adapter", () => {
    const adapter = new AgentUiAdapter("capability-run");
    const send = (sequence: number, inputs: unknown[]) =>
      adapter.apply({
        protocol: EMBED_PROTOCOL,
        runId: adapter.runId,
        batchId: `b-${sequence}`,
        firstSequence: sequence,
        inputs,
      });
    try {
      send(1, [
        {
          type: "template.create",
          id: "profile",
          template: entry.key,
          templateVersion: entry.version,
          data: {},
        },
      ]);
      send(2, [
        {
          type: "a2ui",
          messages: [
            {
              version: "1.0",
              updateDataModel: {
                surfaceId: "profile",
                path: "/view/scores/planning",
                value: 90,
              },
            },
          ],
        },
      ]);
      send(3, [
        {
          type: "template.patch",
          id: "profile",
          patch: { currentColor: "#4169ad", showDimensions: false },
        },
      ]);
      expect(adapter.getSurfaceData("profile")).toMatchObject({
        view: {
          scores: { planning: 90 },
          showDimensions: false,
          currentColor: "#4169ad",
        },
      });
      expect(() =>
        send(4, [
          {
            type: "template.patch",
            id: "profile",
            patch: { scenarioId: "missing" },
          },
        ]),
      ).toThrow("Invalid capability-profile data");
      expect(adapter.getSurfaceData("profile")).toMatchObject({
        view: { scenarioId: "consultant", scores: { planning: 90 } },
      });
    } finally {
      adapter.dispose();
    }
  });
});
