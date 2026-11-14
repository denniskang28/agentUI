import { build } from "esbuild";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const output = path.resolve("packages/agent-ui/dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const [name, platform] of [
  ["protocol", "neutral"],
  ["server", "node"],
  ["react", "browser"],
] as const) {
  await build({
    entryPoints: [
      `packages/agent-ui/src/${name}.${name === "react" ? "tsx" : "ts"}`,
    ],
    outfile: `${output}/${name}.js`,
    bundle: true,
    packages: "external",
    format: "esm",
    platform,
    target: "es2023",
    jsx: "automatic",
    sourcemap: true,
  });
}
const config = {
  extends: "../../tsconfig.json",
  compilerOptions: {
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    declarationMap: false,
    rootDir: "../..",
    outDir: "./dist/types",
    paths: {},
  },
  include: ["src/protocol.ts", "src/server.ts", "src/react.tsx"],
  exclude: [],
};
await writeFile(
  "packages/agent-ui/tsconfig.build.json",
  JSON.stringify(config, null, 2) + "\n",
);
const result = spawnSync(
  "pnpm",
  ["exec", "tsc", "-p", "packages/agent-ui/tsconfig.build.json"],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir("artifacts/packages", { recursive: true });
const packed = spawnSync(
  "pnpm",
  ["pack", "--pack-destination", "../../artifacts/packages"],
  { cwd: "packages/agent-ui", stdio: "inherit" },
);
if (packed.status !== 0) process.exit(packed.status ?? 1);
