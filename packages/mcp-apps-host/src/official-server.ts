import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import {
  NodeStreamableHTTPServerTransport,
  localhostHostValidation,
  localhostOriginValidation,
} from "@modelcontextprotocol/node";
import type { McpServer } from "@modelcontextprotocol/server";
export async function startOfficialServer(port = 3003) {
  const { createServer: createMcpServer } = (await import(
    pathToFileURL(
      new URL("../dist/official-server.mjs", import.meta.url).pathname,
    ).href
  )) as { createServer: () => McpServer };
  const validateHost = localhostHostValidation(),
    validateOrigin = localhostOriginValidation();
  const server = createServer(async (req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    const mcp = createMcpServer(),
      transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
    res.on("close", () => {
      void transport.close();
      void mcp.close();
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res);
  });
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  return server;
}
