import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  createMessage,
  patchMessage,
  enterpriseId,
  type Message,
} from "../../packages/protocol/src/index";

async function connect(
  page: Page,
  request: APIRequestContext,
  preview: Record<string, unknown>,
) {
  const response = await request.post("/api/v1/preview-sessions", {
    data: { actionHandler: "external", preview },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const session = await response.json();
  await page.goto(session.previewUrl);
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`/api/v1/preview-sessions/${session.sessionId}`)
          ).json()
        ).status,
    )
    .toBe("connected");
  let sequence = 1;
  return async (messages: Message[]) => {
    const lastSequence = sequence + messages.length - 1;
    const result = await request.post(
      `/api/v1/preview-sessions/${session.sessionId}/messages`,
      {
        data: {
          runId: session.runId,
          batchId: crypto.randomUUID(),
          firstSequence: sequence,
          messages,
        },
      },
    );
    expect(result.status(), await result.text()).toBe(202);
    await expect
      .poll(
        async () =>
          (
            await (
              await request.get(`/api/v1/preview-sessions/${session.sessionId}`)
            ).json()
          ).lastAppliedSequence,
      )
      .toBe(lastSequence);
    sequence = lastSequence + 1;
  };
}

test("one official Surface mixes progressive, deferred and initially gated live components", async ({
  page,
  request,
}) => {
  const send = await connect(page, request, {
    componentPolicies: {
      mixed: {
        root: { renderPolicy: "progressive" },
        now: { renderPolicy: "progressive" },
        deferred: { renderPolicy: "on_complete", readyWhen: "/state/complete" },
        live: { renderPolicy: "live", initialReadyWhen: "/state/initial" },
      },
    },
  });
  await send([
    createMessage(
      "mixed",
      [
        {
          id: "root",
          component: "Column",
          children: ["now", "deferred", "live"],
        },
        { id: "now", component: "Text", text: { "@path": "/immediate" } },
        {
          id: "deferred",
          component: "KPI",
          catalogId: enterpriseId,
          data: { "@path": "/metric" },
        },
        { id: "live", component: "Text", text: { "@path": "/liveText" } },
      ],
      {
        state: { complete: false, initial: false },
        immediate: "Already visible",
        metric: {
          label: "Deferred metric",
          value: 42,
          delta: "+1",
          trend: "up",
        },
        liveText: "Live starts here",
      },
    ),
  ]);
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await expect(host.getByText("Already visible")).toBeVisible();
  await expect(
    host.locator('[data-component-policy="deferred"]'),
  ).toBeVisible();
  await expect(host.getByText("Deferred metric")).toHaveCount(0);
  await expect(host.locator('[data-component-policy="live"]')).toBeVisible();
  await send([patchMessage("mixed", true, "/state/complete")]);
  await expect(host.getByText("Deferred metric")).toBeVisible();
  await expect(host.getByText("Live starts here")).toHaveCount(0);
  await send([patchMessage("mixed", true, "/state/initial")]);
  await expect(host.getByText("Live starts here")).toBeVisible();
  await send([
    patchMessage("mixed", false, "/state/initial"),
    patchMessage("mixed", "Live keeps updating", "/liveText"),
  ]);
  await expect(host.getByText("Live keeps updating")).toBeVisible();
  await page.getByRole("button", { name: "选择语言" }).click();
  await expect(host.getByText("Already visible")).toBeVisible();
  await expect(host.getByText("Live keeps updating")).toBeVisible();
});

test("ready cannot bypass plugin schema; timeout never mounts a form or dispatches an approval", async ({
  page,
  request,
}) => {
  const uploaded = await request.post("/api/v1/plugins", {
    multipart: {
      file: {
        name: "expense-approval.zip",
        mimeType: "application/zip",
        buffer: await readFile("examples/dist/expense-approval.zip"),
      },
    },
  });
  expect(uploaded.ok(), await uploaded.text()).toBe(true);
  const entry = (await uploaded.json()).entry;
  const send = await connect(page, request, {
    componentPolicies: {
      approval: {
        root: {
          renderPolicy: "on_complete",
          readyWhen: "/ready",
          timeoutMs: 100,
        },
      },
    },
  });
  await send([
    createMessage(
      "approval",
      [{ id: "root", component: entry.component, data: { "@path": "/view" } }],
      { view: {}, ready: true },
      entry.catalogId,
    ),
  ]);
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await expect(host.getByRole("alert")).toContainText("等待数据超时");
  await expect(host.locator("iframe")).toHaveCount(0);
  await send([patchMessage("approval", entry.defaults, "/view")]);
  const sandbox = host.frameLocator('iframe[title="Expense Approval Sandbox"]');
  await expect(
    sandbox.getByRole("button", { name: "批准", exact: true }),
  ).toBeVisible();
  const sessionId = new URL(page.url()).searchParams.get("session");
  const actions = await request.get(
    `/api/v1/preview-sessions/${sessionId}/actions`,
  );
  expect((await actions.json()).actions).toEqual([]);
});
test("external mode switch replays identical data and rejects results from the destroyed run", async ({
  page,
  request,
}) => {
  const send = await connect(page, request, {});
  await send([
    createMessage(
      "external",
      [{ id: "root", component: "Text", text: { "@path": "/text" } }],
      { text: "Keep this response" },
    ),
    patchMessage("external", "Keep the latest value", "/text"),
  ]);
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await expect(host.getByText("Keep the latest value")).toBeVisible();
  const sessionId = new URL(page.url()).searchParams.get("session");
  const url = `/api/v1/preview-sessions/${sessionId}`;
  const old = (await (await request.get(url)).json()).runId;
  await page.getByRole("button", { name: "Native", exact: true }).click();
  await page.getByRole("button", { name: "确认切换", exact: true }).click();
  await expect
    .poll(async () => (await (await request.get(url)).json()).runId)
    .not.toBe(old);
  await expect
    .poll(
      async () => (await (await request.get(url)).json()).lastAppliedSequence,
    )
    .toBe(2);
  await expect(host.getByText("Keep the latest value")).toBeVisible();
  const stale = await request.post(`${url}/messages`, {
    data: {
      runId: old,
      batchId: "late",
      firstSequence: 3,
      messages: [patchMessage("external", "WRONG", "/text")],
    },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).code).toBe("STALE_RUN");
  await expect(host.getByText("Keep the latest value")).toBeVisible();
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await expect(host.locator("[data-surface]")).toHaveCount(0);
  await expect
    .poll(
      async () => (await (await request.get(url)).json()).lastReceivedSequence,
    )
    .toBe(0);
});
