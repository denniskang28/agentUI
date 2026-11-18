import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { McpGateway, effectiveCsp } from "../src/gateway";
import { sandboxHeaders } from "../src/sandbox-policy";
import { startDemoServer } from "../src/demo-server";
import type { ConnectionInfo, AppSnapshot } from "../src/protocol";
let server: HttpServer,
  port: number,
  gateway: McpGateway,
  connection: ConnectionInfo;
const input = (
  tool = "expense_dashboard",
  args: Record<string, unknown> = {},
) => ({
  runId: crypto.randomUUID(),
  requestId: crypto.randomUUID(),
  tool,
  arguments: args,
});
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function finished(app: AppSnapshot) {
  for (let n = 0; n < 100; n++) {
    const s = gateway.snapshot(connection.id, connection.ownerToken, app.id);
    if (s.status !== "running") return s;
    await pause(20);
  }
  throw Error("tool did not finish");
}
beforeAll(async () => {
  server = await startDemoServer(0);
  port = (server.address() as { port: number }).port;
  gateway = new McpGateway([
    {
      id: "test",
      name: "test",
      url: `http://127.0.0.1:${port}/mcp`,
      allowLocal: true,
      allowedTools: [
        "expense_dashboard",
        "approve_expense",
        "model_only",
        "plain_text",
      ],
    },
  ]);
  connection = await gateway.connect("test");
});
afterAll(async () => {
  await gateway.dispose();
  await new Promise<void>((r) => server.close(() => r()));
});
describe("real Streamable HTTP Gateway", () => {
  it("discovers Apps metadata; early result and idempotency execute once", async () => {
    expect(
      connection.tools.find((t) => t.name === "expense_dashboard")?._meta?.ui,
    ).toMatchObject({ resourceUri: "ui://expense/view.html" });
    const before = await fetch(`http://127.0.0.1:${port}/health`).then((r) =>
      r.json(),
    );
    const request = input();
    const [a, b] = await Promise.all([
      gateway.create(connection.id, connection.ownerToken, request),
      gateway.create(connection.id, connection.ownerToken, request),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.resource?.html).toContain("<!doctype html>");
    expect((await finished(a)).result?.structuredContent).toMatchObject({
      status: "pending",
    });
    expect(
      (await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json()))
        .calls - before.calls,
    ).toBe(1);
    await expect(
      gateway.create(connection.id, connection.ownerToken, {
        ...request,
        arguments: { reportId: "different" },
      }),
    ).rejects.toMatchObject({ code: "REQUEST_CONFLICT" });
  });
  it("enforces owners, instances, visibility, read boundaries and payload limits", async () => {
    const a = await gateway.create(
      connection.id,
      connection.ownerToken,
      input(),
    );
    await finished(a);
    expect(() => gateway.snapshot(connection.id, "wrong", a.id)).toThrow(
      "Connection not found",
    );
    expect(() =>
      gateway.snapshot(connection.id, connection.ownerToken, "missing"),
    ).toThrow("App instance");
    await expect(
      gateway.callTool(connection.id, connection.ownerToken, a.id, {
        name: "model_only",
      }),
    ).rejects.toMatchObject({ code: "TOOL_FORBIDDEN" });
    await expect(
      gateway.create(
        connection.id,
        connection.ownerToken,
        input("approve_expense"),
      ),
    ).rejects.toMatchObject({ code: "TOOL_FORBIDDEN" });
    await expect(
      gateway.readResource(connection.id, connection.ownerToken, a.id, {
        uri: "file:///secret",
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_FORBIDDEN" });
    await expect(
      gateway.callTool(connection.id, connection.ownerToken, a.id, {
        name: "approve_expense",
        arguments: { reportId: "X".repeat(2_000_001) },
      }),
    ).rejects.toMatchObject({ code: "PAYLOAD_LIMIT" });
    const r = await gateway.callTool(
      connection.id,
      connection.ownerToken,
      a.id,
      { name: "approve_expense", arguments: { reportId: "EXP-001" } },
    );
    expect(r.structuredContent).toMatchObject({ status: "approved" });
  });
  it("cancels, discards late results, bounds concurrency and cleans up", async () => {
    const a = await gateway.create(
      connection.id,
      connection.ownerToken,
      input("expense_dashboard", { delayMs: 100 }),
    );
    await expect(
      gateway.callTool(connection.id, connection.ownerToken, a.id, {
        name: "approve_expense",
        arguments: { reportId: "EXP-001" },
      }),
    ).rejects.toMatchObject({ code: "APP_BUSY" });
    gateway.cancel(connection.id, connection.ownerToken, a.id);
    await pause(140);
    expect(
      gateway.snapshot(connection.id, connection.ownerToken, a.id).status,
    ).toBe("cancelled");
    await expect(
      gateway.callTool(connection.id, connection.ownerToken, a.id, {
        name: "approve_expense",
        arguments: { reportId: "EXP-001" },
      }),
    ).rejects.toMatchObject({ code: "APP_CLOSED" });
    expect(
      gateway
        .events(connection.id, connection.ownerToken, a.id, 0)
        .some((e) => e.type === "tool.cancelled"),
    ).toBe(true);
    expect(() =>
      gateway.events(connection.id, connection.ownerToken, a.id, 9999),
    ).toThrow("Invalid event");
    gateway.destroy(connection.id, connection.ownerToken, a.id);
    expect(() =>
      gateway.snapshot(connection.id, connection.ownerToken, a.id),
    ).toThrow("App instance");
  });
  it("attaches an already executed result without calling the tool", async () => {
    const before = await fetch(`http://127.0.0.1:${port}/health`).then((r) =>
      r.json(),
    );
    const a = await gateway.attach(
      connection.id,
      connection.ownerToken,
      input(),
      { content: [{ type: "text", text: "Already executed" }] },
    );
    expect(a.result?.content[0]).toMatchObject({ text: "Already executed" });
    expect(
      (await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json()))
        .calls,
    ).toBe(before.calls);
  });
  it("plain tools retain text; timeout and TTL are bounded", async () => {
    const a = await gateway.create(
      connection.id,
      connection.ownerToken,
      input("plain_text"),
    );
    expect((await finished(a)).result?.content[0]).toMatchObject({
      text: "Plain MCP result",
    });
    expect(a.resource).toBeUndefined();
    const short = new McpGateway(gateway.servers, 2000, 30);
    try {
      const c = await short.connect("test");
      const pending = await short.create(
        c.id,
        c.ownerToken,
        input("expense_dashboard", { delayMs: 150 }),
      );
      await pause(100);
      expect(short.snapshot(c.id, c.ownerToken, pending.id).status).toBe(
        "error",
      );
    } finally {
      await short.dispose();
    }
    const ttl = new McpGateway(gateway.servers, 60);
    const c = await ttl.connect("test");
    await pause(120);
    expect(() => ttl.describe(c.id, c.ownerToken)).toThrow();
    await ttl.dispose();
  });
});

it("keeps connection instances separate and diagnoses expired event windows", async () => {
  const a = await gateway.create(connection.id, connection.ownerToken, input());
  await finished(a);
  const other = await gateway.connect("test");
  try {
    expect(() => gateway.snapshot(other.id, other.ownerToken, a.id)).toThrow(
      "App instance",
    );
  } finally {
    await gateway.disconnect(other.id, other.ownerToken);
  }
  for (let n = 0; n < 251; n++)
    await gateway.callTool(connection.id, connection.ownerToken, a.id, {
      name: "approve_expense",
      arguments: { reportId: "EXP-001" },
    });
  expect(() =>
    gateway.events(connection.id, connection.ownerToken, a.id, 0),
  ).toThrow("Event cursor expired");
  const latest = gateway.events(
    connection.id,
    connection.ownerToken,
    a.id,
    500,
  );
  expect(latest.length).toBeGreaterThan(0);
  expect(
    gateway.events(
      connection.id,
      connection.ownerToken,
      a.id,
      latest.at(-1)!.id,
    ),
  ).toEqual([]);
});

it("fails closed for prohibited addresses, unconfigured servers, origins and CSP", async () => {
  const g = new McpGateway([
    {
      id: "local",
      name: "local",
      url: `http://127.0.0.1:${port}/mcp`,
      allowedTools: [],
    },
  ]);
  try {
    await expect(g.connect("local")).rejects.toMatchObject({
      code: "SERVER_ADDRESS",
    });
    await expect(g.connect("http://evil")).rejects.toMatchObject({
      code: "SERVER_NOT_ALLOWED",
    });
  } finally {
    await g.dispose();
  }
  expect(
    effectiveCsp(
      { connectDomains: ["https://allowed.example", "https://evil.example"] },
      { connectDomains: ["https://allowed.example"] },
    ),
  ).toMatchObject({ connectDomains: ["https://allowed.example"] });
  expect(() =>
    effectiveCsp({ resourceDomains: ["https://*.example"] }, {}),
  ).toThrow();
  expect(() =>
    sandboxHeaders(
      new URL("http://preview/mcp-sandbox.html?parentOrigin=http://evil"),
      ["http://localhost:5173"],
    ),
  ).toThrow();
});

it("paginates and validates unlisted blob UI, MIME, permissions and sizes using real Server", async () => {
  const names = ["blob", "mime", "permissions", "html", "size"];
  const h = createServer(async (req, res) => {
    const s = new McpServer({ name: "resource-fixture", version: "1" });
    for (const name of names)
      registerAppTool(
        s,
        name,
        {
          inputSchema: z.object({}),
          _meta: { ui: { resourceUri: `ui://test/${name}` } },
        },
        async () => ({ content: [{ type: "text", text: "safe fallback" }] }),
      );
    s.server.registerCapabilities({ resources: {} });
    s.server.setRequestHandler("resources/list", async () => ({
      resources: [],
    }));
    s.server.setRequestHandler("tools/list", async (p) => {
      const subset = p.params?.cursor ? names.slice(2) : names.slice(0, 2);
      return {
        tools: subset.map((name) => ({
          name,
          inputSchema: { type: "object" as const },
          _meta: { ui: { resourceUri: `ui://test/${name}` } },
        })),
        ...(!p.params?.cursor ? { nextCursor: "page-two" } : {}),
      };
    });
    s.server.setRequestHandler("resources/read", async (p) => ({
      contents: [
        {
          uri: p.params.uri,
          mimeType: p.params.uri.endsWith("/mime")
            ? "text/plain"
            : "text/html;profile=mcp-app",
          ...(p.params.uri.endsWith("/blob")
            ? {
                blob: Buffer.from(
                  "<!doctype html><html><body>Blob app</body></html>",
                ).toString("base64"),
              }
            : {
                text: p.params.uri.endsWith("/html")
                  ? "invalid"
                  : `<!doctype html><html>${p.params.uri.endsWith("/size") ? "x".repeat(2_000_001) : ""}</html>`,
              }),
          ...(p.params.uri.endsWith("/permissions")
            ? { _meta: { ui: { permissions: { camera: {} } } } }
            : {}),
        },
      ],
    }));
    const t = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void t.close();
      void s.close();
    });
    await s.connect(t);
    await t.handleRequest(req, res);
  });
  await new Promise<void>((r) => h.listen(0, "127.0.0.1", r));
  const p = (h.address() as { port: number }).port,
    g = new McpGateway([
      {
        id: "blob",
        name: "blob",
        url: `http://127.0.0.1:${p}`,
        allowLocal: true,
        allowedTools: names,
      },
    ]);
  try {
    const c = await g.connect("blob");
    expect(c.tools).toHaveLength(5);
    const a = await g.create(c.id, c.ownerToken, input("blob"));
    expect(a.resource?.html).toContain("Blob app");
    expect(a.resourceError).toBeUndefined();
    for (const tool of names.slice(1)) {
      const b = await g.create(c.id, c.ownerToken, input(tool));
      expect(b.resource).toBeUndefined();
      expect(b.resourceError).toBeTruthy();
      await pause(20);
      expect(
        g.snapshot(c.id, c.ownerToken, b.id).result?.content[0],
      ).toMatchObject({ text: "safe fallback" });
    }
  } finally {
    await g.dispose();
    await new Promise<void>((r) => h.close(() => r()));
  }
});

it("rejects real endpoint redirects", async () => {
  const h = createServer((_req, res) =>
    res.writeHead(307, { location: "http://127.0.0.1:1/secret" }).end(),
  );
  await new Promise<void>((r) => h.listen(0, "127.0.0.1", r));
  const g = new McpGateway([
    {
      id: "redirect",
      name: "redirect",
      url: `http://127.0.0.1:${(h.address() as { port: number }).port}`,
      allowLocal: true,
      allowedTools: [],
    },
  ]);
  try {
    await expect(g.connect("redirect")).rejects.toThrow();
  } finally {
    await g.dispose();
    await new Promise<void>((r) => h.close(() => r()));
  }
});

it("closes a connection that completes after Gateway disposal", async () => {
  const g = new McpGateway(gateway.servers);
  const pending = g.connect("test");
  await g.dispose();
  await expect(pending).rejects.toMatchObject({ code: "GATEWAY_CLOSED" });
  await expect(g.connect("test")).rejects.toMatchObject({
    code: "GATEWAY_CLOSED",
  });
});
