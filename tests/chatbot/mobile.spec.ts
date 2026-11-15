import { test, expect } from "@playwright/test";

test("both mobile applications keep approval controls and horizontally scrolled risk cells usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const port of [5180, 5181]) {
    await page.goto(`http://localhost:${port}`);
    await page.getByRole("button", { name: /查看报销单/ }).click();
    const host = page.frameLocator('iframe[title="Agent UI"]');
    const expense =
      port === 5180
        ? page
        : host.frameLocator('iframe[title="Expense Approval Sandbox"]');
    await expense.getByRole("textbox", { name: "审批意见" }).fill("手机端审批");
    await expense.getByRole("button", { name: "批准", exact: true }).click();
    await expect(
      expense.getByText("已批准", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: /查看区域风险/ }).click();
    const risk =
      port === 5180
        ? page
        : host.frameLocator('iframe[title="Risk Heatmap Sandbox"]');
    const cell = risk.getByRole(port === 5180 ? "button" : "gridcell", {
      name: `Singapore ${port === 5180 ? "运营" : "操作"} 29`,
    });
    if (port === 5181) {
      await page
        .locator('iframe[title="Agent UI"]')
        .evaluate((node) => node.scrollIntoView({ block: "end" }));
      await risk.getByRole("grid").evaluate((node) => {
        node.scrollLeft = node.scrollWidth;
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
    }
    await cell.click();
    const detail =
      port === 5180
        ? page.locator(".detail")
        : risk.getByText("Singapore: Agent risk detail", { exact: true });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("Singapore: Agent risk detail");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(375);
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
});
