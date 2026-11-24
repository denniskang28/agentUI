# Themes, component appearance and Playground exports

Use matching Library and standalone Host version 0.2.0. Theme and appearance are project configuration, not additional official A2UI fields.

## Configure a convenience template

Select a component and scenario. Edit business data in Content; use Appearance to select a Surface/componentId and configure typography, colors, container or layout. Unset properties retain component defaults and inherit the theme. Each reset arrow restores inheritance; Reset component appearance clears the selected node.

Preview theme configuration controls fonts, base size, brand/status colors, backgrounds, radius and density independently of the workbench theme. Appearance and theme changes update existing instances without clearing inputs. Business content still follows the draft/render workflow.

## Configuration contract

Themes use `RunConfig.themeTokens`; node overrides use `RunConfig.componentAppearances[surfaceId][componentId]`. Explicit node values override the theme, followed by component defaults. Fonts accept system/sans/serif/mono. Component colors accept semantic names or #RRGGBB; theme colors accept #RRGGBB. Public schemas strictly validate values and reject extra fields, arbitrary CSS, selectors and remote fonts.

```ts
import { hostConfigSchema } from "@aap/agent-ui/protocol";

const config = hostConfigSchema.parse({
  runtimeMode: "sandbox", renderPolicy: "progressive", readyWhen: "/ready",
  theme: "light", locale: "en-US", actionHandler: "external",
  latency: 0, outcome: "success",
  themeTokens: { fontFamily: "system", fontSize: 16, brand: "#335577" },
  componentAppearances: {
    main: { title: { typography: "title", color: "brand", fontSize: 24 } }
  }
});
console.log(config);
```

Pass this configuration to AgentUiHost. After mounting, `client.configure({themeTokens, componentAppearances})` updates appearance. Pass `{}` to clear overrides instead of omitting the field. IDs must match real message nodes. Discovery metadata declares supported appearance properties. Text sizing affects DOM text; internal graphics retain their component-specific business configuration.

## Export Library integration

In Copy integration code, select Current draft or Current preview, then Library Inputs, Library Node or Library React. Download ui-input.json, server.ts and AgentUiExample.tsx. Messages and configuration come from the same selected snapshot. Preview exports contain messages actually sent, excluding pending playback steps.

The Node script reads release/manifest.json and ui-input.json, then writes normalized.json through the Adapter. React applies batches after connection and replays full history on reconnection. Convenience templates begin with template.create and retain subsequent real raw updates. Custom JSON/JSONL uses a2ui inputs without dropping protocol fields.

Supply a separate credential-free hostUrl and a stable onAction callback. Forward the full ActionEvent to your backend, authorize the business operation and return NormalizedBatch[]; the example applies those results. Live services retain one Adapter per run and use the next input sequence with a new batchId. The exported offline Node preprocessing script disposes at completion; live services dispose only when the run ends.

## Plugins and upgrades

Unknown and older plugins expose container appearance only. Their internal text, canvas and hardcoded colors cannot be assumed configurable. Global tokens cross both Native Preview and opaque Sandbox boundaries. Project Plugin SDK `useHostTheme()` returns `{mode, tokens}`; plugins can consume Host variables such as `--font-body` and `--color-accent`. Both example plugins consume this environment. Business risk color scales remain business configuration.

Deploy package, Host and manifest version 0.2.0 together. Old 0.1.0 Hosts are explicitly rejected. Plugin SDK protocol remains 1.0; the hook is additive and existing artifacts remain loadable. Business pages never import uploaded plugin JavaScript.

[Integration steps](library-integration.en-US.md) · [Packaging and deployment](library-deployment.en-US.md)
