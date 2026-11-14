import { describe, it, expect } from "vitest";
import {
  parseMessages,
  validateMessages,
  createMessage,
  patchMessage,
  MessageParseError,
} from "../../packages/protocol/src/index";
import {
  builtins,
  instantiate,
  recoverTemplateValues,
} from "../../packages/catalog/src/index";
describe("official protocol integration", () => {
  it("maps an exact template response back to form values without accepting a different tree or Surface", () => {
    for (const entry of builtins) {
      const { messages } = instantiate(entry);
      expect(recoverTemplateValues(entry, messages, "full"), entry.key).toEqual(
        entry.defaults,
      );
      expect(
        recoverTemplateValues(
          entry,
          [
            ...messages,
            createMessage(
              "extra",
              [{ id: "root", component: "Text", text: "Keep this" }],
              {},
            ),
          ],
          "full",
        ),
      ).toBeNull();
    }
    const { messages } = instantiate(builtins[0]);
    const edited = structuredClone(messages);
    (
      edited[0].createSurface as { dataModel: { view: { text: string } } }
    ).dataModel.view.text = "User-entered 中文 😀";
    expect(recoverTemplateValues(builtins[0], edited, "full")?.text).toBe(
      "User-entered 中文 😀",
    );
  });
  it("recovers multi-message template values only when every stream step is preserved", () => {
    const entry = {
      ...builtins[2],
      defaults: {
        ...builtins[2].defaults,
        rows: [
          { label: "one", market: 10 },
          { label: "two", market: 20 },
          { label: "three", market: 30 },
          { label: "four", market: 40 },
        ],
      },
    };
    for (const template of ["progressive", "streaming", "on_complete"]) {
      const { messages } = instantiate(entry, entry.defaults, template);
      expect(recoverTemplateValues(entry, messages, template)).toEqual(
        entry.defaults,
      );
      expect(
        recoverTemplateValues(entry, messages.slice(0, 2), template),
      ).toBeNull();
    }
  });
  it("all gallery templates validate using the installed official processor", () => {
    for (const entry of builtins)
      expect(validateMessages(instantiate(entry).messages), entry.key).toEqual({
        valid: true,
        errors: [],
      });
  });
  it("supports JSON, arrays and JSONL without changing payload", () => {
    const messages = [
      createMessage(
        "s",
        [{ id: "root", component: "Text", text: { "@path": "/message" } }],
        { message: "原始 content" },
      ),
      patchMessage("s", "next", "/message"),
    ];
    expect(parseMessages(JSON.stringify(messages))).toEqual(messages);
    expect(
      parseMessages(messages.map((m) => JSON.stringify(m)).join("\n")),
    ).toEqual(messages);
    expect(parseMessages(JSON.stringify(messages[0]))).toEqual([messages[0]]);
  });
  it("reports original JSONL line numbers including blank lines", () => {
    expect(() => parseMessages('{"version":"1.0"}\n\n{"broken":')).toThrow(
      "JSONL_SYNTAX at line 3",
    );
  });
  it("locates pretty JSON and JSONL syntax errors without depending on UI locale", () => {
    for (const [source, code, line] of [
      ['{\n  "version": "1.0",\n  "createSurface": @\n}', "JSON_SYNTAX", 3],
      ['{\n "nested": [\n {}\n ],\n "invalid": @\n}', "JSON_SYNTAX", 5],
      ['{"version":"1.0"}\r\n\r\n{"broken":@}', "JSONL_SYNTAX", 3],
    ] as const) {
      try {
        parseMessages(source);
        throw Error("Expected a parse error");
      } catch (error) {
        expect(error).toBeInstanceOf(MessageParseError);
        const diagnostic = error as MessageParseError;
        expect(diagnostic.code).toBe(code);
        expect(diagnostic.line).toBe(line);
        expect(source[diagnostic.offset]).toBe("@");
      }
    }
    expect(() =>
      parseMessages(JSON.stringify([{ content: "中".repeat(700000) }])),
    ).toThrow("MESSAGE_TOO_LARGE");
  });
  it("rejects obsolete wire format, schema errors and unknown surfaces", () => {
    expect(
      validateMessages([{ surfaceUpdate: { surfaceId: "s" } }]).valid,
    ).toBe(false);
    expect(
      validateMessages([
        { version: "1.0", createSurface: { surfaceId: "s", extra: true } },
      ]).valid,
    ).toBe(false);
    expect(validateMessages([patchMessage("missing", 42)]).valid).toBe(false);
  });
  it("supports multi-surface creation, update and deletion through official state", () => {
    const messages = [
      createMessage("a", [{ id: "root", component: "Text", text: "A" }], {}),
      createMessage("b", [{ id: "root", component: "Text", text: "B" }], {}),
      patchMessage("a", { label: "new" }),
      { version: "1.0", deleteSurface: { surfaceId: "b" } },
    ];
    expect(validateMessages(messages).valid).toBe(true);
  });
  it("distinguishes complete data arrival from explicit ready event", () => {
    const entry = { ...builtins[2], templates: ["on_complete"] };
    const { messages, renderPolicy } = instantiate(
      entry,
      entry.defaults,
      "on_complete",
    );
    expect(renderPolicy).toBe("on_complete");
    expect(messages).toHaveLength(3);
    expect(messages[1]).toEqual(patchMessage("main", entry.defaults, "/view"));
    expect(messages[2]).toEqual(patchMessage("main", true, "/ready"));
    expect(validateMessages(messages).valid).toBe(true);
  });
});
