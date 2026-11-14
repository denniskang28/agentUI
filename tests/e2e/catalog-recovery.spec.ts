import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeAll(async ({ request }) => {
  const response = await request.get("/api/v1/plugins");
  const { plugins } = await response.json();
  if (
    !plugins.some(
      (plugin: { id: string }) => plugin.id === "expense.approval-form",
    )
  ) {
    const installed = await request.post("/api/v1/plugins", {
      multipart: {
        file: {
          name: "expense-approval.zip",
          mimeType: "application/zip",
          buffer: await readFile("examples/dist/expense-approval.zip"),
        },
      },
    });
    expect(installed.ok(), await installed.text()).toBe(true);
  }
});

test("catalog recovers after interrupted requests without losing the draft", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/v1/components", async (route) => {
    requests++;
    if (requests <= 2) await route.abort("connectionrefused");
    else await route.continue();
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "文本", exact: true })
    .fill("保留当前草稿");
  const library = page.getByRole("complementary", { name: "组件库" });
  await expect(library.getByRole("status")).toHaveText(
    "组件列表加载失败，正在重试。",
  );
  await expect(
    library.getByRole("button", { name: /Expense Approval/ }),
  ).toBeVisible();
  await expect(library.getByRole("status")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "文本", exact: true }),
  ).toHaveValue("保留当前草稿");
  expect(requests).toBeGreaterThanOrEqual(3);
});

test("returning from Plugins refreshes a stale catalog and preserves the draft", async ({
  page,
}) => {
  await page.route("**/api/v1/components", (route) =>
    route.abort("connectionrefused"),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "文本", exact: true })
    .fill("切页后仍保留");
  await page.getByRole("button", { name: "Plugins", exact: true }).click();
  await expect(page.getByRole("table", { name: "已安装插件" })).toContainText(
    "Expense Approval",
  );
  await page.unroute("**/api/v1/components");
  await page.getByRole("button", { name: "Playground", exact: true }).click();
  await expect(
    page.locator(".component-item").filter({ hasText: "Expense Approval" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "文本", exact: true }),
  ).toHaveValue("切页后仍保留");
});
