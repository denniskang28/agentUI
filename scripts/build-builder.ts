import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
// The image always embeds the exact checked-in SDK; never an independently edited copy.
await writeFile(
  "services/plugin-builder/container/sdk.tsx",
  await readFile("packages/plugin-sdk/src/index.tsx"),
);
const child = spawn(
  "docker",
  [
    "build",
    "-t",
    "agent-ui-builder:local",
    "services/plugin-builder/container",
  ],
  { stdio: "inherit" },
);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
