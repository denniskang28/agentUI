# Convenience templates and full A2UI

## Choose an input format in Playground

Keep Component templates / Custom response as the content source, and select A2UI / Library templates separately under Input format. The component form and scenarios generate either official messages or genuine template.create / template.patch inputs. Library inputs pass through the Adapter before the official Runtime renders them. Custom responses can use any discovered template, multiple Surfaces and create/patch/delete operations, independently of the selected gallery component. Template JSON and custom JSON have separate drafts for each format; deliberately empty drafts are retained.

A2UI accepts official messages. Library accepts one UiInput, an input array, one UiBatch, a batch array, or JSONL with one object per line. Plain UiInput records receive generated sequential envelopes. Explicit batches must share a runId and use valid firstSequence and immutable batchId values. Select the format explicitly; runtime configuration stays separate. An exported ui-input.json contains config, intervalMs and batches: paste its batches field into the input editor and apply the accompanying configuration separately.

Validate and Render both call Playground POST /api/v1/library/compile, which validates the entire sequence using a temporary server-side Adapter and disposes it. This is a development compile endpoint, not a production business session API; it never executes uploaded scripts. Limits are 1000 inputs and 2 MB request/compiled output. Playback pauses, resumes and steps through input batches, each of which may produce several official messages. The inspector shows the actual official messages and Surface state. Existing external Agent preview sessions keep the A2UI message contract.

Library draft exports retain the inputs and batch identities; generated Node/React examples use the actual input runId. Preview exports include only executed steps. When Mock Actions add official updates, preview export preserves the actual raw messages so business results are retained. Native / Sandbox remains an independent execution isolation choice.

## Shared batch envelope

Both inputs use UiBatch: `protocol:"enterprise-agent-ui/1"`, the Adapter's runId, an immutable batchId, continuous firstSequence beginning at 1, and an inputs array. Inputs may mix command types. Each input occupies one sequence number regardless of generated message count.

JSON arrays below mean individual `adapter.apply(batch)` calls in order, not one apply call receiving an array. Use separate Adapters for `run_expense` and `run_raw`. Inputs are JSON data, not React/JS functions or plugin source.

## Templates: expense from waiting through completion

This uses the real released `expense.approval-form@1.0.0`. Prepare plugins using [Deployment](library-deployment.en-US.md), then construct the Adapter with manifest.entries. Production code should check the manifest version as in [Integration](library-integration.en-US.md); the version is pinned here for a concrete example.

The five batches create an empty waiting state, deliver full data without readiness, make the form ready, apply a successful business result, then delete it. Send batch 4 only after the service confirms approval. Batch 5 is a separate cleanup example; do not immediately remove a result the user is reading.

```json
[
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_expense",
    "batchId": "batch_1",
    "firstSequence": 1,
    "inputs": [
      {
        "type": "template.create",
        "id": "expense_001",
        "template": "expense.approval-form",
        "templateVersion": "1.0.0",
        "data": {},
        "lifecycle": {
          "renderPolicy": "on_complete",
          "ready": false
        }
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_expense",
    "batchId": "batch_2",
    "firstSequence": 2,
    "inputs": [
      {
        "type": "template.patch",
        "id": "expense_001",
        "patch": {
          "reportId": "EXP-001",
          "employee": "张三",
          "department": "销售部",
          "category": "差旅",
          "currency": "CNY",
          "amount": 3200,
          "notes": "上海客户拜访",
          "requireComment": true,
          "items": [
            {
              "date": "2026-11-10",
              "desc": "交通",
              "amount": 1200
            },
            {
              "date": "2026-11-11",
              "desc": "住宿",
              "amount": 2000
            }
          ]
        }
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_expense",
    "batchId": "batch_3",
    "firstSequence": 3,
    "inputs": [
      {
        "type": "template.patch",
        "id": "expense_001",
        "patch": {},
        "ready": true
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_expense",
    "batchId": "batch_4",
    "firstSequence": 4,
    "inputs": [
      {
        "type": "template.patch",
        "id": "expense_001",
        "patch": {
          "status": "approved",
          "resultVersion": 1
        }
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_expense",
    "batchId": "batch_5",
    "firstSequence": 5,
    "inputs": [
      {
        "type": "template.delete",
        "id": "expense_001"
      }
    ]
  }
]
```

The instance id becomes the Surface ID. Current templates generally bind root component `root` to `/view`, with readiness at `/ready`. The Adapter generates those paths; Agents supply data/patch. Compiled messages are official A2UI, not a replacement engine.

| Field | Actual meaning |
| --- | --- |
| template | ComponentEntry.key from manifest, such as expense.approval-form |
| templateVersion | Exact entry.version; no latest or automatic compatible upgrade |
| data | Component business Schema; ordinary creation merges released defaults |
| lifecycle | Platform policy; progressive and ready=true are defaults |
| lifecycle.ready:false | Deferred on_complete/live accepts partial data without business placeholder defaults |
| lifecycle.timeoutMs | Optional 100–120000ms policy timeout, not HTTP/approval timeout |
| patch | Shallow top-level merge; omission retains, arrays replace, explicit null remains subject to Schema |
| ready | Separate signal outside patch; complete data does not imply readiness |

Use on_complete for forms that must not appear partially, progressive for incremental content already conforming to Schema, and live for ongoing risk updates. ready=true or progressive triggers business Schema validation; ready=false does not bypass eventual validation.

`patch:{amount:3500}` retains employee. `patch:{items:[...]}` replaces the entire array. `patch:{detail:{summary:"new"}}` replaces detail rather than recursively preserving region. Use a raw updateDataModel JSON Pointer for a precise nested update.

Creating a template is different from regenerating its structure. The convenience path instantiates the component's full definition, not a Playground scenario templateId or arbitrary template function. Creation-time properties such as Row.count, Button.action and Text.variant do not regenerate the tree when only /view is patched. Use raw updateComponents or delete/recreate for these changes. Inspect actual component JSON/Schema to distinguish dynamic bindings from structural configuration.

live stays mounted after its first successful readiness transition, even if ready later becomes false. on_complete continues checking readiness. Policy timeout displays diagnostics without performing business work or blocking later data.

## Raw A2UI: four official commands and an interactive button

This example uses Basic Catalog without expense plugins. A Column contains Text and Button, whose event context binds reportId from the data model. Send batch 2 after the backend handles summary.confirm. Batch 3 adds a note and updates root.children; batch 4 deletes the Surface.

```json
[
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_raw",
    "batchId": "batch_1",
    "firstSequence": 1,
    "inputs": [
      {
        "type": "a2ui",
        "messages": [
          {
            "version": "1.0",
            "createSurface": {
              "surfaceId": "raw_001",
              "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
              "components": [
                {
                  "id": "root",
                  "component": "Column",
                  "children": [
                    "headline",
                    "submit"
                  ]
                },
                {
                  "id": "headline",
                  "component": "Text",
                  "text": {
                    "@path": "/headline"
                  }
                },
                {
                  "id": "submit",
                  "component": "Button",
                  "child": "submit_label",
                  "action": {
                    "event": {
                      "name": "summary.confirm",
                      "context": {
                        "reportId": {
                          "@path": "/reportId"
                        }
                      }
                    }
                  }
                },
                {
                  "id": "submit_label",
                  "component": "Text",
                  "text": "确认 / Confirm"
                }
              ],
              "dataModel": {
                "headline": "请核对 EXP-001",
                "reportId": "EXP-001"
              }
            }
          }
        ]
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_raw",
    "batchId": "batch_2",
    "firstSequence": 2,
    "inputs": [
      {
        "type": "a2ui",
        "messages": [
          {
            "version": "1.0",
            "updateDataModel": {
              "surfaceId": "raw_001",
              "path": "/headline",
              "value": "后端已收到确认"
            }
          }
        ]
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_raw",
    "batchId": "batch_3",
    "firstSequence": 3,
    "inputs": [
      {
        "type": "a2ui",
        "messages": [
          {
            "version": "1.0",
            "updateComponents": {
              "surfaceId": "raw_001",
              "components": [
                {
                  "id": "root",
                  "component": "Column",
                  "children": [
                    "headline",
                    "submit",
                    "note"
                  ]
                },
                {
                  "id": "note",
                  "component": "Text",
                  "text": "新增组件 / Added component"
                }
              ]
            }
          }
        ]
      }
    ]
  },
  {
    "protocol": "enterprise-agent-ui/1",
    "runId": "run_raw",
    "batchId": "batch_4",
    "firstSequence": 4,
    "inputs": [
      {
        "type": "a2ui",
        "messages": [
          {
            "version": "1.0",
            "deleteSurface": {
              "surfaceId": "raw_001"
            }
          }
        ]
      }
    ]
  }
]
```

Submit at the relevant business stages, not all immediately after creation. updateComponents changes structure/properties; updateDataModel changes bound data. Do not use surfaceUpdate or invent component.complete as a 1.0 command. Component IDs use compatible identifiers such as submit_label; Surface IDs have a different grammar.

Raw messages retain official fields. renderPolicy/readyWhen are platform configuration, carried in the normalized batch's componentPolicies[surfaceId][componentId], not added to official wire messages. Raw expense input therefore needs an explicit on_complete policy.

## The same expense plugin via either input

Template batch 1 describes only template/version/data/lifecycle. Raw creation requires resolving Catalog/component identity and providing bindings:

```ts
import type { HostManifest, UiInput } from "@aap/agent-ui/protocol";
function createExpenseRaw(manifest: HostManifest): UiInput {
  const entry = manifest.entries.find((item) => item.key === "expense.approval-form");
  if (!entry?.catalogId) throw new Error("EXPENSE_NOT_INSTALLED");
  return { type: "a2ui", messages: [{
    version: "1.0",
    createSurface: {
      surfaceId: "expense_001", catalogId: entry.catalogId,
      components: [{ id: "root", component: entry.component, data: { "@path": "/view" } }],
      dataModel: { ready: false, view: {} },
    },
  }] };
}
// Add a policy to the compiled batch passed to the frontend:
// componentPolicies.expense_001 = {
//   root: { renderPolicy: "on_complete", readyWhen: "/ready" }
// };
```

Next, raw updateDataModel can set `/view` to the complete expense and `/ready` to true. A result updates `/view/status` and `/view/resultVersion`. Template input uses template.patch, letting the Adapter generate equivalent wire updates and policy.

| Responsibility | Official SDK directly, without this library | Library raw input | Library template input |
| --- | --- | --- | --- |
| Tree, Catalog, bindings | Construct and connect to SDK | Construct; Adapter validates | Generate from released template |
| Data changes | Official updateDataModel | Raw updateDataModel | Compile template.patch |
| Structure / multiple Surfaces | Handle official commands | Four wire commands | Create/delete instances; raw for structural changes |
| Actions / interaction | Connect SDK callbacks, transport, lifecycle | Complete shared Action bridge | Same complete Action bridge |
| Isolation, versioning, ACK, recovery | Implement in application | Shared Host/Client | Shared Host/Client |
| Schema / version | Manage yourself | Official structure; plugin business checks also depend on component/service | Additional template version/business Schema checks |

Official SDK integration is distinct from handwritten React without A2UI. The demo baseline uses the latter; [Demo migration](library-demo-migration.en-US.md) distinguishes both.

## Mixed: template create → raw update → template patch

The risk demo creates finance.risk-heatmap@2.1.0 using a template, changes Singapore Market from 68 to 76 via raw updateDataModel, then patches drilldown detail using the template. The Adapter reads current `/view` from official Core before merging, preserving the new value.

```json
{
  "type": "a2ui",
  "messages": [{
    "version": "1.0",
    "updateDataModel": { "surfaceId": "risk_001", "path": "/view/rows/1/market", "value": 76 }
  }]
}
```

This is a UiInput fragment, requiring a valid current-run UiBatch. It assumes an existing risk_001 with Singapore in row 2. Multiple Agents share one run sequence; the Orchestrator must serialize their writes instead of each starting at 1.

## Mixing boundaries

- Raw data updates can be followed by template patches on the same template-created Surface.
- Raw changes to an existing template component definition invalidate convenience binding, including type, binding or other original properties. Later patch throws TEMPLATE_BINDING_CHANGED. Detection is deliberately conservative, not limited to paths.
- Independent nodes with distinct component IDs generally retain binding validity; the component tree still controls visibility.
- Raw deleteSurface removes template mapping. Later template.patch/delete fails until a new template.create.
- A raw-created Surface does not become a convenience instance automatically. Continue raw operations, or delete and recreate with a template.
- Raw path value:null deletes; template.patch null preserves a business null. These semantics differ.

Templates do not invent click, completion or business events. Publish an appropriate plugin or use verified official Catalog capabilities for custom inputs/validation/interaction. A template does not automatically turn arbitrary data fields into a complete form.

Continue with [Actions, results and lifecycle](library-events.en-US.md).
