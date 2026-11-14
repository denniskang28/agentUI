import { spawnSync } from "node:child_process";

// Trusted repository setup only. Uploaded plugins still use the isolated Builder.
function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (Number(process.versions.node.split(".")[0]) < 24)
  throw Error("Node.js 24+ is required. / 需要 Node.js 24 或更新版本。");
run("pnpm", ["--version"]);
run("python3", ["--version"]);
run("docker", ["info", "--format", "{{.ServerVersion}}"]);
run("pnpm", ["builder:image"]);
run("pnpm", ["chatbot:prepare"]);
for (const variant of ["baseline", "with-agent-ui"]) {
  const root = `examples/chatbot-comparison/${variant}`;
  run("npm", [
    "ci",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--prefix",
    root,
  ]);
  run("npm", ["run", "build", "--prefix", root]);
}
console.log(
  "Ready: Risk Heatmap + Expense Approval installed. Run pnpm dev:all. / 准备完成，两个示例插件已安装，执行 pnpm dev:all 启动。",
);
