import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const demoRoot = path.resolve("examples/chatbot-comparison");
for (const variant of ["baseline", "with-agent-ui"])
  if (!existsSync(path.join(demoRoot, variant, "dist/web/index.html")))
    throw Error(
      `Build ${variant} first; see examples/chatbot-comparison/README.md`,
    );
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
for (const [variant, command] of [
  ["baseline", "start"],
  ["with-agent-ui", "deploy"],
]) {
  const child = spawn("npm", ["run", command], {
    cwd: path.join(demoRoot, variant),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
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
  "Baseline http://localhost:5180 | Agent UI http://localhost:5181 | Host http://127.0.0.1:4183 (Ctrl+C stops all)",
);
