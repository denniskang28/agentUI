import { spawn } from "node:child_process";
const jobs = [
  ["tsx", ["watch", "services/api/src/server.ts"]],
  ["vite", ["--config", "apps/preview-host/vite.config.ts"]],
  ["vite", ["--config", "apps/playground/vite.config.ts"]],
];
const children = jobs.map(([cmd, args]) =>
  spawn(String(cmd), args as string[], { stdio: "inherit", env: process.env }),
);
function stop() {
  children.forEach((child) => child.kill("SIGTERM"));
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((child) =>
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stop();
      process.exitCode = code;
    }
  }),
);
