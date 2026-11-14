import { test, expect } from "@playwright/test";

test("traditional chatbot performs actual approval and restores the conversation", async ({
  page,
}) => {
  await page.goto("http://localhost:5180");
  await page.getByRole("button", { name: /查看报销单/ }).click();
  await expect(page.getByText("等待完整数据", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "审批意见" }).fill("符合差旅标准");
  await page.getByRole("button", { name: "批准", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已批准");
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("已批准");
  await expect(
    page.getByRole("button", { name: "批准", exact: true }),
  ).toHaveCount(0);
});

for (const mode of ["template", "raw"] as const)
  for (const runtime of ["sandbox", "native"] as const) {
    test(`${mode}/${runtime}: real uploaded approval plugin receives backend result`, async ({
      page,
    }) => {
      await page.goto("http://localhost:5181");
      await expect(page.getByText("已连接", { exact: true })).toBeVisible();
      if (mode === "raw") await page.getByLabel("UI mode").selectOption(mode);
      if (runtime === "native")
        await page.getByLabel("Runtime mode").selectOption(runtime);
      await page.getByRole("button", { name: /查看报销单/ }).click();
      const host = page.frameLocator('iframe[title="Agent UI"]');
      await expect(
        host.getByText("等待完整数据", { exact: true }),
      ).toBeVisible();
      const plugin =
        runtime === "sandbox"
          ? host.frameLocator('iframe[title="Expense Approval Sandbox"]')
          : host;
      await plugin
        .getByRole("textbox", { name: "审批意见" })
        .fill("符合差旅标准");
      await plugin.getByRole("button", { name: "批准", exact: true }).click();
      await expect(
        plugin.getByText("已批准", { exact: true }).first(),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await page.reload();
      const recovered = page
        .frameLocator('iframe[title="Agent UI"]')
        .frameLocator('iframe[title="Expense Approval Sandbox"]');
      await expect(
        recovered.getByText("已批准", { exact: true }).first(),
      ).toBeVisible();
    });
  }

test("raw components and two Surfaces can be added, changed and deleted through real Actions", async ({
  page,
}) => {
  await page.goto("http://localhost:5181");
  await page.getByRole("button", { name: /演示界面组合/ }).click();
  const host = page.frameLocator('iframe[title="Agent UI"]');
  await expect(host.locator("[data-surface]")).toHaveCount(2);
  await host.getByRole("button", { name: /更新界面/ }).click();
  await expect(
    host.getByText("新增组件 / Added component", { exact: true }),
  ).toBeVisible();
  await host.getByRole("button", { name: /移除界面/ }).click();
  await expect(host.locator("[data-surface]")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
