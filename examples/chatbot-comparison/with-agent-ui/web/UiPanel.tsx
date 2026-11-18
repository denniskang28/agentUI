import { McpAppView, httpTransport } from "@enterprise/mcp-apps-host/react";
import { request, apiUrl } from "./api";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AgentUiClient,
  AgentUiProvider,
  AgentUiHost,
  type HostManifest,
  type NormalizedBatch,
} from "@enterprise/agent-ui/react";
import type { Locale, SessionInfo, StreamEvent } from "../shared/domain";

export const variant: string = "with-agent-ui";
export interface UiPanelProps {
  session: SessionInfo;
  events: StreamEvent[];
  locale: Locale;
  theme: string;
  runtimeMode: "native" | "sandbox";
  onAction: (action: unknown) => Promise<void>;
  onError: (error: string) => void;
}
export function UiPanel({
  session,
  events,
  locale,
  theme,
  runtimeMode,
  onAction,
  onError,
}: UiPanelProps) {
  const hostUrl =
    import.meta.env.VITE_AGENT_UI_HOST_URL ?? "http://127.0.0.1:4183";
  const [manifest, setManifest] = useState<HostManifest>();
  const [connection, setConnection] = useState(0);
  const callbacks = useRef({ onAction, onError });
  callbacks.current = { onAction, onError };
  const client = useMemo(
    () =>
      new AgentUiClient(
        session.runId,
        (action) => {
          void callbacks.current
            .onAction(action)
            .catch((reason) => callbacks.current.onError(String(reason)));
        },
        (error) => callbacks.current.onError(`${error.code}: ${error.message}`),
      ),
    [session.runId],
  );
  const lastApplied = useRef(0);
  useEffect(() => {
    let active = true;
    void fetch(`${hostUrl}/manifest.json`, { credentials: "omit" })
      .then((response) => {
        if (!response.ok) throw Error("MANIFEST_UNAVAILABLE");
        return response.json();
      })
      .then((value) => {
        if (active) setManifest(value as HostManifest);
      })
      .catch((reason) => {
        if (active) callbacks.current.onError(String(reason));
      });
    return () => {
      active = false;
    };
  }, [hostUrl]);
  useEffect(() => {
    if (!connection) return;
    let active = true;
    const apply = async () => {
      for (const event of events) {
        if (event.type !== "ui" || !active || event.id <= lastApplied.current)
          continue;
        const receipt = await client.apply(event.payload as NormalizedBatch);
        if (!active) return;
        lastApplied.current = event.id;
        if (receipt.errors.length)
          callbacks.current.onError(JSON.stringify(receipt.errors));
      }
    };
    void apply().catch((reason) => {
      if (active) callbacks.current.onError(String(reason));
    });
    return () => {
      active = false;
    };
  }, [client, connection, events]);
  // Host cleanup detaches its channel. StrictMode may replay effects on the
  // same memoized client, so do not permanently dispose it in effect cleanup.
  if (!manifest) return null;
  return (
    <>
      <AgentUiProvider client={client}>
        <AgentUiHost
          hostUrl={hostUrl}
          manifest={manifest}
          config={{
            locale,
            theme: theme === "dark" ? "dark" : "light",
            runtimeMode,
            container: "chat",
          }}
          onConnected={() => {
            lastApplied.current = 0;
            setConnection((value) => value + 1);
          }}
        />
      </AgentUiProvider>
      {events
        .filter((e) => e.type === "mcp")
        .map((e) => (
          <McpCard
            key={e.id}
            payload={
              e.payload as {
                connection: { id: string; ownerToken: string };
                appId: string;
              }
            }
            session={session}
            locale={locale}
            theme={theme}
            hostUrl={hostUrl}
            onError={onError}
          />
        ))}
    </>
  );
}

function McpCard({
  payload,
  session,
  locale,
  theme,
  hostUrl,
  onError,
}: {
  payload: { connection: { id: string; ownerToken: string }; appId: string };
  session: SessionInfo;
  locale: Locale;
  theme: string;
  hostUrl: string;
  onError: (error: string) => void;
}) {
  const transport = useMemo(
    () => httpTransport(apiUrl("/api/mcp"), payload.connection, payload.appId),
    [payload],
  );
  const feedback = (type: "message" | "context", value: unknown) =>
    request<void>(`/api/sessions/${session.id}/mcp-feedback`, {
      runId: session.runId,
      type,
      payload: value,
    });
  return (
    <article aria-label="MCP App card">
      <McpAppView
        transport={transport}
        sandboxUrl={`${hostUrl}/mcp-sandbox.html`}
        locale={locale}
        theme={theme === "dark" ? "dark" : "light"}
        onError={(e) => onError(e.message)}
        onMessage={(value) => feedback("message", value)}
        onContextUpdate={(value) => feedback("context", value)}
      />
    </article>
  );
}
