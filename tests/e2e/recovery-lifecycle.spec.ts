import { test, expect } from "@playwright/test";
import { createMessage, patchMessage } from "../../packages/protocol/src/index";
import { counterFixture } from "../fixtures/plugin";

test("invalid protocol and known component schemas report diagnostics and recover in the same editor", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "A2UI JSON" });
  const host = page.frameLocator('iframe[title="Preview Host"]');
  for (const [message, diagnostic] of [
    [{ surfaceUpdate: { surfaceId: "wrongVersion" } }, "version"],
    [
      createMessage("main", [{ id: "root", component: "Text", text: 42 }], {}),
      "Text",
    ],
  ] as const) {
    await editor.fill(JSON.stringify(message));
    await page
      .getByRole("button", { name: "渲染", exact: true })
      .first()
      .click();
    await expect(page.getByRole("alert")).toContainText(diagnostic);
    await expect(host.locator("[data-surface]")).toHaveCount(0);
    await expect(editor).toHaveValue(JSON.stringify(message));
  }
  await editor.fill(
    JSON.stringify(
      createMessage(
        "main",
        [{ id: "root", component: "Text", text: "Recovered real content" }],
        {},
      ),
    ),
  );
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await expect(
    host.getByText("Recovered real content", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Reset cancels a pending Mock response, and refresh permits the fixture to load again", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Button", exact: true }).click();
  await page.getByRole("button", { name: "自定义响应", exact: true }).click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await host.getByRole("button", { name: "生成报告", exact: true }).click();
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  // The previous run's default 800ms Mock callback must not patch this run.
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "调试面板" }).click();
  await page
    .getByRole("region", { name: "调试面板" })
    .getByRole("button", { name: "消息", exact: true })
    .click();
  const history = JSON.parse(await page.locator(".inspector pre").innerText());
  expect(history).toHaveLength(1);
  expect(history[0]).toHaveProperty("createSurface");
  await expect(
    host.getByRole("button", { name: "生成报告", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Button", exact: true }).click();
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await expect(
    host.getByRole("button", { name: "生成报告", exact: true }),
  ).toBeVisible();
  await host.getByRole("button", { name: "生成报告", exact: true }).click();
  await page.getByRole("button", { name: "调试面板" }).click();
  await page.getByRole("button", { name: "操作 1", exact: true }).click();
  await expect(page.locator(".inspector pre")).toContainText("report.generate");
});

for (const mode of ["native", "sandbox"] as const)
  test(`a discovered unknown plugin keeps one timer through streamed updates and releases it on ${mode} disposal`, async ({
    page,
    request,
  }) => {
    const fixture = await counterFixture(
      `thirdparty.lifecycle-${mode}`,
      () => `
import {useEffect,useState} from 'react';
import {definePlugin,useHostAction} from '@enterprise/agent-ui-plugin-sdk';
function View({data}:{data:{value:number;title:string}}){
 const dispatch=useHostAction();const [clicks,setClicks]=useState(0);
 useEffect(()=>{const probe=(window as unknown as {__lifecycle?:{active:number;ticks:number;mounts:number}});probe.__lifecycle??={active:0,ticks:0,mounts:0};const state=probe.__lifecycle;state.active++;state.mounts++;const timer=setInterval(()=>{state.ticks++},50);return()=>{clearInterval(timer);state.active--}},[]);
 return <section data-testid="lifecycle-root"><h3>{data.title}</h3><output>{data.value}</output><button onClick={()=>{setClicks(v=>v+1);dispatch('counter.increment',{value:data.value})}}>Probe action</button><span data-testid="local-state">{clicks}</span></section>
}
export default definePlugin({id:'thirdparty.lifecycle-${mode}',version:'1.0.0',Component:View});`,
    );
    const upload = await request.post("/api/v1/plugins", {
      multipart: {
        metadata: JSON.stringify({
          manifest: fixture.manifest,
          catalog: fixture.catalog,
        }),
        file: {
          name: "lifecycle.tsx",
          mimeType: "text/plain",
          buffer: Buffer.from(fixture.source),
        },
      },
    });
    expect(upload.ok(), await upload.text()).toBe(true);
    // Independent Agent client discovers identity, schema and template; no gallery
    // component name or catalog id is hardcoded in the submitted wire messages.
    const discovery = await (await request.get("/api/v1/components")).json();
    const entry = discovery.components.find(
      (value: { pluginId?: string }) => value.pluginId === fixture.manifest.id,
    );
    expect(entry).toBeTruthy();
    const detail = await (
      await request.get(`/api/v1/components/${encodeURIComponent(entry.key)}`)
    ).json();
    expect(detail.wireSchema).toBeTruthy();
    const instantiated = await request.post(
      `/api/v1/templates/${encodeURIComponent(detail.templates[0])}/instantiate`,
      { data: { values: { title: "Discovered fixture", value: 1 } } },
    );
    expect(instantiated.ok(), await instantiated.text()).toBe(true);
    const template = await instantiated.json();
    const session = await (
      await request.post("/api/v1/preview-sessions", {
        data: { actionHandler: "external", preview: { runtimeMode: mode } },
      })
    ).json();
    const path = `/api/v1/preview-sessions/${session.sessionId}`;
    try {
      await page.goto(session.previewUrl);
      await expect
        .poll(async () => (await (await request.get(path)).json()).status)
        .toBe("connected");
      let sequence = 1;
      const send = async (messages: typeof template.messages) => {
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
      await send(template.messages);
      const host = page.frameLocator('iframe[title="Preview Host"]');
      const content =
        mode === "native"
          ? host
          : host.frameLocator(`iframe[title="${entry.name} Sandbox"]`);
      await content.getByRole("button", { name: "Probe action" }).click();
      await expect(content.getByTestId("local-state")).toHaveText("1");
      await send(
        Array.from({ length: 30 }, (_, index) =>
          patchMessage(
            "main",
            { title: "Discovered fixture", value: index + 2 },
            "/view",
          ),
        ),
      );
      await expect(content.locator("output")).toHaveText("31");
      await expect(content.getByTestId("local-state")).toHaveText("1");
      const root = content.getByTestId("lifecycle-root");
      const probe = await root.evaluate(
        () =>
          (
            window as unknown as {
              __lifecycle: { active: number; mounts: number };
            }
          ).__lifecycle,
      );
      expect(probe.active).toBe(1);
      expect(probe.mounts).toBe(1);
      await expect
        .poll(
          async () =>
            (await (await request.get(`${path}/actions`)).json()).actions
              .length,
        )
        .toBe(1);
      const sandbox =
        mode === "sandbox"
          ? await (await host.locator("iframe").elementHandle())!.contentFrame()
          : null;
      await send([{ version: "1.0", deleteSurface: { surfaceId: "main" } }]);
      await expect(host.getByTestId("lifecycle-root")).toHaveCount(0);
      await expect(host.locator("iframe")).toHaveCount(0);
      if (mode === "native") {
        const getProbe = () =>
          host.locator("body").evaluate(
            () =>
              (
                window as unknown as {
                  __lifecycle: { active: number; ticks: number };
                }
              ).__lifecycle,
          );
        await expect.poll(async () => (await getProbe()).active).toBe(0);
        const ticks = (await getProbe()).ticks;
        await page.waitForTimeout(200);
        expect((await getProbe()).ticks).toBe(ticks);
      } else expect(sandbox!.isDetached()).toBe(true);
      await send(template.messages);
      await expect(content.locator("output")).toHaveText("1");
      await expect(content.getByTestId("local-state")).toHaveText("0");
      await page.reload();
      await expect(content.locator("output")).toHaveText("1");
      await expect(content.getByTestId("local-state")).toHaveText("0");
      await page.getByRole("button", { name: "Plugins", exact: true }).click();
      await page
        .getByRole("button", {
          name: fixture.manifest.displayName,
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "卸载", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "卸载", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect
        .poll(
          async () =>
            (await (await request.get(path)).json()).lastReceivedSequence,
        )
        .toBe(0);
      await expect(host.locator("[data-plugin]")).toHaveCount(0);
      await expect(host.locator("iframe")).toHaveCount(0);
      if (mode === "native")
        await expect
          .poll(() =>
            host
              .locator("body")
              .evaluate(
                () =>
                  (window as unknown as { __lifecycle: { active: number } })
                    .__lifecycle.active,
              ),
          )
          .toBe(0);
    } finally {
      await request.delete(path);
    }
  });

test("form and template JSON share values while complex hand-authored Surfaces retain their draft", async ({
  page,
}) => {
  await page.goto("/");
  const textValue = page.getByRole("textbox", { name: "文本", exact: true });
  await textValue.fill("Form draft 中文 😀");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "A2UI JSON" });
  const source = JSON.parse(await editor.inputValue());
  expect(source[0].createSurface.dataModel.view.text).toBe(
    "Form draft 中文 😀",
  );
  source[0].createSurface.dataModel.view.text = "JSON draft kept";
  await editor.fill(JSON.stringify(source, null, 2));
  await page.getByRole("button", { name: "表单", exact: true }).click();
  await expect(textValue).toHaveValue("JSON draft kept");
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  const host = page.frameLocator('iframe[title="Preview Host"]');
  await expect(
    host.getByText("JSON draft kept", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  source.push(
    createMessage(
      "extra",
      [{ id: "root", component: "Text", text: "Extra Surface survives" }],
      {},
    ),
  );
  const complex = JSON.stringify(source, null, 2);
  await editor.fill(complex);
  await page.getByRole("button", { name: "表单", exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue(complex);
  await expect(
    page.getByRole("status").filter({ hasText: "当前消息无法映射回表单" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(editor).toHaveValue(complex);
  await page.getByRole("button", { name: "渲染", exact: true }).first().click();
  await expect(
    host.getByText("Extra Surface survives", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "恢复模板", exact: true }).click();
  await page.getByRole("button", { name: "表单", exact: true }).click();
  await expect(textValue).toHaveValue("JSON draft kept");
});
