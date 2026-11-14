import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const directory = path.resolve("artifacts/chatbot-visual");
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const entries: {
  variant: string;
  locale: string;
  theme: string;
  viewport: string;
  state: string;
  screenshot: string;
  documentWidth: number;
  scrollY: number;
}[] = [];
try {
  for (const [variant, port] of [
    ["baseline", 5180],
    ["with-agent-ui", 5181],
  ] as const)
    for (const locale of ["zh-CN", "en-US"] as const)
      for (const theme of ["light", "dark"] as const)
        for (const [width, height] of [
          [1440, 900],
          [1280, 800],
          [375, 812],
        ]) {
          const page = await browser.newPage({
            viewport: { width, height },
            locale,
          });
          await page.addInitScript(
            ({ locale, theme }) => {
              localStorage.setItem("locale", locale);
              localStorage.setItem("theme", theme);
            },
            { locale, theme },
          );
          await page.goto(`http://localhost:${port}`);
          await expect(
            page.getByText(locale === "zh-CN" ? "已连接" : "Connected", {
              exact: true,
            }),
          ).toBeVisible();
          for (const state of ["expense", "risk"] as const) {
            if (state === "risk")
              await page
                .getByRole("button", {
                  name: locale === "zh-CN" ? "新建会话" : "New conversation",
                  exact: true,
                })
                .click();
            await page
              .getByRole("button", {
                name:
                  state === "expense"
                    ? /EXP-001/
                    : locale === "zh-CN"
                      ? "查看区域风险"
                      : "View regional risk",
                exact: state === "expense",
              })
              .click();
            const ui =
              variant === "baseline"
                ? page
                : page
                    .frameLocator('iframe[title="Agent UI"]')
                    .frameLocator(
                      `iframe[title="${state === "expense" ? "Expense Approval" : "Risk Heatmap"} Sandbox"]`,
                    );
            if (state === "expense") {
              await expect(
                ui.getByRole("textbox", {
                  name:
                    variant === "baseline" && locale === "en-US"
                      ? "Approval comment"
                      : locale === "zh-CN"
                        ? "审批意见"
                        : "Comment",
                }),
              ).toBeVisible();
            } else if (variant === "baseline")
              await expect(
                ui.getByRole("button", {
                  name: `Singapore ${locale === "zh-CN" ? "市场" : "Market"} 76`,
                  exact: true,
                }),
              ).toBeVisible();
            else
              await expect(
                ui.getByRole("gridcell", {
                  name: `Singapore ${locale === "zh-CN" ? "市场" : "Market"} 76`,
                }),
              ).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            // Two frames after the DOM assertion allow paint/ResizeObserver delivery.
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            await page.evaluate(() =>
              scrollTo(0, document.documentElement.scrollHeight),
            );
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            const screenshot = path.join(
              directory,
              `${variant}-${locale}-${theme}-${width}x${height}-${state}.png`,
            );
            // Fixed viewport capture avoids Chromium's offscreen cross-origin
            // iframe rasterization artifacts during full-page capture.
            await page.screenshot({ path: screenshot });
            if (locale === "zh-CN" && theme === "light" && width === 1440) {
              await writeFile(
                path.join(directory, `${variant}-${state}-trace.json`),
                (await page.locator(".developer pre").textContent()) + "\n",
              );
            }
            const documentWidth = await page.evaluate(
              () => document.documentElement.scrollWidth,
            );
            if (documentWidth > width)
              throw Error(
                `Horizontal page overflow: ${screenshot} (${documentWidth} > ${width})`,
              );
            entries.push({
              variant,
              locale,
              theme,
              viewport: `${width}x${height}`,
              state,
              screenshot,
              documentWidth,
              scrollY: await page.evaluate(() => scrollY),
            });
          }
          await page.close();
        }
} finally {
  await browser.close();
  await writeFile(
    path.join(directory, "matrix.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), entries },
      null,
      2,
    ) + "\n",
  );
}
console.log(
  `Captured ${entries.length} genuine browser states in ${directory}`,
);
