import { test, expect } from "@playwright/test";
import { builtins } from "../../packages/catalog/src/index";

test("every Gallery builtin applies its declared container and text appearance to the real root", async ({
  page,
}) => {
  await page.goto("/");
  const host = page.frameLocator('iframe[title="Preview Host"]');
  for (const entry of builtins) {
    expect(entry.appearance).toContain("padding");
    expect(entry.appearance).toContain("fontSize");
    await page.getByRole("button", { name: entry.name, exact: true }).click();
    await page.getByRole("button", { name: "外观", exact: true }).click();
    await page
      .getByRole("combobox", { name: "配置节点" })
      .selectOption(JSON.stringify(["main", "root"]));
    await page.getByLabel("字号", { exact: true }).fill("22");
    await page.getByLabel("内边距", { exact: true }).fill("19");
    await page
      .getByRole("button", { name: "渲染", exact: true })
      .first()
      .click();
    const root = host
      .locator('[data-agent-ui-node="root"] > :not(style)')
      .first();
    await expect(root, entry.name).toHaveCSS("padding", "19px");
    await expect(root, entry.name).toHaveCSS("font-size", "22px");
  }
});

test("template appearance updates genuine Text and inheritance resets without replay", async ({
  page,
}) => {
  await page.goto("/");
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const text = host.locator(".a2-text");
  await expect(text).toBeVisible();
  await page.getByRole("button", { name: "外观", exact: true }).click();
  await page.getByLabel("字号", { exact: true }).fill("24");
  await expect(text).toHaveCSS("font-size", "24px");
  await expect
    .poll(() =>
      text.evaluate(
        (node) => node.getBoundingClientRect().bottom <= innerHeight,
      ),
    )
    .toBe(true);
  await page
    .getByRole("combobox", { name: "文字颜色 语义颜色" })
    .selectOption("danger");
  await expect(text).toHaveCSS("color", "rgb(210, 63, 63)");
  await page
    .getByRole("button", { name: "恢复继承 字号", exact: true })
    .click();
  await expect(text).toHaveCSS("font-size", "15px");
  await page.getByRole("button", { name: "复制接入代码", exact: true }).click();
  await page
    .getByRole("button", { name: "Library Inputs", exact: true })
    .click();
  const exported = JSON.parse(
    await page.locator(".copy-dialog pre").innerText(),
  );
  expect(exported.batches[0].inputs[0].type).toBe("template.create");
  expect(exported.config.componentAppearances.main.root.color).toBe("danger");
});

test("appearance and theme preserve input element identity and value", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "TextField", exact: true }).click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  const input = host.getByRole("textbox", { name: "联系人邮箱" });
  await input.fill("state@example.com");
  await input.evaluate((node) => {
    node.setAttribute("data-test-identity", "original");
  });
  await page.getByRole("button", { name: "外观", exact: true }).click();
  await page.getByLabel("内边距", { exact: true }).fill("20");
  await expect(host.locator(".a2-field")).toHaveCSS("padding", "20px");
  await page.getByRole("button", { name: "预览主题配置", exact: true }).click();
  await page.locator("#appearance-theme-fontFamily").selectOption("mono");
  await page.locator("#appearance-theme-fontSize").fill("18");
  await expect(input).toHaveCSS("font-size", "18px");
  await expect(input).toHaveAttribute("data-test-identity", "original");
  await expect(input).toHaveValue("state@example.com");
  await page.getByRole("button", { name: "切换预览主题" }).click();
  await expect(input).toHaveValue("state@example.com");
});

test("appearance fields control actual DOM typography, colors, borders and spacing", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await page.getByRole("button", { name: "外观", exact: true }).click();
  await page.getByLabel("字体", { exact: true }).selectOption("mono");
  await page.getByLabel("文字层级", { exact: true }).selectOption("title");
  await page.getByLabel("字号", { exact: true }).fill("24");
  await page.getByLabel("字重", { exact: true }).selectOption("700");
  await page.getByLabel("行高", { exact: true }).fill("1.8");
  await page.getByLabel("文字对齐", { exact: true }).selectOption("center");
  for (const [key, value] of [
    ["color", "#123456"],
    ["backgroundColor", "#fedcba"],
    ["borderColor", "#654321"],
  ]) {
    await page.locator(`#appearance-node-${key}`).selectOption("custom");
    await page.locator(`#appearance-node-${key}-picker`).fill(value);
  }
  for (const [label, value] of [
    ["边框宽度", "2"],
    ["圆角", "8"],
    ["内边距", "12"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  const text = page
    .frameLocator('iframe[title="Preview Host"]')
    .locator(".a2-text");
  await expect(text).toHaveCSS("font-weight", "700");
  await expect(text).toHaveCSS("line-height", "43.2px");
  await expect(text).toHaveCSS("font-family", /monospace/);
  await expect(text).toHaveCSS("color", "rgb(18, 52, 86)");
  await expect(text).toHaveCSS("background-color", "rgb(254, 220, 186)");
  await expect(text).toHaveCSS("border", "2px solid rgb(101, 67, 33)");
  await expect(text).toHaveCSS("border-radius", "8px");
  await expect(text).toHaveCSS("padding", "12px");
  await expect(text).toHaveCSS("text-align", "center");
  await page.getByRole("button", { name: "Row", exact: true }).click();
  await page.getByLabel("间距", { exact: true }).fill("32");
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await expect(
    page.frameLocator('iframe[title="Preview Host"]').locator(".a2-row"),
  ).toHaveCSS("gap", "32px");
});

test("composite node appearance and component drafts remain independent", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByRole("button", { name: "外观", exact: true }).click();
  await page
    .getByRole("combobox", { name: "配置节点" })
    .selectOption(JSON.stringify(["main", "title"]));
  await page.getByLabel("字号", { exact: true }).fill("28");
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await expect(host.getByText("Q4 风险摘要")).toHaveCSS("font-size", "28px");
  await expect(
    host.getByText("7 个区域中 2 个处于高风险，主要来自市场风险。"),
  ).toHaveCSS("font-size", "15px");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await expect(page.getByLabel("字号", { exact: true })).toHaveValue("28");
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await expect(host.getByText("Q4 风险摘要")).toHaveCSS("font-size", "28px");
});

test("exports select the actual preview or draft and downloads contain executable text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await expect(
    page.frameLocator('iframe[title="Preview Host"]').locator(".a2-text"),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "文本", exact: true })
    .fill("New draft only");
  await page.getByRole("button", { name: "复制接入代码", exact: true }).click();
  await page
    .getByRole("button", { name: "Library Inputs", exact: true })
    .click();
  const pre = page.locator(".copy-dialog pre");
  expect(JSON.parse(await pre.innerText()).batches[0].inputs[0].data.text).toBe(
    "New draft only",
  );
  await page.locator(".copy-dialog select").selectOption("preview");
  expect(
    JSON.parse(await pre.innerText()).batches[0].inputs[0].data.text,
  ).not.toBe("New draft only");
  await page.getByRole("button", { name: "Library Node", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载代码", exact: true }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("server.ts");
  const stream = await file.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += String(chunk);
  expect(content).toBe(await pre.innerText());
  expect(content.startsWith("import ")).toBe(true);
});
