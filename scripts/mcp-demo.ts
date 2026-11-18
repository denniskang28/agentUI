import { startFaultServer } from "../packages/mcp-apps-host/src/fault-server";
import { startOfficialServer } from "../packages/mcp-apps-host/src/official-server";
import { startDemoServer } from "../packages/mcp-apps-host/src/demo-server";
const server = await startDemoServer(Number(process.env.MCP_DEMO_PORT ?? 3002));
const official = await startOfficialServer();
const faults = await startFaultServer();
console.log("MCP demo: http://127.0.0.1:3002/mcp");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    faults.close();
    official.close();
    server.close(() => process.exit(0));
  });
