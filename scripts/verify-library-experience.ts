import {
  parseLibrarySource,
  scenarioInputs,
} from "../packages/agent-ui/src/playground-input";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium } from "@playwright/test";
import {
  builtins,
  instantiate,
  type ComponentEntry,
} from "../packages/catalog/src/index";
import { defaultRun } from "../packages/protocol/src/index";
import { libraryExport } from "../apps/playground/src/libraryExport";

const root = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), "library-experience-"));
const evidence = path.resolve("artifacts/library-experience/consumer");
await mkdir(evidence, { recursive: true });
const processes: ChildProcess[] = [];
const steps: string[] = [];
async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: scratch, stdio: "pipe" });
    let output = "";
    child.stdout.on("data", (data) => (output += String(data)));
    child.stderr.on("data", (data) => (output += String(data)));
    child.on("error", reject);
    child.on("exit", (code) => {
      void writeFile(
        path.join(evidence, `step-${steps.length}.log`),
        output,
      ).then(() => {
        if (code === 0) {
          steps.push(`${command} ${args.join(" ")}`);
          resolve();
        } else reject(Error(output.slice(-5000)));
      });
    });
  });
}
function start(
  command: string,
  args: string[],
  env: Record<string, string> = {},
) {
  const child = spawn(command, args, {
    cwd: scratch,
    stdio: "pipe",
    detached: true,
    env: { ...process.env, ...env },
  });
  child.stderr?.on("data", (value) => process.stderr.write(value));
  processes.push(child);
}
async function health(url: string) {
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* bounded local startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error(`Service unavailable: ${url}`);
}
let passed = false;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  const source = path.join(root, "examples/chatbot-comparison/with-agent-ui");
  for (const file of ["package.json", "package-lock.json"])
    await cp(path.join(source, file), path.join(scratch, file));
  await cp(path.join(source, "vendor"), path.join(scratch, "vendor"), {
    recursive: true,
  });
  await cp(
    path.join(root, "artifacts/chatbot-release"),
    path.join(scratch, "release"),
    { recursive: true },
  );
  await writeFile(
    path.join(scratch, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2023",
        lib: ["ES2023", "DOM"],
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        esModuleInterop: true,
        noEmit: true,
        types: ["node", "vite/client"],
      },
      include: ["*.ts", "*.tsx"],
    }),
  );
  const release = JSON.parse(
    await readFile(path.join(scratch, "release/manifest.json"), "utf8"),
  ) as { entries: ComponentEntry[] };
  const scenarios = [
    "template",
    "raw",
    "streaming",
    "plugin-native",
    "plugin-sandbox",
  ] as const;
  for (const scenario of scenarios) {
    const plugin = scenario.startsWith("plugin-");
    const entry = plugin
      ? release.entries.find((entry) => entry.key === "expense.approval-form")!
      : builtins.find(
          (entry) =>
            entry.key === (scenario === "template" ? "button" : "text"),
        )!;
    const values = plugin
      ? entry.defaults
      : scenario === "template"
        ? { ...entry.defaults, label: "Library action" }
        : { ...entry.defaults, text: "Original text" };
    const messages = instantiate(entry, values).messages;
    if (scenario === "streaming")
      messages.push({
        version: "1.0",
        updateDataModel: {
          surfaceId: "main",
          path: "/view/text",
          value: "Stream complete",
        },
      });
    const exported = libraryExport({
      messages,
      entry,
      template: scenario !== "raw",
      config: {
        ...defaultRun,
        runtimeMode: scenario === "plugin-native" ? "native" : "sandbox",
        theme: plugin ? "dark" : "light",
        themeTokens: { fontFamily: "mono", brand: "#335577" },
        componentAppearances: {
          main: {
            [scenario === "template" ? "label" : "root"]: plugin
              ? { padding: 16 }
              : {
                  fontSize: 24,
                  color: scenario === "template" ? "#ffffff" : "#225588",
                },
          },
        },
      },
      intervalMs: 10,
      ...(scenario === "streaming"
        ? {
            batches: parseLibrarySource(
              JSON.stringify(scenarioInputs(entry, messages, "progressive")),
            ).map((batch) => ({ ...batch, runId: "custom_stream_run" })),
          }
        : {}),
    });
    await writeFile(
      path.join(scratch, `${scenario}-input.json`),
      exported.input,
    );
    await writeFile(
      path.join(scratch, `${scenario}-server.ts`),
      exported.server
        .replaceAll("./ui-input.json", `./${scenario}-input.json`)
        .replaceAll("./normalized.json", `./${scenario}-normalized.json`),
    );
    await writeFile(
      path.join(scratch, `${scenario}.tsx`),
      exported.react.replaceAll(
        "./normalized.json",
        `./${scenario}-normalized.json`,
      ),
    );
  }
  await run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
  for (const scenario of scenarios)
    await run("node", ["--import", "tsx", `${scenario}-server.ts`]);
  await writeFile(
    path.join(scratch, "backend.ts"),
    `import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {AgentUiAdapter} from "@aap/agent-ui/server";
import {hostManifestSchema,batchSchema,actionEventSchema} from "@aap/agent-ui/protocol";
const manifest=hostManifestSchema.parse(JSON.parse(await readFile("release/manifest.json","utf8")));
const initial=JSON.parse(await readFile("template-input.json","utf8")) as {batches:unknown[]};
const adapter=new AgentUiAdapter("run_001",manifest.entries);
for(const batch of initial.batches) adapter.apply(batchSchema.parse(batch));
let sequence=initial.batches.length+1;
createServer(async(req,res)=>{try {
 if(req.method!=="POST"){res.end("ok");return;}
 let body="";for await(const chunk of req){body+=chunk;if(body.length>65536)throw Error("limit");}
 const event=actionEventSchema.parse(JSON.parse(body));
 if(event.runId!=="run_001"||event.message.action.name!=="report.generate"||event.message.action.surfaceId!=="main")throw Error("ownership");
 const batch=adapter.apply({protocol:"enterprise-agent-ui/1",runId:"run_001",batchId:"action_"+sequence,firstSequence:sequence++,inputs:[{type:"template.patch",id:"main",patch:{label:"Action confirmed"}}]});
 res.setHeader("Content-Type","application/json");res.end(JSON.stringify([batch]));
}catch(error){res.statusCode=400;res.end(String(error));}}).listen(5192,"127.0.0.1");`,
  );
  await writeFile(
    path.join(scratch, "main.tsx"),
    `import {createRoot} from "react-dom/client";
import {normalizedBatchSchema,type ActionEvent} from "@aap/agent-ui/protocol";
import {AgentUiExample as Template} from "./template";
import {AgentUiExample as Raw} from "./raw";
import {AgentUiExample as Streaming} from "./streaming";
import {AgentUiExample as NativePlugin} from "./plugin-native";
import {AgentUiExample as SandboxPlugin} from "./plugin-sandbox";
const onAction=async(event:ActionEvent)=>{const response=await fetch("/api/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(event)});if(!response.ok)throw Error(await response.text());return normalizedBatchSchema.array().parse(await response.json());};
const Example=location.hash==="#plugin-native"?NativePlugin:location.hash==="#plugin-sandbox"?SandboxPlugin:location.hash==="#raw"?Raw:location.hash==="#streaming"?Streaming:Template;
createRoot(document.getElementById("root")!).render(<Example hostUrl="http://127.0.0.1:4193" onAction={onAction}/>);`,
  );
  await writeFile(
    path.join(scratch, "index.html"),
    '<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
  );
  await writeFile(
    path.join(scratch, "vite.config.ts"),
    'import {defineConfig} from "vite";import react from "@vitejs/plugin-react";export default defineConfig({plugins:[react()],server:{host:"localhost",port:5191,strictPort:true,proxy:{"/api":"http://127.0.0.1:5192"}}});',
  );
  await run("node", ["node_modules/typescript/bin/tsc", "--noEmit"]);
  start("node", ["--import", "tsx", "backend.ts"]);
  start("node", ["release/serve-host.mjs"], {
    AGENT_UI_HOST_PORT: "4193",
    AGENT_UI_PARENT_ORIGINS: "http://localhost:5191",
  });
  start("node", ["node_modules/vite/bin/vite.js"]);
  await Promise.all([
    health("http://localhost:5191"),
    health("http://127.0.0.1:4193/health"),
    health("http://127.0.0.1:5192"),
  ]);
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5191");
  await page.locator("iframe").waitFor();
  const actual = page.frameLocator("iframe");
  await actual.getByRole("button", { name: "Library action" }).click();
  await actual.getByRole("button", { name: "Action confirmed" }).waitFor();
  assert.equal(
    await actual
      .locator(".a2-text")
      .evaluate((node) => getComputedStyle(node).fontSize),
    "24px",
  );
  steps.push(
    "generated template + real Action + backend result rendered with appearance",
  );
  await page.screenshot({
    path: path.join(evidence, "template-action.png"),
    fullPage: true,
  });
  for (const scenario of ["raw", "streaming"]) {
    await page.goto(`http://localhost:5191/#${scenario}`);
    await page.reload();
    const text = page
      .frameLocator("iframe")
      .getByText(scenario === "raw" ? "Original text" : "Stream complete");
    await text.waitFor();
    assert.equal(
      await text.evaluate((node) => getComputedStyle(node).fontSize),
      "24px",
    );
    steps.push(`generated ${scenario} input and real embedded Host rendering`);
    await page.screenshot({
      path: path.join(evidence, `${scenario}.png`),
      fullPage: true,
    });
  }
  for (const mode of ["native", "sandbox"]) {
    await page.goto(`http://localhost:5191/#plugin-${mode}`);
    await page.reload();
    const host = page.frameLocator("iframe");
    const plugin =
      mode === "sandbox"
        ? host.frameLocator('iframe[title="Expense Approval Sandbox"]')
        : host;
    const themed = plugin.locator('[data-host-theme="dark"]');
    await themed.waitFor();
    assert.match(
      await themed.evaluate((node) => getComputedStyle(node).fontFamily),
      /monospace/,
    );
    assert.equal(
      await themed.evaluate((node) =>
        getComputedStyle(node).getPropertyValue("--color-accent").trim(),
      ),
      "#335577",
    );
    await plugin
      .getByRole("textbox", { name: "审批意见" })
      .fill("Independent themed plugin");
    assert.equal(
      await plugin.getByRole("textbox", { name: "审批意见" }).inputValue(),
      "Independent themed plugin",
    );
    steps.push(
      `generated ${mode} uploaded plugin receives matching embedded Host theme tokens`,
    );
    await page.screenshot({
      path: path.join(evidence, `plugin-${mode}.png`),
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  passed = true;
} finally {
  await browser?.close();
  for (const child of processes)
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already exited */
      }
    }
  await writeFile(
    path.join(evidence, "report.json"),
    JSON.stringify(
      { passed, scratch, package: "@aap/agent-ui@0.2.0", steps },
      null,
      2,
    ),
  );
}
console.log(`Verified generated Library consumer: ${scratch}`);
