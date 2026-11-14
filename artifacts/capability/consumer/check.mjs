import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  AgentUiAdapter,
  builtins,
  createHostManifest,
  EMBED_PROTOCOL,
} from "@enterprise/agent-ui/server";
import { capabilityProfileSchema } from "@enterprise/agent-ui/protocol";
const entry = builtins.find((e) => e.key === "capability-profile");
assert.ok(entry);
const data = capabilityProfileSchema.parse({
  ...entry.defaults,
  currentColor: "#4169ad",
  targetColor: "#aa6655",
  showDimensions: false,
});
const adapter = new AgentUiAdapter("consumer-capability");
const send = (n, inputs) =>
  adapter.apply({
    protocol: EMBED_PROTOCOL,
    runId: adapter.runId,
    batchId: `consumer-${n}`,
    firstSequence: n,
    inputs,
  });
const initial = send(1, [
  {
    type: "template.create",
    id: "profile",
    template: entry.key,
    templateVersion: entry.version,
    data,
  },
]);
const update = send(2, [
  {
    type: "a2ui",
    messages: [
      {
        version: "1.0",
        updateDataModel: {
          surfaceId: "profile",
          path: "/view/scores/planning",
          value: 80,
        },
      },
    ],
  },
]);
assert.equal(adapter.getSurfaceData("profile").view.scores.planning, 80);
await writeFile(
  "batches.json",
  JSON.stringify({ initial, update, manifest: createHostManifest(builtins) }),
);
adapter.dispose();
console.log(
  "Installed public exports, capability schema, template creation and raw update passed.",
);
