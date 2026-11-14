import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { createServer as createViteServer } from "vite";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";
import { Orchestrator } from "./orchestrator/index";
import { Presenter, variant } from "./ui/adapter";
import type { DomainEvent, StreamEvent } from "../shared/domain";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = Fastify({ bodyLimit: 2_000_000 });
type Session = {
  id: string;
  user: string;
  runId: string;
  mode: "template" | "raw";
  presenter: Presenter;
  orchestrator: Orchestrator;
  events: StreamEvent[];
  listeners: Set<ServerResponse>;
};
const sessions = new Map<string, Session>();
const modeSchema = z.enum(["template", "raw"]);
function event(session: Session, type: StreamEvent["type"], payload: unknown) {
  const message = {
    id: session.events.length + 1,
    runId: session.runId,
    type,
    payload,
  };
  if (session.events.length >= 5000)
    throw Error("SESSION_LIMIT: create a new conversation");
  session.events.push(message);
  for (const listener of session.listeners)
    listener.write(`id: ${message.id}\ndata: ${JSON.stringify(message)}\n\n`);
}
function owner(id: string) {
  const session = sessions.get(id);
  if (!session || session.user !== "demo-approver")
    throw Error("SESSION_NOT_FOUND");
  return session;
}
function emit(session: Session, run: string, output: DomainEvent) {
  if (session.runId !== run) return;
  event(session, "ui", session.presenter.present(output));
}
app.addHook("onRequest", async (request, reply) => {
  if (!request.url.startsWith("/api/")) return;
  const origin = request.headers.origin;
  const port = Number(
    process.env.DEMO_PORT ?? (variant === "baseline" ? 5180 : 5181),
  );
  if (
    origin &&
    origin !== (process.env.DEMO_PUBLIC_ORIGIN ?? `http://localhost:${port}`)
  ) {
    reply.code(403);
    throw Error("ORIGIN_FORBIDDEN");
  }
});
app.get("/api/health", () => ({ status: "ok", variant }));
app.get("/api/session", (request) => {
  const query = z
    .object({ id: z.string().optional(), mode: modeSchema.optional() })
    .parse(request.query);
  if (query.id && sessions.has(query.id)) {
    const session = owner(query.id);
    return {
      id: session.id,
      runId: session.runId,
      mode: session.mode,
      variant,
    };
  }
  if (sessions.size >= 100) throw Error("DEMO_SESSION_LIMIT");
  const runId = crypto.randomUUID(),
    id = crypto.randomUUID(),
    mode = query.mode ?? "template";
  const session: Session = {
    id,
    runId,
    mode,
    user: "demo-approver",
    presenter: new Presenter(runId, mode),
    orchestrator: new Orchestrator(),
    events: [],
    listeners: new Set(),
  };
  sessions.set(id, session);
  return { id, runId, mode, variant };
});
app.get("/api/sessions/:id/events", (request, reply) => {
  const { id } = request.params as { id: string };
  const session = owner(id);
  const after = Number(
    request.headers["last-event-id"] ??
      (request.query as { after?: string }).after ??
      0,
  );
  if (!Number.isInteger(after) || after < 0 || after > session.events.length)
    throw Error("INVALID_CURSOR");
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  reply.raw.write(": connected\n\n");
  for (const message of session.events.filter((item) => item.id > after))
    reply.raw.write(`id: ${message.id}\ndata: ${JSON.stringify(message)}\n\n`);
  session.listeners.add(reply.raw);
  const heartbeat = setInterval(
    () => reply.raw.write(": heartbeat\n\n"),
    10000,
  );
  request.raw.on("close", () => {
    clearInterval(heartbeat);
    session.listeners.delete(reply.raw);
  });
});
app.post("/api/sessions/:id/chat", async (request, reply) => {
  const session = owner((request.params as { id: string }).id);
  const body = z
    .object({ text: z.string().min(1).max(2000), runId: z.string() })
    .strict()
    .parse(request.body);
  if (body.runId !== session.runId) {
    reply.code(409);
    throw Error("STALE_RUN");
  }
  const run = session.runId;
  event(session, "text", { role: "user", text: body.text });
  event(session, "text", {
    role: "assistant",
    text: /风险|risk/i.test(body.text)
      ? "正在查询风险 / Querying risk"
      : "正在查询 / Querying",
  });
  void session.orchestrator
    .message(
      body.text,
      (output) => emit(session, run, output),
      (message) => {
        if (session.runId === run)
          event(session, "trace", { direction: "backend", message });
      },
    )
    .catch((error) => {
      if (session.runId === run) event(session, "error", String(error));
    });
  return reply.code(202).send({ status: "accepted" });
});
app.post("/api/sessions/:id/actions", async (request, reply) => {
  const session = owner((request.params as { id: string }).id);
  const body = z
    .object({ runId: z.string(), action: z.unknown() })
    .strict()
    .parse(request.body);
  if (body.runId !== session.runId) {
    reply.code(409);
    throw Error("STALE_RUN");
  }
  const action = session.presenter.action(body.action),
    run = session.runId;
  event(session, "trace", {
    direction: "ui → orchestrator → agent",
    action: body.action,
  });
  await session.orchestrator.action(
    action,
    session.user,
    (output) => emit(session, run, output),
    () => session.runId === run,
  );
  return { status: "processed" };
});
app.post("/api/sessions/:id/reset", (request) => {
  const session = owner((request.params as { id: string }).id);
  const body = z.object({ mode: modeSchema }).strict().parse(request.body);
  session.presenter.dispose();
  session.runId = crypto.randomUUID();
  session.mode = body.mode;
  session.presenter = new Presenter(session.runId, session.mode);
  session.orchestrator = new Orchestrator();
  event(session, "reset", { runId: session.runId, mode: session.mode });
  return { id: session.id, runId: session.runId, mode: session.mode };
});
app.post("/api/sessions/:id/fail-next", (request) => {
  owner((request.params as { id: string }).id).orchestrator.service.failNext =
    true;
  return { status: "armed" };
});
app.setErrorHandler((error, _request, reply) =>
  reply
    .code(reply.statusCode >= 400 ? reply.statusCode : 400)
    .send({ error: error instanceof Error ? error.message : String(error) }),
);
if (process.env.NODE_ENV === "production") {
  await app.register(fastifyStatic, { root: path.join(root, "dist/web") });
  app.setNotFoundHandler((_request, reply) => reply.sendFile("index.html"));
} else {
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.setNotFoundHandler((request, reply) => {
    reply.hijack();
    vite.middlewares(request.raw, reply.raw, () => {
      reply.raw.writeHead(404).end();
    });
  });
  app.addHook("onClose", async () => vite.close());
}
await app.listen({
  host: "127.0.0.1",
  port: Number(process.env.DEMO_PORT ?? (variant === "baseline" ? 5180 : 5181)),
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    for (const session of sessions.values()) {
      session.presenter.dispose();
      for (const listener of session.listeners) listener.end();
    }
    void app.close();
  });
