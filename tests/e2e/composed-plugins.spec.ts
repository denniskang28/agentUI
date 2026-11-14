import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createMessage, patchMessage } from "../../packages/protocol/src/index";
const entries: Record<string, any> = {};
test.beforeAll(async ({ request }) => {
  for (const file of ["finance-risk-heatmap.zip", "expense-approval.zip"]) {
    const response = await request.post("/api/v1/plugins", {
      multipart: {
        file: {
          name: file,
          mimeType: "application/zip",
          buffer: await readFile(`examples/dist/${file}`),
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const record = await response.json();
    entries[record.id] = record.entry;
  }
});
for (const mode of ["sandbox", "native"] as const)
  test(`two uploaded plugins share a Surface in ${mode} without mixing data or Actions`, async ({
    page,
    request,
  }) => {
    const heatmap = entries["finance.risk-heatmap"],
      approval = entries["expense.approval-form"];
    const response = await request.post("/api/v1/preview-sessions", {
      data: {
        actionHandler: "external",
        preview: {
          runtimeMode: mode,
          componentPolicies: {
            combined: {
              root: { renderPolicy: "progressive" },
              risk: { renderPolicy: "progressive" },
              approval: {
                renderPolicy: "on_complete",
                readyWhen: "/approvalReady",
              },
            },
          },
        },
      },
    });
    const session = await response.json();
    const path = `/api/v1/preview-sessions/${session.sessionId}`;
    await page.goto(session.previewUrl);
    await expect
      .poll(async () => (await (await request.get(path)).json()).status)
      .toBe("connected");
    let sequence = 1;
    const send = async (messages: any[]) => {
      const result = await request.post(`${path}/messages`, {
        data: {
          runId: session.runId,
          batchId: crypto.randomUUID(),
          firstSequence: sequence,
          messages,
        },
      });
      expect(result.status(), await result.text()).toBe(202);
      sequence += messages.length;
      await expect
        .poll(
          async () =>
            (await (await request.get(path)).json()).lastAppliedSequence,
        )
        .toBe(sequence - 1);
    };
    await send([
      createMessage(
        "combined",
        [
          { id: "root", component: "Column", children: ["risk", "approval"] },
          {
            id: "risk",
            component: heatmap.component,
            catalogId: heatmap.catalogId,
            data: { "@path": "/risk" },
          },
          {
            id: "approval",
            component: approval.component,
            catalogId: approval.catalogId,
            data: { "@path": "/approval" },
          },
        ],
        {
          risk: heatmap.defaults,
          approval: approval.defaults,
          approvalReady: false,
        },
      ),
    ]);
    const host = page.frameLocator('iframe[title="Preview Host"]');
    const risk =
      mode === "sandbox"
        ? host.frameLocator('iframe[title="Risk Heatmap Sandbox"]')
        : host;
    const form =
      mode === "sandbox"
        ? host.frameLocator('iframe[title="Expense Approval Sandbox"]')
        : host;
    await risk.getByRole("gridcell", { name: "Japan 信用 42" }).click();
    await expect(
      host.locator('[data-component-policy="approval"]'),
    ).toBeVisible();
    await send([patchMessage("combined", true, "/approvalReady")]);
    const comment = form.locator("textarea");
    await comment.fill("Native/Sandbox reviewed");
    await page.getByRole("button", { name: "选择语言" }).click();
    await expect(comment).toHaveValue("Native/Sandbox reviewed");
    await expect(comment).toBeFocused();
    await expect(
      risk.getByRole("gridcell", { name: "Japan Credit 42" }),
    ).toHaveAttribute("aria-selected", "true");
    const approve = form.getByRole("button", { name: "Approve", exact: true });
    await approve.dblclick({ force: true });
    await expect(
      form.getByRole("button", { name: "Submitting", exact: true }),
    ).toBeDisabled();
    const received = () =>
      request.get(`${path}/actions`).then((response) => response.json());
    await expect.poll(async () => (await received()).actions.length).toBe(2);
    const actions = (await received()).actions.map(
      (event: any) => event.payload.action.action,
    );
    expect(
      actions.map((action: any) => [
        action.name,
        action.surfaceId,
        action.sourceComponentId,
      ]),
    ).toEqual([
      ["finance.risk.drilldown", "combined", "risk"],
      ["expense.approve", "combined", "approval"],
    ]);
    expect(actions[1].context.idempotencyKey).toBeTruthy();
    expect(actions[1].context.comment).toBe("Native/Sandbox reviewed");
    await send([
      patchMessage(
        "combined",
        { ...approval.defaults, status: "approved" },
        "/approval",
      ),
      patchMessage(
        "combined",
        { ...heatmap.defaults, title: "Independent risk update" },
        "/risk",
      ),
    ]);
    await expect(form.getByRole("status")).toContainText("Approved");
    await expect(risk.getByText("Independent risk update")).toBeVisible();
    await expect(
      risk.getByRole("gridcell", { name: "Japan Credit 42" }),
    ).toHaveAttribute("aria-selected", "true");
    await send([{ version: "1.0", deleteSurface: { surfaceId: "combined" } }]);
    await expect(host.locator("[data-surface]")).toHaveCount(0);
    await expect(host.locator("iframe")).toHaveCount(0);
    await request.delete(path);
  });
