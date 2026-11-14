import { createServer } from "node:http";
import { access, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { serveEmbeddedHost } from "../../scripts/serve-embedded-host";

const root = "artifacts/capability/consumer";
await access("artifacts/chatbot-release/manifest.json").catch(() => {
  throw Error("Run pnpm setup:demo before pnpm capability:consumer.");
});
// Recreate generated consumer inputs from the actual tarball, never repo imports.
const lock = JSON.parse(await readFile(`${root}/package-lock.json`, "utf8"));
lock.packages["node_modules/@enterprise/agent-ui"].integrity =
  `sha512-${createHash("sha512")
    .update(await readFile("artifacts/packages/enterprise-agent-ui-0.1.0.tgz"))
    .digest("base64")}`;
await writeFile(
  `${root}/package-lock.json`,
  JSON.stringify(lock, null, 2) + "\n",
);
for (const [command, args] of [
  ["npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]],
  [process.execPath, ["check.mjs"]],
] as const) {
  const result = spawnSync(command, [...args], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
await build({
  entryPoints: [`${root}/main.jsx`],
  outfile: `${root}/app.js`,
  bundle: true,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
});
const parent = createServer(async (request, response) => {
  const file = request.url === "/app.js" ? "app.js" : "index.html";
  response.setHeader(
    "Content-Type",
    file.endsWith("js") ? "text/javascript" : "text/html; charset=utf-8",
  );
  response.end(await readFile(`${root}/${file}`));
});
await new Promise<void>((resolve) => parent.listen(5285, "localhost", resolve));
const host = serveEmbeddedHost({
  root: "artifacts/chatbot-release",
  port: 4285,
  allowedParents: ["http://localhost:5285"],
});
const browser = await chromium.launch();
const errors: string[] = [];
try {
  const page = await browser.newPage({
    viewport: { width: 900, height: 1000 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5285");
  const frame = page.frameLocator("iframe");
  await expect(frame.getByText("陈晓宁", { exact: true })).toBeVisible();
  await expect(frame.locator(".cp-breakdown")).toHaveCount(0);
  await expect(frame.locator(".cp-score-polygon")).toHaveCSS(
    "stroke",
    "rgb(65, 105, 173)",
  );
  await frame.getByLabel("查看维度").selectOption("compliance");
  await expect(page.locator("#action")).toContainText(
    "capability.dimensionSelect",
  );
  await expect(page.locator("#action")).toContainText(
    '"dimensionId":"compliance"',
  );
  await frame.getByLabel("评估场景").selectOption("service");
  await expect(page.locator("#action")).toContainText(
    "capability.scenarioChange",
  );
  await page.getByRole("button", { name: "Update planning score" }).click();
  await expect(frame.getByLabel("评估场景")).toHaveValue("service");
  await frame.getByLabel("查看维度").selectOption("planning");
  await expect(frame.locator(".cp-detail")).toContainText("高于场景目标 5 分");
  await expect(page.locator("#error")).toHaveText("");
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "artifacts/capability/consumer/installed-host.png",
    fullPage: true,
  });
  await writeFile(
    "artifacts/capability/consumer/report.json",
    JSON.stringify(
      {
        passed: true,
        installedPackage: "@enterprise/agent-ui@0.1.0",
        sourceImports: false,
        staticHost: "dist/embedded-host",
        realActions: [
          "capability.dimensionSelect",
          "capability.scenarioChange",
        ],
        streamedScoreUpdate: 80,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Installed tarball + compiled static Host: rendered, styled, dispatched real Actions and applied score update.",
  );
} finally {
  await browser.close();
  await Promise.all([
    new Promise<void>((resolve) => host.close(() => resolve())),
    new Promise<void>((resolve) => parent.close(() => resolve())),
  ]);
}
