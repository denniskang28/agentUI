import { expect, test, vi } from "vitest";
import { browserId } from "../../packages/protocol/src/browser-id";

test("HTTP hosts generate UUIDs without the secure-context randomUUID API", () => {
  const randomValues = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal("crypto", { getRandomValues: randomValues });
  try {
    const ids = Array.from({ length: 100 }, browserId);
    expect(new Set(ids).size).toBe(100);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  } finally {
    vi.unstubAllGlobals();
  }
});
