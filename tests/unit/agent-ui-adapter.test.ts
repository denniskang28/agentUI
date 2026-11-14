import { describe, expect, it } from "vitest";
import {
  AgentUiAdapter,
  createHostManifest,
  builtins,
} from "../../packages/agent-ui/src/server";
import {
  EMBED_PROTOCOL,
  type UiInput,
} from "../../packages/agent-ui/src/protocol";

function sender(adapter: AgentUiAdapter) {
  let sequence = 1;
  return (inputs: UiInput[]) => {
    const batch = {
      protocol: EMBED_PROTOCOL,
      runId: adapter.runId,
      batchId: `batch-${sequence}`,
      firstSequence: sequence,
      inputs,
    };
    const result = adapter.apply(batch);
    sequence = result.lastSequence + 1;
    return { batch, result };
  };
}
const create: UiInput = {
  type: "template.create",
  id: "card-1",
  template: "text",
  templateVersion: "0.15.0",
  data: { text: "原文", variant: "body" },
};

describe("embedded dual-entry adapter using official Core", () => {
  it("normalizes templates, accepts raw updates of the same Surface, and preserves raw JSON and history", () => {
    const adapter = new AgentUiAdapter("run-1");
    const send = sender(adapter);
    const initial = send([create]);
    const raw = {
      version: "1.0" as const,
      updateDataModel: {
        surfaceId: "card-1",
        path: "/view/text",
        value: "raw update",
      },
    };
    const copy = structuredClone(raw);
    expect(send([{ type: "a2ui", messages: [raw] }]).result.messages).toEqual([
      copy,
    ]);
    send([
      {
        type: "template.patch",
        id: "card-1",
        patch: { text: "template update" },
      },
    ]);
    expect(adapter.getSurfaceData("card-1")).toMatchObject({
      view: { text: "template update" },
    });
    expect(initial.result.messages[0]).toMatchObject({
      createSurface: { dataModel: { view: { text: "原文" } } },
    });
    expect(raw).toEqual(copy);
    const restored = new AgentUiAdapter("run-1");
    for (const batch of adapter.snapshot().batches) restored.apply(batch);
    expect(restored.getSurfaceData("card-1")).toEqual(
      adapter.getSurfaceData("card-1"),
    );
    restored.dispose();
    adapter.dispose();
  });
  it("enforces input ordering, idempotency and atomic rejection without claiming wire sequence equivalence", () => {
    const adapter = new AgentUiAdapter("run-1");
    const send = sender(adapter);
    const { batch } = send([create]);
    expect(adapter.apply(batch).replay).toBe(true);
    expect(() =>
      adapter.apply({
        ...batch,
        inputs: [{ ...create, data: { text: "other" } }],
      }),
    ).toThrow("Batch ID was reused");
    expect(() =>
      adapter.apply({ ...batch, batchId: "gap", firstSequence: 9 }),
    ).toThrow("Expected input sequence 2");
    expect(() => adapter.apply({ ...batch, runId: "old-run" })).toThrow(
      "another run",
    );
    const invalid = {
      ...batch,
      batchId: "invalid",
      firstSequence: 2,
      inputs: [
        {
          type: "template.patch",
          id: "card-1",
          patch: { text: "must roll back" },
        },
        {
          type: "a2ui",
          messages: [
            {
              version: "1.0",
              updateDataModel: { surfaceId: "missing", path: "/", value: {} },
            },
          ],
        },
      ],
    };
    expect(() => adapter.apply(invalid)).toThrow("Official Core rejected");
    expect(adapter.getSurfaceData("card-1")).toMatchObject({
      view: { text: "原文" },
    });
    const { result } = send([
      {
        type: "template.patch",
        id: "card-1",
        patch: { text: "next", variant: "caption" },
        ready: true,
      },
    ]);
    expect(result.lastSequence).toBe(2);
    expect(result.messageCount).toBe(3);
    adapter.dispose();
  });
  it("distinguishes explicit null, omitted fields and array replacement from raw null deletion", () => {
    const adapter = new AgentUiAdapter("run-1");
    const send = sender(adapter);
    send([
      {
        ...create,
        data: { text: "unchanged", nullable: "before", rows: [1, 2] },
      },
    ]);
    send([
      {
        type: "template.patch",
        id: "card-1",
        patch: { nullable: null, rows: [3] },
      },
    ]);
    expect(adapter.getSurfaceData("card-1")).toMatchObject({
      view: { text: "unchanged", nullable: null, rows: [3] },
    });
    send([
      {
        type: "a2ui",
        messages: [
          {
            version: "1.0",
            updateDataModel: {
              surfaceId: "card-1",
              path: "/view/nullable",
              value: null,
            },
          },
        ],
      },
    ]);
    expect(
      (adapter.getSurfaceData("card-1") as { view: object }).view,
    ).not.toHaveProperty("nullable");
    adapter.dispose();
  });
  it("rejects template patches after raw binding changes and removes mappings after raw delete", () => {
    const adapter = new AgentUiAdapter("run-1");
    const send = sender(adapter);
    send([create]);
    send([
      {
        type: "a2ui",
        messages: [
          {
            version: "1.0",
            updateComponents: {
              surfaceId: "card-1",
              components: [
                { id: "root", component: "Text", text: "Changed binding" },
              ],
            },
          },
        ],
      },
    ]);
    expect(() =>
      send([{ type: "template.patch", id: "card-1", patch: { text: "no" } }]),
    ).toThrow("Raw structure changed");
    send([
      {
        type: "a2ui",
        messages: [{ version: "1.0", deleteSurface: { surfaceId: "card-1" } }],
      },
    ]);
    expect(() =>
      send([{ type: "template.patch", id: "card-1", patch: {} }]),
    ).toThrow("No template instance");
    adapter.dispose();
  });
  it("validates version and business data while retaining deferred ready=false as a separate state", () => {
    const entry = {
      ...builtins[0],
      schema: {
        type: "object",
        properties: { text: { type: "string", minLength: 2 } },
        required: ["text"],
        additionalProperties: true,
      },
    };
    const adapter = new AgentUiAdapter("run-1", [entry]);
    const send = sender(adapter);
    expect(() => send([{ ...create, templateVersion: "99" }])).toThrow(
      "Expected template version",
    );
    send([
      {
        ...create,
        data: {},
        lifecycle: { renderPolicy: "on_complete", ready: false },
      },
    ]);
    expect(adapter.getSurfaceData("card-1")).toMatchObject({
      ready: false,
      view: {},
    });
    send([
      { type: "template.patch", id: "card-1", patch: { text: "complete" } },
    ]);
    expect(adapter.getSurfaceData("card-1")).toMatchObject({
      ready: false,
      view: { text: "complete" },
    });
    send([{ type: "template.patch", id: "card-1", patch: {}, ready: true }]);
    expect(adapter.getSurfaceData("card-1")).toMatchObject({ ready: true });
    expect(createHostManifest([entry])).toMatchObject({
      protocol: EMBED_PROTOCOL,
      sdkVersion: "0.15.0",
    });
    adapter.dispose();
  });
});
