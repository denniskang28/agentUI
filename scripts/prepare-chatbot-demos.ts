import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "examples/chatbot-comparison/with-agent-ui";
// Local development reuses the package version. Refresh the lock's content
// integrity so npm ci consumes the current tarball rather than cached old code.
const lock = JSON.parse(
  await readFile(`${root}/package-lock.json`, "utf8"),
) as { packages: Record<string, { integrity?: string; version?: string }> };
await mkdir(`${root}/vendor`, { recursive: true });
for (const [name, version] of [
  ["@aap/agent-ui", "0.2.0"],
  ["@enterprise/mcp-apps-host", "0.1.0"],
] as const) {
  const key = `node_modules/${name}`;
  if (!lock.packages[key])
    throw Error(
      `Missing consumer lock entry ${key}; install the new public dependency first`,
    );
  const tarball = `${name.slice(1).replace("/", "-")}-${version}.tgz`;
  const vendorPath = `${root}/vendor/${tarball}`;
  await cp(`artifacts/packages/${tarball}`, vendorPath);
  lock.packages[key].version = version;
  lock.packages[key].integrity = `sha512-${createHash("sha512")
    .update(await readFile(vendorPath))
    .digest("base64")}`;
}
await rm(`${root}/release`, { recursive: true, force: true });
await cp("artifacts/chatbot-release", `${root}/release`, { recursive: true });
await writeFile(
  `${root}/package-lock.json`,
  JSON.stringify(lock, null, 2) + "\n",
);
console.log(
  "Prepared standalone framework demo inputs. Install each demo with npm ci.",
);
