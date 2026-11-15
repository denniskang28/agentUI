import { appearanceCapabilities } from "../../../packages/protocol/src/appearance";
import { previewOrigin } from "./deployment";
import { randomUUID, createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import yauzl from "yauzl";
import { z } from "zod";
import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";
import { build as bundleTrustedValidator } from "esbuild";
import type { FastifyInstance } from "fastify";
import {
  Catalog,
  DynamicValueSchema,
  basicCatalog,
  enterpriseId,
} from "../../../packages/protocol/src/index";
import type { ComponentEntry } from "../../../packages/catalog/src/index";
import { ApiError } from "./sessions";
const root = path.resolve(".runtime/plugins");
async function writeValidator(schema: Record<string, unknown>, output: string) {
  const ajv = new Ajv({
    strict: true,
    allErrors: true,
    code: { source: true, esm: true },
  });
  const validate = ajv.compile(schema);
  const generated = standaloneCode(ajv, validate);
  const result = await bundleTrustedValidator({
    stdin: { contents: generated, resolveDir: process.cwd() },
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    minify: true,
  });
  await writeFile(
    path.join(output, "validator.js"),
    result.outputFiles[0].contents,
  );
}
export const manifestSchema = z
  .object({
    schemaVersion: z.literal("enterprise-plugin/1.0"),
    id: z.string().regex(/^[a-z][a-z0-9.-]{2,79}$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    displayName: z.string().min(1).max(80),
    entry: z.string().regex(/^src\/[a-zA-Z0-9_./-]+\.tsx?$/),
    catalogFile: z.literal("catalog.json"),
    componentType: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,79}$/),
    supportedRenderPolicies: z
      .array(z.enum(["progressive", "on_complete", "live"]))
      .min(1),
    defaultRenderPolicy: z.enum(["progressive", "on_complete", "live"]),
    actions: z.array(z.string().max(100)).max(30),
    capabilities: z.array(z.enum(["ui.render", "agent.action", "ui.resize"])),
    sdkApiVersion: z.literal("1.0"),
  })
  .strict();
export const pluginCatalogSchema = z
  .object({
    catalogId: z.string().startsWith("urn:"),
    dataSchema: z.record(z.unknown()),
    defaults: z.record(z.unknown()).default({}),
    fields: z.array(
      z
        .object({
          key: z.string(),
          label: z.string(),
          type: z
            .enum(["text", "number", "textarea", "toggle", "select"])
            .optional(),
          wide: z.boolean().optional(),
          options: z.array(z.string()).optional(),
        })
        .passthrough(),
    ),
    templates: z
      .array(
        z.enum(["full", "progressive", "on_complete", "streaming", "action"]),
      )
      .min(1)
      .default(["full"]),
    description: z.string().optional(),
    icon: z.string().optional(),
    category: z.string().optional(),
  })
  .passthrough();
export const uploadMetadataSchema = z
  .object({ manifest: manifestSchema, catalog: pluginCatalogSchema })
  .strict();
function readMetadataJson(text: string, filename: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ApiError(
      422,
      "INVALID_PLUGIN_JSON",
      `${filename}: ${String(error)}`,
    );
  }
}
type Manifest = z.infer<typeof manifestSchema>;
interface RecordData {
  id: string;
  buildId: string;
  manifest: Manifest;
  entry: ComponentEntry;
  schema: Record<string, unknown>;
  createdAt: string;
  bytes: number;
  status: "ready";
}
export function safeEntry(name: string) {
  if (
    name.includes("\\") ||
    name.includes("\0") ||
    name.startsWith("/") ||
    name.split("/").some((p) => p === ".." || p === ".") ||
    name.length > 180
  )
    throw new ApiError(422, "UNSAFE_ZIP_PATH", name);
  if (name.split("/").some((p) => ["node_modules", ".git"].includes(p)))
    throw new ApiError(422, "FORBIDDEN_UPLOAD_FILE", name);
  return name;
}
export async function extractZip(buffer: Buffer, destination: string) {
  await new Promise<void>((resolve, reject) =>
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (err, zip) => {
        if (err || !zip)
          return reject(new ApiError(422, "INVALID_ZIP", String(err)));
        let total = 0,
          count = 0;
        let failed = false;
        const fail = (e: unknown) => {
          if (failed) return;
          failed = true;
          zip.close();
          reject(e);
        };
        zip.on("error", fail);
        zip.on("end", () => resolve());
        zip.on("entry", (entry) => {
          void (async () => {
            const name = safeEntry(entry.fileName);
            if (++count > 100)
              throw new ApiError(413, "ZIP_TOO_MANY_FILES", "最多 100 个文件");
            const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
            if (mode === 0o120000)
              throw new ApiError(422, "ZIP_SYMLINK", "不接受符号链接");
            total += entry.uncompressedSize;
            if (
              total > 10_000_000 ||
              entry.uncompressedSize > 2_000_000 ||
              entry.uncompressedSize / Math.max(1, entry.compressedSize) > 100
            )
              throw new ApiError(
                413,
                "ZIP_EXPANSION_LIMIT",
                "解压尺寸或压缩比超出限制",
              );
            if (name.endsWith("/")) {
              await mkdir(path.join(destination, name), { recursive: true });
              zip.readEntry();
              return;
            }
            if (
              !/\.(tsx?|jsx?|json|jsonl|css|md)$/.test(name) ||
              path.basename(name) === "package.json"
            )
              throw new ApiError(422, "FORBIDDEN_UPLOAD_FILE", name);
            await mkdir(path.dirname(path.join(destination, name)), {
              recursive: true,
            });
            await new Promise<void>((done, bad) =>
              zip.openReadStream(entry, (e, stream) => {
                if (e || !stream) return bad(e);
                const chunks: Buffer[] = [];
                let size = 0;
                stream.on("data", (chunk: Buffer) => {
                  size += chunk.length;
                  if (size > 2_000_000) {
                    stream.destroy();
                    bad(new ApiError(413, "ZIP_EXPANSION_LIMIT", name));
                  } else chunks.push(chunk);
                });
                stream.on("error", bad);
                stream.on(
                  "end",
                  () =>
                    void writeFile(
                      path.join(destination, name),
                      Buffer.concat(chunks),
                    ).then(() => done(), bad),
                );
              }),
            );
            zip.readEntry();
          })().catch(fail);
        });
        zip.readEntry();
      },
    ),
  );
}
async function command(cmd: string, args: string[], timeout = 45000) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new ApiError(504, "BUILD_TIMEOUT", "隔离构建超过 45 秒"));
    }, timeout);
    const output = (chunk: Buffer) => {
      text += chunk.toString();
      if (text.length > 100000) {
        child.kill("SIGKILL");
        reject(new ApiError(413, "BUILD_OUTPUT_LIMIT", "构建日志超限"));
      }
    };
    child.stdout.on("data", output);
    child.stderr.on("data", output);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new ApiError(503, "BUILDER_UNAVAILABLE", e.message));
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(text);
      else
        reject(
          new ApiError(
            422,
            "BUILD_FAILED",
            text.slice(-6000) ||
              "Docker 构建服务不可用；请执行 pnpm builder:image",
          ),
        );
    });
  });
}
export class PluginRegistry {
  records = new Map<string, RecordData>();
  builds: {
    id: string;
    filename: string;
    status: string;
    error?: string;
    createdAt: string;
  }[] = [];
  async load() {
    await mkdir(root, { recursive: true });
    for (const dir of await readdir(root)) {
      try {
        const record = JSON.parse(
          await readFile(path.join(root, dir, "record.json"), "utf8"),
        ) as RecordData;
        const prev = this.records.get(record.id);
        record.entry.bundleUrl = `${previewOrigin}/artifacts/${record.buildId}/plugin.js`;
        record.entry.actions = record.manifest.capabilities.includes(
          "agent.action",
        )
          ? record.manifest.actions
          : [];
        try {
          await stat(path.join(root, dir, "output", "plugin.css"));
          record.entry.stylesheetUrl = record.entry.bundleUrl?.replace(
            /plugin\.js$/,
            "plugin.css",
          );
        } catch {
          /* No stylesheet in this artifact. */
        }
        await writeValidator(record.schema, path.join(root, dir, "output"));
        if (!prev || prev.createdAt < record.createdAt)
          this.records.set(record.id, record);
      } catch {
        /* Incomplete build has no registry entry. */
      }
    }
  }
  entries() {
    return Array.from(this.records.values()).map((r) => ({
      ...r.entry,
      appearance: appearanceCapabilities(r.entry.component, true),
    }));
  }
  catalogs() {
    return Array.from(this.records.values()).map(
      (r) =>
        new Catalog(r.entry.catalogId!, "1.0", [
          {
            name: r.manifest.componentType,
            schema: z.object({ data: DynamicValueSchema }),
          },
        ]),
    );
  }
  async install(
    filename: string,
    buffer: Buffer,
    metadata?: Record<string, unknown>,
  ) {
    const buildId = randomUUID();
    const dir = path.join(root, buildId);
    const input = path.join(dir, "input");
    const output = path.join(dir, "output");
    await mkdir(input, { recursive: true });
    await mkdir(output, { recursive: true, mode: 0o777 });
    await import("node:fs/promises").then((fs) => fs.chmod(output, 0o777));
    const build = {
      id: buildId,
      filename,
      status: "validating",
      createdAt: new Date().toISOString(),
      error: undefined as string | undefined,
    };
    this.builds.unshift(build);
    this.builds = this.builds.slice(0, 30);
    try {
      if (buffer.length > 5_000_000)
        throw new ApiError(413, "UPLOAD_TOO_LARGE", "上传文件最大 5 MB");
      if (filename.endsWith(".zip")) await extractZip(buffer, input);
      else if (filename.endsWith(".tsx")) {
        if (!metadata)
          throw new ApiError(
            400,
            "METADATA_REQUIRED",
            "TSX 上传需要 manifest 和 schema 元数据",
          );
        await mkdir(path.join(input, "src"));
        await writeFile(path.join(input, "src/index.tsx"), buffer);
        await writeFile(
          path.join(input, "plugin.json"),
          JSON.stringify(metadata.manifest),
        );
        await writeFile(
          path.join(input, "catalog.json"),
          JSON.stringify(metadata.catalog),
        );
      } else
        throw new ApiError(415, "UNSUPPORTED_UPLOAD", "仅支持 .tsx 或 .zip");
      let base = input;
      let files = await readdir(base);
      if (!files.includes("plugin.json") && files.length === 1) {
        base = path.join(base, files[0]);
        files = await readdir(base);
      }
      if (!files.includes("plugin.json") || !files.includes("catalog.json"))
        throw new ApiError(
          422,
          "MANIFEST_REQUIRED",
          "根目录需要 plugin.json 和 catalog.json",
        );
      const manifest = manifestSchema.parse(
        readMetadataJson(
          await readFile(path.join(base, "plugin.json"), "utf8"),
          "plugin.json",
        ),
      );
      safeEntry(manifest.entry);
      if (
        !manifest.supportedRenderPolicies.includes(manifest.defaultRenderPolicy)
      )
        throw new ApiError(
          422,
          "INVALID_MANIFEST",
          "默认渲染策略必须在支持列表中",
        );
      const parsedCatalog = pluginCatalogSchema.safeParse(
        readMetadataJson(
          await readFile(path.join(base, "catalog.json"), "utf8"),
          "catalog.json",
        ),
      );
      if (!parsedCatalog.success)
        throw new ApiError(422, "INVALID_CATALOG", parsedCatalog.error.message);
      const catalog = parsedCatalog.data;
      if (
        [basicCatalog.id, enterpriseId].includes(catalog.catalogId) ||
        Array.from(this.records.values()).some(
          (record) =>
            record.id !== manifest.id &&
            record.entry.catalogId === catalog.catalogId,
        )
      )
        throw new ApiError(
          422,
          "CATALOG_ID_CONFLICT",
          "Catalog ID 已被其他组件占用",
        );
      const ajv = new Ajv({ strict: true, allErrors: true });
      let validate;
      try {
        validate = ajv.compile(catalog.dataSchema);
      } catch (error) {
        throw new ApiError(422, "INVALID_SCHEMA", String(error));
      }
      if (!validate(catalog.defaults))
        throw new ApiError(
          422,
          "INVALID_DEFAULTS",
          ajv.errorsText(validate.errors),
        );
      build.status = "building";
      const containerName = `agent-ui-build-${buildId}`;
      try {
        await command("docker", [
          "run",
          "--rm",
          "--name",
          containerName,
          "--network",
          "none",
          "--read-only",
          "--user",
          "65534:65534",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "--memory",
          "256m",
          "--cpus",
          "1",
          "--pids-limit",
          "64",
          "--tmpfs",
          "/tmp:rw,noexec,nosuid,size=16m",
          "--mount",
          `type=bind,src=${base},dst=/input,readonly`,
          "--mount",
          `type=bind,src=${output},dst=/output`,
          "agent-ui-builder:local",
        ]);
      } catch (e) {
        await command("docker", ["rm", "-f", containerName], 5000).catch(
          () => {},
        );
        throw e;
      }
      const artifact = await readFile(path.join(output, "plugin.js"));
      let stylesheetUrl: string | undefined;
      try {
        const css = await stat(path.join(output, "plugin.css"));
        if (css.size > 500000)
          throw new ApiError(413, "ARTIFACT_TOO_LARGE", "样式产物超过 500 KB");
        stylesheetUrl = `${previewOrigin}/artifacts/${buildId}/plugin.css`;
      } catch (error) {
        if ((error as { code?: string }).code !== "ENOENT") throw error;
      }
      await writeValidator(catalog.dataSchema, output);
      if (artifact.length > 2_000_000)
        throw new ApiError(413, "ARTIFACT_TOO_LARGE", "产物超过 2 MB");
      const entry: ComponentEntry = {
        key: manifest.id,
        name: manifest.displayName,
        component: manifest.componentType,
        category: ["基础展示", "布局", "数据展示", "表单与交互"].includes(
          catalog.category ?? "",
        )
          ? catalog.category!
          : "已安装插件",
        icon: catalog.icon ?? "grid",
        version: manifest.version,
        description: catalog.description ?? "上传的动态组件",
        pluginId: manifest.id,
        catalogId: catalog.catalogId,
        schema: catalog.dataSchema,
        defaults: catalog.defaults ?? {},
        fields: catalog.fields ?? [],
        templates: catalog.templates ?? ["full"],
        bundleUrl: `${previewOrigin}/artifacts/${buildId}/plugin.js`,
        actions: manifest.capabilities.includes("agent.action")
          ? manifest.actions
          : [],
        stylesheetUrl,
      };
      const record: RecordData = {
        id: manifest.id,
        buildId,
        manifest,
        entry,
        schema: catalog.dataSchema,
        createdAt: new Date().toISOString(),
        bytes: artifact.length,
        status: "ready",
      };
      await writeFile(
        path.join(dir, "record.json"),
        JSON.stringify(record, null, 2),
      );
      this.records.set(manifest.id, record);
      build.status = "ready";
      return {
        ...record,
        sha256: createHash("sha256").update(artifact).digest("hex"),
      };
    } catch (e) {
      build.status = "failed";
      build.error = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }
  async uninstall(id: string) {
    const record = this.records.get(id);
    if (!record) throw new ApiError(404, "PLUGIN_NOT_FOUND", id);
    this.records.delete(id);
    for (const dir of await readdir(root)) {
      try {
        const r = JSON.parse(
          await readFile(path.join(root, dir, "record.json"), "utf8"),
        );
        if (r.id === id) await rm(path.join(root, dir, "record.json"));
      } catch {
        /* Other build record. */
      }
    }
  }
}
export async function installRoutes(
  app: FastifyInstance,
  registry: PluginRegistry,
) {
  app.get("/api/v1/demo-files/:name", async (req, reply) => {
    const { name } = req.params as { name: string };
    if (
      ![
        "finance-risk-heatmap.zip",
        "expense-approval.zip",
        "unknown-counter.zip",
      ].includes(name)
    )
      throw new ApiError(404, "DEMO_NOT_FOUND", name);
    reply.header("Content-Type", "application/zip");
    return readFile(path.resolve("examples/dist", name));
  });
  app.get("/api/v1/plugins", () => ({
    plugins: Array.from(registry.records.values()),
    builds: registry.builds,
  }));
  app.post("/api/v1/plugins", async (req) => {
    const parts = req.parts();
    let upload: { filename: string; buffer: Buffer } | undefined;
    let metadata: Record<string, unknown> | undefined;
    for await (const part of parts) {
      if (part.type === "file") {
        upload = { filename: part.filename, buffer: await part.toBuffer() };
      } else if (part.fieldname === "metadata") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(part.value));
        } catch (error) {
          throw new ApiError(400, "INVALID_METADATA", String(error));
        }
        const result = uploadMetadataSchema.safeParse(parsed);
        if (!result.success)
          throw new ApiError(400, "INVALID_METADATA", result.error.message);
        metadata = result.data;
      }
    }
    if (!upload) throw new ApiError(400, "FILE_REQUIRED", "请选择插件文件");
    return registry.install(upload.filename, upload.buffer, metadata);
  });
  app.delete("/api/v1/plugins/:id", async (req, reply) => {
    await registry.uninstall((req.params as { id: string }).id);
    reply.code(204).send();
  });
  app.get("/artifacts/:buildId/:filename", async (req, reply) => {
    const { buildId, filename } = req.params as {
      buildId: string;
      filename: string;
    };
    if (!["plugin.js", "validator.js", "plugin.css"].includes(filename))
      throw new ApiError(404, "ARTIFACT_NOT_FOUND", filename);
    if (!/^[a-f0-9-]{36}$/.test(buildId))
      throw new ApiError(404, "ARTIFACT_NOT_FOUND", buildId);
    const file = path.join(root, buildId, "output", filename);
    try {
      await stat(file);
    } catch {
      throw new ApiError(404, "ARTIFACT_NOT_FOUND", buildId);
    }
    reply
      .header(
        "Content-Type",
        filename.endsWith(".css") ? "text/css" : "text/javascript",
      )
      .header("Access-Control-Allow-Origin", "*")
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff");
    return await readFile(file);
  });
}
