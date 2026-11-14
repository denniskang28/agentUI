import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const destination = "artifacts/visual/ui-states";
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const checks: Record<string, unknown>[] = [];
try {
  for (const locale of ["zh-CN", "en-US"])
    for (const theme of ["light", "dark"])
      for (const size of [
        { width: 1440, height: 900 },
        { width: 1280, height: 800 },
        { width: 375, height: 812 },
      ]) {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 900 },
          locale,
        });
        const capture = async (state: string) => {
          await page.screenshot({
            path: `${destination}/${state}-${locale}-${size.width}-${theme}.png`,
          });
          const geometry = await page.evaluate(() => {
            const dialog = document.querySelector("[role=dialog]");
            const buttons = [...(dialog?.querySelectorAll("button") ?? [])].map(
              (element) => {
                const box = element.getBoundingClientRect();
                return {
                  text: element.textContent?.trim(),
                  left: box.left,
                  right: box.right,
                  top: box.top,
                  bottom: box.bottom,
                };
              },
            );
            return {
              width: innerWidth,
              documentWidth: document.documentElement.scrollWidth,
              buttons,
              dialogControlsOutsideViewport: buttons.some(
                (box) =>
                  box.left < 0 ||
                  box.right > innerWidth ||
                  box.top < 0 ||
                  box.bottom > innerHeight,
              ),
            };
          });
          checks.push({ state, locale, theme, ...size, ...geometry });
        };
        const panel = async (index: number) => {
          if (size.width === 375)
            await page.locator(".narrow-tabs button").nth(index).click();
        };
        await page.goto("http://localhost:5173");
        await page
          .locator(".component-item")
          .filter({ hasText: "Risk Heatmap" })
          .click();
        if (theme === "dark") {
          await page
            .getByRole("button", { name: /切换界面明暗主题|Toggle app theme/ })
            .click();
          await page
            .getByRole("button", { name: /切换预览主题|Toggle preview theme/ })
            .click();
        }
        await page
          .getByRole("button", { name: /^(渲染|Render)$/ })
          .first()
          .click();
        await page
          .frameLocator('iframe[title="Preview Host"]')
          .frameLocator('iframe[title="Risk Heatmap Sandbox"]')
          .getByRole("gridcell")
          .first()
          .waitFor();
        await page.setViewportSize(size);
        await panel(1);
        await page
          .getByRole("button", { name: /复制接入代码|Copy integration code/ })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await capture("copy");
        await page
          .getByRole("dialog")
          .getByRole("button", { name: /^(关闭|Close)$/ })
          .last()
          .click();
        await panel(2);
        await page.getByRole("button", { name: "Native", exact: true }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await capture("mode-switch");
        await page.getByRole("button", { name: /^(取消|Cancel)$/ }).click();
        await panel(1);
        await page
          .getByRole("button", { name: /^(自定义响应|Custom response)$/ })
          .click();
        await page
          .getByRole("textbox", { name: "A2UI JSON" })
          .fill('{\n  "version": @\n}');
        await page.getByRole("button", { name: /^(校验|Validate)$/ }).click();
        await expect(page.getByRole("alert")).toBeVisible();
        await page.getByRole("alert").scrollIntoViewIfNeeded();
        await capture("syntax-error");
        await page
          .getByRole("button", { name: "Plugins", exact: true })
          .click();
        await page
          .getByRole("button", { name: /^(卸载|Uninstall)$/ })
          .first()
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await capture("uninstall");
        await page.getByRole("button", { name: /^(取消|Cancel)$/ }).click();
        await page
          .getByRole("button", { name: "Playground", exact: true })
          .click();
        await panel(0);
        await page
          .locator(".component-item")
          .filter({ hasText: "Expense Approval" })
          .click();
        await panel(1);
        await page
          .getByRole("radio", { name: /等待完整数据|Wait for complete data/ })
          .click();
        await page
          .getByLabel(locale === "zh-CN" ? "间隔" : "Interval", { exact: true })
          .fill("30000");
        await page
          .getByRole("button", { name: /^(渲染并播放|Render & play)$/ })
          .click();
        await page.getByRole("button", { name: /^(暂停|Pause)$/ }).click();
        await panel(2);
        const host = page.frameLocator('iframe[title="Preview Host"]');
        await expect(host.getByRole("status")).toBeVisible();
        await capture("waiting");
        await panel(1);
        await page.getByRole("button", { name: /下一步|Next step/ }).click();
        await page.getByRole("button", { name: /下一步|Next step/ }).click();
        await panel(2);
        const approval = host.frameLocator(
          'iframe[title="Expense Approval Sandbox"]',
        );
        await approval
          .getByRole("button", { name: /^(批准|Approve)$/ })
          .press("Enter");
        await expect(approval.getByRole("status")).toBeVisible();
        await capture("approval-complete");
        await page.close();
      }
  await writeFile(
    `${destination}/layout-checks.json`,
    JSON.stringify(checks, null, 2),
  );
  console.log(
    JSON.stringify({
      screenshots: checks.length,
      layoutIssues: checks.filter(
        (check) =>
          check.dialogControlsOutsideViewport ||
          Number(check.documentWidth) > Number(check.width),
      ),
    }),
  );
} finally {
  await browser.close();
}
