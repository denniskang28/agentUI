import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.beforeAll(async ({ request }) => {
  const response = await request.post("/api/v1/plugins", {
    multipart: {
      file: {
        name: "finance-risk-heatmap.zip",
        mimeType: "application/zip",
        buffer: await readFile("examples/dist/finance-risk-heatmap.zip"),
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
});
async function exportResults(page: Page) {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const download = await downloading;
  return JSON.parse(await readFile((await download.path())!, "utf8")).results;
}
test("Compare Both measures real uploaded root commits for three instances and exports raw results", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Benchmarks", exact: true }).click();
  await page
    .getByLabel("测试组件", { exact: true })
    .selectOption("finance.risk-heatmap");
  await page.getByLabel("实例数", { exact: true }).selectOption("3");
  await page.getByLabel("持续时间 (s)", { exact: true }).fill("1");
  await page.getByRole("button", { name: "开始测试", exact: true }).click();
  await expect(page.getByText("测试完成", { exact: true })).toHaveCount(2, {
    timeout: 20000,
  });
  const host = page.frameLocator('iframe[title="Benchmark Preview Host"]');
  await expect(
    host.locator('iframe[title="Risk Heatmap Sandbox"]'),
  ).toHaveCount(3);
  await expect(
    host
      .frameLocator('iframe[title="Risk Heatmap Sandbox"]')
      .first()
      .getByRole("gridcell", { name: "Region 1 信用 10", exact: true }),
  ).toBeVisible();
  const results = await exportResults(page);
  for (const mode of ["native", "sandbox"]) {
    const r = results[mode];
    expect(r.status).toBe("complete");
    expect(r.bundleBytes).toBeGreaterThan(10000);
    expect(r.browser).toContain("Chrome");
    expect(r.configuration).toMatchObject({
      instances: 3,
      frequency: 10,
      size: 100,
      load: "cells",
    });
    expect(r.coldReadyMs).toBeGreaterThan(0);
    expect(r.firstRenderMs).toBeGreaterThan(0);
    expect(r.completedUpdates).toBeGreaterThan(0);
    expect(r.updateP95).toBeGreaterThanOrEqual(r.updateP50);
    expect(r.raw.every((s: any) => s.measurement.components.length === 3)).toBe(
      true,
    );
    expect(
      r.raw
        .filter((s: any) => s.measurement.status === "complete")
        .every((s: any) =>
          s.measurement.components.every(
            (c: any) => c.visible && c.commitMs >= 0,
          ),
        ),
    ).toBe(true);
  }
});
test("large fixture renders a window, high frequency records skips honestly, and leaving destroys the benchmark", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "Benchmarks", exact: true }).click();
  await page
    .getByLabel("测试组件", { exact: true })
    .selectOption("finance.risk-heatmap");
  await page.getByLabel("测试模式", { exact: true }).selectOption("sandbox");
  await page.getByLabel("数据规模", { exact: true }).selectOption("10000");
  await page.getByLabel("实例数", { exact: true }).selectOption("5");
  await page.getByLabel("更新频率 (Hz)", { exact: true }).selectOption("60");
  await page.getByLabel("持续时间 (s)", { exact: true }).fill("1");
  await page.getByRole("button", { name: "开始测试", exact: true }).click();
  await expect(page.getByText("测试完成", { exact: true })).toHaveCount(1, {
    timeout: 40000,
  });
  const host = page.frameLocator('iframe[title="Benchmark Preview Host"]');
  await expect(host.locator("iframe")).toHaveCount(5);
  const sandbox = host
    .frameLocator('iframe[title="Risk Heatmap Sandbox"]')
    .first();
  expect(await sandbox.getByRole("gridcell").count()).toBeLessThan(100);
  await sandbox.getByRole("grid").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    sandbox.getByRole("rowheader", { name: "Region 2500", exact: true }),
  ).toBeVisible();
  const r = (await exportResults(page)).sandbox;
  expect(r.configuration).toMatchObject({
    instances: 5,
    size: 10000,
    frequency: 60,
  });
  expect(r.requestedUpdates).toBe(60);
  expect(r.raw.length + r.skippedUpdates).toBe(60);
  expect(r.completedUpdates + r.supersededUpdates).toBe(r.raw.length);
  await page.getByLabel("持续时间 (s)", { exact: true }).fill("60");
  await page.getByRole("button", { name: "开始测试", exact: true }).click();
  await page.getByRole("button", { name: "停止", exact: true }).click();
  await expect(host.locator("iframe")).toHaveCount(0);
  await expect(page.getByText("已停止", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Playground", exact: true }).click();
  await expect(
    page.locator('iframe[title="Benchmark Preview Host"]'),
  ).toHaveCount(0);
});
test("table record fixture and English controls use an independent visible preview", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Benchmarks", exact: true }).click();
  await page.getByLabel("测试模式", { exact: true }).selectOption("native");
  await page.getByLabel("数据规模", { exact: true }).selectOption("10000");
  await page.getByLabel("持续时间 (s)", { exact: true }).fill("1");
  await page.getByRole("button", { name: "开始测试", exact: true }).click();
  await expect(page.getByText("测试完成", { exact: true })).toHaveCount(1);
  const host = page.frameLocator('iframe[title="Benchmark Preview Host"]');
  await expect(
    host.getByRole("cell", { name: "Record 1 · 10", exact: true }),
  ).toBeVisible();
  expect(await host.getByRole("row").count()).toBeLessThan(30);
  await host.locator("table").evaluate((node) => {
    node.parentElement!.scrollTop = node.parentElement!.scrollHeight;
  });
  await expect(
    host.getByRole("cell", { name: "Record 10000", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "选择语言" }).click();
  await expect(page.getByLabel("Run mode", { exact: true })).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toHaveCount(1);
  await expect(
    host.getByRole("cell", { name: "Record 10000", exact: true }),
  ).toBeVisible();
});
for (const mode of ["native", "sandbox"] as const) {
  test(`real ${mode} click records Host, Mock and actual UI commit stages`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Benchmarks", exact: true }).click();
    await page
      .getByLabel("测试组件", { exact: true })
      .selectOption("finance.risk-heatmap");
    await page.getByLabel("测试模式", { exact: true }).selectOption(mode);
    await page.getByLabel("持续时间 (s)", { exact: true }).fill("1");
    await page.getByRole("button", { name: "开始测试", exact: true }).click();
    await expect(page.getByText("测试完成", { exact: true })).toHaveCount(1);
    const host = page.frameLocator('iframe[title="Benchmark Preview Host"]');
    const view =
      mode === "native"
        ? host
        : host.frameLocator('iframe[title="Risk Heatmap Sandbox"]');
    await view
      .getByRole("gridcell", { name: "Region 1 信用 10", exact: true })
      .click();
    await expect(view.getByText("Agent risk detail")).toBeVisible();
    await expect(page.getByText("操作分段耗时", { exact: true })).toBeVisible();
    await expect(page.getByText("测试完成", { exact: true })).toHaveCount(2);
    const r = (await exportResults(page))[mode];
    expect(r.actions).toHaveLength(1);
    const timing = r.actions[0].timing;
    expect(timing.status).toBe("complete");
    expect(timing.inputToHostMs).toBeGreaterThanOrEqual(0);
    expect(timing.hostToMainMs).toBeGreaterThanOrEqual(0);
    expect(timing.mockMs).toBeGreaterThanOrEqual(750);
    expect(timing.responseCommitMs).toBeGreaterThanOrEqual(0);
    expect(timing.totalMs).toBeGreaterThan(timing.mockMs);
    expect(r.stats.scope).toBe("preview-host-document-best-effort");
    if (r.stats.memory)
      expect(r.stats.memory.usedJSHeapBytes).toBeGreaterThan(0);
    if (r.stats.longTasks)
      expect(r.stats.longTasks.count).toBe(r.stats.longTasks.entries.length);
    expect(r.initial.components[0].paintMs).toBeGreaterThanOrEqual(
      r.initial.components[0].commitMs,
    );
  });
}
test("load failures produce unavailable timings and stage diagnostics, then a valid fixture recovers in both modes", async ({
  page,
  request,
}) => {
  const { counterFixture } = await import("../fixtures/plugin");
  const fixture = await counterFixture(
    "benchmark.load-failure",
    () =>
      `import {definePlugin} from '@enterprise/agent-ui-plugin-sdk';throw new Error('Intentional module load failure');function View(){return <p>never mounted</p>}export default definePlugin({id:'benchmark.load-failure',version:'1.0.0',Component:View});`,
  );
  const uploaded = await request.post("/api/v1/plugins", {
    multipart: {
      metadata: JSON.stringify({
        manifest: fixture.manifest,
        catalog: fixture.catalog,
      }),
      file: {
        name: "load-failure.tsx",
        mimeType: "text/plain",
        buffer: Buffer.from(fixture.source),
      },
    },
  });
  expect(uploaded.ok(), await uploaded.text()).toBe(true);
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Benchmarks", exact: true }).click();
    await page
      .getByLabel("测试组件", { exact: true })
      .selectOption("benchmark.load-failure");
    await page.getByLabel("持续时间 (s)", { exact: true }).fill("1");
    await page.getByRole("button", { name: "开始测试", exact: true }).click();
    await expect(page.getByText("测试失败", { exact: true })).toHaveCount(2);
    const results = await exportResults(page);
    for (const mode of ["native", "sandbox"]) {
      expect(results[mode].coldReadyMs).toBeNull();
      expect(results[mode].updateP95).toBeNull();
      expect(results[mode].raw).toHaveLength(0);
      expect(results[mode].errors.join(" ")).toContain("PLUGIN_LOAD_ERROR");
      expect(results[mode].errorCounts.load).toBeGreaterThan(0);
      expect(results[mode].errorCounts.build).toBeNull();
    }
    await page
      .getByLabel("测试组件", { exact: true })
      .selectOption("finance.risk-heatmap");
    await page.getByRole("button", { name: "开始测试", exact: true }).click();
    await expect(page.getByText("测试完成", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    await request.delete("/api/v1/plugins/benchmark.load-failure");
  }
});
