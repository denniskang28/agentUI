import { test, expect } from "@playwright/test";
import { counterFixture } from "../fixtures/plugin";
test("Plugins UI uploads unknown TSX, exposes real details and replaces its artifact before rendering", async ({
  page,
  request,
}) => {
  const fixture = await counterFixture("studio.upload-counter");
  const metadata = JSON.stringify({
    manifest: fixture.manifest,
    catalog: fixture.catalog,
  });
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Plugins", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "counter.tsx",
      mimeType: "text/plain",
      buffer: Buffer.from(fixture.source),
    });
    await page
      .getByRole("textbox", { name: "TSX 元数据", exact: true })
      .fill(metadata);
    const firstResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/plugins") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "开始构建", exact: true }).click();
    const first = await (await firstResponse).json();
    expect(first.status).toBe("ready");
    await page
      .getByRole("button", { name: fixture.manifest.displayName, exact: true })
      .click();
    await expect(page.locator(".plugin-schema")).toContainText("value");
    await page.getByRole("button", { name: "Actions", exact: true }).click();
    await expect(page.locator(".plugin-detail")).toContainText(
      "counter.increment",
    );
    await page.getByRole("button", { name: "模板", exact: true }).click();
    await expect(page.locator(".plugin-detail")).toContainText("template=full");
    await page.getByRole("button", { name: "查看日志", exact: true }).click();
    await expect(page.locator(".plugin-detail")).toContainText(first.buildId);
    await page.getByRole("button", { name: "选择语言" }).click();
    await expect(page.locator(".plugin-detail")).toContainText(first.buildId);
    const chooserEvent = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Replace upload", exact: true })
      .click();
    await (
      await chooserEvent
    ).setFiles({
      name: "counter.tsx",
      mimeType: "text/plain",
      buffer: Buffer.from(
        fixture.source.replace(
          "<h3>{data.title}</h3>",
          "<h3>Replacement ready</h3>",
        ),
      ),
    });
    const prepared = JSON.parse(
      await page
        .getByRole("textbox", { name: "TSX metadata", exact: true })
        .inputValue(),
    );
    expect(prepared.manifest.id).toBe(fixture.manifest.id);
    const secondResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/plugins") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Build plugin", exact: true })
      .click();
    const second = await (await secondResponse).json();
    expect(second.status).toBe("ready");
    expect(second.buildId).not.toBe(first.buildId);
    expect(second.sha256).not.toBe(first.sha256);
    await page
      .getByRole("button", { name: "Open in Playground", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Render", exact: true })
      .first()
      .click();
    const plugin = page
      .frameLocator('iframe[title="Preview Host"]')
      .frameLocator(`iframe[title="${fixture.manifest.displayName} Sandbox"]`);
    await expect(
      plugin.getByRole("heading", { name: "Replacement ready" }),
    ).toBeVisible();
    await expect(plugin.getByTestId("counter-locale")).toHaveText("en-US");
  } finally {
    await request.delete(`/api/v1/plugins/${fixture.manifest.id}`);
  }
});
