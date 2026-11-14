import { it, expect } from "vitest";
import { createServer } from "../../services/api/src/server";
import { createMessage } from "../../packages/protocol/src/index";
it("real HTTP SSE streams application receipts, resumes by Last-Event-ID and rejects expired replay", async () => {
  const { app, sessions } = await createServer();
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (!address || typeof address === "string") throw Error("No listener");
  const base = `http://127.0.0.1:${address.port}`;
  const session = sessions.create();
  sessions.connect(session.sessionId);
  const route = `/api/v1/preview-sessions/${session.sessionId}`;
  sessions.submit(session.sessionId, {
    batchId: "sse",
    firstSequence: 1,
    messages: [
      createMessage(
        "s",
        [{ id: "root", component: "Text", text: "stream" }],
        {},
      ),
    ],
  });
  const abort = new AbortController();
  try {
    const response = await fetch(base + route + "/events", {
      headers: { "Last-Event-ID": "1" },
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]),
    });
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    sessions.ack(session.sessionId, session.runId, 1);
    const reader = response.body!.getReader();
    let text = "";
    while (!text.includes("event: message.applied")) {
      const chunk = await reader.read();
      if (chunk.done) throw Error("SSE closed early");
      text += new TextDecoder().decode(chunk.value);
    }
    expect(text).toContain("id: 2\nevent: messages.queued");
    expect(text).toContain("id: 3\nevent: message.applied");
    await reader.cancel();
    const resumedAbort = new AbortController();
    try {
      const resumed = await fetch(base + route + "/events", {
        headers: { "Last-Event-ID": "2" },
        signal: AbortSignal.any([
          resumedAbort.signal,
          AbortSignal.timeout(5000),
        ]),
      });
      const next = resumed.body!.getReader();
      let replay = "";
      while (!replay.includes("event: message.applied")) {
        const chunk = await next.read();
        if (chunk.done) throw Error("Replay closed early");
        replay += new TextDecoder().decode(chunk.value);
      }
      expect(replay).not.toContain("messages.queued");
      await next.cancel();
    } finally {
      resumedAbort.abort();
    }
    sessions.eventLimit = 2;
    for (let i = 0; i < 3; i++)
      sessions.event(sessions.get(session.sessionId), "test");
    const expired = await fetch(base + route + "/events", {
      headers: { "Last-Event-ID": "1" },
    });
    expect(expired.status).toBe(410);
    expect((await expired.json()).code).toBe("CURSOR_EXPIRED");
  } finally {
    abort.abort();
    sessions.destroy(session.sessionId);
    await app.close();
  }
}, 15000);

for (const reason of ["expired", "shutdown"] as const)
  it(`active HTTP SSE closes with session.destroyed on ${reason} without a further request`, async () => {
    const { app, sessions } = await createServer();
    if (reason === "expired") sessions.ttl = 250;
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") throw Error("No listener");
    const base = `http://127.0.0.1:${address.port}`;
    const session = sessions.create();
    const route = `/api/v1/preview-sessions/${session.sessionId}`;
    try {
      const response = await fetch(`${base}${route}/events`, {
        signal: AbortSignal.timeout(5000),
      });
      expect(response.status).toBe(200);
      const closing = reason === "shutdown" ? app.close() : undefined;
      const text = await response.text();
      expect(text).toContain("event: session.destroyed");
      expect(text).toContain(`"reason":"${reason}"`);
      expect(sessions.sessions.size).toBe(0);
      if (closing) await closing;
      else {
        const expired = await fetch(`${base}${route}`);
        expect(expired.status).toBe(410);
        expect((await expired.json()).code).toBe("SESSION_EXPIRED");
        const unknown = await fetch(`${base}/api/v1/preview-sessions/unknown`);
        expect(unknown.status).toBe(404);
      }
    } finally {
      await app.close();
    }
  }, 10000);
