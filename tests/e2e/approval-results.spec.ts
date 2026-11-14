import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.beforeAll(async ({ request }) => {
  const response = await request.post("/api/v1/plugins", {
    multipart: {
      file: {
        name: "expense-approval.zip",
        mimeType: "application/zip",
        buffer: await readFile("examples/dist/expense-approval.zip"),
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
});
for (const mode of ["sandbox", "native"])
  test(`${mode} validates comments in the current language and processes rejection, repeated errors and retry intents`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .locator(".component-item")
      .filter({ hasText: "Expense Approval" })
      .click();
    if (mode === "native") {
      await page.getByRole("button", { name: "Native", exact: true }).click();
      await page.getByRole("button", { name: "确认切换", exact: true }).click();
    }
    await page
      .getByRole("button", { name: "平台运行配置", exact: true })
      .click();
    await page.getByLabel("响应延迟", { exact: true }).fill("200");
    await page
      .getByRole("button", { name: "渲染", exact: true })
      .first()
      .click();
    const host = page.frameLocator('iframe[title="Preview Host"]');
    const form =
      mode === "sandbox"
        ? host.frameLocator('iframe[title="Expense Approval Sandbox"]')
        : host;
    await form
      .getByRole("button", { name: "驳回", exact: true })
      .press("Enter");
    await expect(form.getByRole("alert")).toHaveText(
      "驳回或退回时必须填写意见",
    );
    await page.getByRole("button", { name: "选择语言" }).click();
    await expect(form.getByRole("alert")).toHaveText(
      "A comment is required when rejecting or requesting changes",
    );
    await form
      .getByRole("textbox", { name: "Comment", exact: true })
      .fill("Reviewed 业务意见");
    await form.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Rejected");
    await expect(form.getByRole("status")).toContainText("Reviewed 业务意见");
    await page
      .getByRole("button", { name: "Render", exact: true })
      .first()
      .click();
    await page.getByLabel("Mock result", { exact: true }).selectOption("error");
    await form
      .getByRole("textbox", { name: "Comment", exact: true })
      .fill("Retry unchanged intent");
    const approve = form.getByRole("button", { name: "Approve", exact: true });
    await approve.dblclick();
    await expect(
      form.getByRole("button", { name: "Submitting", exact: true }),
    ).toBeDisabled();
    await expect(approve).toBeEnabled();
    await expect(form.getByRole("alert")).toHaveText(
      "Approval failed. Please retry.",
    );
    await approve.click();
    await expect(approve).toBeEnabled();
    await expect(form.getByRole("alert")).toHaveText(
      "Approval failed. Please retry.",
    );
    await page.getByRole("button", { name: "Inspector" }).click();
    await page.getByRole("button", { name: "Actions 2", exact: true }).click();
    const actions = JSON.parse(
      await page.locator(".inspector pre").innerText(),
    );
    expect(actions).toHaveLength(2);
    expect(actions[0].action.context.idempotencyKey).toBeTruthy();
    expect(actions[1].action.context.idempotencyKey).toBe(
      actions[0].action.context.idempotencyKey,
    );
    await page
      .getByLabel("Mock result", { exact: true })
      .selectOption("success");
    await form
      .getByRole("button", { name: "Request changes", exact: true })
      .click();
    await expect(form.getByRole("status")).toContainText("Changes requested");
    await page.getByRole("button", { name: "Actions 3", exact: true }).click();
    const updated = JSON.parse(
      await page.locator(".inspector pre").innerText(),
    );
    expect(updated[2].action.context.idempotencyKey).not.toBe(
      actions[0].action.context.idempotencyKey,
    );
    await page.getByRole("button", { name: "Select language" }).click();
    await expect(form.getByRole("status")).toContainText("已退回");
    await expect(form.getByRole("status")).toContainText(
      "Retry unchanged intent",
    );
  });
