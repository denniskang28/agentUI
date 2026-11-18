import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/server";
import {
  NodeStreamableHTTPServerTransport,
  localhostHostValidation,
  localhostOriginValidation,
} from "@modelcontextprotocol/node";
import {
  registerAppTool,
  registerAppResource,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
/** Real SDK server used by local demos and tests. Deterministic data, never real approval. */
export async function startDemoServer(port = 3002) {
  let approvals = 0,
    calls = 0;
  const html = await readFile(
    new URL("../dist/demo.html", import.meta.url),
    "utf8",
  );
  const validateHost = localhostHostValidation(),
    validateOrigin = localhostOriginValidation();
  const http = createServer(async (req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    if (req.url === "/health") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ status: "ok", calls, approvals }));
      return;
    }
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    const server = new McpServer({
      name: "Expense MCP demo",
      version: "1.0.0",
    });
    registerAppTool(
      server,
      "expense_dashboard",
      {
        description: "Display an expense approval",
        inputSchema: z.object({
          reportId: z.string().default("EXP-001"),
          delayMs: z.number().min(0).max(20000).optional(),
        }),
        _meta: { ui: { resourceUri: "ui://expense/view.html" } },
      },
      async (args) => {
        calls++;
        if (args.delayMs) await new Promise((r) => setTimeout(r, args.delayMs));
        return {
          content: [
            { type: "text", text: `Expense ${args.reportId} pending approval` },
          ],
          structuredContent: {
            reportId: args.reportId,
            amount: 3200,
            status: "pending",
            title: "Expense approval",
          },
        };
      },
    );
    registerAppTool(
      server,
      "approve_expense",
      {
        description: "Approve demo expense",
        inputSchema: z.object({ reportId: z.string() }),
        _meta: { ui: { visibility: ["app"] } },
      },
      async (args) => {
        approvals++;
        return {
          content: [{ type: "text", text: `Approved ${args.reportId}` }],
          structuredContent: {
            reportId: args.reportId,
            amount: 3200,
            status: "approved",
          },
        };
      },
    );
    registerAppTool(
      server,
      "model_only",
      {
        description: "Not callable by an App",
        inputSchema: z.object({}),
        _meta: { ui: { visibility: ["model"] } },
      },
      async () => ({ content: [{ type: "text", text: "model only" }] }),
    );
    server.registerTool(
      "plain_text",
      { description: "A plain tool", inputSchema: z.object({}) },
      async () => ({ content: [{ type: "text", text: "Plain MCP result" }] }),
    );
    registerAppResource(
      server,
      "Expense view",
      "ui://expense/view.html",
      {},
      async () => ({
        contents: [
          {
            uri: "ui://expense/view.html",
            mimeType: "text/html;profile=mcp-app",
            text: html,
          },
        ],
      }),
    );
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });
  await new Promise<void>((resolve) => http.listen(port, "127.0.0.1", resolve));
  return http;
}
