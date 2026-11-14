import { useEffect, useRef, useState } from "react";
import type { Locale, SessionInfo, StreamEvent } from "../shared/domain";
import { translate } from "../shared/i18n";
import { request, apiUrl } from "./api";
import { UiPanel, variant } from "./UiPanel";

export function App() {
  const [locale, setLocale] = useState<Locale>(() =>
    localStorage.getItem("locale") === "en-US" ? "en-US" : "zh-CN",
  );
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") ?? "light",
  );
  const [session, setSession] = useState<SessionInfo>();
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<"native" | "sandbox">(
    "sandbox",
  );
  const end = useRef<HTMLDivElement>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  useEffect(() => {
    localStorage.setItem("locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    let active = true;
    const previous = localStorage.getItem(`conversation:${variant}`);
    void request<SessionInfo>(
      `/api/session${previous ? `?id=${encodeURIComponent(previous)}` : ""}`,
    )
      .then((value) => {
        if (active) {
          setSession(value);
          localStorage.setItem(`conversation:${variant}`, value.id);
        }
      })
      .catch((reason) => {
        if (active) setError(String(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session?.id) return;
    let stream: EventSource | undefined;
    let lastId = 0;
    const receive = (incoming: MessageEvent<string>) => {
      const event = JSON.parse(incoming.data) as StreamEvent;
      lastId = event.id;
      if (event.type === "reset") {
        setSession((old) =>
          old
            ? {
                ...old,
                ...(event.payload as {
                  runId: string;
                  mode: "template" | "raw";
                }),
              }
            : old,
        );
        setEvents([]);
        setError("");
      } else {
        setEvents((old) =>
          old.some((item) => item.id === event.id) ? old : [...old, event],
        );
        if (event.type === "error") setError(String(event.payload));
      }
    };
    const offline = () => {
      stream?.close();
      setConnected(false);
    };
    const online = () => {
      stream?.close();
      stream = new EventSource(
        apiUrl(`/api/sessions/${session.id}/events?after=${lastId}`),
      );
      stream.onopen = () => setConnected(true);
      stream.onerror = () => setConnected(false);
      stream.onmessage = receive;
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    if (navigator.onLine) online();
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      stream?.close();
      setConnected(false);
    };
  }, [session?.id]);
  const current = events.filter((event) => event.runId === session?.runId);
  async function chat(text: string) {
    if (!session) return;
    setInput("");
    setError("");
    try {
      await request(`/api/sessions/${session.id}/chat`, {
        text,
        runId: session.runId,
      });
    } catch (reason) {
      setError(String(reason));
    }
  }
  async function action(value: unknown) {
    if (!session) return;
    try {
      await request(`/api/sessions/${session.id}/actions`, {
        runId: session.runId,
        action: value,
      });
    } catch (reason) {
      setError(String(reason));
      throw reason;
    }
  }
  async function reset(mode = session?.mode ?? "template") {
    if (!session) return;
    setResetting(true);
    try {
      const value = await request<SessionInfo>(
        `/api/sessions/${session.id}/reset`,
        { mode },
      );
      setSession(value);
      setEvents([]);
      setError("");
    } finally {
      setResetting(false);
    }
  }
  function exportTrace() {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ variant, session, events: current }, null, 2)],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${variant}-trace.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="brand-icon">A</span>
          <div>
            <strong>{t("title")}</strong>
            <small>{t("subtitle")}</small>
          </div>
        </div>
        <nav>
          <button
            onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
          >
            {t("language")}
          </button>
          <button
            aria-label={t("theme")}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "◐" : "◑"}
          </button>
          <button
            onClick={() =>
              void reset().catch((reason) => setError(String(reason)))
            }
          >
            {t("reset")}
          </button>
        </nav>
      </header>
      <main>
        <aside>
          <span className="eyebrow">CHATBOT COMPARISON</span>
          <h1>{t(variant === "baseline" ? "baseline" : "integrated")}</h1>
          <p>{t("description")}</p>
          <div className="status">
            <span className={connected ? "dot online" : "dot"} />
            {t(connected ? "connected" : "loading")}
          </div>
          <div className="suggestions">
            {(["expense", "risk", "composition"] as const).map((key) => (
              <button
                key={key}
                disabled={!session}
                onClick={() => void chat(t(key))}
              >
                {t(key)} <span>↗</span>
              </button>
            ))}
          </div>
          {variant !== "baseline" && (
            <div className="controls">
              <label>
                UI
                <select
                  disabled={!session || resetting}
                  aria-label="UI mode"
                  value={session?.mode ?? "template"}
                  onChange={(event) =>
                    void reset(event.target.value as "template" | "raw").catch(
                      (reason) => setError(String(reason)),
                    )
                  }
                >
                  <option value="template">{t("template")}</option>
                  <option value="raw">{t("raw")}</option>
                </select>
              </label>
              <label>
                Runtime
                <select
                  disabled={!session || resetting}
                  aria-label="Runtime mode"
                  value={runtimeMode}
                  onChange={(event) => {
                    setRuntimeMode(event.target.value as "native" | "sandbox");
                    void reset().catch((reason) => setError(String(reason)));
                  }}
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="native">Native</option>
                </select>
              </label>
            </div>
          )}
          <small className="identity">{t("permission")}</small>
          <details className="developer">
            <summary>{t("debug")}</summary>
            <button
              onClick={() =>
                void request(
                  `/api/sessions/${session?.id}/fail-next`,
                  {},
                ).catch((reason) => setError(String(reason)))
              }
            >
              {t("fail")}
            </button>
            <button onClick={exportTrace}>{t("export")}</button>
            <p>{t("trace")}</p>
            <pre>{JSON.stringify(current, null, 2)}</pre>
          </details>
        </aside>
        <section className="conversation" aria-label="Chat">
          <div className="messages">
            {current.length === 0 && (
              <div className="empty">
                <div className="empty-icon">✧</div>
                <h2>{t("empty")}</h2>
                <p>{t("emptyDetail")}</p>
              </div>
            )}
            {current
              .filter((event) => event.type === "text")
              .map((event) => {
                const content = event.payload as { role: string; text: string };
                return (
                  <article key={event.id} className={`bubble ${content.role}`}>
                    <small>
                      {t(content.role === "user" ? "user" : "assistant")}
                    </small>
                    <p>{content.text}</p>
                  </article>
                );
              })}
            {session && (
              <UiPanel
                key={`${session.runId}:${runtimeMode}`}
                session={session}
                events={current.filter((event) => event.type === "ui")}
                locale={locale}
                theme={theme}
                runtimeMode={runtimeMode}
                onAction={action}
                onError={setError}
              />
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div ref={end} />
          </div>
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (input.trim()) void chat(input.trim());
            }}
          >
            <input
              aria-label={t("input")}
              placeholder={t("input")}
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button className="primary" disabled={!session || !input.trim()}>
              {t("send")} ↑
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
