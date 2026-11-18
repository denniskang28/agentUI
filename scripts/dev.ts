import { spawn } from "node:child_process";
import { createServer } from "node:net";

// Check the complete group before spawning: a duplicate launch must not leave
// partially started API, Vite or demo processes behind.
const endpoints: Array<{ name: string; host: string; port: number }> = [
  { name: "API", host: "127.0.0.1", port: 3001 },
  { name: "Preview", host: "127.0.0.1", port: 4173 },
  { name: "Playground", host: "localhost", port: 5173 },
  ...(process.env.MCP_DEMO === "1"
    ? [
        {
          name: "MCP expense",
          host: "127.0.0.1",
          port: Number(process.env.MCP_DEMO_PORT ?? 3002),
        },
        { name: "MCP official", host: "127.0.0.1", port: 3003 },
        { name: "MCP fixtures", host: "127.0.0.1", port: 3004 },
      ]
    : []),
];
const occupied = (
  await Promise.all(
    endpoints.map(async (endpoint) => {
      const available = await new Promise<boolean>((resolve, reject) => {
        const probe = createServer();
        probe.once("error", (error: NodeJS.ErrnoException) => {
          if (error.code === "EADDRINUSE") resolve(false);
          else reject(error);
        });
        probe.listen(
          { host: endpoint.host, port: endpoint.port, exclusive: true },
          () => {
            probe.close((error) => (error ? reject(error) : resolve(true)));
          },
        );
      });
      return available ? [] : [endpoint];
    }),
  )
).flat();
if (occupied.length) {
  console.error(
    "开发服务未启动 / Development services were not started: ports already in use.",
  );
  for (const endpoint of occupied)
    console.error(`  ${endpoint.name}: ${endpoint.host}:${endpoint.port}`);
  console.error(
    "已有服务可能仍在运行，可直接打开 http://localhost:5173；如需重启，请先在原启动终端按 Ctrl+C。\nAn existing stack may be running. Open http://localhost:5173, or stop the original command with Ctrl+C before restarting. No existing process was stopped.",
  );
  process.exit(1);
}
const jobs = [
  ...(process.env.MCP_DEMO === "1" ? [["tsx", ["scripts/mcp-demo.ts"]]] : []),
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
