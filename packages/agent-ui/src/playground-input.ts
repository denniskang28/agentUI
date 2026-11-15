import {
  parseMessages,
  type Message,
  type Json,
} from "../../protocol/src/index";
import {
  batchSchema,
  inputSchema,
  EMBED_PROTOCOL,
  type UiBatch,
  type UiInput,
} from "./protocol";
import type { ComponentEntry } from "../../catalog/src/index";

/** Editor input: a single input/batch, an array, or JSONL. Never execute code. */
export function parseLibrarySource(text: string): UiBatch[] {
  const records = parseMessages(text);
  const wrapped = records.some((record) => "protocol" in record);
  if (wrapped) return records.map((record) => batchSchema.parse(record));
  return records.map((record, index) => ({
    protocol: EMBED_PROTOCOL,
    runId: "run_001",
    batchId: `batch_${index + 1}`,
    firstSequence: index + 1,
    inputs: [inputSchema.parse(record)],
  }));
}

/** The scenario generator owns these exact /view and /ready updates. */
export function scenarioInputs(
  entry: ComponentEntry,
  messages: Message[],
  renderPolicy: "progressive" | "on_complete" | "live",
): UiInput[] {
  return messages.map((message, index) => {
    if (index === 0 && message.createSurface) {
      const body = message.createSurface as {
        surfaceId: string;
        dataModel: { view: Record<string, Json>; ready: boolean };
      };
      return {
        type: "template.create",
        id: body.surfaceId,
        template: entry.key,
        templateVersion: entry.version,
        data: body.dataModel.view,
        lifecycle: { renderPolicy, ready: body.dataModel.ready },
      };
    }
    const update = message.updateDataModel as
      { surfaceId: string; path: string; value: Json } | undefined;
    if (update?.path === "/ready" && typeof update.value === "boolean")
      return {
        type: "template.patch",
        id: update.surfaceId,
        patch: {},
        ready: update.value,
      };
    if (update?.path === "/view")
      return {
        type: "template.patch",
        id: update.surfaceId,
        patch: update.value as Record<string, Json>,
      };
    if (update?.path.startsWith("/view/")) {
      const parts = update.path
        .slice(6)
        .split("/")
        .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
      // Adapter patches are shallow: scenario nested paths currently target one field.
      if (parts.length === 1)
        return {
          type: "template.patch",
          id: update.surfaceId,
          patch: { [parts[0]]: update.value },
        };
    }
    return { type: "a2ui", messages: [message] };
  });
}
