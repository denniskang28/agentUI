import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const output = "artifacts/library-experience/visual";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const evidence: Record<string, unknown>[] = [];
try {
  for (const locale of ["zh-CN", "en-US"] as const)
    for (const theme of ["light", "dark"] as const)
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [375, 812],
      ]) {
        const page = await browser.newPage({
          locale,
          viewport: { width, height },
        });
        const zh = locale === "zh-CN";
        await page.goto("http://localhost:5173");
        if (width === 375)
          await page
            .getByRole("tab", {
              name: zh ? "模板配置" : "Configuration",
              exact: true,
            })
            .click();
        if (theme === "dark") {
          await page
            .getByRole("button", {
              name: zh ? "切换界面明暗主题" : "Toggle app theme",
            })
            .click();
          if (width === 375)
            await page
              .getByRole("tab", {
                name: zh ? "预览面板" : "Preview",
                exact: true,
              })
              .click();
          await page
            .getByRole("button", {
              name: zh ? "切换预览主题" : "Toggle preview theme",
            })
            .click();
          if (width === 375)
            await page
              .getByRole("tab", {
                name: zh ? "模板配置" : "Configuration",
                exact: true,
              })
              .click();
        }
        await page
          .getByRole("button", { name: zh ? "渲染" : "Render", exact: true })
          .first()
          .click();
        await page
          .frameLocator('iframe[title="Preview Host"]')
          .locator(".a2-text")
          .waitFor({ state: "attached" });
        const capture = async (state: string) => {
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              ),
          );
          const file = `${state}-${locale}-${width}-${theme}.png`;
          await page.screenshot({
            path: `${output}/${file}`,
            animations: "disabled",
          });
          const geometry = await page.evaluate(() => {
            const dialog = document.querySelector(".copy-dialog");
            const bounds = dialog?.getBoundingClientRect();
            const footer = dialog
              ?.querySelector("footer")
              ?.getBoundingClientRect();
            return {
              documentWidth: document.documentElement.scrollWidth,
              viewport: innerWidth,
              dialogOutsideViewport:
                !!bounds &&
                (bounds.left < 0 ||
                  bounds.right > innerWidth ||
                  bounds.top < 0 ||
                  bounds.bottom > innerHeight),
              footerOutsideViewport: !!footer && footer.bottom > innerHeight,
            };
          });
          evidence.push({
            file,
            state,
            locale,
            theme,
            width,
            height,
            ...geometry,
          });
          if (
            geometry.documentWidth > width ||
            geometry.dialogOutsideViewport ||
            geometry.footerOutsideViewport
          )
            throw Error(`Layout overflow: ${file}`);
        };
        await capture("content");
        await page
          .getByRole("button", {
            name: zh ? "外观" : "Appearance",
            exact: true,
          })
          .click();
        await page
          .getByLabel(zh ? "字号" : "Font size", { exact: true })
          .fill("24");
        const text = page
          .frameLocator('iframe[title="Preview Host"]')
          .locator(".a2-text");
        await expect(text).toHaveCSS("font-size", "24px");
        await expect
          .poll(() =>
            text.evaluate(
              (node) => node.getBoundingClientRect().bottom <= innerHeight,
            ),
          )
          .toBe(true);
        await capture("appearance");
        if (width === 375)
          await page
            .getByRole("tab", {
              name: zh ? "预览面板" : "Preview",
              exact: true,
            })
            .click();
        await page
          .getByRole("button", {
            name: zh ? "预览主题配置" : "Preview theme configuration",
            exact: true,
          })
          .click();
        await page.locator("#appearance-theme-fontFamily").selectOption("mono");
        await capture("theme");
        await page
          .locator(".theme-popover")
          .getByRole("button", { name: zh ? "关闭" : "Close", exact: true })
          .click();
        if (width === 375)
          await page
            .getByRole("tab", {
              name: zh ? "模板配置" : "Configuration",
              exact: true,
            })
            .click();
        await page
          .getByRole("button", {
            name: zh ? "复制接入代码" : "Copy integration code",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Library React", exact: true })
          .click();
        await capture("export");
        await page
          .getByRole("dialog")
          .getByRole("button", { name: zh ? "关闭" : "Close", exact: true })
          .last()
          .click();
        await page
          .getByRole("button", { name: "API & Docs", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: zh ? "主题与外观配置" : "Theme and appearance",
            exact: true,
          })
          .click();
        await capture("guide");
        await page.close();
      }
  for (const theme of ["light", "dark"])
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [375, 812],
    ]) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        locale: "zh-CN",
      });
      await page.goto(
        "http://127.0.0.1:8766/Agent%20UI%20Playground%20v2.dc.html",
      );
      await page.getByRole("button", { name: "Text", exact: true }).click();
      await page
        .getByRole("button", { name: "渲染", exact: true })
        .first()
        .click();
      await page
        .locator("p")
        .filter({
          hasText: "本季度整体风险可控，亚太市场风险上升，建议关注新加坡敞口。",
        })
        .waitFor();
      if (theme === "dark")
        await page
          .getByRole("button", { name: "切换界面明暗主题", exact: true })
          .click();
      await page.setViewportSize({ width, height });
      if (width === 375)
        await page.getByRole("tab", { name: "配置", exact: true }).click();
      await page.screenshot({
        path: `${output}/reference-${width}-${theme}.png`,
        animations: "disabled",
      });
      await page.close();
    }
} finally {
  await browser.close();
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      { checks: evidence, passed: evidence.length === 60 },
      null,
      2,
    ),
  );
}
console.log(
  `Captured ${evidence.length} implementation states and six unchanged reference states.`,
);
