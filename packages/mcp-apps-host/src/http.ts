import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { McpGateway, type ServerConfig } from "./gateway";
import { HostError, createAppSchema } from "./protocol";
/** Mount within the caller's authenticated boundary. Local Playground uses connection capability tokens. */
export async function installMcpRoutes(
  app: FastifyInstance,
  servers: ServerConfig[],
  prefix = "/api/v1/mcp",
) {
  const gateway = new McpGateway(servers);
  app.addHook("onClose", () => gateway.dispose());
  await app.register(
    async (scoped) => {
      scoped.setErrorHandler((error, _request, reply) => {
        const e = error as Error & { code?: string; status?: number };
        reply
          .code(error instanceof HostError ? error.status : 400)
          .send({ code: e.code ?? "MCP_ERROR", message: e.message });
      });
      scoped.get("/servers", () => gateway.listServers());
      scoped.post("/connections", async (request) => {
        const { serverId } = z
          .object({ serverId: z.string().min(1) })
          .strict()
          .parse(request.body);
        return gateway.connect(serverId);
      });
      const access = (request: {
        params: unknown;
        headers: Record<string, unknown>;
      }) => {
        const p = request.params as { connectionId: string; appId: string };
        return {
          id: p.connectionId,
          appId: p.appId,
          token: String(request.headers["x-mcp-owner"] ?? ""),
        };
      };
      scoped.get("/connections/:connectionId", (request) => {
        const p = access(request);
        return gateway.describe(p.id, p.token);
      });
      scoped.delete("/connections/:connectionId", async (request) => {
        const p = access(request);
        await gateway.disconnect(p.id, p.token);
        return { closed: true };
      });
      scoped.post("/connections/:connectionId/apps", async (request) => {
        const p = access(request);
        return gateway.create(
          p.id,
          p.token,
          createAppSchema.parse(request.body),
        );
      });
      scoped.get("/connections/:connectionId/apps/:appId", (request) => {
        const p = access(request);
        return gateway.snapshot(p.id, p.token, p.appId);
      });
      scoped.post(
        "/connections/:connectionId/apps/:appId/tool-calls",
        async (request) => {
          const p = access(request);
          return gateway.callTool(p.id, p.token, p.appId, request.body);
        },
      );
      scoped.post(
        "/connections/:connectionId/apps/:appId/resource-reads",
        async (request) => {
          const p = access(request);
          return gateway.readResource(p.id, p.token, p.appId, request.body);
        },
      );
      scoped.get("/connections/:connectionId/apps/:appId/events", (request) => {
        const p = access(request),
          q = request.query as { after?: string };
        return gateway.events(p.id, p.token, p.appId, Number(q.after ?? 0));
      });
      scoped.post(
        "/connections/:connectionId/apps/:appId/cancel",
        (request) => {
          const p = access(request);
          gateway.cancel(p.id, p.token, p.appId);
          return { cancelled: true };
        },
      );
      scoped.delete("/connections/:connectionId/apps/:appId", (request) => {
        const p = access(request);
        gateway.destroy(p.id, p.token, p.appId);
        return { closed: true };
      });
    },
    { prefix },
  );
  return gateway;
}
