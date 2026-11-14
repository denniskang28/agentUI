import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chromium" });
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
  await mkdir("artifacts/visual/implementation", { recursive: true });
  for (const [name, label] of [
    ["playground", "Playground"],
    ["plugins", "Plugins"],
    ["docs", "API & Docs"],
    ["benchmarks", "Benchmarks"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.screenshot({
      path: `artifacts/visual/implementation/${name}-1440-light.png`,
    });
  }
  await page.getByRole("button", { name: "Playground", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await page
    .frameLocator('iframe[title="Preview Host"]')
    .getByText("本季度整体风险可控，亚太市场风险上升，建议关注新加坡敞口。")
    .waitFor();
  await page
    .frameLocator('iframe[title="Preview Host"]')
    .locator(".a2-text")
    .evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  await page.screenshot({
    path: "artifacts/visual/implementation/text-1440-light.png",
  });
  console.log(
    "Captured implementation: four pages and Text template at 1440×900.",
  );
} finally {
  await browser.close();
}
