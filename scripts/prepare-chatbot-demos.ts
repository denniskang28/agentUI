import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "examples/chatbot-comparison/with-agent-ui";
await mkdir(`${root}/vendor`, { recursive: true });
await cp(
  "artifacts/packages/enterprise-agent-ui-0.2.0.tgz",
  `${root}/vendor/enterprise-agent-ui-0.2.0.tgz`,
);
await cp(
  "artifacts/packages/enterprise-mcp-apps-host-0.1.0.tgz",
  `${root}/vendor/enterprise-mcp-apps-host-0.1.0.tgz`,
);
await rm(`${root}/release`, { recursive: true, force: true });
await cp("artifacts/chatbot-release", `${root}/release`, { recursive: true });
// Local development reuses the package version. Refresh the lock's content
// integrity so npm ci consumes the current tarball rather than cached old code.
const lock = JSON.parse(
  await readFile(`${root}/package-lock.json`, "utf8"),
) as { packages: Record<string, { integrity?: string; version?: string }> };
for (const [name, version] of [
  ["agent-ui", "0.2.0"],
  ["mcp-apps-host", "0.1.0"],
]) {
  const key = `node_modules/@enterprise/${name}`;
  if (!lock.packages[key])
    throw Error(
      `Missing consumer lock entry ${key}; install the new public dependency first`,
    );
  lock.packages[key].version = version;
  lock.packages[key].integrity = `sha512-${createHash("sha512")
    .update(await readFile(`${root}/vendor/enterprise-${name}-${version}.tgz`))
    .digest("base64")}`;
}
await writeFile(
  `${root}/package-lock.json`,
  JSON.stringify(lock, null, 2) + "\n",
);
console.log(
  "Prepared standalone framework demo inputs. Install each demo with npm ci.",
);
