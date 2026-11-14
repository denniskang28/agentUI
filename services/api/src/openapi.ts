import {
  AgentToRendererMessageSchema,
  ActionMessageSchema,
} from "@a2ui/web_core/v1_0";
import { zodToJsonSchema } from "zod-to-json-schema";
import { runConfigSchema } from "../../../packages/protocol/src/index";
import {
  ackRequestSchema,
  actionRequestSchema,
  runtimeErrorRequestSchema,
  messageBatchSchema,
  previewRequestSchema,
  resetRequestSchema,
  sessionRequestSchema,
  templateRequestSchema,
  validationRequestSchema,
} from "./contracts";
import { manifestSchema, pluginCatalogSchema } from "./plugins";

type Schema = Record<string, unknown>;
const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`,
});
const string = { type: "string" };
const integer = { type: "integer", minimum: 0 };
const object = (
  properties: Schema,
  required = Object.keys(properties),
  additionalProperties = false,
): Schema => ({ type: "object", properties, required, additionalProperties });
const array = (items: Schema): Schema => ({ type: "array", items });
const record = { type: "object", additionalProperties: true };
const schemaDocument = {
  type: "object",
  additionalProperties: true,
  description:
    "A JSON Schema/catalog document. Its own dialect and definitions apply to its contents.",
};
const json = (schema: Schema) => ({ "application/json": { schema } });
function fromZod(schema: Parameters<typeof zodToJsonSchema>[0]): Schema {
  const { $schema: _dialect, ...result } = zodToJsonSchema(schema, {
    $refStrategy: "none",
  });
  void _dialect;
  return result;
}
const errorDescriptions: Record<number, string> = {
  400: "Invalid parameters, JSON or cursor",
  403: "Origin is not allowed",
  404: "Resource not found",
  409: "Preview connection, batch, sequence or run conflict",
  410: "Session or cursor expired",
  413: "Request, upload, artifact or session limit exceeded",
  415: "Unsupported content or upload type",
  422: "Wire, template, plugin metadata or build validation failed",
  500: "Unexpected server error",
  503: "Docker builder unavailable",
  504: "Isolated build timed out",
};
function errors(...codes: number[]) {
  return Object.fromEntries(
    [...new Set([...codes, 403, 500])].map((code) => [
      code,
      { description: errorDescriptions[code], content: json(ref("Error")) },
    ]),
  );
}
function operation(
  id: string,
  summary: string,
  response: string,
  options: {
    body?: string;
    optionalBody?: boolean;
    status?: number;
    errors?: number[];
    internal?: boolean;
    description?: string;
  } = {},
) {
  return {
    operationId: id,
    summary,
    ...(options.description ? { description: options.description } : {}),
    ...(options.internal
      ? { "x-internal": true, tags: ["Preview bridge (internal)"] }
      : { tags: ["Agent developer"] }),
    ...(options.body
      ? {
          requestBody: {
            required: !options.optionalBody,
            content: json(ref(options.body)),
          },
        }
      : {}),
    responses: {
      [options.status ?? 200]: {
        description:
          options.status === 202
            ? "Accepted; await message.applied. Not a plugin paint receipt."
            : "OK",
        content: json(ref(response)),
      },
      ...errors(...(options.errors ?? [])),
    },
  };
}
const path = (name: string, description?: string) => ({
  name,
  in: "path",
  required: true,
  schema: string,
  ...(description ? { description } : {}),
});
const session = [path("sessionId")];
const event = (type: string, payload: Schema) =>
  object({
    id: { type: "integer", minimum: 1 },
    type: { const: type },
    runId: string,
    timestamp: { type: "string", format: "date-time" },
    payload,
  });
const receiptProperties = {
  batchId: string,
  runId: string,
  status: { const: "accepted" },
  firstSequence: { type: "integer", minimum: 1 },
  lastSequence: { type: "integer", minimum: 1 },
};
const sessionProperties = {
  sessionId: string,
  runId: string,
  status: { enum: ["waiting_for_preview", "connected"] },
  previewUrl: { type: "string", format: "uri" },
  expiresAt: { type: "string", format: "date-time" },
  lastReceivedSequence: integer,
  lastAppliedSequence: integer,
  config: ref("RunConfiguration"),
};
const componentProperties = {
  protocolVersion: string,
  source: { enum: ["builtin", "plugin"] },
  availability: { const: "ready" },
  supportedRenderPolicies: array({
    enum: ["progressive", "on_complete", "live"],
  }),
  defaultRenderPolicy: { enum: ["progressive", "on_complete", "live"] },
  key: string,
  name: string,
  component: string,
  category: string,
  icon: string,
  version: string,
  description: string,
  pluginId: string,
  catalogId: string,
  schema: schemaDocument,
  defaults: record,
  fields: array(ref("Field")),
  templates: array(string),
  bundleUrl: { type: "string", format: "uri" },
  stylesheetUrl: { type: "string", format: "uri" },
  actions: array(string),
  wireSchema: schemaDocument,
  inputSchema: schemaDocument,
  catalogSchemaUrl: string,
  templateIds: array(string),
};
const componentRequired = [
  "catalogId",
  "protocolVersion",
  "source",
  "availability",
  "supportedRenderPolicies",
  "defaultRenderPolicy",
  "key",
  "name",
  "component",
  "category",
  "icon",
  "version",
  "description",
  "defaults",
  "fields",
  "templates",
  "actions",
  "wireSchema",
  "inputSchema",
  "schema",
  "catalogSchemaUrl",
  "templateIds",
];
const apiErrors = [400, 404, 409, 410, 413, 415, 422];
export const openapi = {
  openapi: "3.1.0",
  jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
  info: {
    title: "Agent UI Developer API",
    version: "1.0.0",
    description:
      "Local development API using official A2UI v1.0. HTTP sessions, ordering, events and render policies are platform APIs. Request schemas share the server's validators. Internal bridge routes are documented for diagnostics, not Agent-generated receipts.",
  },
  servers: [
    { url: "http://localhost:5173/api/v1" },
    { url: "http://127.0.0.1:3001/api/v1" },
  ],
  paths: {
    "/health": {
      get: operation(
        "health",
        "Read service and pinned SDK versions",
        "Health",
      ),
    },
    "/openapi.json": {
      get: operation(
        "openapi",
        "Read this OpenAPI 3.1 document",
        "OpenApiDocument",
      ),
    },
    "/schemas/agent-to-renderer.json": {
      get: operation(
        "officialWireSchema",
        "Read the unmodified SDK-supplied official A2UI v1.0 wire schema",
        "SchemaDocument",
      ),
    },
    "/catalogs": {
      get: operation(
        "listCatalogs",
        "Read installed official and project catalogs",
        "CatalogList",
      ),
    },
    "/catalogs/{catalogId}": {
      parameters: [
        path(
          "catalogId",
          "URL-encode the complete Catalog ID returned by discovery",
        ),
      ],
      get: operation(
        "readCatalog",
        "Read one complete Catalog document",
        "SchemaDocument",
        { errors: [404] },
      ),
    },
    "/components": {
      get: operation(
        "listComponents",
        "Discover built-in and installed component identities, schemas and templates",
        "ComponentList",
      ),
    },
    "/components/{componentKey}": {
      parameters: [
        path(
          "componentKey",
          "Opaque discovery key; do not derive it from a plugin name",
        ),
      ],
      get: operation(
        "readComponent",
        "Read component details and binding information",
        "ComponentDetail",
        { errors: [404] },
      ),
    },
    "/templates/{templateId}": {
      parameters: [path("templateId")],
      get: operation(
        "readTemplate",
        "Read exact default input and A2UI sequence",
        "Template",
        { errors: [404] },
      ),
    },
    "/templates/{templateId}/instantiate": {
      parameters: [path("templateId")],
      post: operation(
        "instantiateTemplate",
        "Merge defaults, validate input and generate messages without rendering",
        "Instantiation",
        {
          body: "TemplateRequest",
          optionalBody: true,
          errors: [400, 404, 413, 422],
        },
      ),
    },
    "/messages/validate": {
      post: operation(
        "validateMessages",
        "Validate exactly one messages array or JSON/JSONL text, with optional prior messages",
        "ValidationResult",
        {
          body: "ValidationRequest",
          errors: [400, 413, 415],
          description:
            "HTTP 200 with valid=false contains official Core diagnostics. Syntax/transport shape failures are HTTP 400. This endpoint does not mount plugins or validate resolved plugin business data; template inputs and runtime component boundaries do.",
        },
      ),
    },
    "/preview-sessions": {
      post: operation(
        "createSession",
        "Create an ephemeral preview session",
        "Session",
        { body: "SessionRequest", optionalBody: true, errors: [400, 413] },
      ),
    },
    "/preview-sessions/{sessionId}": {
      parameters: session,
      get: operation(
        "readSession",
        "Read current run, connection and received/applied sequence",
        "Session",
        { errors: [404, 410] },
      ),
      delete: {
        operationId: "destroySession",
        summary: "Destroy session and notify the preview",
        responses: {
          204: { description: "Destroyed; no response body" },
          ...errors(404, 410),
        },
      },
    },
    "/preview-sessions/{sessionId}/messages": {
      parameters: session,
      post: operation(
        "submitMessages",
        "Submit an ordered idempotent batch",
        "BatchReceipt",
        {
          body: "MessageBatch",
          status: 202,
          errors: apiErrors,
          description:
            "1–1000 messages, 5000 per run, 2 MB HTTP body. firstSequence must follow lastReceivedSequence. Retry the same batchId/content for the original receipt; a different payload conflicts. Include current runId; it is required after reset. Runtime errors do not roll back already applied messages.",
        },
      ),
    },
    "/preview-sessions/{sessionId}/events": {
      parameters: session,
      get: {
        operationId: "sessionEvents",
        summary: "Stream retained and live platform events over SSE",
        description:
          "Last-Event-ID takes precedence over after. Zero requests the retained window; a nonzero cursor older than the window returns 410 before streaming begins. Event data is a SessionEvent JSON object; id/event lines carry its ID/type. Keepalive comments are not events. Delivery may be at least once. Expiry/destruction emits session.destroyed and closes the stream.",
        parameters: [
          {
            name: "Last-Event-ID",
            in: "header",
            schema: {
              type: "integer",
              minimum: 0,
              maximum: Number.MAX_SAFE_INTEGER,
            },
          },
          {
            name: "after",
            in: "query",
            schema: {
              type: "integer",
              minimum: 0,
              maximum: Number.MAX_SAFE_INTEGER,
              default: 0,
            },
          },
        ],
        responses: {
          200: {
            description:
              "text/event-stream; each data field contains SessionEvent",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  "x-event-schema": ref("SessionEvent"),
                },
                example:
                  'id: 1\nevent: preview.connected\ndata: {"id":1,"type":"preview.connected","runId":"run","timestamp":"2026-11-14T00:00:00.000Z","payload":{}}\n\n',
              },
            },
          },
          ...errors(400, 404, 410),
        },
      },
    },
    "/preview-sessions/{sessionId}/actions": {
      parameters: session,
      get: {
        ...operation(
          "pollActions",
          "Read Actions using a session-bound cursor independent of SSE",
          "ActionPage",
          { errors: [400, 404, 410] },
        ),
        parameters: [
          {
            name: "after",
            in: "query",
            schema: { type: "string", default: "0" },
            description:
              "Use 0 initially, then return the opaque cursor unchanged. Initial 0 returns 410 if earlier Actions have already fallen out of retention.",
          },
        ],
      },
    },
    "/preview-sessions/{sessionId}/connect": {
      parameters: session,
      post: operation(
        "connectPreview",
        "Internal: connect the real preview and restore history",
        "Connection",
        { internal: true, errors: [404, 410] },
      ),
    },
    "/preview-sessions/{sessionId}/heartbeat": {
      parameters: session,
      post: operation(
        "previewHeartbeat",
        "Internal: refresh preview connection liveness",
        "Ok",
        { internal: true, errors: [404, 410] },
      ),
    },
    "/preview-sessions/{sessionId}/reset": {
      parameters: session,
      post: operation(
        "resetPreview",
        "Internal: new run, optionally replay received messages",
        "Session",
        {
          internal: true,
          body: "ResetRequest",
          optionalBody: true,
          errors: [400, 404, 409, 410, 422],
        },
      ),
    },
    "/preview-sessions/{sessionId}/ack": {
      parameters: session,
      post: operation(
        "acknowledgePreview",
        "Internal: acknowledge official Core application",
        "Ok",
        { internal: true, body: "AckRequest", errors: [400, 404, 409, 410] },
      ),
    },
    "/preview-sessions/{sessionId}/action": {
      parameters: session,
      post: operation(
        "previewAction",
        "Internal: forward an actual normalized UI Action",
        "ActionEvent",
        { internal: true, body: "ActionRequest", errors: [400, 404, 409, 410] },
      ),
    },
    "/preview-sessions/{sessionId}/error": {
      parameters: session,
      post: operation(
        "previewRuntimeError",
        "Internal: report an actual plugin load/render or bridge error",
        "RuntimeErrorEvent",
        {
          internal: true,
          body: "RuntimeErrorRequest",
          errors: [400, 404, 409, 410],
        },
      ),
    },
    "/plugins": {
      get: operation(
        "listPlugins",
        "Read installed plugin records and the latest 30 build attempts",
        "PluginList",
      ),
      post: {
        operationId: "uploadPlugin",
        summary: "Upload TSX/ZIP and compile with the isolated Docker builder",
        description:
          "One file up to 5,000,000 bytes. ZIP expansion: up to 100 entries, 10,000,000 total bytes, 2,000,000 bytes per entry, compression ratio <=100. TSX requires metadata JSON (UploadMetadata). Builds do not run package scripts or install user dependencies.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: object(
                {
                  file: { type: "string", format: "binary" },
                  metadata: {
                    type: "string",
                    contentMediaType: "application/json",
                    contentSchema: ref("UploadMetadata"),
                    description:
                      "Required for TSX; JSON containing manifest and catalog",
                  },
                },
                ["file"],
                true,
              ),
            },
          },
        },
        responses: {
          200: {
            description: "Compiled and installed; sha256 is for plugin.js",
            content: json(ref("PluginInstallation")),
          },
          ...errors(400, 413, 415, 422, 503, 504),
        },
      },
    },
    "/plugins/{pluginId}": {
      parameters: [path("pluginId")],
      delete: {
        operationId: "uninstallPlugin",
        summary: "Uninstall a plugin from discovery",
        responses: {
          204: { description: "Uninstalled; no response body" },
          ...errors(404),
        },
      },
    },
    "/demo-files/{name}": {
      parameters: [
        {
          ...path("name"),
          schema: {
            enum: [
              "finance-risk-heatmap.zip",
              "expense-approval.zip",
              "unknown-counter.zip",
            ],
          },
        },
      ],
      get: {
        operationId: "downloadDemo",
        summary: "Download a packaged example for normal plugin upload",
        responses: {
          200: {
            description: "ZIP archive",
            content: {
              "application/zip": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          ...errors(404),
        },
      },
    },
    "/artifacts/{buildId}/{filename}": {
      servers: [{ url: "http://127.0.0.1:4173" }],
      parameters: [
        path("buildId"),
        {
          ...path("filename"),
          schema: { enum: ["plugin.js", "validator.js", "plugin.css"] },
        },
      ],
      get: {
        operationId: "readArtifact",
        summary: "Read an isolated preview artifact (outside /api/v1)",
        responses: {
          200: {
            description: "JavaScript or CSS artifact; no-store and nosniff",
            content: {
              "text/javascript": { schema: { type: "string" } },
              "text/css": { schema: { type: "string" } },
            },
          },
          ...errors(404),
        },
      },
    },
  },
  components: {
    schemas: {
      SchemaDocument: schemaDocument,
      OpenApiDocument: {
        type: "object",
        required: ["openapi", "info", "paths", "components"],
        properties: {
          openapi: { const: "3.1.0" },
          info: record,
          paths: record,
          components: record,
        },
        additionalProperties: true,
      },
      Health: object({
        status: { const: "ok" },
        sdk: object({ core: string, react: string, protocol: string }),
      }),
      Ok: object({ ok: { const: true } }),
      RunConfiguration: fromZod(runConfigSchema),
      PreviewConfiguration: fromZod(previewRequestSchema),
      TemplateRequest: fromZod(templateRequestSchema),
      ValidationRequest: fromZod(validationRequestSchema),
      SessionRequest: fromZod(sessionRequestSchema),
      MessageBatch: fromZod(messageBatchSchema),
      ResetRequest: fromZod(resetRequestSchema),
      AckRequest: fromZod(ackRequestSchema),
      ActionRequest: fromZod(actionRequestSchema),
      RuntimeErrorRequest: fromZod(runtimeErrorRequestSchema),
      RuntimeErrorEvent: event(
        "run.error",
        object({ sequence: integer, errors: array(record) }),
      ),
      A2uiMessage: {
        ...fromZod(AgentToRendererMessageSchema),
        description:
          "Derived from the installed official SDK's public AgentToRendererMessageSchema. Catalog-specific component bindings are additionally validated by official Core. The separate raw schema endpoint returns the SDK's original specification document unmodified.",
      },
      A2uiAction: fromZod(ActionMessageSchema),
      Field: object(
        {
          key: string,
          label: string,
          type: { enum: ["text", "number", "textarea", "toggle", "select"] },
          options: array(string),
          wide: { type: "boolean" },
        },
        ["key", "label"],
        true,
      ),
      Component: object(componentProperties, componentRequired),
      ComponentDetail: object(
        { ...componentProperties, binding: string, templates: array(string) },
        [...componentRequired, "binding"],
      ),
      ComponentList: object({ components: array(ref("Component")) }),
      CatalogList: object({ catalogs: array(ref("SchemaDocument")) }),
      Template: object({
        templateId: string,
        componentKey: string,
        defaults: record,
        inputSchema: schemaDocument,
        messages: array(ref("A2uiMessage")),
        renderPolicy: { enum: ["progressive", "on_complete", "live"] },
      }),
      Instantiation: object({
        messages: array(ref("A2uiMessage")),
        renderPolicy: { enum: ["progressive", "on_complete", "live"] },
        scenario: object({
          renderPolicy: { enum: ["progressive", "on_complete", "live"] },
          readyWhen: string,
        }),
      }),
      ValidationResult: object({
        valid: { type: "boolean" },
        errors: array(record),
      }),
      Session: object(sessionProperties),
      Connection: object({
        ...sessionProperties,
        messages: array(ref("A2uiMessage")),
        eventCursor: integer,
      }),
      BatchReceipt: object(receiptProperties),
      ActionPayload: object({
        actionId: string,
        actionHandler: { enum: ["external", "mock"] },
        action: ref("A2uiAction"),
      }),
      ActionEvent: {
        ...event("ui.action", ref("ActionPayload")),
        properties: {
          ...(event("ui.action", ref("ActionPayload")).properties as Schema),
          actionSequence: { type: "integer", minimum: 1 },
        },
        required: ["id", "type", "runId", "timestamp", "payload"],
        additionalProperties: false,
      },
      ActionPage: object({
        actions: array(ref("ActionEvent")),
        cursor: string,
        runId: string,
      }),
      SessionEvent: {
        oneOf: [
          event("preview.connected", object({})),
          event(
            "messages.queued",
            object({
              ...receiptProperties,
              messages: array(ref("A2uiMessage")),
            }),
          ),
          event(
            "message.applied",
            object({ sequence: integer, errors: array(record) }),
          ),
          event("run.error", object({ sequence: integer, errors: array({}) })),
          event("ui.action", ref("ActionPayload")),
          event("run.reset", object({ config: ref("RunConfiguration") })),
          event(
            "session.destroyed",
            object(
              { reason: { enum: ["destroyed", "expired", "shutdown"] } },
              [],
              false,
            ),
          ),
        ],
      },
      PluginManifest: fromZod(manifestSchema),
      PluginCatalog: fromZod(pluginCatalogSchema),
      UploadMetadata: object({
        manifest: ref("PluginManifest"),
        catalog: ref("PluginCatalog"),
      }),
      PluginEntry: object(
        Object.fromEntries(
          Object.entries(componentProperties).filter(
            ([key]) =>
              ![
                "wireSchema",
                "inputSchema",
                "catalogSchemaUrl",
                "templateIds",
              ].includes(key),
          ),
        ),
        [
          "key",
          "name",
          "component",
          "category",
          "icon",
          "version",
          "description",
          "pluginId",
          "catalogId",
          "schema",
          "defaults",
          "fields",
          "templates",
          "bundleUrl",
          "actions",
        ],
      ),
      PluginRecord: object({
        id: string,
        buildId: string,
        manifest: ref("PluginManifest"),
        entry: ref("PluginEntry"),
        schema: schemaDocument,
        createdAt: { type: "string", format: "date-time" },
        bytes: integer,
        status: { const: "ready" },
      }),
      PluginInstallation: {
        allOf: [
          {
            ...object({
              id: string,
              buildId: string,
              manifest: ref("PluginManifest"),
              entry: ref("PluginEntry"),
              schema: schemaDocument,
              createdAt: { type: "string", format: "date-time" },
              bytes: integer,
              status: { const: "ready" },
              sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
            }),
          },
        ],
      },
      Build: object(
        {
          id: string,
          filename: string,
          status: { enum: ["validating", "building", "ready", "failed"] },
          createdAt: { type: "string", format: "date-time" },
          error: string,
        },
        ["id", "filename", "status", "createdAt"],
      ),
      PluginList: object({
        plugins: array(ref("PluginRecord")),
        builds: array(ref("Build")),
      }),
      Error: object(
        { code: string, message: string, requestId: string, details: record },
        ["code", "message", "requestId"],
      ),
    },
  },
};
