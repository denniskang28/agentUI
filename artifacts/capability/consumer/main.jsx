import React from "react";
import { createRoot } from "react-dom/client";
import {
  AgentUiClient,
  AgentUiHost,
  AgentUiProvider,
} from "@aap/agent-ui/react";
import batches from "./batches.json";
const client = new AgentUiClient(
  "consumer-capability",
  (event) => {
    document.getElementById("action").textContent = JSON.stringify(event);
  },
  (error) => {
    document.getElementById("error").textContent = String(error);
  },
);
createRoot(document.getElementById("root")).render(
  <AgentUiProvider client={client}>
    <AgentUiHost
      hostUrl="http://127.0.0.1:4285"
      manifest={batches.manifest}
      config={{ locale: "zh-CN", theme: "light", runtimeMode: "native" }}
      onConnected={() => client.apply(batches.initial)}
    />
  </AgentUiProvider>,
);
document.getElementById("update").onclick = () => client.apply(batches.update);
