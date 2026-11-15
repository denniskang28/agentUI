import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

test.beforeAll(async ({ request }) => {
  for (const name of ["expense-approval.zip", "finance-risk-heatmap.zip"]) {
    const response = await request.post("/api/v1/plugins", {
      multipart: {
        file: {
          name,
          mimeType: "application/zip",
          buffer: await readFile(`examples/dist/${name}`),
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
});
for (const mode of ["native", "sandbox"] as const)
  for (const plugin of ["Expense Approval", "Risk Heatmap"])
    test(`${plugin} theme reaches ${mode} and retains local input or selection`, async ({
      page,
    }) => {
      await page.goto("/");
      await page.locator(".component-item").filter({ hasText: plugin }).click();
      await page
        .getByRole("button", { name: "渲染", exact: true })
        .first()
        .click();
      if (mode === "native") {
        await page.getByRole("button", { name: "Native", exact: true }).click();
        await page
          .getByRole("button", { name: "确认切换", exact: true })
          .click();
      }
      const host = page.frameLocator('iframe[title="Preview Host"]');
      const content =
        mode === "sandbox"
          ? host.frameLocator(`iframe[title="${plugin} Sandbox"]`)
          : host;
      if (plugin === "Expense Approval")
        await content
          .getByRole("textbox", { name: "审批意见", exact: true })
          .fill("Preserved theme draft");
      else
        await content.getByRole("gridcell", { name: "Japan 信用 42" }).click();
      await page.getByRole("button", { name: "外观", exact: true }).click();
      await expect(page.getByLabel("字号", { exact: true })).toHaveCount(0);
      await page.getByLabel("内边距", { exact: true }).fill("16");
      await expect(host.locator(`[data-plugin]`)).toHaveCSS("padding", "16px");
      await page
        .getByRole("button", { name: "预览主题配置", exact: true })
        .click();
      await page.locator("#appearance-theme-fontFamily").selectOption("mono");
      await page.locator("#appearance-theme-brand").selectOption("custom");
      await page.locator("#appearance-theme-brand-picker").fill("#7b2356");
      await page.getByRole("button", { name: "切换预览主题" }).click();
      await expect(content.locator('[data-host-theme="dark"]')).toBeVisible();
      await expect(content.locator("[data-host-theme]")).toHaveCSS(
        "font-family",
        /monospace/,
      );
      await expect(content.locator("[data-host-theme]")).toHaveCSS(
        "--color-accent",
        "#7b2356",
      );
      if (plugin === "Expense Approval")
        await expect(
          content.getByRole("textbox", { name: "审批意见", exact: true }),
        ).toHaveValue("Preserved theme draft");
      else
        await expect(
          content.getByRole("gridcell", { name: "Japan 信用 42" }),
        ).toHaveAttribute("aria-selected", "true");
      await page
        .locator(".theme-popover")
        .getByRole("button", { name: "关闭", exact: true })
        .click();
      await mkdir("artifacts/library-experience/plugins", { recursive: true });
      await page.screenshot({
        path: `artifacts/library-experience/plugins/${mode}-${plugin.replaceAll(" ", "-")}.png`,
      });
    });
