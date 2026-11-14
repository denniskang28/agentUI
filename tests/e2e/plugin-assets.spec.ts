import { test, expect } from "@playwright/test";
import { counterFixture, zipFiles } from "../fixtures/plugin";
test("a multi-file ZIP loads its compiled CSS in both modes; theme and locale preserve the plugin instance", async ({
  page,
  request,
}) => {
  const fixture = await counterFixture(
    "thirdparty.styled",
    (source) =>
      `import './styles.css';\n${source.replace("<section>", '<section className="styled-counter">')}`,
  );
  fixture.files.push({
    name: "src/styles.css",
    content:
      ".styled-counter h3 { color:rgb(11, 121, 101); } [data-theme=dark] .styled-counter h3 { color:rgb(101, 211, 191); }",
  });
  const installed = await request.post("/api/v1/plugins", {
    multipart: {
      file: {
        name: "styled-counter.zip",
        mimeType: "application/zip",
        buffer: zipFiles(fixture.files),
      },
    },
  });
  expect(installed.ok(), await installed.text()).toBe(true);
  const record = await installed.json();
  expect(record.entry.stylesheetUrl).toMatch(/plugin\.css$/);
  const css = await request.get(record.entry.stylesheetUrl);
  expect(css.ok()).toBe(true);
  expect(css.headers()["content-type"]).toContain("text/css");
  await page.goto("/");
  await page
    .locator(".component-item")
    .filter({ hasText: fixture.manifest.displayName })
    .click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  const sandbox = host.frameLocator(
    `iframe[title="${fixture.manifest.displayName} Sandbox"]`,
  );
  await expect(sandbox.getByRole("heading")).toHaveCSS(
    "color",
    "rgb(11, 121, 101)",
  );
  await sandbox.getByRole("button", { name: "增加", exact: true }).click();
  await page.getByRole("button", { name: "切换预览主题" }).click();
  await expect(sandbox.getByRole("heading")).toHaveCSS(
    "color",
    "rgb(101, 211, 191)",
  );
  await expect(sandbox.getByTestId("local-clicks")).toHaveText("1");
  await page.getByRole("button", { name: "Native", exact: true }).click();
  await page.getByRole("button", { name: "确认切换", exact: true }).click();
  await expect(host.getByRole("heading")).toHaveCSS(
    "color",
    "rgb(101, 211, 191)",
  );
  await host.getByRole("button", { name: "增加", exact: true }).click();
  await page.getByRole("button", { name: "选择语言" }).click();
  await page.getByRole("button", { name: "Toggle preview theme" }).click();
  await expect(host.getByRole("heading")).toHaveCSS(
    "color",
    "rgb(11, 121, 101)",
  );
  await expect(host.getByTestId("local-clicks")).toHaveText("1");
  await expect(host.getByTestId("counter-locale")).toHaveText("en-US");
});
