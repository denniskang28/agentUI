import {
  AgentUiAdapter,
  builtins,
  EMBED_PROTOCOL,
} from "@enterprise/agent-ui/server";
import {
  capabilityProfileSchema,
  type CapabilityProfileData,
} from "@enterprise/agent-ui/protocol";

const entry = builtins.find((item) => item.key === "capability-profile")!;
const data: CapabilityProfileData = capabilityProfileSchema.parse({
  ...entry.defaults,
  currentColor: "#4169ad",
  targetColor: "#7b848c",
  fillOpacity: 18,
  showDimensions: false,
  showDetails: true,
});
const adapter = new AgentUiAdapter("capability-run");
const initial = adapter.apply({
  protocol: EMBED_PROTOCOL,
  runId: "capability-run",
  batchId: "profile-1",
  firstSequence: 1,
  inputs: [
    {
      type: "template.create",
      id: "profile",
      template: entry.key,
      templateVersion: entry.version,
      data,
    },
  ],
});
const update = adapter.apply({
  protocol: EMBED_PROTOCOL,
  runId: "capability-run",
  batchId: "profile-2",
  firstSequence: 2,
  inputs: [
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
  ],
});
// Send initial and update through the existing connected AgentUiClient/Host.
console.log(initial.messages.length, update.messages.length);
adapter.dispose();
