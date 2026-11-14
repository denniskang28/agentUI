import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "apps/playground",
  cacheDir: "../../node_modules/.vite/playground",
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
  build: { outDir: "../../dist/playground", emptyOutDir: true },
});
