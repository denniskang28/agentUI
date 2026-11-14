import { afterAll, beforeAll, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.PUBLIC_MAIN_URL = "http://192.0.2.10/playground/";
  process.env.PUBLIC_PREVIEW_ORIGIN = "http://preview.example.test";
});

import { createServer } from "../../services/api/src/server";
import { counterFixture, zipFiles } from "../fixtures/plugin";

let server: Awaited<ReturnType<typeof createServer>>;
beforeAll(async () => {
  server = await createServer();
});
afterAll(async () => {
  await server.app.close();
});

it("publishes deployment URLs and retains explicit origin boundaries", async () => {
  const response = await server.app.inject({
    method: "POST",
    url: "/api/v1/preview-sessions",
    headers: { origin: "http://192.0.2.10" },
    payload: {},
  });
  expect(response.statusCode).toBe(200);
  expect(response.json().previewUrl).toMatch(
    /^http:\/\/192\.0\.2\.10\/playground\/\?session=/,
  );
  expect(response.headers["access-control-allow-origin"]).toBe(
    "http://192.0.2.10",
  );
  const component = (await server.app.inject("/api/v1/components/text")).json();
  expect(component.catalogSchemaUrl).toMatch(
    /^\/playground\/api\/v1\/catalogs\//,
  );
  const document = (await server.app.inject("/api/v1/openapi.json")).json();
  expect(document.servers[0].url).toBe(
    "http://192.0.2.10/playground/api/v1",
  );
  for (const origin of [
    "http://localhost:5173",
    "http://untrusted.example",
    "null",
  ]) {
    expect(
      (
        await server.app.inject({
          url: "/api/v1/components",
          headers: { origin },
        })
      ).statusCode,
    ).toBe(403);
  }
});

it("compiles an actual plugin with deployment artifact URLs", async () => {
  const fixture = await counterFixture("deployment.counter");
  try {
    const record = await server.registry.install(
      "counter.zip",
      zipFiles(fixture.files),
    );
    expect(record.entry.bundleUrl).toMatch(
      /^http:\/\/preview\.example\.test\/artifacts\//,
    );
    const artifactPath = new URL(record.entry.bundleUrl!).pathname;
    const artifact = await server.app.inject({
      url: artifactPath,
      headers: { origin: "null" },
    });
    expect(artifact.statusCode).toBe(200);
    expect(artifact.body.length).toBeGreaterThan(10000);
  } finally {
    if (server.registry.records.has("deployment.counter"))
      await server.registry.uninstall("deployment.counter");
  }
});
