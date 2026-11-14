import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createMessage, patchMessage } from "../../packages/protocol/src/index";

test.describe("browser language and explicit preference", () => {
  test.use({ locale: "en-GB" });
  test("English browser initializes English and an explicit Chinese preference survives reload", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(
      page.getByRole("button", { name: "Render", exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Select language" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(
      page.getByRole("button", { name: "渲染", exact: true }).first(),
    ).toBeVisible();
  });
});

test("a JSONL import reports the original error position in both languages and can recover to actual rendering", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  const messages = [
    createMessage(
      "imported",
      [{ id: "root", component: "Text", text: { "@path": "/text" } }],
      { text: "Agent 业务原文" },
    ),
    patchMessage("imported", "Updated 业务原文", "/text"),
  ];
  const good = messages.map((message) => JSON.stringify(message)).join("\n\n");
  const bad = JSON.stringify(messages[0]) + '\n\n{"broken":@}';
  await page.locator('input[type=file][accept=".json,.jsonl"]').setInputFiles({
    name: "messages.jsonl",
    mimeType: "application/json",
    buffer: Buffer.from(bad),
  });
  const editor = page.getByRole("textbox", { name: "A2UI JSON" });
  await expect(editor).toHaveValue(bad);
  await page.getByRole("button", { name: "校验", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "JSONL 第 3 行、第 11 列语法错误",
  );
  await page.getByRole("button", { name: "选择语言" }).click();
  await expect(editor).toHaveValue(bad);
  await expect(page.getByRole("alert")).toContainText(
    "JSONL syntax error at line 3, column 11",
  );
  await page.getByRole("button", { name: "Go to line 3, column 11" }).click();
  await expect(editor).toBeFocused();
  expect(
    await editor.evaluate(
      (element: HTMLTextAreaElement) => element.value[element.selectionStart],
    ),
  ).toBe("@");
  await page.locator('input[type=file][accept=".json,.jsonl"]').setInputFiles({
    name: "messages.jsonl",
    mimeType: "application/json",
    buffer: Buffer.from(good),
  });
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Render", exact: true })
    .first()
    .click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await expect(host.getByText("Agent 业务原文")).toBeVisible();
  await expect(host.getByText("Updated 业务原文")).toBeVisible();
  await expect(editor).toHaveValue(good);
  await page.getByRole("button", { name: "Copy integration code" }).click();
  await page.getByRole("button", { name: "A2UI JSON", exact: true }).click();
  const copied = await page.getByRole("dialog").locator("pre").textContent();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Select language" }).click();
  await page.getByRole("button", { name: "复制接入代码" }).click();
  await expect(page.getByRole("dialog").locator("pre")).toHaveText(copied!);
  expect(JSON.parse(copied!)).toEqual(messages);
});

test("language switches retain a paused stream, JSON draft, focused editor, plugin selection and Action history", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/v1/plugins", {
    multipart: {
      file: {
        name: "finance-risk-heatmap.zip",
        mimeType: "application/zip",
        buffer: await readFile("examples/dist/finance-risk-heatmap.zip"),
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await page.goto("/");
  await page
    .locator(".component-item")
    .filter({ hasText: "Risk Heatmap" })
    .click();
  await page.getByRole("radio", { name: /渐进加载/ }).click();
  await page.getByRole("button", { name: "平台运行配置", exact: true }).click();
  await page.getByLabel("处理方式", { exact: true }).selectOption("external");
  await page.getByLabel("间隔", { exact: true }).fill("300");
  await page.getByRole("button", { name: "渲染并播放", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const sandbox = page
    .frameLocator('iframe[title="Preview Host"]')
    .frameLocator('iframe[title="Risk Heatmap Sandbox"]');
  await sandbox.getByRole("gridcell", { name: "Japan 信用 42" }).click();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "A2UI JSON" });
  const draft = (await editor.inputValue()) + "\n ";
  await editor.fill(draft);
  await page.getByRole("button", { name: "选择语言" }).click();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue(draft);
  await expect(page.locator(".runtime-status")).toContainText("Paused");
  await expect(
    sandbox.getByRole("gridcell", { name: "Japan Credit 42" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.waitForTimeout(750);
  await expect(page.locator(".runtime-status")).toContainText("1/3 messages");
  await page.getByRole("button", { name: "Form", exact: true }).click();
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(page.locator(".runtime-status")).toContainText("2/3 messages");
  await expect(
    sandbox.getByRole("gridcell", { name: "Japan Credit 42" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.locator(".runtime-status")).toContainText("3/3 messages");
  await expect(
    sandbox.getByRole("gridcell", { name: "Singapore Market 86" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inspector" }).click();
  await page.getByRole("button", { name: "Actions 1", exact: true }).click();
  const actions = JSON.parse(await page.locator(".inspector pre").innerText());
  expect(actions).toHaveLength(1);
  expect(actions[0].action.context.region).toBe("Japan");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  await expect(editor).toHaveValue(draft);
});
