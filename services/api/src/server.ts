import { installMcpRoutes, configuredMcpServers } from './mcp/routes';
import { AgentUiAdapter } from "../../../packages/agent-ui/src/server";
import { parseLibrarySource } from "../../../packages/agent-ui/src/playground-input";
import { mainOrigin, previewOrigin, publicApiUrl } from "./deployment";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { pathToFileURL } from "node:url";
import { builtins, instantiate } from "../../../packages/catalog/src/index";
import {
  parseMessages,
  MessageParseError,
  validateMessages,
  basicCatalog,
  enterpriseCatalog,
} from "../../../packages/protocol/src/index";
import { SessionStore, ApiError } from "./sessions";
import { PluginRegistry, installRoutes } from "./plugins";
import {
  templateRequestSchema,
  validationRequestSchema,
  sessionRequestSchema,
  messageBatchSchema,
  resetRequestSchema,
  ackRequestSchema,
  actionRequestSchema,
  runtimeErrorRequestSchema,
} from "./contracts";
import { openapi } from "./openapi";
import { Schemas } from "@a2ui/web_core/v1_0";
import Ajv from "ajv";
export async function createServer() {
  const app = Fastify({ bodyLimit: 2_000_000, logger: false });
  await app.register(cors, {
    origin: [mainOrigin, previewOrigin],
    credentials: false,
  });
  app.addHook("onRequest", async (req) => {
    const origin = req.headers.origin;
    if (origin && ![mainOrigin, previewOrigin, "null"].includes(origin))
      throw new ApiError(
        403,
        "ORIGIN_FORBIDDEN",
        "仅允许已配置的 Playground 和 Preview Host",
      );
    if (origin === "null" && !req.url.startsWith("/artifacts/"))
      throw new ApiError(403, "ORIGIN_FORBIDDEN", "Sandbox 不能调用平台 API");
  });
  await app.register(multipart, {
    limits: { fileSize: 5_000_000, files: 1, fields: 12 },
  });
  await installMcpRoutes(app, configuredMcpServers());
  const registry = new PluginRegistry();
  await registry.load();
  const catalogs = () => registry.catalogs();
  const sessions = new SessionStore(catalogs);
  app.addHook("preClose", async () => sessions.dispose());
  const entries = () => [...builtins, ...registry.entries()];
  const describeEntry = (entry: ReturnType<typeof entries>[number]) => {
    const catalog = entry.pluginId
      ? catalogs().find((c) => c.id === entry.catalogId)
      : entry.catalogId
        ? enterpriseCatalog
        : basicCatalog;
    const document = catalog?.toJson();
    const componentSchemas = document?.components as
      Record<string, unknown> | undefined;
    const inputSchema = entry.schema ?? {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(entry.defaults).map(([key, value]) => [
          key,
          {
            type: Array.isArray(value)
              ? "array"
              : typeof value === "object"
                ? "object"
                : typeof value,
            default: value,
            ...(entry.fields.find((field) => field.key === key)?.options
              ? {
                  enum: entry.fields.find((field) => field.key === key)!
                    .options,
                }
              : {}),
          },
        ]),
      ),
    };
    return {
      ...entry,
      catalogId: catalog?.id,
      protocolVersion: catalog?.protocolVersion,
      source: entry.pluginId ? "plugin" : "builtin",
      availability: "ready",
      supportedRenderPolicies: entry.pluginId
        ? registry.records.get(entry.pluginId)!.manifest.supportedRenderPolicies
        : ["progressive", "on_complete", "live"],
      defaultRenderPolicy: entry.pluginId
        ? registry.records.get(entry.pluginId)!.manifest.defaultRenderPolicy
        : "progressive",
      actions:
        entry.actions ??
        (entry.key === "datatable"
          ? ["table.rowClick"]
          : entry.key === "chart"
            ? ["chart.select"]
            : entry.key === "button"
              ? [String(entry.defaults.action)]
              : []),
      schema: entry.schema ?? componentSchemas?.[entry.component],
      inputSchema,
      wireSchema: componentSchemas?.[entry.component],
      catalogSchemaUrl: `${new URL(publicApiUrl).pathname}/catalogs/${encodeURIComponent(catalog?.id ?? "")}`,
      templateIds: entry.templates.map((t) => `${entry.key}~${t}`),
    };
  };
  app.setErrorHandler((error, _req, reply) => {
    const e = error as Error & { statusCode?: number; code?: string };
    reply.status(e instanceof z.ZodError ? 400 : (e.statusCode ?? 500)).send({
      code: e.code ?? "INVALID_REQUEST",
      message: e.message,
      requestId: crypto.randomUUID(),
      ...(e instanceof ApiError && e.details ? { details: e.details } : {}),
      ...(e instanceof z.ZodError ? { details: { issues: e.issues } } : {}),
      ...(e instanceof MessageParseError
        ? {
            details: {
              line: e.line,
              column: e.column,
              offset: e.offset,
              diagnostic: e.diagnostic,
            },
          }
        : {}),
    });
  });
  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.url} not found`,
      requestId: crypto.randomUUID(),
    }),
  );
  app.get("/api/v1/health", () => ({
    status: "ok",
    sdk: { core: "0.15.0", react: "0.15.0", protocol: "1.0" },
  }));
  app.get("/api/v1/openapi.json", () => openapi);
  app.get(
    "/api/v1/schemas/agent-to-renderer.json",
    () => Schemas.A2uiMessageSchemaRaw,
  );
  app.get("/api/v1/catalogs", () => ({
    catalogs: [basicCatalog, enterpriseCatalog, ...catalogs()].map((catalog) =>
      catalog.toJson(),
    ),
  }));
  app.get("/api/v1/catalogs/:id", (req) => {
    const catalog = [basicCatalog, enterpriseCatalog, ...catalogs()].find(
      (catalog) => catalog.id === (req.params as { id: string }).id,
    );
    if (!catalog)
      throw new ApiError(
        404,
        "CATALOG_NOT_FOUND",
        (req.params as { id: string }).id,
      );
    return catalog.toJson();
  });
  app.get("/api/v1/components", () => ({
    components: entries().map(describeEntry),
  }));
  app.get("/api/v1/components/:key", async (req) => {
    const { key } = req.params as { key: string };
    const e = entries().find((e) => e.key === key);
    if (!e) throw new ApiError(404, "COMPONENT_NOT_FOUND", key);
    return {
      ...describeEntry(e),
      binding: "A2UI v1.0 @path JSON Pointer",
      templates: e.templates.map((t) => `${key}~${t}`),
    };
  });
  const getTemplate = (id: string) => {
    const [key, t, extra] = id.split("~");
    const e = entries().find((e) => e.key === key);
    if (!e || extra !== undefined || !e.templates.includes(t))
      throw new ApiError(404, "TEMPLATE_NOT_FOUND", id);
    return { e, t };
  };
  app.get("/api/v1/templates/:id", (req) => {
    const { id } = req.params as { id: string };
    const { e, t } = getTemplate(id);
    return {
      templateId: id,
      componentKey: e.key,
      defaults: e.defaults,
      inputSchema: describeEntry(e).inputSchema,
      ...instantiate(e, e.defaults, t),
    };
  });
  app.post("/api/v1/templates/:id/instantiate", (req) => {
    const { e, t } = getTemplate((req.params as { id: string }).id);
    const body = templateRequestSchema.parse(
      req.body === undefined ? {} : req.body,
    );
    const values = { ...e.defaults, ...body.values };
    {
      const validate = new Ajv({ strict: true, allErrors: true }).compile(
        describeEntry(e).inputSchema,
      );
      if (!validate(values))
        throw new ApiError(
          422,
          "INVALID_TEMPLATE_VALUES",
          JSON.stringify(validate.errors),
          { errors: validate.errors ?? [] },
        );
    }
    const result = instantiate(e, values, t, body.surfaceId);
    const validation = validateMessages(result.messages, [], catalogs());
    if (!validation.valid)
      throw new ApiError(
        422,
        "INVALID_TEMPLATE_VALUES",
        JSON.stringify(validation.errors),
        { errors: validation.errors },
      );
    return {
      ...result,
      scenario: { renderPolicy: result.renderPolicy, readyWhen: "/ready" },
    };
  });
  app.post("/api/v1/library/compile", (req) => {
    const { text } = z
      .object({ text: z.string().min(1) })
      .strict()
      .parse(req.body);
    const batches = parseLibrarySource(text);
    if (batches.reduce((count, batch) => count + batch.inputs.length, 0) > 1000)
      throw new ApiError(
        413,
        "LIBRARY_INPUT_LIMIT",
        "Sequence exceeds 1000 inputs",
      );
    const adapter = new AgentUiAdapter(batches[0].runId, entries());
    try {
      let outputBytes = Buffer.byteLength(JSON.stringify(batches)) + 64;
      let currentPolicies =
        {} as import("../../../packages/protocol/src/index").RunConfig["componentPolicies"];
      const steps = batches.map((batch, index) => {
        try {
          const result = adapter.apply(batch);
          if (!result.replay) currentPolicies = result.componentPolicies;
          const step = {
            messages: result.replay ? [] : result.messages,
            componentPolicies: currentPolicies,
          };
          outputBytes += Buffer.byteLength(JSON.stringify(step));
          if (outputBytes > 2_000_000)
            throw new ApiError(
              413,
              "COMPILED_OUTPUT_LIMIT",
              "Compiled sequence exceeds 2 MB",
            );
          return step;
        } catch (error) {
          if (error instanceof ApiError) throw error;
          const e = error as Error & { code?: string; details?: unknown };
          throw new ApiError(
            422,
            e.code ?? "INVALID_LIBRARY_INPUT",
            `Batch ${index + 1}: ${e.message}${e.details ? " " + JSON.stringify(e.details) : ""}`,
          );
        }
      });
      return { batches, steps };
    } finally {
      adapter.dispose();
    }
  });
  app.post("/api/v1/messages/validate", (req) => {
    const body = validationRequestSchema.parse(req.body);
    const messages = "text" in body ? parseMessages(body.text) : body.messages;
    return validateMessages(messages, body.prior ?? [], catalogs());
  });
  app.post("/api/v1/preview-sessions", (req) => {
    const body = sessionRequestSchema.parse(
      req.body === undefined ? {} : req.body,
    );
    return sessions.create({
      ...body.preview,
      actionHandler: body.actionHandler,
      runtimeMode: body.preview.runtimeMode,
      locale: body.preview.locale,
    });
  });
  app.get("/api/v1/preview-sessions/:id", (req) =>
    sessions.describe(sessions.get((req.params as { id: string }).id)),
  );
  app.post("/api/v1/preview-sessions/:id/messages", (req, reply) => {
    const body = messageBatchSchema.parse(req.body);
    reply.code(202);
    return sessions.submit(
      (req.params as { id: string }).id,
      body as Parameters<SessionStore["submit"]>[1],
    );
  });
  app.get("/api/v1/preview-sessions/:id/events", (req, reply) => {
    const id = (req.params as { id: string }).id;
    const after = Number(
      req.headers["last-event-id"] ??
        (req.query as { after?: string }).after ??
        0,
    );
    if (!Number.isSafeInteger(after) || after < 0)
      throw new ApiError(400, "INVALID_CURSOR", "游标必须为非负整数");
    const replay = sessions.replay(id, after);
    const s = sessions.get(id);
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": mainOrigin,
    });
    reply.raw.write(": connected\n\n");
    replay.forEach((e) =>
      reply.raw.write(
        `id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`,
      ),
    );
    s.clients.add(reply.raw);
    const timer = setInterval(() => reply.raw.write(": heartbeat\n\n"), 10000);
    req.raw.on("close", () => {
      clearInterval(timer);
      s.clients.delete(reply.raw);
    });
  });
  app.get("/api/v1/preview-sessions/:id/actions", (req) => {
    const after = (req.query as { after?: string }).after ?? "0";
    return sessions.actionsAfter((req.params as { id: string }).id, after);
  });
  app.delete("/api/v1/preview-sessions/:id", (req, reply) => {
    sessions.get((req.params as { id: string }).id);
    sessions.destroy((req.params as { id: string }).id);
    reply.code(204).send();
  });
  app.post("/api/v1/preview-sessions/:id/connect", (req) =>
    sessions.connect((req.params as { id: string }).id),
  );
  app.post("/api/v1/preview-sessions/:id/heartbeat", (req) => {
    sessions.heartbeat((req.params as { id: string }).id);
    return { ok: true };
  });
  app.post("/api/v1/preview-sessions/:id/reset", (req) => {
    const { replay, ...config } = resetRequestSchema.parse(
      req.body === undefined ? {} : req.body,
    );
    return sessions.reset((req.params as { id: string }).id, config, replay);
  });
  app.post("/api/v1/preview-sessions/:id/ack", (req) => {
    const body = ackRequestSchema.parse(req.body);
    sessions.ack(
      (req.params as { id: string }).id,
      body.runId,
      body.sequence,
      body.errors,
    );
    return { ok: true };
  });
  app.post("/api/v1/preview-sessions/:id/action", (req) => {
    const body = actionRequestSchema.parse(req.body);
    return sessions.action(
      (req.params as { id: string }).id,
      body.runId,
      body.action,
    );
  });
  app.post("/api/v1/preview-sessions/:id/error", (req) => {
    const body = runtimeErrorRequestSchema.parse(req.body);
    return sessions.runtimeError(
      (req.params as { id: string }).id,
      body.runId,
      body.error,
    );
  });
  await installRoutes(app, registry);
  return { app, sessions, registry };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { app } = await createServer();
  await app.listen({ host: "127.0.0.1", port: 3001 });
  console.log("Agent UI API: http://127.0.0.1:3001");
}
