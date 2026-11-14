import { test, expect } from "@playwright/test";
import {
  createMessage,
  patchMessage,
  type Message,
} from "../../packages/protocol/src/index";

test("unknown leaves and roots show localized placeholders while real bindings and Actions keep working", async ({
  page,
  request,
}) => {
  const session = await (
    await request.post("/api/v1/preview-sessions", {
      data: { actionHandler: "external" },
    })
  ).json();
  const path = `/api/v1/preview-sessions/${session.sessionId}`;
  try {
    await page.goto(session.previewUrl);
    await expect
      .poll(async () => (await (await request.get(path)).json()).status)
      .toBe("connected");
    let sequence = 1;
    const send = async (messages: Message[]) => {
      const response = await request.post(`${path}/messages`, {
        data: {
          batchId: crypto.randomUUID(),
          runId: session.runId,
          firstSequence: sequence,
          messages,
        },
      });
      expect(response.status(), await response.text()).toBe(202);
      sequence += messages.length;
      await expect
        .poll(
          async () =>
            (await (await request.get(path)).json()).lastAppliedSequence,
        )
        .toBe(sequence - 1);
    };
    const initial = [
      createMessage(
        "mixed",
        [
          {
            id: "root",
            component: "Column",
            children: ["text", "unknown", "field", "button"],
          },
          { id: "text", component: "Text", text: { "@path": "/value" } },
          {
            id: "unknown",
            component: "FutureCard",
            business: { title: "Original payload" },
          },
          {
            id: "field",
            component: "TextField",
            label: "Unchanged input",
            value: { "@path": "/input" },
          },
          {
            id: "button",
            component: "Button",
            child: "label",
            action: {
              event: { name: "test.continue", context: { raw: "未翻译" } },
            },
          },
          { id: "label", component: "Text", text: "Continue action" },
        ],
        { value: "Before update", input: "" },
      ),
      createMessage(
        "unknownRoot",
        [{ id: "root", component: "FutureRoot" }],
        {},
      ),
    ];
    await send(initial);
    const host = page.frameLocator('iframe[title="Preview Host"]');
    await expect(host.getByRole("note")).toHaveCount(2);
    await expect(host.getByRole("note").first()).toContainText(
      "不支持的组件: FutureCard",
    );
    await host
      .getByRole("textbox", { name: "Unchanged input" })
      .fill("local draft");
    await send([patchMessage("mixed", "After update", "/value")]);
    await expect(host.getByText("After update", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "选择语言" }).click();
    await expect(host.getByRole("note").first()).toContainText(
      "Unsupported component: FutureCard",
    );
    await expect(
      host.getByRole("textbox", { name: "Unchanged input" }),
    ).toHaveValue("local draft");
    await host.getByRole("button", { name: "Continue action" }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(`${path}/actions`)).json()).actions.length,
      )
      .toBe(1);
    const actions = await (await request.get(`${path}/actions`)).json();
    expect(actions.actions[0].payload.action.action.name).toBe("test.continue");
    expect(actions.actions[0].payload.action.action.context.raw).toBe("未翻译");
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page
      .getByRole("region", { name: "Inspector", exact: true })
      .getByRole("button", { name: "Messages", exact: true })
      .click();
    await expect(page.locator(".inspector pre")).toContainText(
      '"component": "FutureCard"',
    );
    await expect(page.locator(".inspector pre")).toContainText(
      "Original payload",
    );
    await expect(page.locator(".inspector pre")).not.toContainText(
      "UnsupportedComponent",
    );
    const rawHistory = JSON.parse(
      await page.locator(".inspector pre").innerText(),
    );
    expect(rawHistory[0].createSurface.dataModel).toEqual({
      value: "Before update",
      input: "",
    });
    await send([
      {
        version: "1.0",
        updateComponents: {
          surfaceId: "mixed",
          components: [
            { id: "unknown", component: "Text", text: "Now installed" },
          ],
        },
      },
      {
        version: "1.0",
        updateComponents: {
          surfaceId: "unknownRoot",
          components: [
            { id: "root", component: "Text", text: "Root recovered" },
          ],
        },
      },
    ]);
    await expect(host.getByRole("note")).toHaveCount(0);
    await expect(
      host.getByText("Now installed", { exact: true }),
    ).toBeVisible();
    await expect(
      host.getByText("Root recovered", { exact: true }),
    ).toBeVisible();
    await expect(
      host.getByRole("textbox", { name: "Unchanged input" }),
    ).toHaveValue("local draft");
  } finally {
    await request.delete(path);
  }
});
