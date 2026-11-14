import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = process.cwd();
const consumer = path.join(root, "examples/chatbot-comparison/with-agent-ui");
const slugs = [
  "library-overview",
  "library-integration",
  "library-inputs",
  "library-events",
  "library-demo-migration",
  "library-deployment",
];
const locales = ["zh-CN", "en-US"];
const temporary = await mkdtemp(path.join(os.tmpdir(), "agent-ui-docs-"));
let links = 0;
const json: { file: string; value: unknown }[] = [];
const modules: string[] = [];
const servers: string[] = [];
try {
  await access(path.join(consumer, "release/manifest.json"));
  await access(
    path.join(consumer, "node_modules/@enterprise/agent-ui/package.json"),
  );
  await symlink(
    path.join(consumer, "node_modules"),
    path.join(temporary, "node_modules"),
    "dir",
  );
  await writeFile(path.join(temporary, "package.json"), '{"type":"module"}');
  for (const locale of locales) {
    for (const slug of slugs) {
      const file = `docs/developer/${slug}.${locale}.md`;
      const source = await readFile(path.join(root, file), "utf8");
      for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        if (/^https?:/.test(match[1])) continue;
        await access(path.resolve(root, "docs/developer", match[1]));
        links++;
      }
      let index = 0;
      for (const block of source.matchAll(
        /```(ts|tsx|json)\n([\s\S]*?)\n```/g,
      )) {
        if (block[1] === "json") {
          json.push({ file, value: JSON.parse(block[2]) });
        } else {
          const filename = path.join(
            temporary,
            `${slug}.${locale}.${++index}.${block[1]}`,
          );
          await writeFile(filename, `${block[2]}\nexport {};\n`);
          modules.push(filename);
          if (block[2].includes("console.log(JSON.stringify(firstBatch))"))
            servers.push(filename);
        }
      }
    }
  }
  await run(
    process.execPath,
    [
      path.join(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--target",
      "ES2023",
      "--module",
      "ESNext",
      "--moduleResolution",
      "Bundler",
      "--jsx",
      "react-jsx",
      "--skipLibCheck",
      "--lib",
      "ES2023,DOM",
      "--types",
      "node,react",
      ...modules,
    ],
    { cwd: temporary },
  );
  for (const filename of servers) {
    const result = await run(process.execPath, [filename], { cwd: consumer });
    assert.equal(JSON.parse(result.stdout).runId, "run_001");
  }
  await writeFile(path.join(temporary, "samples.json"), JSON.stringify(json));
  // This child is an installed-package consumer: no repository/private SDK imports.
  const runner = `
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AgentUiAdapter } from '@enterprise/agent-ui/server';
import { actionEventSchema, hostManifestSchema, inputSchema, normalizedBatchSchema } from '@enterprise/agent-ui/protocol';
const manifest=hostManifestSchema.parse(JSON.parse(await readFile('./release/manifest.json','utf8')));
const samples=JSON.parse(await readFile(new URL('./samples.json',import.meta.url),'utf8'));
let batches=0, actions=0, normalized=0, fragments=0;
for (const {file,value} of samples) {
  if(Array.isArray(value)) {
    const adapter=new AgentUiAdapter(value[0].runId,manifest.entries);
    try {
      for(const batch of value) {
        adapter.apply(batch); batches++;
        if(batch.runId==='run_expense' && batch.firstSequence===2) assert.equal(adapter.getSurfaceData('expense_001').ready,false,file);
        if(batch.runId==='run_expense' && batch.firstSequence===3) assert.equal(adapter.getSurfaceData('expense_001').ready,true,file);
        if(batch.runId==='run_expense' && batch.firstSequence===4) assert.equal(adapter.getSurfaceData('expense_001').view.status,'approved',file);
        if(batch.runId==='run_raw' && batch.firstSequence===2) assert.equal(adapter.getSurfaceData('raw_001').headline,'后端已收到确认',file);
      }
      const id=value[0].runId==='run_raw'?'raw_001':'expense_001';
      assert.equal(adapter.getSurfaceData(id),undefined,file);
    } finally {adapter.dispose();}
  } else if(value.message?.action) { actionEventSchema.parse(value); actions++; }
  else if(value.type==='a2ui') { inputSchema.parse(value); fragments++; }
  else if(value.type==='ui') {
    const actual=normalizedBatchSchema.parse(value.payload);
    const adapter=new AgentUiAdapter('run_001',manifest.entries);
    try {
      const expected=adapter.apply({protocol:'enterprise-agent-ui/1',runId:'run_001',batchId:'batch_1',firstSequence:1,inputs:[{type:'template.create',id:'summary_001',template:'text',templateVersion:'0.15.0',data:{text:'Hello from Agent'}}]});
      assert.deepEqual(actual,expected,file); normalized++;
    } finally {adapter.dispose();}
  }
}
console.log(JSON.stringify({batches,actions,normalized,fragments}));
`;
  const filename = path.join(temporary, "verify.mjs");
  await writeFile(filename, runner);
  const verified = await run(process.execPath, [filename], { cwd: consumer });
  const report = {
    guides: slugs.length * locales.length,
    localLinks: links,
    strictTypeScriptExamples: modules.length,
    executedServerExamples: servers.length,
    jsonBlocks: json.length,
    ...JSON.parse(verified.stdout),
    package: "@enterprise/agent-ui@0.1.0",
    validation:
      "installed public exports + genuine official Core + release plugin schemas",
  };
  await mkdir(path.join(root, "artifacts/library-docs"), { recursive: true });
  await writeFile(
    path.join(root, "artifacts/library-docs/verification.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(
    "Library guide verification failed. Prepare/install the standalone demo first (pnpm chatbot:prepare and npm ci --ignore-scripts in with-agent-ui).",
  );
  if (error && typeof error === "object" && "stdout" in error)
    console.error(error.stdout);
  throw error;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
