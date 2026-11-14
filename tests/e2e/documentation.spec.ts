import { test, expect } from "@playwright/test";
test("the complete checked-in guides switch language while component documentation and code remain intact", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "API & Docs", exact: true }).click();
  await page.getByRole("button", { name: "快速开始", exact: true }).click();
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

test("library guides preserve article selection across languages and navigate between complete guides", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "API & Docs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Library 架构与选型", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".docs-table")
      .first()
      .getByRole("columnheader", { name: "层", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "接入步骤", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "第二步：后端增加一个 UI Presenter",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".docs-article")).toContainText(
    "@enterprise/agent-ui/react",
  );
  await page.getByRole("button", { name: "选择语言" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Installation through first render",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Events and retries", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Complete click payload", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".docs-article")).toContainText(
    '"sourceComponentId": "root"',
  );
  await page.locator(".docs-main").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page
    .getByRole("button", { name: "Templates and full A2UI", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Shared batch envelope", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".docs-article")).toContainText(
    '"updateComponents"',
  );
  await expect(page.locator(".docs-article")).toContainText(
    '"templateVersion": "1.0.0"',
  );
  await page
    .getByRole("button", { name: "Migrating an existing chatbot", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Without the library: conventional chatbot",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Packaging and deployment", exact: true })
    .click();
  await expect(page.locator(".docs-article")).toContainText(
    "npm ci --ignore-scripts",
  );
  await expect(page.locator(".docs-article")).toContainText(
    "AGENT_UI_PARENT_ORIGINS",
  );
});

test("long library code and comparison tables scroll inside a narrow reader", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "API & Docs", exact: true }).click();
  await page
    .getByRole("button", { name: "便捷模板与完整 A2UI", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "共同的批次信封", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const code = page.locator(".docs-article pre").first();
  expect(
    await code.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  const table = page.locator(".docs-table").last();
  await table.scrollIntoViewIfNeeded();
  expect(
    await table.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await table.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(await table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(
    0,
  );
});
