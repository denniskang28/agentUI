import { test, expect } from "@playwright/test";
test("MCP App uses real HTTP tools, opaque frame, host context and cleanup", async ({
  page,
  request,
}) => {
  const servers = await request.get("/api/v1/mcp/servers");
  test.skip(
    !(await servers.json()).some(
      (s: { id: string }) => s.id === "expense-demo",
    ),
    "Start pnpm mcp:dev",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "MCP Apps", exact: true }).click();
  await page
    .getByRole("combobox", { name: "服务器", exact: true })
    .selectOption("expense-demo");
  await page.getByRole("button", { name: "连接", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "工具", exact: true }),
  ).toContainText("expense_dashboard");
  await expect(
    page.getByRole("combobox", { name: "工具", exact: true }),
  ).not.toContainText("approve_expense");
  await page.getByRole("button", { name: "调用并展示" }).click();
  const proxy = page.frameLocator('iframe[title="MCP App"]');
  const app = proxy.frameLocator('iframe[title="MCP App View"]');
  await expect(app.locator("#approval-status")).toContainText("pending");
  await expect(app.locator("#delivery-order")).toHaveText("input,result");
  const beforeHeight = await page
    .locator('iframe[title="MCP App"]')
    .evaluate((e) => e.clientHeight);
  await app.getByRole("button", { name: "Expand details" }).click();
  await expect
    .poll(() =>
      page.locator('iframe[title="MCP App"]').evaluate((e) => e.clientHeight),
    )
    .toBeGreaterThan(beforeHeight);
  await app.getByRole("button", { name: "Update context" }).click();
  await expect(
    page.getByText("Selected expense EXP-001", { exact: false }),
  ).toBeAttached();
  await app.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(app.locator("#approval-status")).toContainText("approved");
  await app.getByRole("button", { name: "Send summary" }).click();
  await expect(
    page.getByText("Approval reviewed", { exact: false }),
  ).toBeAttached();
  const isolated = await app.locator("body").evaluate(() => {
    try {
      return { opaque: location.origin, parentReadable: !!parent.document };
    } catch {
      return { opaque: location.origin, parentReadable: false };
    }
  });
  expect(isolated.parentReadable).toBe(false);
  await page.getByRole("button", { name: "选择语言", exact: true }).click();
  await expect(app.locator("#host-context")).toContainText("en-US");
  await page.getByRole("button", { name: "Toggle app theme" }).click();
  await expect(app.locator("#host-context")).toContainText("dark");
  await page.screenshot({
    path: ".private/evidence/mcp-apps/playground-approved.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close app", exact: true }).click();
  await expect(page.locator('iframe[title="MCP App"]')).toHaveCount(0);
});

test("official unmodified quickstart updates real DOM through AppBridge", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "MCP Apps", exact: true }).click();
  await page
    .getByRole("combobox", { name: "服务器", exact: true })
    .selectOption("official-time");
  await page.getByRole("button", { name: "连接", exact: true }).click();
  await page.getByRole("button", { name: "调用并展示" }).click();
  const app = page
    .frameLocator('iframe[title="MCP App"]')
    .frameLocator('iframe[title="MCP App View"]');
  await expect(app.locator("#server-time")).toContainText(/\d{4}-\d{2}-\d{2}T/);
  const first = await app.locator("#server-time").textContent();
  await app.getByRole("button", { name: "Get Server Time" }).click();
  await expect(app.locator("#server-time")).not.toHaveText(first!);
  await page.screenshot({
    path: ".private/evidence/mcp-apps/official-time.png",
    fullPage: true,
  });
});

test("plain tool, JSON errors, cancellation and restart keep channels separate", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "MCP Apps", exact: true }).click();
  await page
    .getByRole("combobox", { name: "服务器", exact: true })
    .selectOption("expense-demo");
  await page.getByRole("button", { name: "连接", exact: true }).click();
  await page
    .getByRole("combobox", { name: "工具", exact: true })
    .selectOption("plain_text");
  await page.getByRole("button", { name: "调用并展示" }).click();
  await expect(
    page.getByText("Plain MCP result", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('iframe[title="MCP App"]')).toBeHidden();
  await page.getByRole("textbox", { name: "工具参数 JSON" }).fill("{");
  await page.getByRole("button", { name: "调用并展示" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByRole("textbox", { name: "工具参数 JSON" })
    .fill('{"delayMs":3000}');
  await page
    .getByRole("combobox", { name: "工具", exact: true })
    .selectOption("expense_dashboard");
  await page.getByRole("button", { name: "调用并展示" }).click();
  await page.getByRole("button", { name: "取消调用" }).click();
  const app = page
    .frameLocator('iframe[title="MCP App"]')
    .frameLocator('iframe[title="MCP App View"]');
  await expect(app.locator("body")).toContainText("Cancelled");
  await page.getByRole("button", { name: "关闭应用" }).click();
  await expect(page.locator('iframe[title="MCP App"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Playground", exact: true }).click();
  await expect(page.locator('iframe[title="Preview Host"]')).toHaveCount(1);
});

for (const tool of ["invalid_mime", "uninitialized_view"])
  test(`UI failure ${tool} retains actual text and cleans up`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "MCP Apps", exact: true }).click();
    await page
      .getByRole("combobox", { name: "服务器", exact: true })
      .selectOption("negative-fixtures");
    await page.getByRole("button", { name: "连接", exact: true }).click();
    await page
      .getByRole("combobox", { name: "工具", exact: true })
      .selectOption(tool);
    await page.getByRole("button", { name: "调用并展示" }).click();
    await expect(page.getByRole("alert").first()).toContainText(
      tool === "invalid_mime" ? "HTML resource" : "APP_INITIALIZE_TIMEOUT",
      { timeout: 15000 },
    );
    await expect(
      page.getByText(`Text retained: ${tool}`, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "关闭应用" }).click();
    await expect(page.locator('iframe[title="MCP App"]')).toHaveCount(0);
  });
