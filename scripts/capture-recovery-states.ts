import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createMessage } from "../packages/protocol/src/index";

const destination = "artifacts/visual/recovery-states";
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
          locale,
          viewport: { width: 1440, height: 900 },
        });
        const capture = async (state: string) => {
          await page.screenshot({
            path: `${destination}/${state}-${locale}-${size.width}-${theme}.png`,
          });
          const geometry = await page.evaluate(() => ({
            width: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
          }));
          checks.push({ state, locale, theme, ...size, ...geometry });
        };
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
          .getByRole("button", { name: /^(自定义响应|Custom response)$/ })
          .click();
        const editor = page.getByRole("textbox", { name: "A2UI JSON" });
        await editor.fill(
          JSON.stringify(
            createMessage(
              "main",
              [{ id: "root", component: "Text", text: 42 }],
              {},
            ),
            null,
            2,
          ),
        );
        await page
          .getByRole("button", { name: /^(渲染|Render)$/ })
          .first()
          .click();
        await expect(page.getByRole("alert")).toContainText("Text");
        await page.setViewportSize(size);
        if (size.width === 375)
          await page.locator(".narrow-tabs button").nth(1).click();
        await page.getByRole("alert").scrollIntoViewIfNeeded();
        await capture("schema-error");
        await editor.fill(
          JSON.stringify(
            createMessage(
              "main",
              [
                {
                  id: "root",
                  component: "Column",
                  children: ["title", "future", "input"],
                },
                {
                  id: "title",
                  component: "Text",
                  text: "Original Agent content",
                },
                {
                  id: "future",
                  component: "FutureVisualization",
                  data: { label: "Business payload" },
                },
                {
                  id: "input",
                  component: "TextField",
                  label: "Business input",
                  value: { "@path": "/input" },
                },
              ],
              { input: "Unchanged draft" },
            ),
            null,
            2,
          ),
        );
        await page
          .getByRole("button", { name: /^(渲染|Render)$/ })
          .first()
          .click();
        if (size.width === 375)
          await page.locator(".narrow-tabs button").nth(2).click();
        const host = page.frameLocator('iframe[title="Preview Host"]');
        await expect(host.getByRole("note")).toContainText(
          "FutureVisualization",
        );
        await expect(
          host.getByRole("textbox", { name: "Business input" }),
        ).toHaveValue("Unchanged draft");
        await expect
          .poll(() =>
            page
              .locator('iframe[title="Preview Host"]')
              .evaluate((element) => element.getBoundingClientRect().height),
          )
          .toBeGreaterThan(100);
        await capture("unknown-component");
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
