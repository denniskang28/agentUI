import {
  Catalog,
  DynamicValueSchema,
  MessageProcessor,
  basicCatalog,
  type ComponentApi,
} from "@a2ui/web_core/v1_0";
import { z } from "zod";
import Ajv from "ajv";
import { capabilityProfileSchema } from "../../protocol/src/capability";
import { builtins, instantiate } from "../../catalog/src/index";
import {
  enterpriseCatalog,
  validateMessages,
  type Message,
  type RunConfig,
} from "../../protocol/src/index";
import {
  AgentUiError,
  batchSchema,
  canonical,
  EMBED_PROTOCOL,
  HOST_VERSION,
  type UiBatch,
  type ComponentEntry,
  type HostManifest,
  type BatchReceipt,
} from "./protocol";

export { AgentUiError, EMBED_PROTOCOL, HOST_VERSION } from "./protocol";
export type {
  UiBatch,
  UiInput,
  ComponentEntry,
  HostManifest,
} from "./protocol";
type Binding = { entry: ComponentEntry; valid: boolean };
export interface CompiledBatch extends BatchReceipt {
  messages: Message[];
  componentPolicies: NonNullable<RunConfig["componentPolicies"]>;
}
export interface AdapterSnapshot {
  protocol: typeof EMBED_PROTOCOL;
  runId: string;
  batches: UiBatch[];
}
function pluginCatalogs(entries: ComponentEntry[]) {
  return entries
    .filter((e) => e.pluginId)
    .map(
      (e) =>
        new Catalog(e.catalogId!, "1.0", [
          { name: e.component, schema: z.object({ data: DynamicValueSchema }) },
        ]),
    );
}
/** Runs in a trusted server or isolated Host, not in the credentialed chat page. */
export class AgentUiAdapter {
  private bindings = new Map<string, Binding>();
  private history: Message[] = [];
  private received = new Map<
    string,
    { signature: string; result: CompiledBatch; batch: UiBatch }
  >();
  private processor: MessageProcessor;
  private policies: NonNullable<RunConfig["componentPolicies"]> = {};
  private nextSequence = 1;
  private disposed = false;
  private catalogs: Catalog<ComponentApi>[];
  private validators = new Map<string, ReturnType<Ajv["compile"]>>();
  readonly entries: ComponentEntry[];
  constructor(
    readonly runId: string,
    entries: ComponentEntry[] = builtins,
  ) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(runId))
      throw new AgentUiError("INVALID_RUN", "Invalid run ID");
    this.entries = structuredClone(entries);
    this.catalogs = pluginCatalogs(this.entries);
    this.processor = new MessageProcessor(
      [basicCatalog, enterpriseCatalog, ...this.catalogs],
      undefined,
      { version: "1.0", reportErrorsOnly: true },
    );
    const ajv = new Ajv({ strict: true, allErrors: true });
    for (const entry of this.entries)
      if (entry.schema)
        this.validators.set(entry.key, ajv.compile(entry.schema));
  }
  private validateData(entry: ComponentEntry, value: unknown) {
    if (
      entry.catalogId === enterpriseCatalog.id &&
      entry.component === "CapabilityProfile"
    ) {
      const result = capabilityProfileSchema.safeParse(value);
      if (!result.success)
        throw new AgentUiError(
          "INVALID_TEMPLATE_DATA",
          `Invalid ${entry.key} data`,
          result.error.issues,
        );
    }
    const validate = this.validators.get(entry.key);
    if (validate && !validate(value))
      throw new AgentUiError(
        "INVALID_TEMPLATE_DATA",
        `Invalid ${entry.key} data`,
        validate.errors,
      );
  }
  apply(source: unknown): CompiledBatch {
    if (this.disposed)
      throw new AgentUiError(
        "ADAPTER_DISPOSED",
        "Create a new adapter for a new run",
      );
    try {
      if (new TextEncoder().encode(JSON.stringify(source)).length > 2_000_000)
        throw new AgentUiError("BATCH_TOO_LARGE", "UI batch exceeds 2 MB");
    } catch (error) {
      if (error instanceof AgentUiError) throw error;
      throw new AgentUiError(
        "INVALID_BATCH",
        "Batch must be serializable JSON",
      );
    }
    const parsed = batchSchema.safeParse(source);
    if (!parsed.success)
      throw new AgentUiError(
        "INVALID_BATCH",
        "Invalid UI batch",
        parsed.error.issues,
      );
    const batch = parsed.data;
    if (JSON.stringify(batch).length > 2_000_000)
      throw new AgentUiError("BATCH_TOO_LARGE", "UI batch exceeds 2 MB");
    if (batch.runId !== this.runId)
      throw new AgentUiError("STALE_RUN", "Batch belongs to another run");
    const signature = canonical(batch);
    const prior = this.received.get(batch.batchId);
    if (prior) {
      if (prior.signature !== signature)
        throw new AgentUiError(
          "BATCH_CONFLICT",
          "Batch ID was reused with different content",
        );
      return structuredClone({ ...prior.result, replay: true });
    }
    if (batch.firstSequence !== this.nextSequence)
      throw new AgentUiError(
        "SEQUENCE_CONFLICT",
        `Expected input sequence ${this.nextSequence}`,
      );
    if (this.received.size >= 1000)
      throw new AgentUiError(
        "RUN_LIMIT",
        "Reset before exceeding 1000 batches",
      );
    const bindings = new Map(
      [...this.bindings].map(([key, binding]) => [key, { ...binding }]),
    );
    const policies = structuredClone(this.policies);
    const messages: Message[] = [];
    // Trial processing uses official Core state and is disposed even on rejection.
    const trial = new MessageProcessor(
      [basicCatalog, enterpriseCatalog, ...this.catalogs],
      undefined,
      { version: "1.0", reportErrorsOnly: true },
    );
    const process = (items: Message[]) => {
      const errors = trial.processMessagesWithErrors(structuredClone(items));
      if (errors.length)
        throw new AgentUiError(
          "INVALID_MESSAGES",
          "Official Core rejected UI messages",
          errors,
        );
      messages.push(...structuredClone(items));
    };
    try {
      trial.processMessagesWithErrors(structuredClone(this.history));
      for (const input of batch.inputs) {
        if (input.type === "template.create") {
          if (trial.getSurface(input.id))
            throw new AgentUiError(
              "SURFACE_EXISTS",
              `Surface ${input.id} already exists`,
            );
          const entry = this.entries.find((e) => e.key === input.template);
          if (!entry)
            throw new AgentUiError(
              "UNKNOWN_TEMPLATE",
              `Unknown template ${input.template}`,
            );
          if (entry.version !== input.templateVersion)
            throw new AgentUiError(
              "TEMPLATE_VERSION",
              `Expected template version ${entry.version}`,
            );
          const policy = input.lifecycle?.renderPolicy ?? "progressive";
          const ready = input.lifecycle?.ready ?? true;
          const values = {
            ...structuredClone(entry.defaults),
            ...structuredClone(input.data),
          };
          if (ready || policy === "progressive")
            this.validateData(entry, values);
          const initial = instantiate(
            entry,
            entry.component === "CapabilityProfile" &&
              !ready &&
              policy !== "progressive"
              ? entry.defaults
              : values,
            "full",
            input.id,
          ).messages;
          for (const message of initial) {
            const body = message.createSurface as {
              dataModel: { ready: boolean };
            };
            body.dataModel.ready = ready;
          }
          // Deferred forms must not inherit placeholder business defaults.
          if (!ready && policy !== "progressive") {
            const body = initial[0].createSurface as {
              dataModel: { view: unknown };
            };
            body.dataModel.view = structuredClone(input.data);
          }
          process(initial);
          bindings.set(input.id, { entry, valid: true });
          policies[input.id] = {
            root: {
              renderPolicy: policy,
              readyWhen: "/ready",
              ...(input.lifecycle?.timeoutMs
                ? { timeoutMs: input.lifecycle.timeoutMs }
                : {}),
            },
          };
        } else if (input.type === "template.patch") {
          const binding = bindings.get(input.id);
          if (!binding)
            throw new AgentUiError(
              "TEMPLATE_INSTANCE_MISSING",
              `No template instance ${input.id}`,
            );
          if (!binding.valid)
            throw new AgentUiError(
              "TEMPLATE_BINDING_CHANGED",
              "Raw structure changed template bindings; use raw messages or recreate the instance",
            );
          const surface = trial.getSurface(input.id);
          if (!surface)
            throw new AgentUiError(
              "TEMPLATE_INSTANCE_MISSING",
              `Surface ${input.id} was deleted`,
            );
          const old =
            surface.dataModel.get<Record<string, unknown>>("/view") ?? {};
          const merged = {
            ...structuredClone(old),
            ...structuredClone(input.patch),
          };
          const ready = input.ready ?? surface.dataModel.get("/ready");
          if (ready || policies[input.id]?.root?.renderPolicy === "progressive")
            this.validateData(binding.entry, merged);
          // Official v1.0 treats a path value of null as deletion. A shallow
          // object replacement preserves an explicit null inside business data.
          const updates: Message[] = Object.values(input.patch).includes(null)
            ? [
                {
                  version: "1.0",
                  updateDataModel: {
                    surfaceId: input.id,
                    path: "/view",
                    value: merged,
                  },
                },
              ]
            : Object.entries(input.patch).map(([key, value]) => ({
                version: "1.0",
                updateDataModel: {
                  surfaceId: input.id,
                  path: `/view/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`,
                  value,
                },
              }));
          if (input.ready !== undefined)
            updates.push({
              version: "1.0",
              updateDataModel: {
                surfaceId: input.id,
                path: "/ready",
                value: input.ready,
              },
            });
          process(updates);
        } else if (input.type === "template.delete") {
          if (!bindings.has(input.id))
            throw new AgentUiError(
              "TEMPLATE_INSTANCE_MISSING",
              `No template instance ${input.id}`,
            );
          process([{ version: "1.0", deleteSurface: { surfaceId: input.id } }]);
          bindings.delete(input.id);
          delete policies[input.id];
        } else {
          process(input.messages as Message[]);
          for (const message of input.messages) {
            const deletion = message.deleteSurface as
              { surfaceId: string } | undefined;
            if (deletion) {
              bindings.delete(deletion.surfaceId);
              delete policies[deletion.surfaceId];
            }
            const structural = (message.updateComponents ??
              message.createSurface) as
              | { surfaceId: string; components?: Record<string, unknown>[] }
              | undefined;
            if (!structural) continue;
            const binding = bindings.get(structural.surfaceId);
            if (!binding) continue;
            const expected = instantiate(binding.entry).messages[0]
              .createSurface as { components: Record<string, unknown>[] };
            for (const node of structural.components ?? []) {
              const original = expected.components.find(
                (c) => c.id === node.id,
              );
              if (original && canonical(original) !== canonical(node))
                binding.valid = false;
            }
          }
        }
      }
      if (this.history.length + messages.length > 5000)
        throw new AgentUiError(
          "RUN_LIMIT",
          "Reset before exceeding 5000 messages",
        );
      const errors = this.processor.processMessagesWithErrors(
        structuredClone(messages),
      );
      if (errors.length)
        throw new AgentUiError(
          "CORE_APPLY_ERROR",
          "Core commit failed",
          errors,
        );
      this.bindings = bindings;
      this.policies = policies;
      this.history.push(...structuredClone(messages));
      const result: CompiledBatch = {
        batchId: batch.batchId,
        runId: this.runId,
        firstSequence: batch.firstSequence,
        lastSequence: batch.firstSequence + batch.inputs.length - 1,
        messageCount: messages.length,
        messages,
        componentPolicies: structuredClone(policies),
        replay: false,
      };
      this.nextSequence = result.lastSequence + 1;
      this.received.set(batch.batchId, {
        signature,
        result: structuredClone(result),
        batch: structuredClone(batch),
      });
      return result;
    } finally {
      trial.dispose();
    }
  }
  getSurfaceData(surfaceId: string): unknown {
    return structuredClone(
      this.processor.getSurface(surfaceId)?.dataModel.get("/"),
    );
  }
  snapshot(): AdapterSnapshot {
    return {
      protocol: EMBED_PROTOCOL,
      runId: this.runId,
      batches: [...this.received.values()].map((e) => structuredClone(e.batch)),
    };
  }
  dispose() {
    this.disposed = true;
    this.processor.dispose();
    this.bindings.clear();
    this.history = [];
    this.received.clear();
    this.policies = {};
  }
}
export function createHostManifest(
  entries: ComponentEntry[] = builtins,
): HostManifest {
  return {
    protocol: EMBED_PROTOCOL,
    hostVersion: HOST_VERSION,
    sdkVersion: "0.15.0",
    pluginSdkVersion: "1.0",
    entries: structuredClone(entries),
  };
}
export { builtins, instantiate, validateMessages };
