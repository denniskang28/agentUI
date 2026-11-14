import { randomUUID, createHash } from "node:crypto";
import type { ServerResponse } from "node:http";
import {
  validateMessages,
  type Message,
  type RunConfig,
  defaultRun,
} from "../../../packages/protocol/src/index";
import type { Catalog } from "@a2ui/web_core/v1_0";
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export interface SessionEvent {
  id: number;
  type: string;
  runId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
interface Session {
  id: string;
  expiresAt: number;
  runId: string;
  connected: boolean;
  lastSeen: number;
  received: number;
  applied: number;
  history: Message[];
  batches: Map<string, { hash: string; receipt: Record<string, unknown> }>;
  events: SessionEvent[];
  nextEvent: number;
  clients: Set<ServerResponse>;
  config: RunConfig;
  actions: (SessionEvent & { actionSequence: number })[];
  nextAction: number;
  requireRunId: boolean;
  expiryTimer?: ReturnType<typeof setTimeout>;
}
export class SessionStore {
  sessions = new Map<string, Session>();
  private expired = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(
    private extraCatalogs: () => Catalog<any>[] = () => [],
    public ttl = 60 * 60 * 1000,
    public eventLimit = 500,
  ) {}
  create(config: Partial<RunConfig> = {}) {
    const session: Session = {
      id: randomUUID(),
      expiresAt: Date.now() + this.ttl,
      runId: randomUUID(),
      connected: false,
      lastSeen: 0,
      received: 0,
      applied: 0,
      history: [],
      batches: new Map(),
      events: [],
      nextEvent: 1,
      clients: new Set(),
      config: { ...defaultRun, ...config },
      actions: [],
      nextAction: 1,
      requireRunId: false,
    };
    this.sessions.set(session.id, session);
    session.expiryTimer = setTimeout(
      () => this.destroy(session.id, "expired"),
      this.ttl,
    );
    session.expiryTimer.unref();
    return this.describe(session);
  }
  get(id: string) {
    const s = this.sessions.get(id);
    if (!s) {
      if (this.expired.has(id))
        throw new ApiError(410, "SESSION_EXPIRED", "预览会话已过期");
      throw new ApiError(404, "SESSION_NOT_FOUND", "预览会话不存在");
    }
    if (s.expiresAt <= Date.now()) {
      this.destroy(id, "expired");
      throw new ApiError(410, "SESSION_EXPIRED", "预览会话已过期");
    }
    if (s.connected && Date.now() - s.lastSeen > 15000) s.connected = false;
    return s;
  }
  describe(s: Session) {
    return {
      sessionId: s.id,
      runId: s.runId,
      status: s.connected ? "connected" : "waiting_for_preview",
      previewUrl: `http://localhost:5173/playground?session=${s.id}`,
      expiresAt: new Date(s.expiresAt).toISOString(),
      lastReceivedSequence: s.received,
      lastAppliedSequence: s.applied,
      config: s.config,
    };
  }
  event(s: Session, type: string, payload: Record<string, unknown> = {}) {
    const e: SessionEvent = {
      id: s.nextEvent++,
      type,
      runId: s.runId,
      timestamp: new Date().toISOString(),
      payload,
    };
    s.events.push(e);
    if (s.events.length > this.eventLimit) s.events.shift();
    if (type === "ui.action") {
      s.actions.push({ ...e, actionSequence: s.nextAction++ });
      if (s.actions.length > this.eventLimit) s.actions.shift();
    }
    for (const client of s.clients)
      client.write(
        `id: ${e.id}\nevent: ${type}\ndata: ${JSON.stringify(e)}\n\n`,
      );
    return e;
  }
  connect(id: string) {
    const s = this.get(id);
    s.connected = true;
    s.lastSeen = Date.now();
    this.event(s, "preview.connected");
    return {
      ...this.describe(s),
      messages: s.history,
      eventCursor: s.nextEvent - 1,
    };
  }
  heartbeat(id: string) {
    const s = this.get(id);
    s.lastSeen = Date.now();
    s.connected = true;
  }
  reset(id: string, config?: Partial<RunConfig>, replay = false) {
    const s = this.get(id);
    const history = replay ? [...s.history] : [];
    s.runId = randomUUID();
    s.requireRunId = true;
    s.history = [];
    s.received = 0;
    s.applied = 0;
    s.batches.clear();
    s.config = { ...s.config, ...config };
    this.event(s, "run.reset", { config: s.config });
    if (history.length)
      this.submit(id, {
        batchId: `replay-${s.runId}`,
        runId: s.runId,
        firstSequence: 1,
        messages: history,
      });
    return this.describe(s);
  }
  submit(
    id: string,
    body: {
      batchId: string;
      firstSequence: number;
      messages: Message[];
      runId?: string;
    },
  ) {
    const s = this.get(id);
    if (s.requireRunId && !body.runId)
      throw new ApiError(
        409,
        "RUN_ID_REQUIRED",
        "重置后的运行必须提交当前 runId",
      );
    if (body.runId && body.runId !== s.runId)
      throw new ApiError(409, "STALE_RUN", "旧运行的更新已拒绝");
    const hash = createHash("sha256")
      .update(
        JSON.stringify(body, (_key, value: unknown) =>
          value && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(
                Object.entries(value).sort(([a], [b]) =>
                  a < b ? -1 : a > b ? 1 : 0,
                ),
              )
            : value,
        ),
      )
      .digest("hex");
    const prev = s.batches.get(body.batchId);
    if (prev) {
      if (prev.hash !== hash)
        throw new ApiError(409, "BATCH_CONFLICT", "batchId 已被用于不同内容");
      return prev.receipt;
    }
    if (!s.connected)
      throw new ApiError(
        409,
        "PREVIEW_NOT_CONNECTED",
        "请先打开预览并等待 preview.connected",
      );
    if (s.history.length + body.messages.length > 5000)
      throw new ApiError(413, "SESSION_LIMIT", "会话消息达到 5000 条上限");
    if (body.firstSequence !== s.received + 1)
      throw new ApiError(
        409,
        "SEQUENCE_CONFLICT",
        `firstSequence 应为 ${s.received + 1}`,
      );
    const validation = validateMessages(
      body.messages,
      s.history,
      this.extraCatalogs(),
    );
    if (!validation.valid)
      throw new ApiError(
        422,
        "INVALID_MESSAGES",
        JSON.stringify(validation.errors),
        {
          errors: validation.errors,
          firstSequence: body.firstSequence,
          runId: s.runId,
        },
      );
    const lastSequence = s.received + body.messages.length;
    s.received = lastSequence;
    s.history.push(...body.messages);
    const receipt = {
      batchId: body.batchId,
      runId: s.runId,
      status: "accepted",
      firstSequence: body.firstSequence,
      lastSequence,
    };
    s.batches.set(body.batchId, { hash, receipt });
    this.event(s, "messages.queued", { ...receipt, messages: body.messages });
    return receipt;
  }
  ack(id: string, runId: string, sequence: number, errors: unknown[] = []) {
    const s = this.get(id);
    if (runId !== s.runId) throw new ApiError(409, "STALE_RUN", "旧实例已销毁");
    if (sequence > s.received || sequence < s.applied)
      throw new ApiError(409, "SEQUENCE_CONFLICT", "非法应用序号");
    s.applied = sequence;
    this.event(s, errors.length ? "run.error" : "message.applied", {
      sequence,
      errors,
    });
  }
  action(id: string, runId: string, action: Record<string, unknown>) {
    const s = this.get(id);
    if (runId !== s.runId)
      throw new ApiError(409, "STALE_RUN", "旧实例 Action 已拒绝");
    return this.event(s, "ui.action", {
      actionId: randomUUID(),
      action: { version: "1.0", action },
      actionHandler: s.config.actionHandler,
    });
  }
  replay(id: string, after: number) {
    const s = this.get(id);
    if (after && s.events.length && after < s.events[0].id - 1)
      throw new ApiError(410, "CURSOR_EXPIRED", "事件游标已超出保留窗口");
    if (after >= s.nextEvent)
      throw new ApiError(400, "INVALID_CURSOR", "游标超出当前事件范围");
    return s.events.filter((e) => e.id > after);
  }
  actionsAfter(id: string, after: string | 0 = "0") {
    const s = this.get(id);
    let index = 0;
    if (after !== "0" && after !== 0) {
      try {
        if (!/^action\.[A-Za-z0-9_-]+$/.test(after)) throw Error();
        const value = JSON.parse(
          Buffer.from(after.slice(7), "base64url").toString("utf8"),
        );
        if (
          value.session !== id ||
          !Number.isSafeInteger(value.index) ||
          value.index < 0 ||
          value.index >= s.nextAction
        )
          throw Error();
        index = value.index;
      } catch {
        throw new ApiError(400, "INVALID_CURSOR", "无效的 Action 游标");
      }
    }
    if (s.actions.length && index < s.actions[0].actionSequence - 1)
      throw new ApiError(
        410,
        "CURSOR_EXPIRED",
        "Action 游标已过期；需要重新同步会话",
      );
    return {
      actions: s.actions.filter((e) => e.actionSequence > index),
      cursor: `action.${Buffer.from(JSON.stringify({ session: id, index: s.nextAction - 1 })).toString("base64url")}`,
      runId: s.runId,
    };
  }
  runtimeError(id: string, runId: string, error: Record<string, unknown>) {
    const s = this.get(id);
    if (runId !== s.runId)
      throw new ApiError(409, "STALE_RUN", "旧实例错误已拒绝");
    return this.event(s, "run.error", { sequence: s.applied, errors: [error] });
  }
  dispose() {
    for (const id of [...this.sessions.keys()]) this.destroy(id, "shutdown");
    for (const timer of this.expired.values()) clearTimeout(timer);
    this.expired.clear();
  }
  destroy(
    id: string,
    reason: "destroyed" | "expired" | "shutdown" = "destroyed",
  ) {
    const s = this.sessions.get(id);
    if (s) {
      if (s.expiryTimer) clearTimeout(s.expiryTimer);
      if (reason === "expired") {
        const timer = setTimeout(() => this.expired.delete(id), 60 * 60 * 1000);
        timer.unref();
        this.expired.set(id, timer);
      }
      this.event(s, "session.destroyed", { reason });
      s.clients.forEach((c) => c.end());
      this.sessions.delete(id);
    }
  }
}
