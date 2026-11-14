import { test, expect } from "@playwright/test";
test("official Core + React renders a template and updates a bound input", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await expect(
    host.getByText(
      "本季度整体风险可控，亚太市场风险上升，建议关注新加坡敞口。",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "TextField", exact: true }).click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const input = host.getByRole("textbox", { name: "联系人邮箱" });
  await input.fill("agent@example.com");
  await expect(input).toHaveValue("agent@example.com");
  await page.getByRole("button", { name: "选择语言" }).click();
  await expect(input).toHaveValue("agent@example.com");
  await expect(
    page.getByRole("button", { name: "Render", exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("Card/Row, enterprise table and chart use actual surface DOM", async ({
  page,
}) => {
  await page.goto("/");
  const host = page.frameLocator('iframe[title="Preview Host"]');
  for (const name of ["Card", "Row", "KPI", "DataTable", "Chart"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("button", { name: "渲染", exact: true })
      .first()
      .click();
    if (name === "Card")
      await expect(host.getByText("Q4 风险摘要")).toBeVisible();
    if (name === "Row") await expect(host.getByText("子组件 3")).toBeVisible();
    if (name === "KPI") await expect(host.getByText("¥ 4.82 亿")).toBeVisible();
    if (name === "DataTable")
      await expect(host.getByRole("table")).toBeVisible();
    if (name === "Chart") await expect(host.getByRole("img")).toBeVisible();
  }
});
test("actual button dispatch reaches Action inspector", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Button", exact: true }).click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await page
    .frameLocator('iframe[title="Preview Host"]')
    .getByRole("button", { name: "生成报告" })
    .click();
  await page.getByRole("button", { name: "调试面板" }).click();
  await page.getByRole("button", { name: "操作 1", exact: true }).click();
  await expect(page.locator(".inspector pre")).toContainText("report.generate");
  await expect(page.locator(".inspector pre")).toContainText(
    "sourceComponentId",
  );
});
test("form/JSON viewing does not mark draft dirty; language persists", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  await expect(page.locator(".dirty")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "A2UI JSON" })).toContainText(
    "createSurface",
  );
  await page.getByRole("button", { name: "选择语言" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(
    page.getByRole("button", { name: "Render", exact: true }).first(),
  ).toBeVisible();
});
test("enterprise table sorting and row selection dispatch a real Action; chart clicks dispatch a data point", async ({
  page,
}) => {
  await page.goto("/");
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await page.getByRole("button", { name: "DataTable", exact: true }).click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await host.getByRole("button", { name: /负责人/ }).click();
  await expect(host.locator("tbody tr").first()).toContainText("Chen");
  await host.locator("tbody tr").first().click();
  await page.getByRole("button", { name: "调试面板" }).click();
  await page.getByRole("button", { name: "操作 1", exact: true }).click();
  await expect(page.locator(".inspector pre")).toContainText("table.rowClick");
  await expect(page.locator(".inspector pre")).toContainText("复核新加坡敞口");
  await page.getByRole("button", { name: "Chart", exact: true }).click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const chart = host.getByRole("img");
  await expect(chart.locator("canvas")).toBeVisible();
  const box = await chart.boundingBox();
  if (!box) throw Error("Chart has no layout");
  await chart.click({ position: { x: 32 + (box.width - 44) / 6, y: 150 } });
  await page.getByRole("button", { name: "操作 1", exact: true }).click();
  await expect(page.locator(".inspector pre")).toContainText("chart.select");
});
