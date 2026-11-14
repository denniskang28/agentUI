import { test, expect } from "@playwright/test";

test("an existing parent reconnects to a reloaded Host and replays acknowledged history", async ({
  page,
}) => {
  await page.goto("http://localhost:5181");
  await page.getByRole("button", { name: /查看报销单/ }).click();
  const plugin = page
    .frameLocator('iframe[title="Agent UI"]')
    .frameLocator('iframe[title="Expense Approval Sandbox"]');
  await plugin.getByRole("textbox", { name: "审批意见" }).fill("恢复检查");
  await plugin.getByRole("button", { name: "批准", exact: true }).click();
  await expect(
    plugin.getByText("已批准", { exact: true }).first(),
  ).toBeVisible();
  const embedded = page
    .frames()
    .find((frame) => frame.url().startsWith("http://127.0.0.1:4183/"));
  expect(embedded).toBeTruthy();
  await embedded!.evaluate(() => location.reload());
  await expect(
    plugin.getByText("已批准", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(
    page
      .frames()
      .filter((frame) => frame.url().startsWith("http://127.0.0.1:4183/")),
  ).toHaveLength(1);
});

test("SSE reconnect recovers missed Agent messages without creating duplicate Surfaces", async ({
  page,
  context,
  request,
}) => {
  await page.goto("http://localhost:5181");
  await expect(page.getByText("已连接", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /查看报销单/ }).click();
  const host = page.frameLocator('iframe[title="Agent UI"]');
  await expect(
    host
      .frameLocator('iframe[title="Expense Approval Sandbox"]')
      .getByRole("textbox", { name: "审批意见" }),
  ).toBeVisible();
  const sessionId = await page.evaluate(() =>
    localStorage.getItem("conversation"),
  );
  const session = (await (
    await request.get(`http://localhost:5181/api/session?id=${sessionId}`)
  ).json()) as { runId: string };
  await context.setOffline(true);
  try {
    await expect(page.getByText("连接中", { exact: true })).toBeVisible();
    const response = await request.post(
      `http://localhost:5181/api/sessions/${sessionId}/chat`,
      { data: { runId: session.runId, text: "risk" } },
    );
    expect(response.status()).toBe(202);
  } finally {
    await context.setOffline(false);
  }
  await expect(page.getByText("已连接", { exact: true })).toBeVisible();
  await expect(
    host
      .frameLocator('iframe[title="Risk Heatmap Sandbox"]')
      .getByRole("gridcell", { name: "Singapore 市场 76" }),
  ).toBeVisible();
  await expect(host.locator("[data-surface]")).toHaveCount(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const decision of ["驳回", "退回修改"] as const) {
  test(`backend confirms ${decision} in both equivalent applications`, async ({
    page,
  }) => {
    for (const port of [5180, 5181]) {
      await page.goto(`http://localhost:${port}`);
      await page.getByRole("button", { name: /查看报销单/ }).click();
      const plugin =
        port === 5180
          ? page
          : page
              .frameLocator('iframe[title="Agent UI"]')
              .frameLocator('iframe[title="Expense Approval Sandbox"]');
      await plugin
        .getByRole("textbox", { name: "审批意见" })
        .fill("请补充发票");
      await plugin.getByRole("button", { name: decision, exact: true }).click();
      await expect(
        plugin
          .getByText(
            decision === "驳回"
              ? "已驳回"
              : port === 5180
                ? "已退回修改"
                : "已退回",
            {
              exact: true,
            },
          )
          .first(),
      ).toBeVisible();
    }
  });
}
