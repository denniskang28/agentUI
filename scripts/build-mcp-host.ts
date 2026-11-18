import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "packages/mcp-apps-host/dist";
await mkdir(dir, { recursive: true });
for (const name of ["demo-view", "sandbox"]) {
  const result = await build({
    entryPoints: [`packages/mcp-apps-host/src/${name}.ts`],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2023",
    minify: true,
  });
  const js = result.outputFiles[0].text;
  if (name === "demo-view")
    await writeFile(
      `${dir}/demo.html`,
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;margin:20px;color-scheme:light dark}button{font:inherit;margin:4px;padding:8px 14px}pre{white-space:pre-wrap}</style></head><body><div id="app">Loading…</div><script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
    );
  else {
    await writeFile(`${dir}/mcp-sandbox.js`, js);
    await writeFile(
      `${dir}/mcp-sandbox.html`,
      '<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="/mcp-sandbox.js"></script></body></html>',
    );
  }
}
// Official quickstart sources are vendored unmodified with commit/blob provenance.
import path from "node:path";
import { readFile } from "node:fs/promises";
const sdkModules = path.resolve("packages/mcp-apps-host/node_modules");
const view = await build({
  entryPoints: ["examples/mcp/official-quickstart/src/mcp-app.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2023",
  minify: true,
  nodePaths: [sdkModules],
});
const officialHtml = (
  await readFile("examples/mcp/official-quickstart/mcp-app.html", "utf8")
).replace(
  '<script type="module" src="/src/mcp-app.ts"></script>',
  () =>
    `<script type="module">${view.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`,
);
await writeFile(`${dir}/mcp-app.html`, officialHtml);
await build({
  entryPoints: ["examples/mcp/official-quickstart/server.ts"],
  outfile: `${dir}/official-server.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2023",
  nodePaths: [sdkModules],
  alias: { zod: path.join(sdkModules, "zod") },
  banner: {
    js: "import {createRequire as officialCreateRequire} from 'node:module';const require=officialCreateRequire(import.meta.url);",
  },
});
// The upstream server resolves its HTML below a dist subdirectory.
await mkdir(`${dir}/dist`, { recursive: true });
await writeFile(`${dir}/dist/mcp-app.html`, officialHtml);

// Public ESM entries keep dependencies external; declarations resolve entirely inside the package.
for (const [name, platform] of [
  ["react", "browser"],
  ["protocol", "neutral"],
  ["server", "node"],
] as const) {
  await build({
    entryPoints: [
      `packages/mcp-apps-host/src/${name}.${name === "react" ? "tsx" : "ts"}`,
    ],
    outfile: `${dir}/${name}.js`,
    bundle: true,
    packages: "external",
    format: "esm",
    platform,
    target: "es2023",
    jsx: "automatic",
    sourcemap: true,
  });
}
const { spawnSync } = await import("node:child_process");
for (const [args, cwd] of [
  [["exec", "tsc", "-p", "packages/mcp-apps-host/tsconfig.build.json"], "."],
  [
    ["pack", "--pack-destination", "../../artifacts/packages"],
    "packages/mcp-apps-host",
  ],
] as const) {
  const result = spawnSync("pnpm", [...args], { cwd, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
