import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "apps/embedded-host",
  cacheDir: "../../node_modules/.vite/embedded-host",
  plugins: [react()],
  build: { outDir: "../../dist/embedded-host", emptyOutDir: true },
});
