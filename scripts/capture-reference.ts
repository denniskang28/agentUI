import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chromium" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: "zh-CN",
  });
  await page.goto("http://127.0.0.1:8766/Agent%20UI%20Playground%20v2.dc.html");
  await page.getByRole("button", { name: "Playground", exact: true }).waitFor();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await page.getByRole("gridcell").first().waitFor();
  await mkdir("artifacts/visual/reference", { recursive: true });
  for (const [name, label] of [
    ["playground", "Playground"],
    ["plugins", "Plugins"],
    ["docs", "API & Docs"],
    ["benchmarks", "Benchmarks"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.screenshot({
      path: `artifacts/visual/reference/${name}-1440-light.png`,
    });
  }
  await page.getByRole("button", { name: "Playground", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await page
    .locator("p")
    .filter({
      hasText: "本季度整体风险可控，亚太市场风险上升，建议关注新加坡敞口。",
    })
    .waitFor();
  await page.screenshot({
    path: "artifacts/visual/reference/text-1440-light.png",
  });
  console.log("Captured reference: four pages and Text template at 1440×900.");
} finally {
  await browser.close();
}
