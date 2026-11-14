import { cp, mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { get } from "node:http";
import { chromium } from "@playwright/test";

const source = path.resolve("examples/chatbot-comparison");
const scratch = await realpath(
  await mkdtemp(path.join(tmpdir(), "agent-ui-consumers-")),
);
const evidence = path.resolve("artifacts/chatbot-consumer");
await mkdir(evidence, { recursive: true });
await writeFile(
  path.join(evidence, "report.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scratch,
      passed: false,
      status: "running",
      steps: [],
    },
    null,
    2,
  ) + "\n",
);
const steps: { name: string; passed: boolean; log: string }[] = [];
const children: ChildProcess[] = [];
function run(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: "pipe",
    });
    let output = "";
    child.stdout.on("data", (value) => {
      output += String(value);
    });
    child.stderr.on("data", (value) => {
      output += String(value);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      const label = args.join("-").replace(/[^\w-]/g, "_");
      const name = `${path.basename(cwd)}-${label.slice(0, 100)}-${createHash("sha256").update(label).digest("hex").slice(0, 8)}`;
      const log = path.join(evidence, `${name}.log`);
      void writeFile(log, output).then(() => {
        steps.push({ name, passed: code === 0, log });
        if (code === 0) {
          console.log(`PASS ${name}`);
          resolve();
        } else
          reject(Error(`${name} failed (${code}):\n${output.slice(-5000)}`));
      });
    });
  });
}
function start(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "pipe",
    detached: true,
  });
  children.push(child);
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", (value) => process.stderr.write(value));
}
function probe(url: string): Promise<number | null> {
  // Node's HTTP client avoids a macOS/undici setTypeOfService crash observed
  // while polling just-terminated local servers on this Node 24 runtime.
  return new Promise((resolve) => {
    const request = get(url, { agent: false }, (response) => {
      response.resume();
      resolve(response.statusCode ?? null);
    });
    request.setTimeout(1000, () => request.destroy());
    request.on("error", () => resolve(null));
  });
}
async function health(url: string) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const status = await probe(url);
    if (status !== null && status >= 200 && status < 300) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(`Health timeout ${url}`);
}
let passed = false;
let error: string | undefined;
try {
  for (const variant of ["baseline", "with-agent-ui"]) {
    const destination = path.join(scratch, variant);
    await cp(path.join(source, variant), destination, {
      recursive: true,
      filter: (file) =>
        !["node_modules", "dist", ".git"].some((name) =>
          file.split(path.sep).includes(name),
        ),
    });
    await run(
      "npm",
      ["ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"],
      destination,
    );
    await run("npm", ["run", "build"], destination, {
      VITE_AGENT_UI_HOST_URL: "http://127.0.0.1:4283",
    });
  }
  const integrated = path.join(scratch, "with-agent-ui");
  const packageRoot = await realpath(
    path.join(integrated, "node_modules/@enterprise/agent-ui"),
  );
  if (!packageRoot.startsWith(scratch + path.sep))
    throw Error("Consumer library resolved outside the isolated installation");
  await run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import {AgentUiAdapter} from '@enterprise/agent-ui/server'; const a=new AgentUiAdapter('consumer_run'); console.log(a.snapshot()); a.dispose();",
    ],
    integrated,
  );
  start("npm", ["run", "deploy"], integrated, {
    NODE_ENV: "production",
    DEMO_PORT: "5281",
    AGENT_UI_HOST_PORT: "4283",
    AGENT_UI_PARENT_ORIGINS: "http://localhost:5280,http://localhost:5281",
  });
  start("npm", ["start"], path.join(scratch, "baseline"), {
    NODE_ENV: "production",
    DEMO_PORT: "5280",
  });
  await Promise.all([
    health("http://127.0.0.1:4283/health"),
    health("http://localhost:5280/api/health"),
    health("http://localhost:5281/api/health"),
  ]);
  const browser = await chromium.launch({ channel: "chromium" });
  try {
    for (const [variant, port] of [
      ["baseline", "5280"],
      ["with-agent-ui", "5281"],
    ] as const) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        locale: "zh-CN",
      });
      await page.goto(`http://localhost:${port}`);
      await page.getByRole("button", { name: /查看报销单/ }).click();
      const ui =
        variant === "baseline"
          ? page
          : page
              .frameLocator('iframe[title="Agent UI"]')
              .frameLocator('iframe[title="Expense Approval Sandbox"]');
      await ui
        .getByRole("textbox", { name: "审批意见" })
        .fill("独立消费者实际审批");
      await ui.getByRole("button", { name: "批准", exact: true }).click();
      await ui.getByText("已批准", { exact: true }).first().waitFor();
      await page.reload();
      await ui.getByText("已批准", { exact: true }).first().waitFor();
      await page.screenshot({
        path: path.join(evidence, `${variant}.png`),
        fullPage: true,
      });
      steps.push({
        name: `${variant}-real-browser-approval-and-recovery`,
        passed: true,
        log: path.join(evidence, `${variant}.png`),
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  passed = true;
} catch (failure) {
  error = String(failure);
  process.exitCode = 1;
  console.error(error);
} finally {
  for (const child of children)
    if (child.pid)
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Already exited. */
      }
  if (children.length) {
    const ports = [4283, 5280, 5281];
    const deadline = Date.now() + 5000;
    let live = true;
    while (live && Date.now() < deadline) {
      live = (
        await Promise.all(
          ports.map(
            async (port) =>
              (await probe(`http://127.0.0.1:${port}/health`)) !== null,
          ),
        )
      ).some(Boolean);
      if (live) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (live) {
      passed = false;
      error = "Deployment child ports remain open after termination";
      process.exitCode = 1;
    }
    steps.push({
      name: "standalone-deploy-process-cleanup",
      passed: !live,
      log: path.join(evidence, "run.log"),
    });
  }
  await writeFile(
    path.join(evidence, "report.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), scratch, passed, steps, error },
      null,
      2,
    ) + "\n",
  );
  console.log(`Consumer evidence: ${evidence}; passed=${passed}`);
}
