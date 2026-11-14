import { test, expect } from "@playwright/test";
test("the complete checked-in guides switch language while component documentation and code remain intact", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "API & Docs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "启动本地服务" }),
  ).toBeVisible();
  await expect(page.locator(".docs-article")).toContainText(
    "bash examples/agent.sh action",
  );
  await page.getByRole("button", { name: "API 参考", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "SSE 与 Action 轮询" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "选择语言" }).click();
  await expect(
    page.getByRole("heading", { name: "SSE and Action polling" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Plugin development", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Native and Sandbox" }),
  ).toBeVisible();
  await expect(page.locator(".docs-article")).toContainText("useHostLocale()");
  await page
    .getByRole("button", { name: "Component reference", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Text", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".docs-article")).toContainText('"@path"');
});
