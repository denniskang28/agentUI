import { z } from "zod";
import type { ServerConfig } from "../../../../packages/mcp-apps-host/src/server";
export { installMcpRoutes } from "../../../../packages/mcp-apps-host/src/server";
export function configuredMcpServers(): ServerConfig[] {
  // Trusted environment configuration only; URLs/credentials never accepted from the browser.
  if (!process.env.MCP_SERVERS_JSON) return [];
  return z
    .array(
      z
        .object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          name: z.string(),
          url: z.string().url(),
          allowedTools: z.array(z.string()),
          allowLocal: z.boolean().optional(),
          headers: z.record(z.string()).optional(),
          resourceDomains: z.array(z.string()).optional(),
          connectDomains: z.array(z.string()).optional(),
        })
        .strict(),
    )
    .parse(JSON.parse(process.env.MCP_SERVERS_JSON));
}
