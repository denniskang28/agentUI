import { describe, expect, it } from "vitest";
import { MessageProcessor } from "@a2ui/web_core/v1_0";
import {
  basicCatalog,
  createMessage,
  patchMessage,
  validateMessages,
} from "../../packages/protocol/src/index";
import {
  fallbackCatalog,
  fallbackCatalogId,
  processWithFallback,
} from "../../packages/protocol/src/fallback";

describe("unknown component rendering adapter", () => {
  it("validation never mutates the stored initial snapshot when checking later data patches", () => {
    const history = [
      createMessage(
        "main",
        [{ id: "root", component: "Text", text: { "@path": "/value" } }],
        { value: "initial" },
      ),
    ];
    const before = structuredClone(history);
    expect(
      validateMessages([patchMessage("main", "later", "/value")], history)
        .valid,
    ).toBe(true);
    expect(history).toEqual(before);
  });
  it("keeps raw messages intact and applies later known replacements through official state", () => {
    const processor = new MessageProcessor(
      [basicCatalog, fallbackCatalog],
      undefined,
      { version: "1.0", reportErrorsOnly: true },
    );
    try {
      const source = [
        createMessage(
          "main",
          [
            { id: "root", component: "Column", children: ["known", "unknown"] },
            { id: "known", component: "Text", text: { "@path": "/value" } },
            {
              id: "unknown",
              component: "FutureCard",
              nested: { business: "untouched" },
            },
          ],
          { value: "before" },
        ),
        patchMessage("main", "after", "/value"),
      ];
      const original = structuredClone(source);
      expect(processWithFallback(processor, source)).toEqual([]);
      expect(source).toEqual(original);
      const surface = processor.getSurface("main")!;
      expect(surface.dataModel.get("/value")).toBe("after");
      const unknown = surface.componentsModel.get("unknown")!;
      expect(unknown.type).toBe("UnsupportedComponent");
      expect(unknown.catalog.id).toBe(fallbackCatalogId);
      expect(unknown.properties.originalType).toBe("FutureCard");
      expect(
        processWithFallback(processor, [
          {
            version: "1.0",
            updateComponents: {
              surfaceId: "main",
              components: [
                { id: "unknown", component: "Text", text: "Recovered" },
              ],
            },
          },
        ]),
      ).toEqual([]);
      expect(surface.componentsModel.get("unknown")!.type).toBe("Text");
    } finally {
      processor.dispose();
    }
  });

  it("does not hide known schema violations, invalid identifiers or missing catalogs", () => {
    for (const component of [
      { id: "root", component: "Text", text: 42 },
      { id: "bad id", component: "FutureCard" },
      { id: "root", component: "FutureCard", catalogId: "urn:missing:catalog" },
    ]) {
      const processor = new MessageProcessor(
        [basicCatalog, fallbackCatalog],
        undefined,
        { version: "1.0", reportErrorsOnly: true },
      );
      try {
        expect(
          processWithFallback(processor, [
            createMessage("main", [component], {}),
          ]).length,
        ).toBeGreaterThan(0);
      } finally {
        processor.dispose();
      }
    }
  });
  it("does not invent a default catalog on a v1.0 Surface that declares none", () => {
    const processor = new MessageProcessor(
      [basicCatalog, fallbackCatalog],
      undefined,
      { version: "1.0", reportErrorsOnly: true },
    );
    try {
      expect(
        processWithFallback(processor, [
          {
            version: "1.0",
            createSurface: {
              surfaceId: "noDefault",
              components: [{ id: "root", component: "FutureCard" }],
            },
          },
        ]).length,
      ).toBeGreaterThan(0);
    } finally {
      processor.dispose();
    }
  });
});
