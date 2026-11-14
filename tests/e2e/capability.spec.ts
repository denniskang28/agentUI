import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { instantiate, builtins } from "../../packages/catalog/src/index";
import { insuranceCapabilityExample } from "../../packages/catalog/src/capability";
import { patchMessage, type Message } from "../../packages/protocol/src/index";

const entry = builtins.find((e) => e.key === "capability-profile")!;
async function connect(
  page: Page,
  request: APIRequestContext,
  preview: Record<string, unknown> = {},
) {
  const session = await (
    await request.post("/api/v1/preview-sessions", {
      data: { actionHandler: "external", preview },
    })
  ).json();
  const route = `/api/v1/preview-sessions/${session.sessionId}`;
  await page.goto(session.previewUrl);
  await expect
    .poll(async () => (await (await request.get(route)).json()).status)
    .toBe("connected");
  let sequence = 1;
  return {
    route,
    send: async (messages: Message[]) => {
      const last = sequence + messages.length - 1;
      const response = await request.post(`${route}/messages`, {
        data: {
          runId: session.runId,
          batchId: `cap-${sequence}`,
          firstSequence: sequence,
          messages,
        },
      });
      expect(response.status(), await response.text()).toBe(202);
      await expect
        .poll(
          async () =>
            (await (await request.get(route)).json()).lastAppliedSequence,
        )
        .toBe(last);
      sequence = last + 1;
    },
  };
}

test("gallery exposes capability colors and independent layout switches", async ({
  page,
  request,
}) => {
  const discovered = await (
    await request.get("/api/v1/components/capability-profile")
  ).json();
  expect(discovered.actions).toEqual([
    "capability.dimensionSelect",
    "capability.scenarioChange",
  ]);
  await page.goto("/");
  await page
    .getByRole("button", { name: "CapabilityProfile", exact: true })
    .click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  const render = page
    .getByRole("button", { name: "渲染", exact: true })
    .first();
  await render.click();
  await expect(host.getByText("陈晓宁", { exact: true })).toBeVisible();
  await page.getByLabel("当前能力颜色", { exact: true }).fill("#4169ad");
  await page.getByLabel("目标线颜色", { exact: true }).fill("#aa6655");
  await page.getByLabel("填充强度 (%)", { exact: true }).fill("25");
  await page.getByLabel("显示能力维度明细", { exact: true }).uncheck();
  await render.click();
  await expect(host.getByRole("region", { name: "能力维度明细" })).toHaveCount(
    0,
  );
  await expect(host.locator(".cp-score-polygon")).toHaveCSS(
    "stroke",
    "rgb(65, 105, 173)",
  );
  await expect(host.locator(".cp-target-polygon")).toHaveCSS(
    "stroke",
    "rgb(170, 102, 85)",
  );
  await expect(host.locator(".capability-profile")).toHaveCSS(
    "--cp-opacity",
    "25%",
  );
  await host.getByLabel("查看维度").selectOption("compliance");
  await expect(
    host.getByRole("region", { name: "维度评价说明" }),
  ).toContainText("隐私保护");
  await mkdir("artifacts/capability/visual", { recursive: true });
  await page.screenshot({
    path: "artifacts/capability/visual/configured-chart-only-1440.png",
    fullPage: true,
  });
  await page.getByLabel("显示底部评价说明", { exact: true }).uncheck();
  await render.click();
  await expect(host.getByRole("region", { name: "维度评价说明" })).toHaveCount(
    0,
  );
  await expect(host.getByRole("img")).toBeVisible();
});

test("official bound selection, real Actions and streamed score/configuration patches preserve state", async ({
  page,
  request,
}) => {
  const { route, send } = await connect(page, request);
  try {
    await send(instantiate(entry, entry.defaults, "full").messages);
    const host = page.frameLocator('iframe[title="Preview Host"]');
    await host.getByLabel("评估场景").selectOption("service");
    await host
      .getByRole("button", { name: "客户经营: 72 / 90", exact: true })
      .click();
    await expect(host.locator(".cp-detail")).toContainText("距场景目标 18 分");
    await expect
      .poll(
        async () =>
          (await (await request.get(`${route}/actions?after=0`)).json()).actions
            .length,
      )
      .toBe(2);
    const actions = (
      await (await request.get(`${route}/actions?after=0`)).json()
    ).actions;
    expect(JSON.stringify(actions)).toContain("capability.scenarioChange");
    expect(JSON.stringify(actions)).toContain('"dimensionId":"relationship"');
    expect(JSON.stringify(actions)).toContain('"scenarioId":"service"');
    const before = await host
      .locator(".cp-score-polygon")
      .getAttribute("points");
    await send([patchMessage("main", 89, "/view/scores/relationship")]);
    await expect(host.locator(".cp-detail")).toContainText("距场景目标 1 分");
    await expect(host.getByLabel("评估场景")).toHaveValue("service");
    expect(
      await host.locator(".cp-score-polygon").getAttribute("points"),
    ).not.toBe(before);
    await send([patchMessage("main", false, "/view/showDimensions")]);
    await expect(host.locator(".cp-breakdown")).toHaveCount(0);
    await expect(host.getByLabel("查看维度")).toHaveValue("relationship");
    await page.getByRole("button", { name: "选择语言" }).click();
    await expect(host.getByLabel("Assessment scenario")).toHaveValue("service");
    await expect(host.locator(".cp-detail")).toContainText("Below target by 1");
    await expect(host.getByText("陈晓宁", { exact: true })).toBeVisible();
    expect(
      (await (await request.get(`${route}/actions?after=0`)).json()).actions
        .length,
    ).toBe(2);
  } finally {
    await request.delete(route);
  }
});

test("missing scores are not zero-filled and custom 3-dimension scales normalize correctly", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const { route, send } = await connect(page, request);
  try {
    const data = {
      title: "Custom skills",
      subjectId: "custom",
      subjectName: "Example",
      dimensions: ["a", "b", "c"].map((id) => ({
        id,
        label: id.toUpperCase(),
        min: 0,
        max: 5,
      })),
      scores: { a: 4, b: null, c: 3 },
      scenarios: [
        { id: "target", label: "Target", targets: { a: 5, b: 5, c: 5 } },
      ],
      showDimensions: false,
    };
    await send(instantiate(entry, data).messages);
    const host = page.frameLocator('iframe[title="Preview Host"]');
    await expect(host.locator(".cp-score-polygon")).toHaveCount(0);
    await expect(host.locator(".cp-point")).toHaveCount(2);
    await expect(host.getByRole("status")).toContainText("部分维度尚未评估");
    await send([patchMessage("main", 2, "/view/scores/b")]);
    await expect(host.locator(".cp-score-polygon")).toHaveCount(1);
    await expect(host.locator(".cp-point")).toHaveCount(3);
    await expect(host.locator(".cp-detail")).toContainText("原始刻度：0–5");
    await send([patchMessage("main", 8, "/view/scores/b")]);
    await expect(host.getByRole("alert")).toContainText("数据校验失败");
  } finally {
    await request.delete(route);
  }
});

test("capability layout evidence at fixed viewports, locales and themes", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  await mkdir("artifacts/capability/visual", { recursive: true });
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [375, 812],
  ]) {
    await page.setViewportSize({ width, height });
    for (const locale of ["zh-CN", "en-US"] as const)
      for (const theme of ["light", "dark"] as const) {
        const { route, send } = await connect(page, request, { locale, theme });
        try {
          await send(instantiate(entry, insuranceCapabilityExample).messages);
          if (width === 375)
            await page
              .getByRole("tab", {
                name: locale === "zh-CN" ? "预览面板" : "Preview",
                exact: true,
              })
              .click();
          const host = page.frameLocator('iframe[title="Preview Host"]');
          await expect(host.locator(".cp-score-polygon")).toBeVisible();
          const bounds = await host
            .locator(".capability-profile")
            .evaluate((el) => ({
              width: el.clientWidth,
              scroll: el.scrollWidth,
            }));
          expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
          await page.screenshot({
            path: `artifacts/capability/visual/${locale}-${theme}-${width}.png`,
            fullPage: true,
          });
        } finally {
          await request.delete(route);
        }
      }
  }
});
