import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chromium" });
const destination = "artifacts/visual/layout-matrix";
await mkdir(destination, { recursive: true });
const checks: Record<string, unknown>[] = [];
const requested = process.argv.slice(2);
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: "zh-CN",
  });
  await page.goto("http://localhost:5173");
  await page
    .locator(".component-item")
    .filter({ hasText: "Risk Heatmap" })
    .click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await page
    .frameLocator('iframe[title="Preview Host"]')
    .frameLocator('iframe[title="Risk Heatmap Sandbox"]')
    .getByRole("gridcell")
    .first()
    .waitFor();
  for (const locale of ["zh-CN", "en-US"]) {
    if ((await page.locator("html").getAttribute("lang")) !== locale)
      await page
        .getByRole("button", { name: /选择语言|Select language/ })
        .click();
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page
        .getByRole("button", { name: "Playground", exact: true })
        .click();
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: /切换界面明暗主题|Toggle app theme/ })
          .click();
      if (
        (await page.locator(".preview-frame").getAttribute("data-theme")) !==
        theme
      )
        await page
          .getByRole("button", { name: /切换预览主题|Toggle preview theme/ })
          .click();
      for (const size of [
        { width: 1440, height: 900 },
        { width: 1280, height: 800 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(size);
        for (const [name, label] of [
          ["playground", "Playground"],
          ["plugins", "Plugins"],
          ["docs", "API & Docs"],
          ["benchmarks", "Benchmarks"],
        ]) {
          if (requested.length && !requested.includes(name)) continue;
          await page.getByRole("button", { name: label, exact: true }).click();
          if (name === "playground" && size.width === 375)
            await page.locator(".narrow-tabs button").last().click();
          if (name === "playground")
            await expect
              .poll(async () =>
                page
                  .locator('iframe[title="Preview Host"]')
                  .evaluate(
                    (element) => element.getBoundingClientRect().height,
                  ),
              )
              .toBeGreaterThan(300);
          if (name === "plugins")
            await page
              .locator(".page-grid > section")
              .nth(1)
              .locator(".plugin-row")
              .first()
              .waitFor();
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              ),
          );
          await page.screenshot({
            path: `${destination}/${name}-${locale}-${size.width}-${theme}.png`,
          });
          const geometry = await page.evaluate(() => ({
            width: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            headerButtons: [
              ...document.querySelectorAll<HTMLButtonElement>(
                ".app-header button",
              ),
            ].map((button) => {
              const box = button.getBoundingClientRect();
              return {
                text: button.textContent?.trim(),
                left: box.left,
                right: box.right,
                top: box.top,
                bottom: box.bottom,
              };
            }),
          }));
          checks.push({
            page: name,
            locale,
            theme,
            ...size,
            ...geometry,
            horizontalDocumentOverflow: geometry.documentWidth > geometry.width,
            headerControlsOutsideViewport: geometry.headerButtons.some(
              (box) => box.left < 0 || box.right > size.width,
            ),
          });
        }
      }
    }
  }
  await writeFile(
    `${destination}/layout-checks${requested.length ? `-${requested.join("-")}` : ""}.json`,
    JSON.stringify(checks, null, 2),
  );
  console.log(
    JSON.stringify({
      screenshots: checks.length,
      layoutIssues: checks.filter(
        (c) => c.horizontalDocumentOverflow || c.headerControlsOutsideViewport,
      ),
    }),
  );
} finally {
  await browser.close();
}
