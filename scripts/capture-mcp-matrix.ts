import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const output = ".private/evidence/mcp-apps/matrix";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" }),
  checks: unknown[] = [];
try {
  for (const locale of ["zh-CN", "en-US"] as const) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      locale,
    });
    await page.addInitScript(
      (value) => localStorage.setItem("agent-ui.locale", value),
      locale,
    );
    await page.goto("http://localhost:5173");
    await page.getByRole("button", { name: "MCP Apps", exact: true }).click();
    await page
      .getByRole("combobox", { name: /^服务器$|^Server$/ })
      .selectOption("expense-demo");
    await page.getByRole("button", { name: /^连接$|^Connect$/ }).click();
    await page
      .getByRole("button", { name: /^调用并展示$|^Call and display$/ })
      .click();
    const app = page
      .frameLocator('iframe[title="MCP App"]')
      .frameLocator('iframe[title="MCP App View"]');
    await expect(app.locator("#approval-status")).toContainText("pending");
    for (const theme of ["light", "dark"]) {
      if (
        (await page.locator(".application").getAttribute("data-theme")) !==
        theme
      )
        await page
          .getByRole("button", { name: /切换界面明暗主题|Toggle app theme/ })
          .click();
      await expect(app.locator("#host-context")).toContainText(
        `${locale} / ${theme}`,
      );
      for (const size of [
        { width: 1440, height: 900 },
        { width: 1280, height: 800 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(size);
        await page.evaluate(
          () =>
            new Promise<void>((r) =>
              requestAnimationFrame(() => requestAnimationFrame(() => r())),
            ),
        );
        await page.waitForTimeout(150);
        await page.screenshot({
          path: `${output}/${locale}-${theme}-${size.width}.png`,
        });
        if (size.width === 375) {
          await page
            .locator('iframe[title="MCP App"]')
            .scrollIntoViewIfNeeded();
          await page.evaluate(
            () =>
              new Promise<void>((r) =>
                requestAnimationFrame(() => requestAnimationFrame(() => r())),
              ),
          );
          await page.screenshot({
            path: `${output}/${locale}-${theme}-375-app.png`,
          });
          await page.locator(".mcp-workbench").evaluate((e) => {
            e.parentElement!.scrollTop = 0;
          });
        }
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          document: document.documentElement.scrollWidth,
          panel: document
            .querySelector(".mcp-workbench")!
            .getBoundingClientRect().width,
          panelScroll: document.querySelector(".mcp-workbench")!.scrollWidth,
        }));
        expect(geometry.document).toBeLessThanOrEqual(size.width);
        expect(geometry.panelScroll).toBeLessThanOrEqual(
          Math.ceil(geometry.panel) + 1,
        );
        checks.push({ locale, theme, size, geometry, state: "app" });
      }
    }
    await page
      .getByRole("textbox", { name: /工具参数 JSON|Tool arguments JSON/ })
      .fill("{");
    await page
      .getByRole("button", { name: /^调用并展示$|^Call and display$/ })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      await page.evaluate(
        () => new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      );
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${output}/${locale}-error-${width}.png` });
      checks.push({ locale, width, state: "invalid-json" });
    }
    await page.close();
  }
  await writeFile(
    `${output}/checks.json`,
    JSON.stringify({ at: new Date().toISOString(), checks }, null, 2),
  );
} finally {
  await browser.close();
}
