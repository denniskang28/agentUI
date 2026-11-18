import { randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent } from "undici";
import {
  Client,
  StreamableHTTPClientTransport,
  type Tool,
  type CallToolResult,
} from "@modelcontextprotocol/client";
import { getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";
import {
  HostError,
  boundedJson,
  createAppSchema,
  callSchema,
  readSchema,
  cspSchema,
  MAX_BYTES,
  type CreateApp,
  type ConnectionInfo,
  type AppSnapshot,
  type GatewayEvent,
  type UiResource,
} from "./protocol";
export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  allowedTools: string[];
  allowLocal?: boolean;
  headers?: Record<string, string>;
  resourceDomains?: string[];
  connectDomains?: string[];
}
interface Connection {
  client: Client;
  dispatcher: Agent;
  config: ServerConfig;
  info: ConnectionInfo;
  resources: Set<string>;
  apps: Map<string, Instance>;
  requests: Map<string, { signature: string; promise: Promise<AppSnapshot> }>;
  expires: number;
}
interface Instance {
  snapshot: AppSnapshot;
  events: GatewayEvent[];
  nextEvent: number;
  abort: AbortController;
  busy: boolean;
  reads: number;
}
const TIMEOUT = 15000;
function same(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function publicAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || b === 88)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  // Only global-unicast IPv6; IPv4-mapped, loopback, link-local and ULA fail closed.
  return /^[23][0-9a-f]{0,3}:/i.test(ip) && !ip.startsWith("2001:db8:");
}
function exactOrigins(values: string[] = []): string[] {
  return values.map((value) => {
    const u = new URL(value);
    if (
      !["http:", "https:", "wss:"].includes(u.protocol) ||
      u.origin !== value ||
      u.username ||
      u.password ||
      u.hostname.includes("*")
    )
      throw new HostError("CSP_ORIGIN", "Expected exact allowed origins");
    return u.origin;
  });
}
export function effectiveCsp(
  raw: unknown,
  config: Pick<ServerConfig, "connectDomains" | "resourceDomains">,
) {
  const csp = cspSchema.parse(raw ?? {});
  const intersect = (asked: string[] = [], allowed: string[] = []) => {
    const valid = exactOrigins(asked),
      permit = exactOrigins(allowed);
    return valid.filter((origin) => permit.includes(origin));
  };
  return {
    connectDomains: intersect(csp.connectDomains, config.connectDomains),
    resourceDomains: intersect(csp.resourceDomains, config.resourceDomains),
    frameDomains: [],
    baseUriDomains: [],
  };
}
export class McpGateway {
  private connections = new Map<string, Connection>();
  private connecting = 0;
  private disposed = false;
  private timer: ReturnType<typeof setInterval>;
  constructor(
    readonly servers: ServerConfig[],
    readonly ttlMs = 60 * 60 * 1000,
    readonly timeoutMs = TIMEOUT,
  ) {
    if (new Set(servers.map((s) => s.id)).size !== servers.length)
      throw new HostError("SERVER_CONFIG", "Duplicate server IDs");
    this.timer = setInterval(
      () => {
        for (const [id, c] of this.connections)
          if (c.expires < Date.now())
            void this.disconnect(id, c.info.ownerToken);
      },
      Math.min(10000, Math.max(50, ttlMs)),
    );
    this.timer.unref();
  }
  listServers() {
    return this.servers.map(({ id, name }) => ({ id, name }));
  }
  private conn(id: string, token: string) {
    const c = this.connections.get(id);
    if (!c || !same(c.info.ownerToken, token))
      throw new HostError("CONNECTION_NOT_FOUND", "Connection not found", 404);
    if (c.expires < Date.now()) {
      void this.disconnect(id, token);
      throw new HostError("CONNECTION_EXPIRED", "Connection expired", 410);
    }
    return c;
  }
  private app(id: string, token: string, appId: string) {
    const c = this.conn(id, token),
      i = c.apps.get(appId);
    if (!i) throw new HostError("APP_NOT_FOUND", "App instance not found", 404);
    return { c, i };
  }
  async connect(serverId: string): Promise<ConnectionInfo> {
    if (this.disposed)
      throw new HostError("GATEWAY_CLOSED", "Gateway is closed", 410);
    if (this.connections.size + this.connecting >= 50)
      throw new HostError("CONNECTION_LIMIT", "Too many connections", 429);
    this.connecting++;
    try {
      return await this.connectNew(serverId);
    } finally {
      this.connecting--;
    }
  }
  private async connectNew(serverId: string): Promise<ConnectionInfo> {
    if (this.connections.size >= 50)
      throw new HostError("CONNECTION_LIMIT", "Too many connections", 429);
    const config = this.servers.find((s) => s.id === serverId);
    if (!config)
      throw new HostError(
        "SERVER_NOT_ALLOWED",
        "Server is not configured",
        403,
      );
    const url = new URL(config.url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new HostError("SERVER_URL", "Invalid server URL");
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const resolved = isIP(host)
      ? [{ address: host, family: isIP(host) }]
      : await lookup(host, { all: true });
    if (
      !resolved.length ||
      (!config.allowLocal && resolved.some((r) => !publicAddress(r.address)))
    )
      throw new HostError(
        "SERVER_ADDRESS",
        "Server resolves to a prohibited address",
        403,
      );
    if (url.protocol !== "https:" && !config.allowLocal)
      throw new HostError(
        "SERVER_TLS",
        "Remote MCP servers require HTTPS",
        403,
      );
    // Pin the validated resolution for this connection, eliminating DNS rebinding.
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, options, callback) => {
          const chosen = resolved.filter(
            (r) => !options.family || r.family === options.family,
          );
          if (!chosen.length)
            return callback(new Error("No approved address"), "", 4);
          if (options.all) callback(null, chosen);
          else callback(null, chosen[0].address, chosen[0].family);
        },
      },
    });
    const guardedFetch: typeof globalThis.fetch = async (input, init) => {
      const target = new URL(
        typeof input === "string" || input instanceof URL
          ? String(input)
          : input.url,
      );
      if (target.href !== url.href)
        throw new HostError(
          "SERVER_REDIRECT",
          "MCP request target differs from configured endpoint",
          403,
        );
      const fetchOptions: RequestInit & { dispatcher: Agent } = {
        ...init,
        redirect: "error",
        dispatcher,
      };
      const response = await fetch(target, fetchOptions);
      let bytes = 0;
      const body = response.body?.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            bytes += chunk.byteLength;
            if (bytes > MAX_BYTES)
              throw new HostError(
                "RESPONSE_LIMIT",
                "MCP response exceeds 2 MB",
                413,
              );
            controller.enqueue(chunk);
          },
        }),
      );
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    };
    const client = new Client(
      { name: "Enterprise Agent UI MCP Host", version: "0.1.0" },
      {
        listMaxPages: 50,
        capabilities: {
          extensions: {
            "io.modelcontextprotocol/ui": {
              mimeTypes: ["text/html;profile=mcp-app"],
            },
          },
        },
      },
    );
    try {
      await client.connect(
        new StreamableHTTPClientTransport(url, {
          requestInit: { headers: config.headers },
          fetch: guardedFetch,
        }),
        { timeout: this.timeoutMs },
      );
      const tools: Tool[] = [];
      let cursor: string | undefined;
      const seen = new Set<string>();
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined, {
          timeout: this.timeoutMs,
        });
        tools.push(...page.tools);
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor))
          throw new HostError("PAGINATION", "Repeated cursor");
        if (cursor) seen.add(cursor);
        if (tools.length > 500 || seen.size > 50)
          throw new HostError("TOOL_LIMIT", "Tool list too large");
      } while (cursor);
      const resources = new Set<string>();
      if (client.getServerCapabilities()?.resources) {
        let rc: string | undefined;
        const rs = new Set<string>();
        do {
          const page = await client.listResources(
            rc ? { cursor: rc } : undefined,
            { timeout: this.timeoutMs },
          );
          for (const r of page.resources) resources.add(r.uri);
          rc = page.nextCursor;
          if (rc && rs.has(rc))
            throw new HostError("PAGINATION", "Repeated resource cursor");
          if (rc) rs.add(rc);
          if (resources.size > 500 || rs.size > 50)
            throw new HostError("RESOURCE_LIMIT", "Resource list too large");
        } while (rc);
      }
      const info = {
        id: randomUUID(),
        serverId,
        tools: tools.filter((t) => config.allowedTools.includes(t.name)),
        ownerToken: randomUUID(),
      };
      for (const t of info.tools) {
        const uri = getToolUiResourceUri(t);
        if (uri) resources.add(uri);
      }
      if (this.disposed)
        throw new HostError("GATEWAY_CLOSED", "Gateway is closed", 410);
      this.connections.set(info.id, {
        client,
        dispatcher,
        config,
        info,
        resources,
        apps: new Map(),
        requests: new Map(),
        expires: Date.now() + this.ttlMs,
      });
      return boundedJson(info);
    } catch (error) {
      await client.close().catch(() => {});
      await dispatcher.close();
      throw error;
    }
  }
  describe(id: string, token: string) {
    return this.conn(id, token).info;
  }
  private event(i: Instance, type: string, payload: unknown) {
    i.events.push({
      id: i.nextEvent++,
      type,
      appInstanceId: i.snapshot.id,
      runId: i.snapshot.runId,
      at: new Date().toISOString(),
      payload,
    });
    if (i.events.length > 500) i.events.shift();
  }
  private async resource(c: Connection, uri: string): Promise<UiResource> {
    if (!uri.startsWith("ui://"))
      throw new HostError("UI_URI", "Expected ui:// resource");
    const response = boundedJson(
      await c.client.readResource({ uri }, { timeout: this.timeoutMs }),
    );
    const part = response.contents.find((p) => p.uri === uri);
    if (
      !part ||
      response.contents.length !== 1 ||
      part.mimeType !== "text/html;profile=mcp-app"
    )
      throw new HostError(
        "UI_RESOURCE",
        "Expected a single MCP App HTML resource",
      );
    const html =
      "text" in part
        ? part.text
        : Buffer.from(part.blob, "base64").toString("utf8");
    if (
      Buffer.byteLength(html) > MAX_BYTES ||
      !/<(?:!doctype\s+html|html)[\s>]/i.test(html)
    )
      throw new HostError("UI_HTML", "Invalid or oversized HTML document");
    const meta = part._meta?.ui as Record<string, unknown> | undefined;
    if (meta?.permissions && Object.keys(meta.permissions as object).length)
      throw new HostError(
        "UI_PERMISSION",
        "Requested browser permissions are not supported",
      );
    return { uri, html, csp: effectiveCsp(meta?.csp, c.config) };
  }
  async create(
    id: string,
    token: string,
    source: CreateApp,
  ): Promise<AppSnapshot> {
    const c = this.conn(id, token),
      input = createAppSchema.parse(boundedJson(source));
    const signature = JSON.stringify(input),
      old = c.requests.get(input.requestId);
    if (old) {
      if (old.signature !== signature)
        throw new HostError(
          "REQUEST_CONFLICT",
          "Request ID reused with different data",
          409,
        );
      return old.promise;
    }
    if (c.requests.size >= 100)
      throw new HostError(
        "APP_LIMIT",
        "Connection instance limit reached",
        429,
      );
    const promise = this.createNew(c, input);
    c.requests.set(input.requestId, { signature, promise });
    return promise;
  }
  private async createNew(
    c: Connection,
    input: CreateApp,
  ): Promise<AppSnapshot> {
    const tool = c.info.tools.find((t) => t.name === input.tool);
    if (!tool || !this.visible(tool, "model"))
      throw new HostError(
        "TOOL_FORBIDDEN",
        "Tool unavailable to the caller",
        403,
      );
    const snapshot: AppSnapshot = {
      id: randomUUID(),
      serverConnectionId: c.info.id,
      runId: input.runId,
      toolCallId: randomUUID(),
      tool,
      input: input.arguments,
      status: "running",
    };
    const i: Instance = {
      snapshot,
      events: [],
      nextEvent: 1,
      abort: new AbortController(),
      busy: false,
      reads: 0,
    };
    c.apps.set(snapshot.id, i);
    this.event(i, "app.created", { tool: tool.name });
    void this.execute(c, i, { name: tool.name, arguments: input.arguments })
      .then((result) => {
        if (i.abort.signal.aborted) return;
        snapshot.status = "complete";
        snapshot.result = result;
        this.event(i, "tool.result", result);
      })
      .catch((error) => {
        if (i.abort.signal.aborted) return;
        snapshot.status = "error";
        snapshot.error = String(error);
        this.event(i, "tool.error", { message: snapshot.error });
      });
    const uri = getToolUiResourceUri(tool);
    if (uri)
      try {
        snapshot.resource = await this.resource(c, uri);
      } catch (error) {
        snapshot.resourceError = String(error);
        this.event(i, "resource.error", { message: snapshot.resourceError });
      }
    return structuredClone(snapshot);
  }
  /** Trusted orchestration call on an existing connection; use attach() for its resulting UI. */
  async callForHost(
    id: string,
    token: string,
    source: unknown,
    signal?: AbortSignal,
  ): Promise<CallToolResult> {
    const c = this.conn(id, token),
      params = callSchema.parse(boundedJson(source));
    const tool = c.info.tools.find((t) => t.name === params.name);
    if (!tool || !this.visible(tool, "model"))
      throw new HostError(
        "TOOL_FORBIDDEN",
        "Tool unavailable to the caller",
        403,
      );
    return boundedJson(
      (await c.client.callTool(params, {
        timeout: this.timeoutMs,
        signal,
      })) as CallToolResult,
    );
  }
  // Trusted orchestrators can attach the result of a call already executed on this connection.
  async attach(
    id: string,
    token: string,
    input: CreateApp,
    result: CallToolResult,
  ): Promise<AppSnapshot> {
    const c = this.conn(id, token);
    createAppSchema.parse(boundedJson(input));
    boundedJson(result);
    const tool = c.info.tools.find((t) => t.name === input.tool);
    if (!tool || !this.visible(tool, "model"))
      throw new HostError("TOOL_FORBIDDEN", "Tool unavailable", 403);
    if (c.apps.size >= 100)
      throw new HostError("APP_LIMIT", "Too many instances", 429);
    const snapshot: AppSnapshot = {
      id: randomUUID(),
      serverConnectionId: c.info.id,
      runId: input.runId,
      toolCallId: input.requestId,
      tool,
      input: input.arguments,
      result,
      status: "complete",
    };
    const i: Instance = {
      snapshot,
      events: [],
      nextEvent: 1,
      abort: new AbortController(),
      busy: false,
      reads: 0,
    };
    c.apps.set(snapshot.id, i);
    const uri = getToolUiResourceUri(tool);
    if (uri)
      try {
        snapshot.resource = await this.resource(c, uri);
      } catch (e) {
        snapshot.resourceError = String(e);
      }
    this.event(i, "tool.attached", { tool: tool.name });
    return structuredClone(snapshot);
  }
  private visible(tool: Tool, actor: "app" | "model") {
    const ui = tool._meta?.ui as { visibility?: string[] } | undefined;
    return (ui?.visibility ?? ["app", "model"]).includes(actor);
  }
  private async execute(
    c: Connection,
    i: Instance,
    params: { name: string; arguments?: Record<string, unknown> },
    signal?: AbortSignal,
  ): Promise<CallToolResult> {
    if (i.abort.signal.aborted)
      throw new HostError("APP_CLOSED", "Instance closed", 410);
    if (i.busy)
      throw new HostError("APP_BUSY", "A tool call is already running", 409);
    i.busy = true;
    try {
      return boundedJson(
        (await c.client.callTool(params, {
          timeout: this.timeoutMs,
          signal: signal
            ? AbortSignal.any([signal, i.abort.signal])
            : i.abort.signal,
        })) as CallToolResult,
      );
    } finally {
      i.busy = false;
    }
  }
  snapshot(id: string, token: string, appId: string) {
    return structuredClone(this.app(id, token, appId).i.snapshot);
  }
  async callTool(
    id: string,
    token: string,
    appId: string,
    source: unknown,
    signal?: AbortSignal,
  ) {
    const { c, i } = this.app(id, token, appId),
      params = callSchema.parse(boundedJson(source));
    const tool = c.info.tools.find((t) => t.name === params.name);
    if (!tool || !this.visible(tool, "app"))
      throw new HostError(
        "TOOL_FORBIDDEN",
        "Tool unavailable to this App",
        403,
      );
    this.event(i, "tool.request", params);
    const result = await this.execute(c, i, params, signal);
    if (i.abort.signal.aborted)
      throw new HostError("APP_CLOSED", "Instance closed", 410);
    this.event(i, "app.tool.result", result);
    return result;
  }
  async readResource(
    id: string,
    token: string,
    appId: string,
    source: unknown,
    signal?: AbortSignal,
  ) {
    const { c, i } = this.app(id, token, appId),
      p = readSchema.parse(boundedJson(source));
    if (i.abort.signal.aborted)
      throw new HostError("APP_CLOSED", "Instance closed", 410);
    if (!c.resources.has(p.uri))
      throw new HostError("RESOURCE_FORBIDDEN", "Resource is not allowed", 403);
    if (i.reads >= 2)
      throw new HostError("RESOURCE_BUSY", "Too many resource reads", 429);
    i.reads++;
    try {
      return boundedJson(
        await c.client.readResource(p, {
          timeout: this.timeoutMs,
          signal: signal
            ? AbortSignal.any([signal, i.abort.signal])
            : i.abort.signal,
        }),
      );
    } finally {
      i.reads--;
    }
  }

  events(id: string, token: string, appId: string, after: number) {
    const { i } = this.app(id, token, appId);
    if (!Number.isSafeInteger(after) || after < 0 || after >= i.nextEvent)
      throw new HostError("EVENT_CURSOR", "Invalid event cursor");
    if (after < (i.events[0]?.id ?? 1) - 1)
      throw new HostError("EVENT_CURSOR_EXPIRED", "Event cursor expired", 410);
    return i.events.filter((e) => e.id > after);
  }
  cancel(id: string, token: string, appId: string) {
    const { i } = this.app(id, token, appId);
    if (i.snapshot.status !== "running") return;
    i.abort.abort();
    i.snapshot.status = "cancelled";
    this.event(i, "tool.cancelled", {});
  }
  destroy(id: string, token: string, appId: string) {
    const { c, i } = this.app(id, token, appId);
    i.abort.abort();
    c.apps.delete(appId);
  }
  async disconnect(id: string, token: string) {
    const c = this.connections.get(id);
    if (!c || !same(c.info.ownerToken, token)) return;
    this.connections.delete(id);
    for (const i of c.apps.values()) i.abort.abort();
    await c.client.close();
    await c.dispatcher.close();
  }
  async dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    await Promise.allSettled(
      [...this.connections].map(([id, c]) =>
        this.disconnect(id, c.info.ownerToken),
      ),
    );
  }
}
