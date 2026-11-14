import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const output = "artifacts/library-docs/visual";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const evidence: Record<string, unknown>[] = [];
const articles = [
  ["integration", "从安装到首屏", "Installation through first render"],
  ["inputs", "便捷模板与完整 A2UI", "Templates and full A2UI"],
  ["events", "Action 与运行生命周期", "Actions and run lifecycle"],
  ["migration", "现有 Chatbot 的改造对照", "Migrating an existing chatbot"],
  ["deployment", "打包、部署与运维", "Packaging and deployment"],
];
try {
  for (const locale of ["zh-CN", "en-US"] as const) {
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [375, 812],
    ]) {
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({
          viewport: { width, height },
          locale,
        });
        await context.addInitScript(
          (value) => localStorage.setItem("agent-ui.locale", value),
          locale,
        );
        const page = await context.newPage();
        await page.goto("http://localhost:5173");
        await page
          .getByRole("button", { name: "API & Docs", exact: true })
          .click();
        if (theme === "dark")
          await page
            .getByRole("button", {
              name:
                locale === "zh-CN" ? "切换界面明暗主题" : "Toggle app theme",
            })
            .click();
        await page
          .getByRole("heading", {
            name: locale === "zh-CN" ? "系统整体架构" : "System architecture",
            exact: true,
          })
          .waitFor();
        await page.evaluate(() => document.fonts.ready);
        const capture = async (state: string) => {
          const file = `${locale}-${width}-${theme}-${state}.png`;
          await page.screenshot({
            path: `${output}/${file}`,
            animations: "disabled",
          });
          const metrics = await page.evaluate(() => ({
            viewport: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            articleWidth: document.querySelector(".docs-article")?.clientWidth,
          }));
          if (metrics.documentWidth > width)
            throw Error(`Root overflow: ${file}`);
          evidence.push({
            file,
            locale,
            width,
            height,
            theme,
            state,
            ...metrics,
          });
        };
        await capture("overview");
        if (width === 1440 && theme === "light") {
          for (const [slug, zh, en] of articles) {
            await page
              .getByRole("button", {
                name: locale === "zh-CN" ? zh : en,
                exact: true,
              })
              .click();
            await page.locator(".docs-main").evaluate((element) => {
              element.scrollTop = 0;
            });
            await capture(slug);
          }
        }
        if (width === 375 && theme === "light") {
          await page
            .getByRole("button", {
              name:
                locale === "zh-CN"
                  ? "便捷模板与完整 A2UI"
                  : "Templates and full A2UI",
              exact: true,
            })
            .click();
          const table = page.locator(".docs-table").last();
          await table.evaluate((element) => {
            element.scrollIntoView({ block: "start" });
            element.scrollLeft = element.scrollWidth;
          });
          await capture("inputs-table-scrolled");
        }
        if (width === 1280 && theme === "dark") {
          await page
            .getByRole("button", {
              name:
                locale === "zh-CN"
                  ? "从安装到首屏"
                  : "Installation through first render",
              exact: true,
            })
            .click();
          await page
            .locator(".docs-article pre")
            .nth(1)
            .evaluate((element) => element.scrollIntoView({ block: "start" }));
          await capture("integration-code");
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  `${output}/matrix.json`,
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(
  `Captured ${evidence.length} actual documentation states in ${output}`,
);
