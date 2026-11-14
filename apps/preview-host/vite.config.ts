import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "apps/preview-host",
  cacheDir: "../../node_modules/.vite/preview-host",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    cors: true,
    headers: {
      "Content-Security-Policy":
        "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:4173; img-src data:; font-src 'none'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors http://localhost:5173 http://127.0.0.1:4173",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
    proxy: { "/artifacts": "http://127.0.0.1:3001" },
  },
  build: { outDir: "../../dist/preview-host", emptyOutDir: true },
});
