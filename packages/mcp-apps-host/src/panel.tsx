import { useEffect, useMemo, useRef, useState } from "react";
import { McpAppView } from "./react";
import {
  httpTransport,
  type AppSnapshot,
  type ConnectionInfo,
  type GatewayEvent,
} from "./protocol";
const words = {
  "zh-CN": {
    server: "服务器",
    connect: "连接",
    disconnect: "断开",
    tool: "工具",
    args: "工具参数 JSON",
    call: "调用并展示",
    close: "关闭应用",
    cancel: "取消调用",
    empty:
      "未配置 MCP Server。请使用 pnpm mcp:dev 启动本地示例，或设置服务端 MCP_SERVERS_JSON。",
    choose: "选择工具",
    logs: "交互日志",
    input: "输入 / 结果",
    ready: "已连接",
    error: "错误",
    loading: "处理中…",
    title: "MCP Apps",
    hint: "选择受控服务器和工具，在隔离环境运行应用。",
    model: "消息 / 上下文",
    none: "尚无应用",
    retry: "重新加载服务器列表",
  },
  "en-US": {
    server: "Server",
    connect: "Connect",
    disconnect: "Disconnect",
    tool: "Tool",
    args: "Tool arguments JSON",
    call: "Call and display",
    close: "Close app",
    cancel: "Cancel call",
    empty:
      "No MCP servers configured. Start pnpm mcp:dev for local examples or set server-side MCP_SERVERS_JSON.",
    choose: "Choose a tool",
    logs: "Interaction log",
    input: "Input / result",
    ready: "Connected",
    error: "Error",
    loading: "Working…",
    title: "MCP Apps",
    hint: "Choose a configured server and tool to run an isolated app.",
    model: "Message / context",
    none: "No app yet",
    retry: "Reload servers",
  },
};
/** Optional reference workbench, shared by Playground and the standalone consumer. */
export function McpAppsPanel({
  baseUrl,
  sandboxUrl,
  locale = "zh-CN",
  theme = "light",
}: {
  baseUrl: string;
  sandboxUrl: string;
  locale?: "zh-CN" | "en-US";
  theme?: "light" | "dark";
}) {
  const w = words[locale],
    generation = useRef(0),
    currentConnection = useRef<ConnectionInfo | undefined>(undefined);
  const [servers, setServers] = useState<{ id: string; name: string }[]>([]),
    [server, setServer] = useState(""),
    [connection, setConnection] = useState<ConnectionInfo>(),
    [tool, setTool] = useState(""),
    [args, setArgs] = useState("{}"),
    [app, setApp] = useState<AppSnapshot>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [events, setEvents] = useState<GatewayEvent[]>([]),
    [messages, setMessages] = useState<unknown[]>([]);
  const request = async <T,>(
    suffix: string,
    body?: unknown,
    conn?: ConnectionInfo,
    method?: string,
  ): Promise<T> => {
    const response = await fetch(baseUrl + suffix, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(conn ? { "x-mcp-owner": conn.ownerToken } : {}),
      },
      credentials: "omit",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw Error(`${result.code}: ${result.message}`);
    return result;
  };
  const load = () =>
    request<typeof servers>("/servers")
      .then((v) => {
        setServers(v);
        setServer((old) => old || v[0]?.id || "");
      })
      .catch((e) => setError(String(e)));
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
      const c = currentConnection.current;
      if (c)
        void request(`/connections/${c.id}`, undefined, c, "DELETE").catch(
          () => {},
        );
    };
  }, [baseUrl]);
  const transport = useMemo(
    () =>
      connection && app
        ? httpTransport(baseUrl, connection, app.id)
        : undefined,
    [baseUrl, connection, app?.id],
  );
  const perform = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const connect = () =>
    perform(async () => {
      const gen = ++generation.current;
      const c = await request<ConnectionInfo>("/connections", {
        serverId: server,
      });
      if (gen !== generation.current) {
        void request(`/connections/${c.id}`, undefined, c, "DELETE");
        return;
      }
      currentConnection.current = c;
      setConnection(c);
      const first = c.tools.find(
        (t) =>
          (
            t._meta?.ui as { visibility?: string[] } | undefined
          )?.visibility?.includes("model") ?? true,
      );
      setTool(first?.name ?? "");
    });
  const close = () =>
    perform(async () => {
      generation.current++;
      setApp(undefined);
      if (transport) await transport.destroy();
    });
  const disconnect = () =>
    perform(async () => {
      generation.current++;
      setApp(undefined);
      const c = connection;
      setConnection(undefined);
      currentConnection.current = undefined;
      if (c) await request(`/connections/${c.id}`, undefined, c, "DELETE");
    });
  const call = () =>
    perform(async () => {
      if (!connection) return;
      const input = JSON.parse(args);
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw Error("Arguments must be a JSON object");
      const gen = ++generation.current;
      if (transport) await transport.destroy();
      setApp(undefined);
      setEvents([]);
      const value = await request<AppSnapshot>(
        `/connections/${connection.id}/apps`,
        {
          runId: crypto.randomUUID(),
          requestId: crypto.randomUUID(),
          tool,
          arguments: input,
        },
        connection,
      );
      if (gen !== generation.current) {
        void request(
          `/connections/${connection.id}/apps/${value.id}`,
          undefined,
          connection,
          "DELETE",
        );
        return;
      }
      setApp(value);
    });
  return (
    <section
      className="mcp-workbench"
      aria-label="MCP Apps"
      style={{
        colorScheme: theme,
        padding: 20,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <style>{`.mcp-workbench select,.mcp-workbench textarea{color:inherit;background:var(--color-surface,#fff);border:1px solid var(--color-divider,#dce4eb);border-radius:6px;padding:8px;font:inherit;max-width:100%;box-sizing:border-box}.mcp-workbench label{display:flex;flex-direction:column;gap:6px}.mcp-workbench select:disabled{opacity:.7}.mcp-workbench details{margin-top:12px}.mcp-workbench pre{background:var(--color-surface,transparent);padding:12px;border:1px solid var(--color-divider,#dce4eb);border-radius:8px}.mcp-workbench button{font:inherit}`}</style>
      <h2>{w.title}</h2>
      <p>{w.hint}</p>
      {error && (
        <p role="alert" style={{ overflowWrap: "anywhere" }}>
          {w.error}: {error}
        </p>
      )}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
          margin: "16px 0",
        }}
      >
        <label>
          {w.server}
          <select
            aria-label={w.server}
            value={server}
            disabled={!!connection || busy}
            onChange={(e) => setServer(e.target.value)}
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {!connection ? (
          <button
            className="btn btn-primary"
            disabled={!server || busy}
            onClick={() => void connect()}
          >
            {w.connect}
          </button>
        ) : (
          <>
            <span>{w.ready}</span>
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {w.disconnect}
            </button>
          </>
        )}
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          {w.retry}
        </button>
      </div>
      {!servers.length && <p>{w.empty}</p>}
      {connection && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))",
            gap: 20,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <label>
              {w.tool}
              <select
                aria-label={w.tool}
                value={tool}
                disabled={busy}
                onChange={(e) => setTool(e.target.value)}
              >
                {connection.tools
                  .filter(
                    (t) =>
                      (
                        t._meta?.ui as { visibility?: string[] } | undefined
                      )?.visibility?.includes("model") ?? true,
                  )
                  .map((t) => (
                    <option value={t.name} key={t.name}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <label style={{ display: "block", marginTop: 12 }}>
              {w.args}
              <textarea
                aria-label={w.args}
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                rows={8}
                style={{
                  display: "block",
                  boxSizing: "border-box",
                  width: "100%",
                  fontFamily: "monospace",
                }}
              />
            </label>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 12,
              }}
            >
              <button
                className="btn btn-primary"
                disabled={busy || !tool}
                onClick={() => void call()}
              >
                {busy ? w.loading : w.call}
              </button>
              {app && (
                <>
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => void close()}
                  >
                    {w.close}
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        await request(
                          `/connections/${connection.id}/apps/${app.id}/cancel`,
                          {},
                          connection,
                        );
                      })
                    }
                  >
                    {w.cancel}
                  </button>
                </>
              )}
            </div>
            <details>
              <summary>{w.input}</summary>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {JSON.stringify(
                  { input: app?.input, result: app?.result },
                  null,
                  2,
                )}
              </pre>
            </details>
          </div>
          <div style={{ minWidth: 0 }}>
            {transport ? (
              <McpAppView
                transport={transport}
                sandboxUrl={sandboxUrl}
                locale={locale}
                theme={theme}
                onError={(e) => setError(e.message)}
                onEvent={(event) => {
                  setEvents((old) => [...old.slice(-99), event]);
                  if (event.type === "tool.result")
                    setApp((old) =>
                      old
                        ? {
                            ...old,
                            result: event.payload as AppSnapshot["result"],
                            status: "complete",
                          }
                        : old,
                    );
                }}
                onMessage={async (p) => {
                  setMessages((old) => [
                    ...old.slice(-19),
                    { type: "message", payload: p },
                  ]);
                }}
                onContextUpdate={async (p) => {
                  setMessages((old) => [
                    ...old.slice(-19),
                    { type: "context", payload: p },
                  ]);
                }}
              />
            ) : (
              <p>{w.none}</p>
            )}
          </div>
        </div>
      )}
      <details open>
        <summary>{w.logs}</summary>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          {JSON.stringify(events, null, 2)}
        </pre>
      </details>
      <details>
        <summary>{w.model}</summary>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {JSON.stringify(messages, null, 2)}
        </pre>
      </details>
    </section>
  );
}
