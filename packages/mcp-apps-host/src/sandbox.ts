/** Trusted outer proxy only. Untrusted HTML is never inserted into this document. */
const params = new URLSearchParams(location.search),
  parentOrigin = params.get("parentOrigin");
if (window === window.top || !parentOrigin)
  throw Error("Sandbox must be embedded by an allowed parent");
const config = (await fetch("/host-config.json", { credentials: "omit" }).then(
  (r) => r.json(),
)) as { allowedParents: string[] };
if (!config.allowedParents.includes(parentOrigin))
  throw Error("Parent origin is not allowed");
const inner = document.createElement("iframe");
inner.title = "MCP App View";
inner.setAttribute("sandbox", "allow-scripts");
inner.style.cssText = "width:100%;height:100vh;border:0;display:block";
inner.referrerPolicy = "no-referrer";
document.body.style.margin = "0";
document.body.append(inner);
let loaded = false;
window.addEventListener("message", (e: MessageEvent) => {
  const data = e.data;
  if (!data || typeof data !== "object" || data.jsonrpc !== "2.0") return;
  try {
    if (JSON.stringify(data).length > 2_000_000) return;
  } catch {
    return;
  }
  if (e.source === parent && e.origin === parentOrigin) {
    if (data.method === "ui/notifications/sandbox-resource-ready") {
      if (loaded || typeof data.params?.html !== "string") return;
      loaded = true;
      // HTTP header CSP is inherited by srcdoc; the View cannot loosen it.
      const policy = JSON.parse(params.get("csp") ?? "{}") as {
        connectDomains?: string[];
      };
      const connect = (policy.connectDomains ?? []).join(" ") || "'none'";
      const meta = document.createElement("meta");
      meta.httpEquiv = "Content-Security-Policy";
      meta.content = `connect-src ${connect}; frame-src 'none'; base-uri 'none'; form-action 'none'`;
      // Parse in an inert document, preserve standards mode, and put the restriction first.
      const documentSource = new DOMParser().parseFromString(
        data.params.html,
        "text/html",
      );
      documentSource.head.prepend(meta);
      inner.srcdoc =
        "<!doctype html>" + documentSource.documentElement.outerHTML;
    } else if (
      !String(data.method ?? "").startsWith("ui/notifications/sandbox-")
    )
      inner.contentWindow?.postMessage(data, "*");
  } else if (e.source === inner.contentWindow && e.origin === "null") {
    if (!String(data.method ?? "").startsWith("ui/notifications/sandbox-"))
      parent.postMessage(data, parentOrigin);
  }
});
parent.postMessage(
  {
    jsonrpc: "2.0",
    method: "ui/notifications/sandbox-proxy-ready",
    params: {},
  },
  parentOrigin,
);

export {};
