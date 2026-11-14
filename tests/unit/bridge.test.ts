import { it, expect } from "vitest";
import {
  isJsonEnvelope,
  isPluginAction,
} from "../../packages/protocol/src/bridge";
import { pointer } from "../../packages/protocol/src/index";
it("bridge rejects structured-clone cycles, BigInt, arrays and oversized messages without throwing", () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (const value of [
    null,
    [],
    42,
    cycle,
    { big: 1n },
    { large: "x".repeat(200) },
  ])
    expect(isJsonEnvelope(value, 100)).toBe(false);
  expect(isJsonEnvelope({ type: "ready" }, 100)).toBe(true);
});
it("plugin Actions must be declared, small and object-shaped", () => {
  expect(
    isPluginAction({ name: "allowed", context: { value: 1 } }, ["allowed"]),
  ).toBe(true);
  for (const value of [
    { name: "other", context: {} },
    { name: "allowed", context: [] },
    { name: "allowed", context: null },
    { name: "allowed", context: { payload: "x".repeat(70000) } },
  ])
    expect(isPluginAction(value, ["allowed"])).toBe(false);
});
it("platform JSON Pointer never follows inherited properties and correctly unescapes keys", () => {
  expect(pointer({}, "/constructor/prototype")).toBeUndefined();
  expect(pointer({ "a/b": { "~key": 4 } }, "/a~1b/~0key")).toBe(4);
});
