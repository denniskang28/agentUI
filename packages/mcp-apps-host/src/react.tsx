import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBridge,
  PostMessageTransport,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { HostTransport, AppSnapshot, GatewayEvent } from "./protocol";
export { httpTransport } from "./protocol";
export type {
  HostTransport,
  AppSnapshot,
  GatewayEvent,
  ConnectionInfo,
  Tool,
} from "./protocol";
export interface McpAppViewProps {
  transport: HostTransport;
  sandboxUrl: string;
  theme?: "light" | "dark";
  locale?: string;
  onMessage?: (message: unknown) => Promise<void>;
  onContextUpdate?: (context: unknown) => Promise<void>;
  onOpenLink?: (url: string) => Promise<void>;
  onEvent?: (event: GatewayEvent) => void;
  onError?: (error: Error) => void;
}
/** A stable transport identifies one server-owned App instance. Mounting never calls its initial tool. */
export function McpAppView(props: McpAppViewProps) {
  const { transport, sandboxUrl } = props;
  const frameKey = useMemo(() => crypto.randomUUID(), [transport, sandboxUrl]);
  const frame = useRef<HTMLIFrameElement>(null),
    bridge = useRef<AppBridge | undefined>(undefined);
  const latest = useRef(props);
  latest.current = props;
  const [snapshot, setSnapshot] = useState<AppSnapshot>(),
    [error, setError] = useState(""),
    [height, setHeight] = useState(160),
    [ready, setReady] = useState(false);
  const context = (): McpUiHostContext => ({
    theme: latest.current.theme ?? "light",
    locale: latest.current.locale ?? "zh-CN",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: "web",
    displayMode: "inline",
    availableDisplayModes: ["inline"],
    containerDimensions: { maxHeight: 1200 },
  });
  useEffect(() => {
    bridge.current?.setHostContext(context());
  }, [props.theme, props.locale]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    setSnapshot(undefined);
    setError("");
    setReady(false);
    const report = (e: unknown) => {
      if (!active) return;
      const value = e instanceof Error ? e : new Error(String(e));
      setError(value.message);
      latest.current.onError?.(value);
    };
    let sent = false,
      initialized = false,
      current: AppSnapshot | undefined,
      cursor = 0,
      ownBridge: AppBridge | undefined;
    const deliver = () => {
      if (!initialized || sent || !current || current.status === "running")
        return;
      sent = true;
      if (current.result)
        void ownBridge?.sendToolResult(current.result).catch(report);
      else if (current.status === "error")
        void ownBridge
          ?.sendToolResult({
            isError: true,
            content: [{ type: "text", text: current.error ?? "Tool failed" }],
          })
          .catch(report);
      else
        void ownBridge
          ?.sendToolCancelled({ reason: current.error ?? "Tool cancelled" })
          .catch(report);
    };
    const initialize = async () => {
      current = await transport.snapshot(controller.signal);
      if (!active) return;
      setSnapshot(current);
      if (!current.resource) {
        if (current.resourceError) setError(current.resourceError);
        return;
      }
      const target = frame.current;
      if (!target) throw Error("SANDBOX_MISSING");
      const url = new URL(sandboxUrl, location.href);
      if (url.origin === location.origin)
        throw Error("SANDBOX_ORIGIN: sandbox must use a separate origin");
      url.searchParams.set("parentOrigin", location.origin);
      url.searchParams.set("csp", JSON.stringify(current.resource.csp));
      ownBridge = new AppBridge(
        null,
        { name: "Enterprise MCP Apps Host", version: "0.1.0" },
        {
          serverTools: {},
          serverResources: {},
          logging: {},
          ...(latest.current.onContextUpdate
            ? { updateModelContext: { text: {} } }
            : {}),
          ...(latest.current.onOpenLink ? { openLinks: {} } : {}),
        },
        { hostContext: context() },
      );
      bridge.current = ownBridge;
      ownBridge.oncalltool = (params, extra) => {
        if (!active) throw Error("HOST_DETACHED");
        return transport.callTool(
          { name: params.name, arguments: params.arguments },
          extra.mcpReq.signal,
        );
      };
      ownBridge.onreadresource = (params, extra) => {
        if (!active) throw Error("HOST_DETACHED");
        return transport.readResource({ uri: params.uri }, extra.mcpReq.signal);
      };
      ownBridge.onmessage = async (p) => {
        if (!active) throw Error("HOST_DETACHED");
        if (!latest.current.onMessage) return { isError: true };
        await latest.current.onMessage(p);
        return {};
      };
      ownBridge.onupdatemodelcontext = async (p) => {
        if (!active) throw Error("HOST_DETACHED");
        if (!latest.current.onContextUpdate) throw Error("CONTEXT_UNSUPPORTED");
        await latest.current.onContextUpdate(p);
        return {};
      };
      ownBridge.onopenlink = async (p) => {
        if (!active) throw Error("HOST_DETACHED");
        const u = new URL(p.url);
        if (
          !["https:", "http:"].includes(u.protocol) ||
          !latest.current.onOpenLink
        )
          return { isError: true };
        await latest.current.onOpenLink(u.href);
        return {};
      };
      ownBridge.onrequestdisplaymode = async () => {
        if (!active) throw Error("HOST_DETACHED");
        return { mode: "inline" };
      };
      ownBridge.onsizechange = ({ height: h }) => {
        if (!active) return;
        if (typeof h === "number" && Number.isFinite(h))
          setHeight(Math.max(80, Math.min(1200, h)));
      };
      ownBridge.oninitialized = () => {
        if (!active) return;
        void ownBridge!
          .sendToolInput({ arguments: current!.input })
          .then(() => {
            if (!active) return;
            initialized = true;
            setReady(true);
            deliver();
          })
          .catch(report);
      };
      const loaded = new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => {
          window.removeEventListener("message", receive);
          reject(Error("SANDBOX_LOAD_TIMEOUT"));
        }, 10000);
        const receive = (e: MessageEvent) => {
          if (
            e.source !== target.contentWindow ||
            e.origin !== url.origin ||
            e.data?.method !== "ui/notifications/sandbox-proxy-ready"
          )
            return;
          clearTimeout(deadline);
          window.removeEventListener("message", receive);
          resolve();
        };
        window.addEventListener("message", receive);
        controller.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(deadline);
            window.removeEventListener("message", receive);
            reject(Error("HOST_DETACHED"));
          },
          { once: true },
        );
      });
      target.src = url.href;
      await loaded;
      if (!active) return;
      await ownBridge.connect(
        new PostMessageTransport(target.contentWindow!, target.contentWindow!),
      );
      await ownBridge.sendSandboxResourceReady({
        html: current.resource.html,
        csp: current.resource.csp,
        sandbox: "allow-scripts",
      });
      timer = setTimeout(() => {
        if (!initialized) report(Error("APP_INITIALIZE_TIMEOUT"));
      }, 10000);
    };
    const poll = async () => {
      try {
        const events = await transport.events(cursor, controller.signal);
        if (!active) return;
        for (const event of events) {
          cursor = event.id;
          latest.current.onEvent?.(event);
        }
        current = await transport.snapshot(controller.signal);
        if (!active) return;
        setSnapshot(current);
        deliver();
      } catch (e) {
        report(e);
        return;
      }
      if (active) pollTimer = setTimeout(() => void poll(), 500);
    };
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    void initialize()
      .then(() => {
        if (active) void poll();
      })
      .catch(report);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
      clearTimeout(pollTimer);
      bridge.current = undefined;
      if (ownBridge) {
        void ownBridge
          .teardownResource({ reason: "Host detached" }, { timeout: 500 })
          .catch(() => {})
          .finally(() => ownBridge?.close());
      }
    };
  }, [transport, sandboxUrl]);
  return (
    <div data-mcp-app={snapshot?.id} data-mcp-ready={ready}>
      {error && (
        <p role="alert" style={{ overflowWrap: "anywhere" }}>
          {error}
        </p>
      )}
      <iframe
        key={frameKey}
        ref={frame}
        title="MCP App"
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        style={{
          width: "100%",
          height,
          border: 0,
          display: snapshot?.resource ? "block" : "none",
        }}
      />
      {(!snapshot?.resource || !!error) && snapshot?.result && (
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {snapshot.result.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n")}
        </pre>
      )}
    </div>
  );
}

export { McpAppsPanel } from "./panel";
