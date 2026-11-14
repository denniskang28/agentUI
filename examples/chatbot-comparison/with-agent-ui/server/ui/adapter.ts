import { readFile } from "node:fs/promises";
import {
  AgentUiAdapter,
  EMBED_PROTOCOL,
  type HostManifest,
} from "@enterprise/agent-ui/server";
import { actionEventSchema } from "@enterprise/agent-ui/protocol";
import type { BusinessAction, DomainEvent } from "../../shared/domain";

export const variant: string = "with-agent-ui";
const manifest = JSON.parse(
  await readFile(
    new URL("../../release/manifest.json", import.meta.url),
    "utf8",
  ),
) as HostManifest;
const basic = "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json";
type WireMessage = { version: "1.0"; [key: string]: unknown };
export class Presenter {
  private adapter: AgentUiAdapter;
  private sequence = 1;
  private rawPolicies: Record<
    string,
    Record<string, { renderPolicy: "on_complete"; readyWhen: string }>
  > = {};
  constructor(
    readonly runId: string,
    readonly mode: "template" | "raw",
  ) {
    this.adapter = new AgentUiAdapter(runId, manifest.entries);
  }
  present(event: DomainEvent): unknown {
    let inputs: unknown[];
    if (event.kind === "composition") {
      inputs = [{ type: "a2ui", messages: this.composition(event) }];
    } else {
      const template =
        event.kind === "expense"
          ? "expense.approval-form"
          : "finance.risk-heatmap";
      const entry = manifest.entries.find(
        (candidate) => candidate.key === template,
      );
      if (!entry) throw Error(`PLUGIN_NOT_INSTALLED: ${template}`);
      const create =
        event.phase === "loading" ||
        (event.kind === "risk" && event.phase === "ready");
      if (
        this.mode === "template" &&
        !(event.kind === "risk" && event.phase === "update")
      ) {
        inputs = [
          create
            ? {
                type: "template.create",
                id: event.surfaceId,
                template,
                templateVersion: entry.version,
                data: event.data,
                lifecycle: {
                  renderPolicy:
                    event.kind === "expense" ? "on_complete" : "live",
                  ready: event.kind !== "expense",
                },
              }
            : {
                type: "template.patch",
                id: event.surfaceId,
                patch: event.data,
                ...(event.phase === "ready" ? { ready: true } : {}),
              },
        ];
      } else {
        if (event.kind === "expense")
          this.rawPolicies[event.surfaceId] = {
            root: { renderPolicy: "on_complete", readyWhen: "/ready" },
          };
        const messages: WireMessage[] = create
          ? [
              {
                version: "1.0",
                createSurface: {
                  surfaceId: event.surfaceId,
                  catalogId: entry.catalogId,
                  components: [
                    {
                      id: "root",
                      component: entry.component,
                      data: { "@path": "/view" },
                    },
                  ],
                  dataModel: {
                    ready: event.kind !== "expense",
                    view: event.data,
                  },
                },
              },
            ]
          : [
              {
                version: "1.0",
                updateDataModel: {
                  surfaceId: event.surfaceId,
                  path: "/view",
                  value: event.data,
                },
              },
            ];
        if (!create && event.phase === "ready")
          messages.push({
            version: "1.0",
            updateDataModel: {
              surfaceId: event.surfaceId,
              path: "/ready",
              value: true,
            },
          });
        inputs = [{ type: "a2ui", messages }];
      }
    }
    const compiled = this.adapter.apply({
      protocol: EMBED_PROTOCOL,
      runId: this.runId,
      batchId: `batch-${this.sequence}`,
      firstSequence: this.sequence,
      inputs,
    });
    this.sequence = compiled.lastSequence + 1;
    return {
      ...compiled,
      componentPolicies: { ...compiled.componentPolicies, ...this.rawPolicies },
    };
  }
  private composition(
    event: Extract<DomainEvent, { kind: "composition" }>,
  ): WireMessage[] {
    const { surfaceId, phase } = event;
    const text = {
      id: "heading",
      component: "Text",
      text:
        phase === "update"
          ? "审批前请核对发票。 / Check invoices before approval."
          : "Agent UI composition",
    };
    if (phase === "delete")
      return [surfaceId, `${surfaceId}-detail`].map((id) => ({
        version: "1.0",
        deleteSurface: { surfaceId: id },
      }));
    const components = [
      {
        id: "root",
        component: "Column",
        children: [
          "heading",
          "update",
          "remove",
          ...(phase === "update" ? ["note"] : []),
        ],
      },
      text,
      {
        id: "update",
        component: "Button",
        child: "update_label",
        action: { event: { name: "composition.update", context: {} } },
      },
      { id: "update_label", component: "Text", text: "更新界面 / Update UI" },
      {
        id: "remove",
        component: "Button",
        child: "remove_label",
        action: { event: { name: "composition.delete", context: {} } },
      },
      { id: "remove_label", component: "Text", text: "移除界面 / Remove UI" },
      ...(phase === "update"
        ? [
            {
              id: "note",
              component: "Text",
              text: "新增组件 / Added component",
            },
          ]
        : []),
    ];
    return phase === "create"
      ? [
          {
            version: "1.0",
            createSurface: {
              surfaceId,
              catalogId: basic,
              components,
              dataModel: {},
            },
          },
          {
            version: "1.0",
            createSurface: {
              surfaceId: `${surfaceId}-detail`,
              catalogId: basic,
              components: [
                {
                  id: "root",
                  component: "Text",
                  text: "第二个 Surface / Second Surface",
                },
              ],
              dataModel: {},
            },
          },
        ]
      : [{ version: "1.0", updateComponents: { surfaceId, components } }];
  }
  action(source: unknown): BusinessAction {
    const event = actionEventSchema.parse(source);
    if (event.runId !== this.runId) throw Error("STALE_RUN");
    return event.message.action;
  }
  dispose() {
    this.adapter.dispose();
  }
}
