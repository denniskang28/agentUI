import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PluginRegistry } from "../services/api/src/plugins";
import { builtins, createHostManifest } from "../packages/agent-ui/src/server";
import { build } from "esbuild";

// Reuse the actual constrained builder; no fallback when Docker is unavailable.
const registry = new PluginRegistry();
const output = path.resolve("artifacts/chatbot-release");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const filename of ["expense-approval.zip", "finance-risk-heatmap.zip"]) {
  const record = await registry.install(
    filename,
    await readFile(`examples/dist/${filename}`),
  );
  await mkdir(`${output}/artifacts/${record.buildId}`, { recursive: true });
  await cp(
    `.runtime/plugins/${record.buildId}/output`,
    `${output}/artifacts/${record.buildId}`,
    { recursive: true },
  );
}
const entries = registry.entries().map((entry) => ({
  ...entry,
  bundleUrl: new URL(entry.bundleUrl!).pathname,
  ...(entry.stylesheetUrl
    ? { stylesheetUrl: new URL(entry.stylesheetUrl).pathname }
    : {}),
}));
await writeFile(
  `${output}/manifest.json`,
  JSON.stringify(createHostManifest([...builtins, ...entries]), null, 2) + "\n",
);
await cp("dist/embedded-host", `${output}/host`, { recursive: true });
for (const file of ["mcp-sandbox.html", "mcp-sandbox.js"])
  await cp(`packages/mcp-apps-host/dist/${file}`, `${output}/host/${file}`);
await cp("apps/preview-host/public/runtime.css", `${output}/host/runtime.css`);
await build({
  entryPoints: ["scripts/serve-embedded-host.ts"],
  outfile: `${output}/serve-host.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
});
console.log(
  `Exported Host and ${entries.length} genuine plugin artifacts to ${output}`,
);
