import { test, expect } from "@playwright/test";
import { counterFixture } from "../fixtures/plugin";
const probeSource = `import {useState} from 'react';import {definePlugin,useHostAction} from '@enterprise/agent-ui-plugin-sdk';
function Probe(){const [result,setResult]=useState('idle');const dispatch=useHostAction();return <section><button onClick={async()=>{const checks=[];try{parent.document.body;checks.push('DOCUMENT_ESCAPE')}catch{checks.push('document blocked')}try{top.location.href='http://localhost:5173/?escaped=1';checks.push('NAVIGATION_ESCAPE')}catch{checks.push('navigation blocked')}try{await fetch('http://localhost:5173/api/v1/components');checks.push('NETWORK_ESCAPE')}catch{checks.push('network blocked')}dispatch('undeclared.action',{});const context={};context.self=context;dispatch('counter.increment',context);setResult(checks.join('; '))}}>Probe boundaries</button><output data-testid="probe-result">{result}</output></section>}
export default definePlugin({id:'security.runtime-probe',version:'1.0.0',Component:Probe});`;
test.beforeAll(async ({ request }) => {
  for (const [id, source] of [
    ["security.runtime-probe", probeSource],
    [
      "security.throwing",
      `import {definePlugin} from '@enterprise/agent-ui-plugin-sdk';function Broken(){throw new Error('Intentional renderer failure')}export default definePlugin({id:'security.throwing',version:'1.0.0',Component:Broken});`,
    ],
  ]) {
    const fixture = await counterFixture(id, () => source);
    const response = await request.post("/api/v1/plugins", {
      multipart: {
        metadata: JSON.stringify({
          manifest: fixture.manifest,
          catalog: fixture.catalog,
        }),
        file: {
          name: "probe.tsx",
          mimeType: "text/plain",
          buffer: Buffer.from(source),
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
});
for (const mode of ["sandbox", "native"] as const) {
  test(`${mode} forwards actual plugin failure to the external Agent and destroys the preview`, async ({
    page,
    request,
  }) => {
    const session = (
      await request.post("/api/v1/preview-sessions", {
        data: { preview: { runtimeMode: mode, locale: "en-US" } },
      })
    ).json();
    const connection = await session;
    const route = `/api/v1/preview-sessions/${connection.sessionId}`;
    try {
      await page.goto(connection.previewUrl);
      await expect
        .poll(async () => (await (await request.get(route)).json()).status)
        .toBe("connected");
      const template = await (
        await request.post(
          "/api/v1/templates/security.throwing~full/instantiate",
          { data: {} },
        )
      ).json();
      const receipt = await request.post(`${route}/messages`, {
        data: {
          batchId: "actual-runtime-error",
          runId: connection.runId,
          firstSequence: 1,
          messages: template.messages,
        },
      });
      expect(receipt.status(), await receipt.text()).toBe(202);
      const host = page.frameLocator('iframe[title="Preview Host"]');
      await expect(host.getByRole("alert")).toContainText(
        "Component render failed",
      );
      const response = await fetch(`http://127.0.0.1:3001${route}/events`, {
        signal: AbortSignal.timeout(8000),
      });
      const reader = response.body!.getReader();
      let events = "";
      try {
        while (!events.includes("Intentional renderer failure")) {
          const chunk = await reader.read();
          if (chunk.done) throw Error("SSE closed before runtime error");
          events += new TextDecoder().decode(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      const error = events
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.slice(6)))
        .find((event) => event.type === "run.error");
      expect(error.runId).toBe(connection.runId);
      expect(JSON.stringify(error.payload.errors)).toContain(
        "Intentional renderer failure",
      );
      expect((await request.delete(route)).status()).toBe(204);
      await expect(host.locator(".surface")).toHaveCount(0);
      await expect(
        page.getByText("Session ended", { exact: true }),
      ).toBeVisible();
      expect((await request.get(route)).status()).toBe(404);
    } finally {
      await request.delete(route);
    }
  });
  test(`${mode} rejects parent access, top navigation, network and undeclared/cyclic Actions`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .locator(".component-item")
      .filter({ hasText: "security.runtime-probe" })
      .click();
    if (mode === "native") {
      await page.getByRole("button", { name: "Native", exact: true }).click();
      await page.getByRole("button", { name: "确认切换", exact: true }).click();
    }
    await page
      .getByRole("button", { name: "渲染", exact: true })
      .first()
      .click();
    const host = page.frameLocator('iframe[title="Preview Host"]');
    const root =
      mode === "sandbox"
        ? host.frameLocator('iframe[title="security.runtime-probe Sandbox"]')
        : host;
    await root.getByRole("button", { name: "Probe boundaries" }).click();
    await expect(root.getByTestId("probe-result")).toHaveText(
      "document blocked; navigation blocked; network blocked",
    );
    expect(page.url()).not.toContain("escaped=1");
    await page.getByRole("button", { name: "调试面板" }).click();
    await page.getByRole("button", { name: "操作", exact: true }).click();
    await expect(page.locator(".inspector pre")).toHaveText("[]");
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page
      .getByRole("button", { name: "渲染", exact: true })
      .first()
      .click();
    await expect(
      host.getByText(
        "本季度整体风险可控，亚太市场风险上升，建议关注新加坡敞口。",
      ),
    ).toBeVisible();
  });
  test(`${mode} plugin render exceptions produce a component error and leave the Playground usable`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .locator(".component-item")
      .filter({ hasText: "security.throwing" })
      .click();
    if (mode === "native") {
      await page.getByRole("button", { name: "Native", exact: true }).click();
      await page.getByRole("button", { name: "确认切换", exact: true }).click();
    }
    await page
      .getByRole("button", { name: "渲染", exact: true })
      .first()
      .click();
    const host = page.frameLocator('iframe[title="Preview Host"]');
    await expect(host.getByRole("alert")).toContainText("组件渲染失败");
    await expect(host.getByRole("alert").locator("details")).toContainText(
      "Intentional renderer failure",
    );
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page
      .getByRole("button", { name: "渲染", exact: true })
      .first()
      .click();
    await expect(
      host.getByText(
        "本季度整体风险可控，亚太市场风险上升，建议关注新加坡敞口。",
      ),
    ).toBeVisible();
  });
}
test.afterAll(async ({ request }) => {
  for (const id of ["security.runtime-probe", "security.throwing"])
    await request.delete(`/api/v1/plugins/${id}`);
});
