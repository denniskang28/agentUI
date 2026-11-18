import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "examples/chatbot-comparison";
const skip = new Set(["node_modules", "dist", "vendor", "release"]);
async function list(dir: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    if (skip.has(entry.name) || entry.name.startsWith(".")) continue;
    const relative = prefix + entry.name;
    if (entry.isDirectory())
      result.push(...(await list(`${dir}/${entry.name}`, relative + "/")));
    else if (entry.isFile()) result.push(relative);
  }
  return result.sort();
}
const a = await list(`${root}/baseline`),
  b = await list(`${root}/with-agent-ui`);
const permitted = new Map([
  [
    "package.json",
    "Framework package and Host launch command / 框架依赖与 Host 命令",
  ],
  ["package-lock.json", "Resolved standalone dependencies / 独立依赖锁"],
  [
    "server/ui/adapter.ts",
    "Business DTO versus template/raw A2UI output and Action adapter / UI 输出和 Action 适配",
  ],
  [
    "web/UiPanel.tsx",
    "Handwritten cards versus packaged isolated Host client / 手写组件与框架接入",
  ],
  ["README.md", "Variant-specific run instructions / 各版本启动说明"],
  ["DEPLOYMENT.md", "Standalone framework deployment / 独立框架部署"],
]);
for(const file of ['server/index.ts','shared/domain.ts','web/App.tsx'])permitted.set(file,'MCP Apps conversation channel and trusted orchestration; existing A2UI business agents unchanged / MCP Apps 会话通道');
const identical: string[] = [],
  changed: { file: string; reason: string }[] = [],
  unexpected: string[] = [];
for (const file of [...new Set([...a, ...b])].sort()) {
  const common = a.includes(file) && b.includes(file);
  if (common) {
    const hashes = await Promise.all(
      ["baseline", "with-agent-ui"].map(async (variant) =>
        createHash("sha256")
          .update(await readFile(`${root}/${variant}/${file}`))
          .digest("hex"),
      ),
    );
    if (hashes[0] === hashes[1]) {
      identical.push(file);
      continue;
    }
  }
  const reason =
    permitted.get(file) ??
    (file.startsWith("deploy/")
      ? "Host deployment configuration / Host 部署配置"
      : undefined);
  if (reason) changed.push({ file, reason });
  else unexpected.push(file);
}
const report = {
  generatedAt: new Date().toISOString(),
  identical,
  changed,
  unexpected,
  passed: unexpected.length === 0,
};
await writeFile(
  `${root}/integration-diff.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    identical: identical.length,
    changed: changed.length,
    unexpected,
  }),
);
if (unexpected.length) process.exitCode = 1;
