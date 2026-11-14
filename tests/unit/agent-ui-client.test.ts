import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentUiClient } from "../../packages/agent-ui/src/react";
import {
  AgentUiAdapter,
  createHostManifest,
} from "../../packages/agent-ui/src/server";
import type { NormalizedBatch } from "../../packages/agent-ui/src/protocol";

afterEach(() => vi.useRealTimers());
function batch(): NormalizedBatch {
  const adapter = new AgentUiAdapter("run1");
  const result = adapter.apply({
    protocol: "enterprise-agent-ui/1",
    runId: "run1",
    batchId: "b1",
    firstSequence: 1,
    inputs: [
      {
        type: "template.create",
        id: "card",
        template: "text",
        templateVersion: "0.15.0",
        data: { text: "hello" },
      },
    ],
  });
  adapter.dispose();
  return result;
}
describe("public client MessageChannel lifecycle (transport tests)", () => {
  it("queues until Host handshake, deduplicates acknowledgement and forwards full Actions", async () => {
    const errors = vi.fn(),
      onAction = vi.fn();
    const client = new AgentUiClient("run1", onAction, errors);
    const channel = new MessageChannel();
    const messages: string[] = [];
    channel.port2.onmessage = (event) => {
      messages.push(event.data.type);
      if (event.data.type === "init")
        channel.port2.postMessage({ type: "connected", runId: "run1" });
      if (event.data.type === "batch")
        channel.port2.postMessage({
          type: "applied",
          runId: "run1",
          batchId: "b1",
          lastSequence: 1,
          errors: [],
        });
    };
    client.attach(channel.port1, createHostManifest());
    try {
      const value = batch();
      const [first, repeated] = await Promise.all([
        client.apply(value),
        client.apply({ ...value, replay: true }),
      ]);
      expect(first).toEqual(repeated);
      expect(messages.filter((type) => type === "batch")).toHaveLength(1);
      await expect(
        client.apply({ ...value, messages: [], messageCount: 0 }),
      ).rejects.toThrow("Batch ID reused");
      const action = {
        protocol: "enterprise-agent-ui/1",
        runId: "run1",
        actionId: "act1",
        message: {
          version: "1.0",
          action: {
            name: "test",
            surfaceId: "card",
            sourceComponentId: "root",
            timestamp: new Date().toISOString(),
            context: { nested: { amount: 123 } },
            extension: "preserved",
          },
        },
      };
      const received = new Promise<void>((resolve) =>
        client.subscribe((message) => {
          if (message.type === "action") resolve();
        }),
      );
      channel.port2.postMessage({
        type: "action",
        runId: "run1",
        event: action,
      });
      await received;
      expect(onAction).toHaveBeenCalledWith(action);
      expect(errors).not.toHaveBeenCalled();
    } finally {
      client.dispose();
      channel.port2.close();
    }
  });
  it("rejects stalled initialization and detached pending work, clears timers and refuses reuse", async () => {
    vi.useFakeTimers();
    const errors = vi.fn();
    const client = new AgentUiClient("run1", undefined, errors);
    const first = new MessageChannel();
    client.attach(first.port1, createHostManifest());
    const pending = expect(client.apply(batch())).rejects.toThrow(
      "Host is not connected",
    );
    await vi.advanceTimersByTimeAsync(15001);
    await pending;
    expect(errors.mock.calls[0][0].code).toBe("HOST_CONNECT_TIMEOUT");
    client.detach();
    first.port2.close();
    const second = new MessageChannel();
    client.attach(second.port1, createHostManifest());
    const detached = expect(client.apply(batch())).rejects.toThrow(
      "Host is not connected",
    );
    client.dispose();
    await detached;
    expect(vi.getTimerCount()).toBe(0);
    expect(() => client.attach(second.port1, createHostManifest())).toThrow(
      "Create a new client",
    );
    second.port2.close();
  });
});
