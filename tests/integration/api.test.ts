import { beforeAll, afterAll, it, expect } from "vitest";
import { createServer } from "../../services/api/src/server";
import { SessionStore } from "../../services/api/src/sessions";
import { createMessage, patchMessage } from "../../packages/protocol/src/index";
let server: Awaited<ReturnType<typeof createServer>>;
it("JSONL syntax diagnostics use stable codes and original file positions", async () => {
  const response = await server.app.inject({
    method: "POST",
    url: "/api/v1/messages/validate",
    payload: { text: '{"version":"1.0"}\n\n{"broken":@}' },
  });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({
    code: "JSONL_SYNTAX",
    details: { line: 3, column: 11, offset: 29 },
  });
});
it("session creation preserves component policies and container; reset rejects unknown or malformed configuration", async () => {
  const preview = {
    container: "chat",
    locale: "en-US",
    renderPolicy: "live",
    readyWhen: "/started",
    componentPolicies: {
      surface: {
        form: {
          renderPolicy: "on_complete",
          readyWhen: "/formReady",
          timeoutMs: 500,
        },
      },
    },
  };
  const response = await server.app.inject({
    method: "POST",
    url: "/api/v1/preview-sessions",
    payload: { preview },
  });
  expect(response.statusCode).toBe(200);
  const session = response.json();
  expect(session.config).toMatchObject(preview);
  for (const payload of [
    { locale: "fr-FR" },
    { readyTimeoutMs: 0 },
    { componentPolicies: { surface: { form: { renderPolicy: "fake" } } } },
    { arbitrary: "value" },
  ]) {
    const result = await server.app.inject({
      method: "POST",
      url: `/api/v1/preview-sessions/${session.sessionId}/reset`,
      payload,
    });
    expect(result.statusCode).toBe(400);
  }
  expect(server.sessions.get(session.sessionId).runId).toBe(session.runId);
});
beforeAll(async () => {
  server = await createServer();
});
afterAll(async () => {
  await server.app.close();
});
it("discovery, instantiation and validation share official templates", async () => {
  const discovery = await server.app.inject("/api/v1/components");
  expect(discovery.statusCode).toBe(200);
  for (const entry of discovery.json().components) {
    const response = await server.app.inject({
      method: "POST",
      url: `/api/v1/templates/${entry.key}~full/instantiate`,
      payload: {},
    });
    expect(response.statusCode, entry.key).toBe(200);
    const validation = await server.app.inject({
      method: "POST",
      url: "/api/v1/messages/validate",
      payload: { messages: response.json().messages },
    });
    expect(validation.json().valid).toBe(true);
  }
});
it("session requires preview connection; retries are idempotent and sequences contiguous", async () => {
  const session = server.sessions.create({
    locale: "en-US",
    actionHandler: "external",
  });
  const url = `/api/v1/preview-sessions/${session.sessionId}`;
  const body = {
    batchId: "one",
    firstSequence: 1,
    messages: [
      createMessage(
        "s",
        [{ id: "root", component: "Text", text: "original" }],
        {},
      ),
    ],
  };
  expect(
    (
      await server.app.inject({
        method: "POST",
        url: url + "/messages",
        payload: body,
      })
    ).json().code,
  ).toBe("PREVIEW_NOT_CONNECTED");
  server.sessions.connect(session.sessionId);
  const first = await server.app.inject({
    method: "POST",
    url: url + "/messages",
    payload: body,
  });
  expect(first.statusCode).toBe(202);
  const retry = await server.app.inject({
    method: "POST",
    url: url + "/messages",
    payload: body,
  });
  expect(retry.json()).toEqual(first.json());
  expect(server.sessions.get(session.sessionId).history).toHaveLength(1);
  expect(
    (
      await server.app.inject({
        method: "POST",
        url: url + "/messages",
        payload: { ...body, messages: [patchMessage("s", {})] },
      })
    ).json().code,
  ).toBe("BATCH_CONFLICT");
  expect(
    (
      await server.app.inject({
        method: "POST",
        url: url + "/messages",
        payload: { ...body, batchId: "two", firstSequence: 3 },
      })
    ).json().code,
  ).toBe("SEQUENCE_CONFLICT");
  expect((await server.app.inject(url)).json().config.locale).toBe("en-US");
  server.sessions.destroy(session.sessionId);
});
it("rejects an entire invalid batch before appending any message", () => {
  const store = new SessionStore();
  const session = store.create();
  store.connect(session.sessionId);
  expect(() =>
    store.submit(session.sessionId, {
      batchId: "invalid",
      firstSequence: 1,
      messages: [
        createMessage("s", [{ id: "root", component: "Text", text: "ok" }], {}),
        patchMessage("missing", 1),
      ],
    }),
  ).toThrow();
  expect(store.get(session.sessionId).history).toHaveLength(0);
});
it("expired cursors, TTL and stale run replies fail explicitly", () => {
  const store = new SessionStore(() => [], 60000, 2);
  const session = store.create();
  const s = store.get(session.sessionId);
  store.connect(s.id);
  for (let i = 0; i < 4; i++) store.event(s, "test");
  expect(() => store.replay(s.id, 1)).toThrow("事件游标");
  store.reset(s.id);
  expect(() => store.ack(s.id, session.runId, 0)).toThrow("旧实例");
  s.expiresAt = Date.now() - 1;
  expect(() => store.get(s.id)).toThrow("已过期");
});
it("Action cursors are independent of SSE events, bound to a session and explicitly expire", () => {
  const store = new SessionStore(() => [], 60000, 2);
  const a = store.create(),
    b = store.create();
  const state = store.get(a.sessionId);
  const initial = store.actionsAfter(a.sessionId).cursor;
  for (let i = 0; i < 10; i++) store.event(state, "unrelated");
  expect(store.actionsAfter(a.sessionId, initial).cursor).toBe(initial);
  store.action(a.sessionId, a.runId, { name: "one" });
  const first = store.actionsAfter(a.sessionId, initial);
  expect(first.actions).toHaveLength(1);
  expect(first.actions[0].payload.actionId).toBeTruthy();
  expect(() => store.actionsAfter(b.sessionId, first.cursor)).toThrow("无效");
  store.action(a.sessionId, a.runId, { name: "two" });
  store.action(a.sessionId, a.runId, { name: "three" });
  expect(() => store.actionsAfter(a.sessionId, initial)).toThrow("已过期");
  expect(store.actionsAfter(a.sessionId, first.cursor).actions).toHaveLength(2);
});
it("mode-switch reset replays ordered messages under a fresh run and rejects late replies", () => {
  const store = new SessionStore();
  const session = store.create();
  store.connect(session.sessionId);
  const messages = [
    createMessage(
      "s",
      [{ id: "root", component: "Text", text: { "@path": "/title" } }],
      { title: "Initial" },
    ),
    patchMessage("s", "Latest", "/title"),
  ];
  const original = structuredClone(messages);
  store.submit(session.sessionId, {
    batchId: "initial",
    firstSequence: 1,
    runId: session.runId,
    messages,
  });
  const reset = store.reset(session.sessionId, { runtimeMode: "native" }, true);
  const state = store.get(session.sessionId);
  expect(messages).toEqual(original);
  expect(state.history).toEqual(original);
  expect(reset.runId).not.toBe(session.runId);
  expect(state.history).toEqual(messages);
  expect(state.received).toBe(2);
  expect(state.applied).toBe(0);
  expect(state.events.slice(-2).map((event) => event.type)).toEqual([
    "run.reset",
    "messages.queued",
  ]);
  for (const runId of [undefined, session.runId])
    expect(() =>
      store.submit(session.sessionId, {
        batchId: "late",
        firstSequence: 3,
        messages: [patchMessage("s", "stale", "/title")],
        runId,
      }),
    ).toThrow();
  expect(state.history).toEqual(messages);
});
it("component discovery exposes exact wire/business schemas and rejects invalid enterprise template input", async () => {
  const text = (await server.app.inject("/api/v1/components/text")).json();
  expect(text.wireSchema.properties.component.const).toBe("Text");
  expect(text.schema.properties.text).toBeTruthy();
  const catalog = await server.app.inject(text.catalogSchemaUrl);
  expect(catalog.statusCode).toBe(200);
  expect(catalog.json().components.Text).toEqual(text.wireSchema);
  const invalid = await server.app.inject({
    method: "POST",
    url: "/api/v1/templates/chart~full/instantiate",
    payload: { values: { items: [{ label: "invalid", value: "text" }] } },
  });
  expect(invalid.statusCode).toBe(422);
  expect(invalid.json().code).toBe("INVALID_TEMPLATE_VALUES");
});
it("validates locale and forbids untrusted browser origins", async () => {
  const invalid = await server.app.inject({
    method: "POST",
    url: "/api/v1/preview-sessions",
    payload: { preview: { locale: "fr-FR" } },
  });
  expect(invalid.statusCode).toBe(400);
  expect(
    (
      await server.app.inject({
        url: "/api/v1/components",
        headers: { origin: "https://untrusted.example" },
      })
    ).statusCode,
  ).toBe(403);
});
