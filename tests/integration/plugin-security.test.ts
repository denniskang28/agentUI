import { beforeAll, afterAll, it, expect } from "vitest";
import { createServer } from "../../services/api/src/server";
import { counterFixture, zipFiles } from "../fixtures/plugin";
let server: Awaited<ReturnType<typeof createServer>>;
beforeAll(async () => {
  server = await createServer();
});
afterAll(async () => {
  await server.app.close();
});
const install = (buffer: Buffer) =>
  server.registry.install("security-test.zip", buffer);
it("rejects ZIP traversal, symlinks, dependency directories and package scripts", async () => {
  for (const file of [
    { name: "../escape.tsx", content: "not executed" },
    { name: "src/link.tsx", content: "/etc/passwd", mode: 0o120777 },
    { name: "node_modules/secret.js", content: "not executed" },
    {
      name: "package.json",
      content: '{"scripts":{"install":"must never run"}}',
    },
  ])
    await expect(install(zipFiles([file]))).rejects.toThrow();
});
it("rejects excessive file counts and expanded entry sizes before compilation", async () => {
  await expect(
    install(
      zipFiles(
        Array.from({ length: 101 }, (_, i) => ({
          name: `src/${i}.tsx`,
          content: "",
        })),
      ),
    ),
  ).rejects.toThrow("100");
  await expect(
    install(zipFiles([{ name: "large.tsx", content: "x".repeat(2_000_001) }])),
  ).rejects.toThrow();
});
it("rejects default data that fails uploaded JSON Schema and reserved catalog identities", async () => {
  for (const modify of [
    (catalog: any) => {
      catalog.defaults.value = "invalid";
    },
    (catalog: any) => {
      catalog.catalogId = "urn:enterprise:agent-ui:catalog:1";
    },
  ]) {
    const fixture = await counterFixture("security.metadata");
    modify(fixture.catalog);
    fixture.files[1].content = JSON.stringify(fixture.catalog);
    await expect(install(zipFiles(fixture.files))).rejects.toThrow();
  }
});
it("actual isolated builder rejects forbidden dependencies, path escape and syntax errors", async () => {
  for (const source of [
    "import fs from 'node:fs';export default fs;",
    "import outside from '../../builder/sdk.tsx';export default outside;",
    "export default <div broken={",
  ]) {
    const fixture = await counterFixture("security.rejected", () => source);
    await expect(install(zipFiles(fixture.files))).rejects.toMatchObject({
      code: "BUILD_FAILED",
    });
    expect(server.registry.records.has(fixture.manifest.id)).toBe(false);
  }
}, 30000);
it("opaque sandbox origins and unrelated sites cannot reach platform session endpoints", async () => {
  for (const origin of ["null", "https://unrelated.invalid"]) {
    const response = await server.app.inject({
      method: "POST",
      url: "/api/v1/preview-sessions",
      headers: { origin },
      payload: {},
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("ORIGIN_FORBIDDEN");
  }
});
