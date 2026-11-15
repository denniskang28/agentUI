import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AgentUiError,
  EMBED_PROTOCOL,
  HOST_VERSION,
  actionEventSchema,
  normalizedBatchSchema,
  canonical,
  type ActionEvent,
  type HostManifest,
  type NormalizedBatch,
  type RunConfig,
} from "./protocol";

export type {
  ActionEvent,
  HostManifest,
  NormalizedBatch,
  RunConfig,
} from "./protocol";
export interface HostReceipt {
  batchId: string;
  runId: string;
  lastSequence: number;
  errors: unknown[];
}
type Listener = (message: Record<string, unknown>) => void;
/** One ordered session channel can attach a frame and display multiple Surfaces. */
export class AgentUiClient {
  private port?: MessagePort;
  private listeners = new Set<Listener>();
  private queue: Promise<unknown> = Promise.resolve();
  private ready?: () => void;
  private pending = new Map<
    string,
    {
      resolve: (receipt: HostReceipt) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private batches = new Map<
    string,
    { signature: string; receipt?: HostReceipt }
  >();
  private generation = 0;
  private connected = false;
  private closed = false;
  private connectionTimer?: ReturnType<typeof setTimeout>;
  constructor(
    readonly runId: string,
    readonly onAction?: (event: ActionEvent) => void,
    readonly onError?: (error: AgentUiError) => void,
  ) {}
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(message: Record<string, unknown>) {
    this.listeners.forEach((listener) => listener(message));
  }
  attach(
    port: MessagePort,
    manifest: HostManifest,
    config: Partial<RunConfig> = {},
  ) {
    if (this.closed)
      throw new AgentUiError(
        "CLIENT_DISPOSED",
        "Create a new client after disposal",
      );
    this.detach();
    this.port = port;
    const generation = this.generation;
    this.queue = new Promise<void>((resolve) => {
      this.ready = resolve;
    });
    this.connectionTimer = setTimeout(() => {
      this.onError?.(
        new AgentUiError(
          "HOST_CONNECT_TIMEOUT",
          "Host initialization timed out",
        ),
      );
      this.ready?.();
    }, 15000);
    port.onmessage = (event) => {
      if (
        generation !== this.generation ||
        !event.data ||
        event.data.runId !== this.runId
      )
        return;
      const message = event.data as Record<string, unknown>;
      if (message.type === "connected") {
        clearTimeout(this.connectionTimer);
        this.connected = true;
        this.ready?.();
      }
      if (message.type === "action") {
        const parsed = actionEventSchema.safeParse(message.event);
        if (parsed.success && parsed.data.runId === this.runId)
          this.onAction?.(parsed.data);
      }
      if (message.type === "applied" && typeof message.batchId === "string") {
        const request = this.pending.get(message.batchId);
        if (request) {
          clearTimeout(request.timer);
          this.pending.delete(message.batchId);
          const receipt = {
            batchId: message.batchId,
            runId: this.runId,
            lastSequence: Number(message.lastSequence),
            errors: Array.isArray(message.errors) ? message.errors : [],
          };
          const prior = this.batches.get(message.batchId);
          if (prior) prior.receipt = receipt;
          request.resolve(receipt);
        }
      }
      if (message.type === "error") {
        const error = new AgentUiError(
          String(message.code ?? "HOST_ERROR"),
          String(message.message ?? "Host error"),
          message.details,
        );
        this.onError?.(error);
        if (!this.connected) {
          clearTimeout(this.connectionTimer);
          this.ready?.();
        }
        if (typeof message.batchId === "string") {
          const pending = this.pending.get(message.batchId);
          if (pending) {
            clearTimeout(pending.timer);
            pending.reject(error);
            this.pending.delete(message.batchId);
          }
        }
      }
      this.emit(message);
    };
    port.start();
    port.postMessage({
      type: "init",
      protocol: EMBED_PROTOCOL,
      hostVersion: HOST_VERSION,
      runId: this.runId,
      manifest,
      config,
    });
  }
  apply(source: NormalizedBatch): Promise<HostReceipt> {
    const batch = normalizedBatchSchema.parse(source);
    if (batch.runId !== this.runId)
      return Promise.reject(
        new AgentUiError("STALE_RUN", "Batch belongs to another run"),
      );
    const generation = this.generation;
    const task = this.queue.then(() => {
      if (
        this.closed ||
        generation !== this.generation ||
        !this.connected ||
        !this.port
      )
        throw new AgentUiError("HOST_NOT_CONNECTED", "Host is not connected");
      const signature = canonical({ ...batch, replay: false });
      const prior = this.batches.get(batch.batchId);
      if (prior) {
        if (prior.signature !== signature)
          throw new AgentUiError(
            "BATCH_CONFLICT",
            "Batch ID reused with changed content",
          );
        if (prior.receipt) return prior.receipt;
      }
      this.batches.set(batch.batchId, { signature });
      return new Promise<HostReceipt>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(batch.batchId);
          reject(
            new AgentUiError(
              "HOST_ACK_TIMEOUT",
              "Host application acknowledgement timed out",
            ),
          );
        }, 15000);
        this.pending.set(batch.batchId, { resolve, reject, timer });
        this.port!.postMessage({ type: "batch", runId: this.runId, batch });
      });
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
  configure(
    config: Pick<
      Partial<RunConfig>,
      "locale" | "theme" | "themeTokens" | "componentAppearances"
    >,
  ) {
    this.port?.postMessage({ type: "configure", runId: this.runId, config });
  }
  select(surfaceIds?: string[]) {
    this.port?.postMessage({ type: "select", runId: this.runId, surfaceIds });
  }
  detach() {
    clearTimeout(this.connectionTimer);
    this.generation++;
    this.connected = false;
    this.ready?.();
    this.ready = undefined;
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new AgentUiError("HOST_DETACHED", "Host detached"));
    }
    this.pending.clear();
    this.batches.clear();
    this.port?.postMessage({ type: "dispose", runId: this.runId });
    this.port?.close();
    this.port = undefined;
    this.queue = Promise.resolve();
  }
  dispose() {
    this.detach();
    this.closed = true;
    this.listeners.clear();
  }
}

const Session = createContext<AgentUiClient | null>(null);
export function AgentUiProvider({
  client,
  children,
}: {
  client: AgentUiClient;
  children: ReactNode;
}) {
  return <Session.Provider value={client}>{children}</Session.Provider>;
}
export interface AgentUiHostProps {
  hostUrl: string;
  manifest: HostManifest;
  config?: Partial<RunConfig>;
  surfaceIds?: string[];
  title?: string;
  onConnected?: () => void;
}
/** The credentialed application never imports plugin JavaScript. */
export function AgentUiHost({
  hostUrl,
  manifest,
  config,
  surfaceIds,
  title = "Agent UI",
  onConnected,
}: AgentUiHostProps) {
  const client = useContext(Session);
  if (!client)
    throw new AgentUiError(
      "PROVIDER_REQUIRED",
      "Wrap AgentUiHost in AgentUiProvider",
    );
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ manifest, config, surfaceIds, onConnected });
  latest.current = { manifest, config, surfaceIds, onConnected };
  const [height, setHeight] = useState(120);
  useEffect(() => {
    const url = new URL(hostUrl, location.href);
    if (url.origin === location.origin)
      throw new AgentUiError("HOST_ORIGIN", "Host must use a separate origin");
    let connectedDocument: string | undefined;
    const loadTimer = setTimeout(() => {
      if (!connectedDocument)
        client.onError?.(
          new AgentUiError(
            "HOST_LOAD_TIMEOUT",
            "Host did not become ready; check URL, CSP and allowed parent origins",
          ),
        );
    }, 15000);
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== url.origin ||
        event.data?.type !== "agent-ui.ready" ||
        event.data.protocol !== EMBED_PROTOCOL
      )
        return;
      if (event.data.hostVersion !== HOST_VERSION) {
        clearTimeout(loadTimer);
        client.onError?.(
          new AgentUiError("HOST_VERSION", "Host/client versions differ"),
        );
        return;
      }
      if (
        typeof event.data.documentId !== "string" ||
        connectedDocument === event.data.documentId
      )
        return;
      if (connectedDocument) client.detach();
      connectedDocument = event.data.documentId;
      clearTimeout(loadTimer);
      const channel = new MessageChannel();
      client.attach(
        channel.port1,
        latest.current.manifest,
        latest.current.config,
      );
      frame.current?.contentWindow?.postMessage(
        { type: "agent-ui.connect", protocol: EMBED_PROTOCOL },
        url.origin,
        [channel.port2],
      );
    };
    const unsubscribe = client.subscribe((message) => {
      if (
        message.type === "resize" &&
        typeof message.height === "number" &&
        Number.isFinite(message.height)
      )
        setHeight(Math.min(10000, Math.max(32, message.height)));
      if (message.type === "connected") {
        client.select(latest.current.surfaceIds);
        latest.current.onConnected?.();
      }
    });
    window.addEventListener("message", receive);
    // Probe handles an iframe loaded before the parent effect attached.
    const probe = () =>
      frame.current?.contentWindow?.postMessage(
        { type: "agent-ui.probe", protocol: EMBED_PROTOCOL },
        url.origin,
      );
    probe();
    frame.current?.addEventListener("load", probe);
    const node = frame.current;
    return () => {
      clearTimeout(loadTimer);
      window.removeEventListener("message", receive);
      node?.removeEventListener("load", probe);
      unsubscribe();
      client.detach();
    };
  }, [client, hostUrl]);
  useEffect(() => {
    client.configure({
      locale: config?.locale,
      theme: config?.theme,
      themeTokens: config?.themeTokens,
      componentAppearances: config?.componentAppearances,
    });
  }, [
    client,
    config?.locale,
    config?.theme,
    config?.themeTokens,
    config?.componentAppearances,
  ]);
  useEffect(() => {
    client.select(surfaceIds);
  }, [client, surfaceIds]);
  return (
    <iframe
      ref={frame}
      src={hostUrl}
      title={title}
      sandbox="allow-scripts allow-same-origin"
      referrerPolicy="no-referrer"
      style={{ display: "block", border: 0, width: "100%", height }}
    />
  );
}
