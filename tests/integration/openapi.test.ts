import { beforeAll, afterAll, it, expect } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import { createServer } from "../../services/api/src/server";
import { createMessage, patchMessage } from "../../packages/protocol/src/index";
import { instantiate } from "../../packages/catalog/src/index";
import { counterFixture, zipFiles } from "../fixtures/plugin";
let server: Awaited<ReturnType<typeof createServer>>;
let document: any;
const ajv = new Ajv2020({
  strict: false,
  allErrors: true,
  validateFormats: false,
});
const compiled = new Map<string, ReturnType<typeof ajv.compile>>();
function validate(schema: any, value: unknown) {
  const key = JSON.stringify(schema);
  let check = compiled.get(key);
  if (!check) {
    check = ajv.compile({ ...schema, components: document.components });
    compiled.set(key, check);
  }
  expect(
    check(value),
    ajv.errorsText(check.errors, { dataVar: "response" }),
  ).toBe(true);
}
async function call(
  method: "GET" | "POST" | "DELETE",
  path: string,
  url = path,
  payload?: unknown,
) {
  const response = await server.app.inject({
    method,
    url: `/api/v1${url}`,
    ...(payload === undefined
      ? {}
      : {
          payload: JSON.stringify(payload),
          headers: { "content-type": "application/json" },
        }),
  });
  const declared =
    document.paths[path][method.toLowerCase()].responses[response.statusCode];
  expect(
    declared,
    `${method} ${path}: undeclared ${response.statusCode} ${response.body}`,
  ).toBeTruthy();
  if (response.statusCode === 204) expect(response.body).toBe("");
  else {
    expect(response.headers["content-type"]).toContain("application/json");
    validate(declared.content["application/json"].schema, response.json());
  }
  return response;
}
beforeAll(async () => {
  server = await createServer();
  document = (await server.app.inject("/api/v1/openapi.json")).json();
});
afterAll(async () => {
  await server.app.close();
});
it("all documented operations map to real routes, use unique IDs and compile their request/response schemas", () => {
  const ids = new Set<string>();
  for (const [path, item] of Object.entries(document.paths) as [string, any][])
    for (const method of ["get", "post", "delete"]) {
      const op = item[method];
      if (!op) continue;
      expect(ids.has(op.operationId), op.operationId).toBe(false);
      ids.add(op.operationId);
      const names = [...(item.parameters ?? []), ...(op.parameters ?? [])]
        .filter((p) => p.in === "path")
        .map((p) => p.name)
        .sort();
      expect(names).toEqual(
        [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]).sort(),
      );
      const actual =
        (path.startsWith("/artifacts/") ? "" : "/api/v1") +
        path.replace(
          /\{([^}]+)\}/g,
          (_match, name: string) =>
            `:${({ componentKey: "key", name: "name", buildId: "buildId", filename: "filename" } as Record<string, string>)[name] ?? "id"}`,
        );
      expect(
        server.app.hasRoute({
          method: method.toUpperCase() as "GET",
          url: actual,
        }),
        `${method} ${path}`,
      ).toBe(true);
      if (op.requestBody?.content?.["application/json"])
        ajv.compile({
          ...op.requestBody.content["application/json"].schema,
          components: document.components,
        });
      for (const response of Object.values(op.responses) as any[])
        for (const [contentType, media] of Object.entries(
          response.content ?? {},
        ) as [string, any][]) {
          if (contentType === "application/json")
            ajv.compile({ ...media.schema, components: document.components });
        }
    }
  expect(
    document.paths["/preview-sessions/{sessionId}/messages"].post
      .responses[200],
  ).toBeUndefined();
  expect(
    document.paths["/preview-sessions/{sessionId}/messages"].post
      .responses[202],
  ).toBeTruthy();
});
it("real discovery, templates, session receipts and every event shape conform to the published response schemas", async () => {
  await call("GET", "/health");
  await call("GET", "/openapi.json");
  await call("GET", "/schemas/agent-to-renderer.json");
  const catalogs = (await call("GET", "/catalogs")).json().catalogs;
  for (const catalog of catalogs)
    await call(
      "GET",
      "/catalogs/{catalogId}",
      `/catalogs/${encodeURIComponent(catalog.catalogId)}`,
    );
  const components = (await call("GET", "/components")).json().components;
  for (const component of components) {
    const generated = instantiate(component, component.defaults);
    const validation = await call("POST", "/messages/validate", undefined, {
      messages: generated.messages,
    });
    expect(validation.json().valid, component.key).toBe(true);
    const detail = (
      await call(
        "GET",
        "/components/{componentKey}",
        `/components/${encodeURIComponent(component.key)}`,
      )
    ).json();
    expect(detail.catalogId).toBeTruthy();
    expect(detail.supportedRenderPolicies).toContain(
      detail.defaultRenderPolicy,
    );
    for (const template of detail.templateIds) {
      await call(
        "GET",
        "/templates/{templateId}",
        `/templates/${encodeURIComponent(template)}`,
      );
      await call(
        "POST",
        "/templates/{templateId}/instantiate",
        `/templates/${encodeURIComponent(template)}/instantiate`,
        {},
      );
    }
  }
  const messages = [
    createMessage(
      "s",
      [{ id: "root", component: "Text", text: { "@path": "/title" } }],
      { title: "Agent 原文" },
    ),
  ];
  await call("POST", "/messages/validate", undefined, { messages });
  await call("POST", "/messages/validate", undefined, {
    text: JSON.stringify(messages[0]),
  });
  const session = (
    await call("POST", "/preview-sessions", undefined, {
      preview: { locale: "en-US" },
    })
  ).json();
  const base = `/preview-sessions/${session.sessionId}`,
    pattern = "/preview-sessions/{sessionId}";
  await call("GET", pattern, base);
  await call("POST", pattern + "/connect", base + "/connect", {});
  await call("POST", pattern + "/heartbeat", base + "/heartbeat", {});
  await call("POST", pattern + "/messages", base + "/messages", {
    batchId: "initial",
    runId: session.runId,
    firstSequence: 1,
    messages,
  });
  await call("POST", pattern + "/ack", base + "/ack", {
    runId: session.runId,
    sequence: 1,
  });
  await call("POST", pattern + "/action", base + "/action", {
    runId: session.runId,
    action: {
      name: "report.generate",
      surfaceId: "s",
      sourceComponentId: "root",
      timestamp: new Date().toISOString(),
      context: { value: "业务原文" },
    },
  });
  const first = (
    await call("GET", pattern + "/actions", base + "/actions?after=0")
  ).json();
  await call(
    "GET",
    pattern + "/actions",
    base + "/actions?after=" + encodeURIComponent(first.cursor),
  );
  await call("POST", pattern + "/error", base + "/error", {
    runId: session.runId,
    error: { code: "PLUGIN_RENDER_ERROR", message: "render diagnostic" },
  });
  const state = server.sessions.get(session.sessionId);
  await call("POST", pattern + "/reset", base + "/reset", {
    runtimeMode: "native",
    replay: true,
  });
  for (const event of state.events)
    validate({ $ref: "#/components/schemas/SessionEvent" }, event);
  await call("DELETE", pattern, base);
  for (const event of state.events)
    validate({ $ref: "#/components/schemas/SessionEvent" }, event);
  await call("GET", pattern, base);
});
it("malformed transport requests reject consistently, and business/wire diagnostics retain structured details", async () => {
  for (const payload of [
    null,
    {},
    [],
    { text: 4 },
    { text: "" },
    { messages: {} },
    { messages: [] },
    { messages: [{}], prior: {} },
    { text: "{}", messages: [{}] },
    { messages: [{}], extra: true },
  ]) {
    const result = await call("POST", "/messages/validate", undefined, payload);
    expect(result.statusCode).toBe(400);
  }
  const invalidWire = await call("POST", "/messages/validate", undefined, {
    messages: [{ version: "0.8", surfaceUpdate: {} }],
  });
  expect(invalidWire.statusCode).toBe(200);
  expect(invalidWire.json().valid).toBe(false);
  const badTemplate = await call(
    "POST",
    "/templates/{templateId}/instantiate",
    "/templates/row~full/instantiate",
    { values: { count: "three" } },
  );
  expect(badTemplate.statusCode).toBe(422);
  expect(badTemplate.json().details.errors.length).toBeGreaterThan(0);
  expect(
    (
      await call(
        "GET",
        "/templates/{templateId}",
        "/templates/text~full~ignored",
      )
    ).statusCode,
  ).toBe(404);
  expect(
    (
      await call("POST", "/preview-sessions", undefined, {
        preview: { locale: "en-US", invented: true },
      })
    ).statusCode,
  ).toBe(400);
  const session = (
    await call("POST", "/preview-sessions", undefined, {})
  ).json();
  for (const [pattern, url] of [
    ["/preview-sessions", "/preview-sessions"],
    ["/templates/{templateId}/instantiate", "/templates/text~full/instantiate"],
    [
      "/preview-sessions/{sessionId}/reset",
      `/preview-sessions/${session.sessionId}/reset`,
    ],
  ])
    expect((await call("POST", pattern, url, null)).statusCode).toBe(400);
  server.sessions.connect(session.sessionId);
  const invalid = await call(
    "POST",
    "/preview-sessions/{sessionId}/messages",
    `/preview-sessions/${session.sessionId}/messages`,
    {
      batchId: "bad",
      firstSequence: 1,
      messages: [patchMessage("missing", {})],
    },
  );
  expect(invalid.statusCode).toBe(422);
  expect(invalid.json().details.errors.length).toBeGreaterThan(0);
});
it("real plugin upload, build records, metadata failures and uninstall conform to OpenAPI", async () => {
  const fixture = await counterFixture("contract.counter");
  const boundary = "agent-ui-contract-boundary";
  const buffer = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="contract.zip"\r\nContent-Type: application/zip\r\n\r\n`,
    ),
    zipFiles(fixture.files),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await server.app.inject({
    method: "POST",
    url: "/api/v1/plugins",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: buffer,
  });
  expect(response.statusCode, response.body).toBe(200);
  validate(
    { $ref: "#/components/schemas/PluginInstallation" },
    response.json(),
  );
  try {
    await call("GET", "/plugins");
    await call(
      "GET",
      "/components/{componentKey}",
      "/components/contract.counter",
    );
    const artifact = await server.app.inject(
      new URL(response.json().entry.bundleUrl).pathname,
    );
    expect(artifact.statusCode).toBe(200);
    expect(artifact.headers["content-type"]).toContain("text/javascript");
    for (const metadata of ["{broken", "null", "{}"]) {
      const invalid = await server.app.inject({
        method: "POST",
        url: "/api/v1/plugins",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        payload: `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${metadata}\r\n--${boundary}--\r\n`,
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().code).toBe("INVALID_METADATA");
      validate({ $ref: "#/components/schemas/Error" }, invalid.json());
    }
  } finally {
    await call("DELETE", "/plugins/{pluginId}", "/plugins/contract.counter");
  }
}, 15000);
it("JSON property ordering does not break retries or reorder messages and arrays", async () => {
  const session = (
    await call("POST", "/preview-sessions", undefined, {})
  ).json();
  server.sessions.connect(session.sessionId);
  const message = createMessage(
    "retry",
    [{ id: "root", component: "Text", text: "same" }],
    { nested: { first: 1, second: 2 }, array: [1, 2] },
  );
  const body = {
    batchId: "stable",
    firstSequence: 1,
    runId: session.runId,
    messages: [message],
  };
  const reverse = (value: any): any =>
    Array.isArray(value)
      ? value.map(reverse)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([k, v]) => [k, reverse(v)]),
          )
        : value;
  const url = `/preview-sessions/${session.sessionId}/messages`;
  const first = await call(
    "POST",
    "/preview-sessions/{sessionId}/messages",
    url,
    body,
  );
  const retry = await call(
    "POST",
    "/preview-sessions/{sessionId}/messages",
    url,
    reverse(body),
  );
  expect(retry.json()).toEqual(first.json());
  expect(server.sessions.get(session.sessionId).history).toHaveLength(1);
  const changed = structuredClone(body);
  (changed.messages[0].createSurface as any).dataModel.array = [2, 1];
  expect(
    (
      await call("POST", "/preview-sessions/{sessionId}/messages", url, changed)
    ).json().code,
  ).toBe("BATCH_CONFLICT");
});
