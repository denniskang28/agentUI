import { describe, it, expect } from "vitest";
import { builtins, templateMeta } from "../../packages/catalog/src/index";
import {
  dictionaries,
  initialLocale,
  translate,
  label,
} from "../../packages/i18n/src/index";
describe("locale contract", () => {
  it("both dictionaries have the same keys and non-empty translations", () => {
    expect(Object.keys(dictionaries["en-US"]).sort()).toEqual(
      Object.keys(dictionaries["zh-CN"]).sort(),
    );
    for (const dictionary of Object.values(dictionaries))
      for (const value of Object.values(dictionary))
        expect(value.trim().length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(dictionaries["en-US"])) {
      expect(value, key).not.toMatch(/[\u3400-\u9fff]/);
      expect(
        [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort(),
        key,
      ).toEqual(
        [
          ...dictionaries["zh-CN"][
            key as keyof (typeof dictionaries)["zh-CN"]
          ].matchAll(/\{(\w+)\}/g),
        ]
          .map((match) => match[1])
          .sort(),
      );
    }
    for (const key of [
      ...builtins.flatMap((entry) => [
        entry.description,
        entry.category,
        ...entry.fields.map((field) => field.label),
      ]),
      ...Object.values(templateMeta).flat(),
    ])
      expect(Object.hasOwn(dictionaries["en-US"], key), key).toBe(true);
  });
  it("saved preference overrides browser; unsupported browser falls back to Chinese", () => {
    expect(initialLocale("en-US", "zh-CN")).toBe("en-US");
    expect(initialLocale(null, "en-GB")).toBe("en-US");
    expect(initialLocale(null, "ja-JP")).toBe("zh-CN");
    expect(initialLocale("zh-CN", "en-US")).toBe("zh-CN");
  });
  it("interpolates counts without modifying machine protocol identifiers", () => {
    expect(translate("en-US", "消息计数", { count: 3 })).toBe("3 messages");
    expect(translate("en-US", "消息计数", { count: 1 })).toBe("1 message");
    expect(translate("zh-CN", "消息计数", { count: 3 })).toBe("3 条消息");
    expect(translate("en-US", "JSON")).toBe("JSON");
    expect(label("en-US", "constructor")).toBe("constructor");
    expect(label("en-US", "__proto__")).toBe("__proto__");
  });
});
