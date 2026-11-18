import { sandboxHeaders } from "../../packages/mcp-apps-host/src/sandbox-policy";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "apps/preview-host",
  cacheDir: "../../node_modules/.vite/preview-host",
  plugins: [
    react(),
    {
      name: "mcp-sandbox-policy",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url ?? "/", "http://127.0.0.1:4173");
          const parents = (
            process.env.MCP_PARENT_ORIGINS ??
            "http://localhost:5173,http://localhost:5181"
          ).split(",");
          if (url.pathname === "/host-config.json") {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ allowedParents: parents }));
            return;
          }
          if (url.pathname === "/mcp-sandbox.html")
            try {
              const headers = sandboxHeaders(
                url,
                parents,
                (process.env.MCP_RESOURCE_ORIGINS ?? "")
                  .split(",")
                  .filter(Boolean),
              );
              for (const [key, value] of Object.entries(headers))
                res.setHeader(key, value);
            } catch {
              res.statusCode = 403;
              res.end("Sandbox policy rejected");
              return;
            }
          else
            res.setHeader(
              "Content-Security-Policy",
              "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:4173; img-src data:; font-src 'none'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors http://localhost:5173 http://127.0.0.1:4173",
            );
          next();
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    cors: true,
    headers: {
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
    proxy: { "/artifacts": "http://127.0.0.1:3001" },
  },
  build: {
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        mcp: new URL("./mcp-sandbox.html", import.meta.url).pathname,
      },
    },
    outDir: "../../dist/preview-host",
    emptyOutDir: true,
  },
});
