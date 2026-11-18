import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = ".runtime/java-deps";
await mkdir(root, { recursive: true });
await mkdir(".runtime/java-classes", { recursive: true });
const jar = `${root}/gson-2.13.2.jar`;
let bytes: Buffer;
try {
  bytes = await readFile(jar);
} catch {
  const response = await fetch(
    "https://repo.maven.apache.org/maven2/com/google/code/gson/gson/2.13.2/gson-2.13.2.jar",
  );
  if (!response.ok) throw Error(`Gson download ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (
  createHash("sha256").update(bytes).digest("hex") !==
  "dd0ce1b55a3ed2080cb70f9c655850cda86c206862310009dcb5e5c95265a5e0"
)
  throw Error("Gson integrity mismatch");
await writeFile(jar, bytes);
const binary = (name: string) =>
  process.env.MCP_JAVA_HOME
    ? path.join(process.env.MCP_JAVA_HOME, "bin", name)
    : name;
for (const [command, args] of [
  [
    "javac",
    [
      "-cp",
      jar,
      "-d",
      ".runtime/java-classes",
      "examples/mcp/java/McpHostExample.java",
    ],
  ],
  [
    "java",
    [
      "-cp",
      `${jar}${path.delimiter}.runtime/java-classes`,
      "McpHostExample",
      ...process.argv.slice(2),
    ],
  ],
] as const) {
  const result = spawnSync(binary(command), [...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
