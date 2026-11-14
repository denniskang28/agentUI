import { test, expect } from "@playwright/test";

test("the real static Host rejects incompatible manifests and unapproved asset origins", async ({
  page,
  request,
}) => {
  const manifest = (await (
    await request.get("http://127.0.0.1:4183/manifest.json")
  ).json()) as { entries: { pluginId?: string; bundleUrl?: string }[] };
  await page.goto("http://localhost:5181/host-probe");
  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.title = "Probe";
    frame.src = "http://127.0.0.1:4183/";
    document.body.replaceChildren(frame);
  });
  const messages = await page.evaluate(async (manifest) => {
    const target = document.querySelector<HTMLIFrameElement>(
      'iframe[title="Probe"]',
    )!.contentWindow!;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("Host did not announce readiness")),
        5000,
      );
      const receive = (event: MessageEvent) => {
        if (
          event.source === target &&
          event.origin === "http://127.0.0.1:4183" &&
          event.data.type === "agent-ui.ready"
        ) {
          clearTimeout(timeout);
          window.removeEventListener("message", receive);
          resolve();
        }
      };
      window.addEventListener("message", receive);
      target.postMessage(
        { type: "agent-ui.probe", protocol: "enterprise-agent-ui/1" },
        "http://127.0.0.1:4183",
      );
    });
    const channel = new MessageChannel();
    target.postMessage(
      { type: "agent-ui.connect", protocol: "enterprise-agent-ui/1" },
      "http://127.0.0.1:4183",
      [channel.port2],
    );
    const send = (value: unknown) =>
      new Promise<{ type: string; runId: string; message?: string }>(
        (resolve, reject) => {
          const timeout = setTimeout(
            () => reject(Error("Host command timed out")),
            5000,
          );
          channel.port1.onmessage = (event) => {
            if (event.data.type !== "error" && event.data.type !== "connected")
              return;
            clearTimeout(timeout);
            resolve(event.data);
          };
          channel.port1.postMessage({
            type: "init",
            protocol: "enterprise-agent-ui/1",
            hostVersion: "0.1.0",
            runId: "probe_run",
            manifest: value,
          });
        },
      );
    try {
      const badVersion = await send({ ...manifest, sdkVersion: "99" });
      const invalid = structuredClone(manifest);
      invalid.entries.find((entry) => entry.pluginId)!.bundleUrl =
        "http://localhost:5181/unapproved.js";
      const badAsset = await send(invalid);
      const connected = await send(manifest);
      channel.port1.postMessage({ type: "dispose", runId: "probe_run" });
      return [badVersion, badAsset, connected];
    } finally {
      channel.port1.close();
    }
  }, manifest);
  expect(messages[0]).toMatchObject({ type: "error", runId: "probe_run" });
  expect(messages[1]).toMatchObject({ type: "error", runId: "probe_run" });
  expect(messages[1].message).toContain("ASSET_ORIGIN");
  expect(messages[2]).toMatchObject({ type: "connected", runId: "probe_run" });
});

test("CSP blocks embedding under an origin outside the exact parent allowlist", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") violations.push(message.text());
  });
  await page.goto("http://127.0.0.1:5181/forbidden-parent");
  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.title = "Forbidden";
    frame.src = "http://127.0.0.1:4183/";
    document.body.replaceChildren(frame);
  });
  await expect
    .poll(() => violations.some((value) => value.includes("frame-ancestors")))
    .toBe(true);
  expect(
    page.frames().some((frame) => frame.url() === "http://127.0.0.1:4183/"),
  ).toBe(false);
});
