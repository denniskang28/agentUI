import { test, expect } from "@playwright/test";
import { counterFixture } from "../fixtures/plugin";
const pluginId = "intl.external-counter";
test.beforeAll(async ({ request }) => {
  const fixture = await counterFixture(pluginId);
  const response = await request.post("/api/v1/plugins", {
    multipart: {
      metadata: JSON.stringify({
        manifest: fixture.manifest,
        catalog: fixture.catalog,
      }),
      file: {
        name: "counter.tsx",
        mimeType: "text/plain",
        buffer: Buffer.from(fixture.source),
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
});
for (const initialMode of ["sandbox", "native"] as const)
  test(`${initialMode} external locale preserves the current instance and survives mode replay and Reset`, async ({
    page,
    request,
  }) => {
    const session = await (
      await request.post("/api/v1/preview-sessions", {
        data: {
          preview: { runtimeMode: initialMode, locale: "zh-CN" },
        },
      })
    ).json();
    const route = `/api/v1/preview-sessions/${session.sessionId}`;
    try {
      await page.goto(session.previewUrl);
      await expect
        .poll(async () => (await (await request.get(route)).json()).status)
        .toBe("connected");
      const template = await (
        await request.post(`/api/v1/templates/${pluginId}~full/instantiate`, {
          data: {},
        })
      ).json();
      const submit = async (runId: string, batchId: string) => {
        const response = await request.post(`${route}/messages`, {
          data: {
            runId,
            batchId,
            firstSequence: 1,
            messages: template.messages,
          },
        });
        expect(response.status(), await response.text()).toBe(202);
      };
      await submit(session.runId, "initial");
      const host = page.frameLocator('iframe[title="Preview Host"]');
      const sandbox = host.frameLocator(`iframe[title="${pluginId} Sandbox"]`);
      const root = initialMode === "sandbox" ? sandbox : host;
      await root.getByRole("button", { name: "增加", exact: true }).click();
      await expect(root.getByTestId("local-clicks")).toHaveText("1");
      await page.getByRole("button", { name: "选择语言" }).click();
      await expect(root.getByTestId("counter-locale")).toHaveText("en-US");
      await expect(root.getByTestId("local-clicks")).toHaveText("1");
      const nextMode = initialMode === "sandbox" ? "Native" : "Sandbox";
      await page.getByRole("button", { name: nextMode, exact: true }).click();
      await page
        .getByRole("button", { name: "Switch mode", exact: true })
        .click();
      const nextRoot = initialMode === "sandbox" ? host : sandbox;
      await expect(nextRoot.getByTestId("counter-locale")).toHaveText("en-US");
      await expect(nextRoot.getByTestId("local-clicks")).toHaveText("0");
      const switched = await (await request.get(route)).json();
      expect(switched.runId).not.toBe(session.runId);
      expect(switched.config.locale).toBe("en-US");
      const actions = await (
        await request.get(`${route}/actions?after=0`)
      ).json();
      expect(actions.actions).toHaveLength(1);
      await page
        .getByRole("button", { name: "Reset", exact: true })
        .last()
        .click();
      await expect
        .poll(async () => (await (await request.get(route)).json()).runId)
        .not.toBe(switched.runId);
      const reset = await (await request.get(route)).json();
      expect(reset.config.locale).toBe("en-US");
      expect(reset.lastReceivedSequence).toBe(0);
      await submit(reset.runId, "after-reset");
      await expect(
        nextRoot.getByRole("button", { name: "Increment", exact: true }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    } finally {
      await request.delete(route);
    }
  });
test.afterAll(async ({ request }) => {
  await request.delete(`/api/v1/plugins/${pluginId}`);
});
