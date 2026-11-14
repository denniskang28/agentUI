import { readFile, writeFile } from "node:fs/promises";
const files = [
  "apps/playground/src/tokens.css",
  "apps/playground/src/shared.css",
  "apps/preview-host/src/host.css",
];
await writeFile(
  "apps/preview-host/public/runtime.css",
  (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n"),
);
