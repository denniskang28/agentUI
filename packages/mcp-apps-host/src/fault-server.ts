import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/server";
import {
  NodeStreamableHTTPServerTransport,
  localhostHostValidation,
  localhostOriginValidation,
} from "@modelcontextprotocol/node";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
/** Separate negative protocol fixture; never part of the published Host entry points. */
export async function startFaultServer(port = 3004) {
  const validateHost = localhostHostValidation(),
    validateOrigin = localhostOriginValidation();
  const http = createServer(async (req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    const server = new McpServer({
      name: "MCP negative fixtures",
      version: "1",
    });
    for (const name of ["invalid_mime", "uninitialized_view"])
      registerAppTool(
        server,
        name,
        {
          inputSchema: z.object({}),
          _meta: { ui: { resourceUri: `ui://fault/${name}` } },
        },
        async () => ({
          content: [{ type: "text", text: `Text retained: ${name}` }],
        }),
      );
    server.server.registerCapabilities({ resources: {} });
    server.server.setRequestHandler("resources/list", async () => ({
      resources: [],
    }));
    server.server.setRequestHandler("resources/read", async (req) => ({
      contents: [
        {
          uri: req.params.uri,
          mimeType: req.params.uri.endsWith("invalid_mime")
            ? "text/plain"
            : "text/html;profile=mcp-app",
          text: "<!doctype html><html><body>App cannot initialize</body></html>",
        },
      ],
    }));
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
  await new Promise<void>((r) => http.listen(port, "127.0.0.1", r));
  return http;
}
