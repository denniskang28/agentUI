import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chromium" });
const sizes = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
];
await mkdir("artifacts/visual/reference", { recursive: true });
try {
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: sizes[0], locale: "zh-CN" });
    await page.goto(
      "http://127.0.0.1:8766/Agent%20UI%20Playground%20v2.dc.html",
    );
    await page
      .getByRole("button", { name: "渲染", exact: true })
      .first()
      .click();
    await page.getByRole("gridcell").first().waitFor();
    if (theme === "dark")
      await page
        .getByRole("button", { name: "切换界面明暗主题", exact: true })
        .click();
    for (const size of sizes) {
      await page.setViewportSize(size);
      for (const [key, label] of [
        ["playground", "Playground"],
        ["plugins", "Plugins"],
        ["docs", "API & Docs"],
        ["benchmarks", "Benchmarks"],
      ]) {
        await page.getByRole("button", { name: label, exact: true }).click();
        if (key === "playground" && size.width === 375)
          await page.getByRole("tab", { name: "预览", exact: true }).click();
        await page.screenshot({
          path: `artifacts/visual/reference/${key}-${size.width}-${theme}.png`,
        });
      }
    }
    await page.close();
  }
  console.log(
    "Captured 24 Chinese reference page/size/theme states without editing the reference.",
  );
} finally {
  await browser.close();
}
