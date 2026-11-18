import { sandboxHeaders } from "../packages/mcp-apps-host/src/sandbox-policy";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Static-only deployment: no Playground, session API, builder, cookies or auth. */
export function serveEmbeddedHost(options: {
  root: string;
  port: number;
  allowedParents: string[];
  allowedExternalOrigins?: string[];
}) {
  const parents = options.allowedParents.map((value) => {
    const url = new URL(value);
    if (url.origin !== value || !["http:", "https:"].includes(url.protocol))
      throw Error("Expected exact HTTP(S) parent origins");
    return url.origin;
  });
  const csp = `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src data:; font-src 'none'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${parents.join(" ")}`;
  const server = createServer(async (request, response) => {
    response.setHeader("Content-Security-Policy", csp);
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    // Public, credential-free compiled artifacts are readable by opaque frames.
    // No business or session API is exposed here.
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Cache-Control", "no-store");
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405).end();
        return;
      }
      const url = new URL(request.url ?? "/", "http://host.invalid");
      const pathname = url.pathname;
      if (pathname === "/mcp-sandbox.html") {
        try {
          for (const [key, value] of Object.entries(
            sandboxHeaders(
              url,
              parents,
              options.allowedExternalOrigins ??
                (process.env.MCP_RESOURCE_ORIGINS ?? "")
                  .split(",")
                  .filter(Boolean),
            ),
          ))
            response.setHeader(key, value);
        } catch {
          response.writeHead(403).end("Sandbox policy rejected");
          return;
        }
      }
      if (pathname === "/health") {
        response.setHeader("Content-Type", "application/json");
        response.end('{"status":"ok"}');
        return;
      }
      if (pathname === "/host-config.json") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ allowedParents: parents }));
        return;
      }
      if (pathname.startsWith("/api/")) {
        response.writeHead(404).end();
        return;
      }
      const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
      const root = path.resolve(options.root);
      const filename = path.resolve(
        root,
        pathname.startsWith("/artifacts/") || pathname === "/manifest.json"
          ? relative
          : `host/${relative || "index.html"}`,
      );
      if (
        !filename.startsWith(root + path.sep) ||
        !(await stat(filename)).isFile()
      ) {
        response.writeHead(404).end();
        return;
      }
      const contentTypes: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
      };
      response.setHeader(
        "Content-Type",
        contentTypes[path.extname(filename)] ?? "application/octet-stream",
      );
      if (request.method === "HEAD") response.end();
      else response.end(await readFile(filename));
    } catch {
      response.writeHead(404).end();
    }
  });
  server.listen(options.port, "127.0.0.1");
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = serveEmbeddedHost({
    root:
      process.env.AGENT_UI_RELEASE_DIR ??
      (fileURLToPath(import.meta.url).endsWith("serve-host.mjs")
        ? fileURLToPath(new URL(".", import.meta.url))
        : "artifacts/chatbot-release"),
    port: Number(process.env.AGENT_UI_HOST_PORT ?? 4183),
    allowedParents: (
      process.env.AGENT_UI_PARENT_ORIGINS ??
      "http://localhost:5180,http://localhost:5181"
    ).split(","),
  });
  process.on("SIGINT", () => server.close());
  process.on("SIGTERM", () => server.close());
}
