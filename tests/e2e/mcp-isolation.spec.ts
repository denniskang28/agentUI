import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { cp, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { serveEmbeddedHost } from "../../scripts/serve-embedded-host";
let proxy: Server,
  external: Server,
  root: string,
  preview: string,
  origin: string;
let hits = 0;
test.beforeAll(async () => {
  root = await mkdtemp(`${tmpdir()}/mcp-isolation-`);
  await mkdir(`${root}/host`);
  for (const name of ["mcp-sandbox.html", "mcp-sandbox.js"])
    await cp(`packages/mcp-apps-host/dist/${name}`, `${root}/host/${name}`);
  external = createServer((req, res) => {
    hits++;
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url === "/app.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end("document.getElementById('script').textContent='script-ok'");
    } else res.end("external-ok");
  });
  await new Promise<void>((r) => external.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(external.address() as { port: number }).port}`;
  proxy = serveEmbeddedHost({
    root,
    port: 0,
    allowedParents: ["http://localhost:5173"],
    allowedExternalOrigins: [origin],
  });
  await new Promise<void>((r) =>
    proxy.listening ? r() : proxy.once("listening", r),
  );
  preview = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`;
});
test.afterAll(async () => {
  await Promise.all(
    [proxy, external].map((s) => new Promise<void>((r) => s.close(() => r()))),
  );
  await rm(root, { recursive: true, force: true });
});
test("actual inherited CSP allows declared origin and blocks undeclared network, frames and parent access", async ({
  page,
  request,
}) => {
  const denied = await request.get(
    `${preview}/mcp-sandbox.html?parentOrigin=http://evil.example`,
  );
  expect(denied.status()).toBe(403);
  const csp = {
    connectDomains: [origin],
    resourceDomains: [origin],
    frameDomains: [],
    baseUriDomains: [],
  };
  const url = `${preview}/mcp-sandbox.html?parentOrigin=${encodeURIComponent("http://localhost:5173")}&csp=${encodeURIComponent(JSON.stringify(csp))}`;
  const headers = await request.get(url);
  expect(headers.headers()["content-security-policy"]).toContain(origin);
  expect(headers.headers()["referrer-policy"]).toBe("no-referrer");
  await page.goto("/");
  const before = hits;
  await page.evaluate(
    ({ url, origin }) => {
      const f = document.createElement("iframe");
      f.title = "Security proxy";
      f.sandbox.add("allow-scripts", "allow-same-origin");
      const listener = (e: MessageEvent) => {
        if (
          e.source !== f.contentWindow ||
          e.data?.method !== "ui/notifications/sandbox-proxy-ready"
        )
          return;
        window.removeEventListener("message", listener);
        f.contentWindow!.postMessage(
          {
            jsonrpc: "2.0",
            method: "ui/notifications/sandbox-resource-ready",
            params: {
              html: `<!doctype html><html><body><p id="allowed"></p><p id="script"></p><script src="${origin}/app.js"></script><p id="blocked"></p><p id="parent"></p><script>addEventListener('message',e=>{if(e.data?.method==='test/spoof')document.getElementById('allowed').textContent='forged';});fetch('${origin}/ok').then(r=>r.text()).then(v=>document.getElementById('allowed').textContent=v);fetch('http://127.0.0.1:3002/health').then(()=>document.getElementById('blocked').textContent='leaked').catch(()=>document.getElementById('blocked').textContent='blocked');try{parent.document.body.textContent='owned';}catch{document.getElementById('parent').textContent='isolated';}</script></body></html>`,
            },
          },
          new URL(url).origin,
        );
      };
      window.addEventListener("message", listener);
      f.src = url;
      document.body.append(f);
    },
    { url, origin },
  );
  const app = page
    .frameLocator('iframe[title="Security proxy"]')
    .frameLocator('iframe[title="MCP App View"]');
  await expect(app.locator("#allowed")).toHaveText("external-ok");
  await expect(app.locator("#blocked")).toHaveText("blocked");
  await expect(app.locator("#parent")).toHaveText("isolated");
  expect(await app.locator("body").evaluate(() => document.compatMode)).toBe(
    "CSS1Compat",
  );
  await expect(app.locator("#script")).toHaveText("script-ok");
  expect(hits - before).toBe(2);
  await expect(
    page.getByText("Agent UI Playground", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const f = document.querySelector(
      'iframe[title="Security proxy"]',
    ) as HTMLIFrameElement;
    f.contentWindow!.postMessage(
      { jsonrpc: "2.0", method: "test/spoof", params: {} },
      "*",
    );
  });
  await expect(app.locator("#allowed")).toHaveText("forged");
  await app
    .locator("#allowed")
    .evaluate((e) => (e.textContent = "external-ok"));
  // A sibling main-origin window has the allowed parent origin but the wrong source identity.
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.title = "Attacker";
    f.src = "http://localhost:5173/";
    document.body.append(f);
  });
  const attacker = page.frameLocator('iframe[title="Attacker"]');
  await attacker.locator("body").waitFor();
  const targetIndex = await page
    .locator('iframe[title="Security proxy"]')
    .evaluate((e) =>
      Array.from(document.querySelectorAll("iframe")).indexOf(
        e as HTMLIFrameElement,
      ),
    );
  await attacker.locator("body").evaluate((_body, index) => {
    parent.frames[index].postMessage(
      {
        jsonrpc: "2.0",
        method: "test/spoof",
        params: {},
      },
      "*",
    );
  }, targetIndex);
  await page.waitForTimeout(100);
  await expect(app.locator("#allowed")).toHaveText("external-ok");
  const cycle = await app.locator("body").evaluate(() => {
    const value: Record<string, unknown> = { jsonrpc: "2.0" };
    value.self = value;
    parent.postMessage(value, "*");
    return true;
  });
  expect(cycle).toBe(true);
  await expect(app.locator("#allowed")).toHaveText("external-ok");
  await page.screenshot({
    path: ".private/evidence/mcp-apps/isolation.png",
    fullPage: true,
  });
});
