/** Node 24+, no platform SDK dependency. Open the printed previewUrl. */
const options = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  options.set(process.argv[i], process.argv[i + 1]);
const base = options.get("--base") ?? "http://localhost:5173/api/v1";
const scenario = options.get("--scenario") ?? "full";
if (!["full", "progressive", "action"].includes(scenario))
  throw Error("--scenario full|progressive|action");
const locale = options.get("--locale") ?? "zh-CN";
const key =
  options.get("--component") ?? (scenario === "action" ? "button" : "text");
const deadline = Date.now() + Number(options.get("--timeout") ?? 40) * 1000;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(
  path: string,
  data?: unknown,
  method?: string,
): Promise<any> {
  const response = await fetch(base + path, {
    method: method ?? (data === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error(`${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
const component = (await request("/components")).components.find(
  (entry: { key: string }) => entry.key === key,
);
if (!component) throw Error(`Component not installed: ${key}`);
const template = await request(
  `/templates/${component.templateIds[0]}/instantiate`,
  {},
);
const session = await request("/preview-sessions", {
  actionHandler: "external",
  preview: { runtimeMode: "sandbox", locale },
});
console.log(
  JSON.stringify({
    sessionId: session.sessionId,
    previewUrl: session.previewUrl,
  }),
);
const sessionPath = `/preview-sessions/${session.sessionId}`;
while ((await request(sessionPath)).status !== "connected") {
  if (Date.now() > deadline)
    throw Error("Open previewUrl and wait for preview.connected");
  await pause(100);
}
let sequence = 1;
async function submit(messages: unknown[], batchId: string) {
  const receipt = await request(`${sessionPath}/messages`, {
    batchId,
    runId: session.runId,
    firstSequence: sequence,
    messages,
  });
  sequence = receipt.lastSequence + 1;
  while ((await request(sessionPath)).lastAppliedSequence < sequence - 1) {
    if (Date.now() > deadline) throw Error("message.applied timeout");
    await pause(50);
  }
}
await submit(template.messages, "initial");
if (scenario === "progressive") {
  for (let tick = 0; tick < 3; tick++) {
    await pause(150);
    await submit(
      [
        {
          version: "1.0",
          updateDataModel: {
            surfaceId: "main",
            path: "/view/text",
            value: `External Agent update ${tick + 1}`,
          },
        },
      ],
      `update-${tick}`,
    );
  }
} else if (scenario === "action") {
  let cursor = "0",
    handled = false;
  while (Date.now() < deadline) {
    const result = await request(
      `${sessionPath}/actions?after=${encodeURIComponent(cursor)}`,
    );
    cursor = result.cursor;
    for (const event of result.actions) {
      if (event.runId !== session.runId) continue;
      const action = event.payload.action.action;
      await submit(
        [
          {
            version: "1.0",
            updateDataModel: {
              surfaceId: action.surfaceId,
              path: "/view/label",
              value: `Agent received ${action.name}`,
            },
          },
        ],
        `action-${event.payload.actionId}`,
      );
      console.log(JSON.stringify({ action: action.name, result: "applied" }));
      handled = true;
      break;
    }
    if (handled) break;
    await pause(100);
  }
  if (!handled)
    throw Error("Click the button in the preview to dispatch an Action");
}
console.log(JSON.stringify({ result: "complete", lastSequence: sequence - 1 }));
export {};
