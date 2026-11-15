import { test, expect } from "@playwright/test";
import { builtins } from "../../packages/catalog/src/index";

test("each component seeds its own custom response and keeps template JSON independent", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "A2UI JSON", exact: true });
  // Opening CapabilityProfile first used to seed every subsequent component.
  for (const entry of [
    ...builtins.filter((entry) => entry.component === "CapabilityProfile"),
    ...builtins.filter((entry) => entry.component !== "CapabilityProfile"),
  ]) {
    await page.getByRole("button", { name: entry.name, exact: true }).click();
    await page.getByRole("button", { name: "JSON", exact: true }).click();
    const template = JSON.parse(await editor.inputValue());
    expect(template[0].createSurface.components[0].component).toBe(
      entry.component,
    );
    const validation = await request.post("/api/v1/messages/validate", {
      data: { messages: template },
    });
    expect((await validation.json()).valid, entry.name).toBe(true);
    await page.getByRole("button", { name: "自定义响应", exact: true }).click();
    expect(JSON.parse(await editor.inputValue())).toEqual(template);
  }
});

test("edited and deliberately empty custom drafts survive component switches without replacing templates", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "A2UI JSON", exact: true });
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  const custom = JSON.parse(await editor.inputValue());
  custom[0].createSurface.dataModel.view.text = "Text custom draft";
  const raw = JSON.stringify(custom, null, 2);
  await editor.fill(raw);
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  await editor.fill("");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  await expect(editor).toHaveValue(raw);
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await expect(
    page
      .frameLocator('iframe[title="Preview Host"]')
      .getByText("Text custom draft", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "组件模板", exact: true }).click();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  expect(
    JSON.parse(await editor.inputValue())[0].createSurface.dataModel.view.text,
  ).not.toBe("Text custom draft");
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  await expect(editor).toHaveValue("");
});

test("clicking the active scenario preserves JSON and restoring examples clears scenario overrides", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "CapabilityProfile", exact: true })
    .click();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  await page.getByRole("radio", { name: /渐进加载/ }).click();
  const editor = page.getByRole("textbox", { name: "A2UI JSON", exact: true });
  const initial = await editor.inputValue();
  const changed = JSON.parse(initial);
  changed[0].createSurface.dataModel.view.title = "Edited progressive profile";
  const raw = JSON.stringify(changed, null, 2);
  await editor.fill(raw);
  await page.getByRole("radio", { name: /渐进加载/ }).click();
  await expect(editor).toHaveValue(raw);
  await page.getByRole("radio", { name: /完整数据展示/ }).click();
  await page.getByRole("radio", { name: /渐进加载/ }).click();
  await expect(editor).toHaveValue(raw);
  await page.getByRole("button", { name: "恢复示例", exact: true }).click();
  await page.getByRole("radio", { name: /渐进加载/ }).click();
  await expect(editor).toHaveValue(initial);
});
