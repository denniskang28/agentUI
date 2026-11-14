import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const destination = "artifacts/visual/plugin-details";
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const checks: Record<string, unknown>[] = [];
try {
  for (const locale of ["zh-CN", "en-US"])
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({ locale });
      await page.goto("http://localhost:5173");
      if (theme === "dark")
        await page
          .getByRole("button", { name: /切换界面明暗主题|Toggle app theme/ })
          .click();
      await page.getByRole("button", { name: "Plugins", exact: true }).click();
      await expect(page.locator(".plugin-detail")).toBeVisible();
      for (const size of [
        { width: 1440, height: 900 },
        { width: 1280, height: 800 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(size);
        for (const [index, state] of [
          "schema",
          "actions",
          "templates",
          "logs",
        ].entries()) {
          await page.locator(".plugin-detail-tabs button").nth(index).click();
          await page
            .locator(".plugin-detail")
            .evaluate((element) => element.scrollIntoView({ block: "start" }));
          await page.screenshot({
            path: `${destination}/${state}-${locale}-${size.width}-${theme}.png`,
          });
          const geometry = await page.evaluate(() => ({
            width: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            controls: [
              ...document.querySelectorAll(".plugin-detail button"),
            ].map((element) => {
              const { left, right } = element.getBoundingClientRect();
              return { text: element.textContent?.trim(), left, right };
            }),
          }));
          checks.push({ state, locale, theme, ...size, ...geometry });
        }
      }
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
        (check) => Number(check.documentWidth) > Number(check.width),
      ),
    }),
  );
} finally {
  await browser.close();
}
