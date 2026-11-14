import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

for (const file of [
  "examples/chatbot-comparison/baseline/dist/web/index.html",
  "examples/chatbot-comparison/with-agent-ui/dist/web/index.html",
  "examples/chatbot-comparison/with-agent-ui/release/manifest.json",
  "examples/chatbot-comparison/with-agent-ui/vendor/enterprise-agent-ui-0.1.0.tgz",
])
  if (!existsSync(file))
    throw Error("Run pnpm setup:demo first. / 请先执行 pnpm setup:demo。");

const children: ChildProcess[] = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children)
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Already exited. */
      }
    }
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, stop);
for (const command of ["dev", "chatbot:demo"]) {
  const child = spawn("pnpm", [command], {
    stdio: "inherit",
    env: process.env,
    detached: true,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error);
    process.exitCode = 1;
    stop();
  });
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
}
console.log(
  "Playground http://localhost:5173 | Baseline http://localhost:5180 | Agent UI http://localhost:5181 | Ctrl+C stops all",
);
