import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.beforeAll(async ({ request }) => {
  for (const filename of ["finance-risk-heatmap.zip", "expense-approval.zip"]) {
    const response = await request.post("/api/v1/plugins", {
      multipart: {
        file: {
          name: filename,
          mimeType: "application/zip",
          buffer: await readFile(`examples/dist/${filename}`),
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const record = await response.json();
    expect(record.status).toBe("ready");
    expect(record.bytes).toBeGreaterThan(10000);
  }
});
test("uploaded heatmap renders, dispatches and preserves locale state in Sandbox and Native", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".component-item")
    .filter({ hasText: "Risk Heatmap" })
    .click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  const sandbox = host.frameLocator('iframe[title="Risk Heatmap Sandbox"]');
  await expect(
    sandbox.getByRole("gridcell", { name: "Japan 信用 42" }),
  ).toBeVisible();
  await sandbox.getByRole("gridcell", { name: "Japan 信用 42" }).click();
  await expect(sandbox.getByText("Agent risk detail")).toBeVisible();
  await page.getByRole("button", { name: "选择语言" }).click();
  await expect(
    sandbox.getByRole("gridcell", { name: "Japan Credit 42" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Native", exact: true }).click();
  await page.getByRole("button", { name: "Switch mode", exact: true }).click();
  await expect(
    host.getByRole("gridcell", { name: "Japan Credit 42" }),
  ).toBeVisible();
  await expect(host.locator("iframe")).toHaveCount(0);
  await host.getByRole("gridcell", { name: "Singapore Market 68" }).click();
  await expect(host.getByText("Agent risk detail")).toBeVisible();
  await page.getByRole("button", { name: "Select language" }).click();
  await expect(
    host.getByRole("gridcell", { name: "Singapore 市场 68" }),
  ).toHaveAttribute("aria-selected", "true");
});
test("deferred approval waits after data arrival and only opens when ready; real action updates UI", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".component-item")
    .filter({ hasText: "Expense Approval" })
    .click();
  await page.getByRole("radio", { name: /等待完整数据/ }).click();
  await page.getByRole("button", { name: "渲染并播放" }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await expect(host.getByText("等待完整数据", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(host.getByText("等待完整数据", { exact: true })).toBeVisible();
  await expect(host.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "下一步" }).click();
  const sandbox = host.frameLocator('iframe[title="Expense Approval Sandbox"]');
  await expect(
    sandbox.getByRole("button", { name: "批准", exact: true }),
  ).toBeVisible();
  await sandbox
    .getByRole("textbox", { name: "审批意见", exact: true })
    .fill("Approved after review");
  await page.getByRole("button", { name: "选择语言" }).click();
  await expect(
    sandbox.getByRole("textbox", { name: "Comment", exact: true }),
  ).toHaveValue("Approved after review");
  await sandbox.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    sandbox.getByRole("button", { name: "Submitting" }),
  ).toBeDisabled();
  await expect(sandbox.getByRole("status")).toContainText("Approved");
  await page.getByRole("button", { name: "Inspector" }).click();
  await page.getByRole("button", { name: "Actions 1", exact: true }).click();
  await expect(page.locator(".inspector pre")).toContainText("expense.approve");
  await expect(page.locator(".inspector pre")).toContainText("idempotencyKey");
});
test("unknown TSX plugin installs through generic metadata and exposes locale", async ({
  page,
  request,
}) => {
  const manifest = JSON.parse(
    await readFile("examples/plugins/unknown-counter/plugin.json", "utf8"),
  );
  const catalog = JSON.parse(
    await readFile("examples/plugins/unknown-counter/catalog.json", "utf8"),
  );
  const response = await request.post("/api/v1/plugins", {
    multipart: {
      metadata: JSON.stringify({ manifest, catalog }),
      file: {
        name: "third-party-counter.tsx",
        mimeType: "text/plain",
        buffer: await readFile(
          "examples/plugins/unknown-counter/src/index.tsx",
        ),
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await page.goto("/");
  await page
    .locator(".component-item")
    .filter({ hasText: "Third-party Counter" })
    .click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  const sandbox = host.frameLocator(
    'iframe[title="Third-party Counter Sandbox"]',
  );
  await sandbox.getByRole("button", { name: "增加", exact: true }).click();
  await expect(sandbox.getByTestId("local-clicks")).toHaveText("1");
  await page.getByRole("button", { name: "选择语言" }).click();
  await expect(sandbox.getByTestId("counter-locale")).toHaveText("en-US");
  await expect(sandbox.getByTestId("local-clicks")).toHaveText("1");
});
