/* global process */
import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
const demoRoot = fileURLToPath(new URL("..", import.meta.url));
const children = [
  spawn(process.execPath, ["release/serve-host.mjs"], {
    cwd: demoRoot,
    stdio: "inherit",
    detached: true,
    env: process.env,
  }),
  spawn("npm", ["start"], {
    cwd: demoRoot,
    stdio: "inherit",
    detached: true,
    env: { ...process.env, NODE_ENV: "production" },
  }),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Already exited. */
      }
    }
  }
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
for (const child of children)
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
