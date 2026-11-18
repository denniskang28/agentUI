import { chatbotOrigins } from "./origins";
import { test, expect } from "@playwright/test";

for (const runtime of ["sandbox", "native"] as const) {
  test(`${runtime}: failed approval retries, preserves input/locale, and rejects late runs`, async ({
    page,
    request,
  }) => {
    await page.goto(`${chatbotOrigins.integrated}`);
    await expect(page.getByText("已连接", { exact: true })).toBeVisible();
    if (runtime === "native")
      await page.getByLabel("Runtime mode").selectOption(runtime);
    await page.getByRole("button", { name: /查看报销单/ }).click();
    const host = page.frameLocator('iframe[title="Agent UI"]');
    const plugin =
      runtime === "sandbox"
        ? host.frameLocator('iframe[title="Expense Approval Sandbox"]')
        : host;
    await plugin
      .getByRole("textbox", { name: "审批意见" })
      .fill("保留这段意见");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(plugin.getByRole("textbox", { name: "Comment" })).toHaveValue(
      "保留这段意见",
    );
    await page.getByText("Developer trace", { exact: true }).click();
    await page
      .getByRole("button", { name: "Fail next action", exact: true })
      .click();
    await plugin.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(
      plugin.getByRole("button", { name: "Approve", exact: true }),
    ).toBeEnabled();
    await expect(plugin.getByRole("alert")).toBeVisible();
    const trace = JSON.parse(await page.locator("pre").innerText()) as {
      type: string;
      payload: { action?: unknown };
    }[];
    const first = trace.find(
      (event) => event.type === "trace" && event.payload.action,
    );
    expect(first?.payload.action).toMatchObject({
      protocol: "enterprise-agent-ui/1",
      message: {
        version: "1.0",
        action: {
          name: "expense.approve",
          context: { comment: "保留这段意见", reportId: "EXP-001" },
          sourceComponentId: "root",
        },
      },
    });
    await plugin.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(
      plugin.getByText("Approved", { exact: true }).first(),
    ).toBeVisible();
    const session = await page.evaluate(() =>
      localStorage.getItem("conversation:with-agent-ui"),
    );
    const old = (await (
      await request.get(
        `${chatbotOrigins.integrated}/api/session?id=${session}`,
      )
    ).json()) as { runId: string };
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await expect(plugin.getByText("Approved", { exact: true })).toHaveCount(0);
    const stale = await request.post(
      `${chatbotOrigins.integrated}/api/sessions/${session}/actions`,
      { data: { runId: old.runId, action: first?.payload.action } },
    );
    expect(stale.status()).toBe(409);
    await expect(host.locator("[data-surface]")).toHaveCount(0);
  });

  test(`${runtime}: template creation, raw stream update and Agent drilldown share the same plugin`, async ({
    page,
  }) => {
    await page.goto(`${chatbotOrigins.integrated}`);
    await expect(page.getByText("已连接", { exact: true })).toBeVisible();
    if (runtime === "native")
      await page.getByLabel("Runtime mode").selectOption(runtime);
    await page.getByRole("button", { name: /查看区域风险/ }).click();
    const host = page.frameLocator('iframe[title="Agent UI"]');
    const plugin =
      runtime === "sandbox"
        ? host.frameLocator('iframe[title="Risk Heatmap Sandbox"]')
        : host;
    await expect(
      plugin.getByRole("gridcell", { name: "Singapore 市场 76" }),
    ).toBeVisible();
    await plugin.getByRole("gridcell", { name: "Japan 信用 42" }).click();
    await expect(
      plugin.getByText("Japan: Agent risk detail", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(
      plugin.getByRole("gridcell", { name: "Japan Credit 42" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(host.locator("[data-surface]")).toHaveCount(1);
  });
}

test("Host is credential-free static serving and refuses session API access", async ({
  request,
}) => {
  const response = await request.get(`${chatbotOrigins.host}/`);
  expect(response.headers()["content-security-policy"]).toContain(
    `frame-ancestors ${chatbotOrigins.baseline} ${chatbotOrigins.integrated}`,
  );
  expect(response.headers()["set-cookie"]).toBeUndefined();
  expect(
    (
      await request.get(`${chatbotOrigins.host}/api/v1/preview-sessions`)
    ).status(),
  ).toBe(404);
  const configuration = await (
    await request.get(`${chatbotOrigins.host}/host-config.json`)
  ).json();
  expect(configuration.allowedParents).toEqual(
    expect.arrayContaining([
      `${chatbotOrigins.baseline}`,
      `${chatbotOrigins.integrated}`,
    ]),
  );
});
