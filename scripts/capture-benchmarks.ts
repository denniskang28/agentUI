import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const destination = "artifacts/visual/benchmarks";
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const checks: Record<string, unknown>[] = [];
try {
  const setup = await browser.newContext();
  const upload = await setup.request.post(
    "http://localhost:5173/api/v1/plugins",
    {
      multipart: {
        file: {
          name: "finance-risk-heatmap.zip",
          mimeType: "application/zip",
          buffer: await readFile("examples/dist/finance-risk-heatmap.zip"),
        },
      },
    },
  );
  expect(upload.ok(), await upload.text()).toBe(true);
  await setup.close();
  for (const locale of ["zh-CN", "en-US"])
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({
        locale,
        viewport: { width: 1440, height: 900 },
      });
      await page.goto("http://localhost:5173");
      if (theme === "dark") {
        await page
          .getByRole("button", { name: /切换界面明暗主题|Toggle app theme/ })
          .click();
        await page
          .getByRole("button", { name: /切换预览主题|Toggle preview theme/ })
          .click();
      }
      await page
        .getByRole("button", { name: "Benchmarks", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: /^(测试组件|Component)$/ })
        .selectOption("finance.risk-heatmap");
      await page
        .getByRole("spinbutton", { name: /^(持续时间 \(s\)|Duration \(s\))$/ })
        .fill("1");
      await page
        .getByRole("button", { name: /^(开始测试|Run benchmark)$/ })
        .click();
      await expect(
        page.getByText(locale === "zh-CN" ? "测试完成" : "Completed", {
          exact: true,
        }),
      ).toHaveCount(2);
      const view = page
        .frameLocator('iframe[title="Benchmark Preview Host"]')
        .frameLocator('iframe[title="Risk Heatmap Sandbox"]');
      await view
        .getByRole("gridcell", {
          name: locale === "zh-CN" ? "Region 1 信用 10" : "Region 1 Credit 10",
          exact: true,
        })
        .click();
      await expect(view.getByText("Agent risk detail")).toBeVisible();
      await expect(
        page.getByText(locale === "zh-CN" ? "测试完成" : "Completed", {
          exact: true,
        }),
      ).toHaveCount(3);
      const downloading = page.waitForEvent("download");
      await page
        .getByRole("button", { name: /^(导出 JSON|Export JSON)$/ })
        .click();
      const download = await downloading;
      await download.saveAs(`${destination}/measured-${locale}-${theme}.json`);
      for (const size of [
        { width: 1440, height: 900 },
        { width: 1280, height: 800 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(size);
        await page.locator(".secondary-page").evaluate((node) => {
          node.scrollTop = 0;
        });
        await view
          .locator("body")
          .evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              ),
          );
        await page.screenshot({
          path: `${destination}/page-${locale}-${size.width}-${theme}.png`,
          fullPage: false,
        });
        await page
          .getByRole("heading", {
            name: locale === "zh-CN" ? "测试结果" : "Results",
            exact: true,
          })
          .evaluate((node) => node.scrollIntoView({ block: "start" }));
        await page.screenshot({
          path: `${destination}/results-${locale}-${size.width}-${theme}.png`,
        });
        checks.push({
          locale,
          theme,
          ...size,
          ...(await page.evaluate(() => ({
            documentWidth: document.documentElement.scrollWidth,
            overflowingControls: [
              ...document.querySelectorAll(
                ".bench-controls input,.bench-controls select,.bench-controls button",
              ),
            ]
              .filter((node) => {
                const r = node.getBoundingClientRect();
                return r.x < 0 || r.right > innerWidth;
              })
              .map(
                (node) => node.getAttribute("aria-label") || node.textContent,
              ),
          }))),
        });
      }
      await page.close();
    }
  await writeFile(
    `${destination}/layout-checks.json`,
    JSON.stringify(checks, null, 2),
  );
  console.log(
    JSON.stringify({
      screenshots: checks.length * 2,
      layoutIssues: checks.filter(
        (c) =>
          Number(c.documentWidth) > Number(c.width) ||
          (c.overflowingControls as string[]).length,
      ).length,
    }),
  );
} finally {
  await browser.close();
}
