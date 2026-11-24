# MCP Apps Host integration

Version: `@enterprise/mcp-apps-host@0.1.0`, React 19, Node 24+, strict TypeScript. A2UI remains a separate channel using `@aap/agent-ui`. MCP HTML is never converted into A2UI or passed to its MessageProcessor. The MCP package pins ext-apps 2.0.4, Client/Server 2.4.0, Node Transport 2.1.2 and Zod 4; existing A2UI 0.15.0 and Zod 3 remain unchanged.

## Quickstart and public package

```sh
pnpm install --frozen-lockfile
pnpm mcp:dev
# Main: http://localhost:5173 → MCP Apps
# Credential-free preview: http://127.0.0.1:4173
# Controlled demo MCP endpoints: 127.0.0.1:3002 and 3003; negative-protocol fixture: 3004
pnpm mcp:build
```

If the development stack is already running, open the URL directly. A duplicate launch lists occupied ports and exits before spawning children. To restart, press Ctrl+C in the original terminal first. Do not run two `mcp:dev` instances or combine it with `pnpm dev` / `mcp:demo` on the same ports.

Install `artifacts/packages/enterprise-mcp-apps-host-0.1.0.tgz`. Public entry points are `/react`, `/protocol` and `/server`. The first two work in browsers; `/server` is Node only. The sandbox assets are `dist/mcp-sandbox.html` and `dist/mcp-sandbox.js` inside the installed package. They require a separate origin and the HTTP policy described below. Do not import App HTML or JavaScript into the trusted main application.

`pnpm chatbot:prepare` creates the combined A2UI/MCP release. In `examples/chatbot-comparison/with-agent-ui`, run `npm ci && npm run build`, configure `MCP_SERVERS_JSON`, then `npm run deploy`. Click **MCP App** in the Chatbot. A2UI cards continue working independently. The example orchestrator is deterministic; it does not pretend to run an LLM. The integration consumes actual tarballs and a static Preview independently of Playground and Builder.

## React and replaceable transport

```tsx
import {McpAppView, httpTransport} from '@enterprise/mcp-apps-host/react';
const transport = useMemo(() => httpTransport('/api/mcp', connection, appId),
  [connection.id, connection.ownerToken, appId]);
return <McpAppView transport={transport}
  sandboxUrl="https://preview.example.net/mcp-sandbox.html"
  locale="en-US" theme="light"
  onMessage={message => sendToOrchestrator(message)}
  onContextUpdate={context => updateOrchestratorContext(context)} />;
```

Keep transport identity stable. Mounting reads a snapshot and never executes the initial tool. Theme/locale changes notify official Host Context without creating another business call. Third-party business text is not translated by the Host. A custom `HostTransport` may replace HTTP using the public snapshot/callTool/readResource/events(after)/destroy contract, with AbortSignal support.

The View closes its bridge and listeners on detach. Business orchestration owns the instance: destroy it when closing a card, resetting or ending a conversation; disconnect closes all instances. StrictMode effect replay does not execute tools or permanently destroy the shared instance. `McpAppsPanel` is an optional bilingual developer workbench. Its message/context callbacks record diagnostics; production applications should connect `McpAppView` callbacks to their orchestrator. The Chatbot example routes messages to its deterministic orchestrator and stores context in its current session.

Only inline display is supported. Browser permissions, nested Apps, custom base URI and other display modes are unsupported. Links are declared only with an explicit `onOpenLink` callback: the Host checks HTTP(S), and the business callback must enforce its target policy. Unsupported capabilities are not advertised.

## Node orchestration and existing tool results

```ts
import {installMcpRoutes} from '@enterprise/mcp-apps-host/server';
const gateway = await installMcpRoutes(fastify, [{
 id:'reports',name:'Reports',url:'https://mcp.example.net/mcp',
 allowedTools:['report','approve'],headers:{Authorization:process.env.MCP_AUTH!},
 resourceDomains:['https://static.example.net'],connectDomains:[]
}], '/api/mcp');
const c = await gateway.connect('reports');
const result = await gateway.callForHost(c.id,c.ownerToken,
 {name:'report',arguments:{id:'R-1'}});
const app = await gateway.attach(c.id,c.ownerToken,
 {runId:'run-1',requestId:'call-1',tool:'report',arguments:{id:'R-1'}},result);
```

Alternatively `create` (HTTP `/apps`) executes the initial tool. Choose one path: never execute the tool and then call create to display its result. `attach` is trusted backend API only; there is no browser attach endpoint. The orchestrator must establish that the result belongs to that call and connection. No automatic retries for side effects. App calls remain bound to the same server connection.

Server addresses, credentials and policy come from trusted backend configuration. Only configured server IDs are accepted from the browser. The connection `ownerToken` is a browser business-channel capability, not an MCP Server credential; it never goes to Preview. Place routes behind your authentication, per-user ownership, CSRF/Origin and rate controls. The local capability-token reference does not implement production multi-tenancy, OAuth/SSO, durable sessions or arbitrary stdio execution.

## Language-neutral HTTP and event contract

All bodies are JSON. Failures return `{code,message}` with HTTP errors; asynchronous initial tool failures appear in snapshot status/error. Ordinary tools and resource failures retain a text result. Apart from servers/list and connection creation, all endpoints require `x-mcp-owner`.

| Method/path relative to /api/mcp | Contract |
|---|---|
| GET /servers | `{id,name}[]`; no endpoint addresses or credentials |
| POST /connections | `{serverId}` → `{id,serverId,ownerToken,tools}` |
| GET /connections/:c | Connection description |
| DELETE /connections/:c | Disconnect and release every instance |
| POST /connections/:c/apps | `{runId,requestId,tool,arguments:{}}` → AppSnapshot |
| GET /connections/:c/apps/:a | Current snapshot |
| DELETE /connections/:c/apps/:a | Destroy instance |
| POST …/:a/tool-calls | `{name,arguments?}` → official CallToolResult |
| POST …/:a/resource-reads | `{uri}` → official ReadResourceResult |
| POST …/:a/cancel | `{}` → `{cancelled:true}` |
| GET …/:a/events?after=N | Ordered per-instance GatewayEvent[] |

Snapshot includes id, serverConnectionId, runId, toolCallId, tool, input, status and optional result/error/resource/resourceError. Resource contains uri, html and effective CSP. Initial status transitions are running → complete/error/cancelled. App-triggered later calls return their own response and `app.tool.result` event; they do not overwrite the initial result.

Events contain `{id,type,appInstanceId,runId,at,payload}`. Start at after=0, then use the greatest returned ID. The window holds 500 events per instance. Expired cursors return 410 EVENT_CURSOR_EXPIRED: recover the snapshot and explicitly rebind/create a new instance as appropriate; do not replay tools/call from logs. Invalid/future cursors return 400. Snapshot reads and mounting have no business side effects. Tool result `_meta` may reach the App but must not automatically enter model context.

The same create requestId and complete request data return the same instance; changed data return 409 REQUEST_CONFLICT. Keys remain until disconnect. Destroyed instance IDs cannot be read. Cancellation drops late results but does not roll back an already completed operation. Connection loss produces transport errors/timeouts; reconnect is explicit. This reference has no cross-process persistence: after restart stale connections return 404.

Default limits: 1-hour hard connection TTL, 50 connections, 100 create request IDs per connection, approximately 2 MB request/response/resource boundaries, one concurrent tool per instance, two concurrent resource reads, 15-second tool timeout, 10-second proxy/App initialization deadline and 500-ms teardown wait. Use server-side admission/rate controls for production.

Java may call this HTTP contract or implement the same contract while owning a Java MCP Client. React needs no Node A2UI template translation service for raw A2UI. This repository ships a Node Gateway and executable Java HTTP client, not a Java Gateway or Java SDK. See [the Java example](../../examples/mcp/java/README.md).

## Separate Preview deployment

Use a different origin, with no business cookies or auth headers. Both origins should use HTTPS in production. Public static artifacts must contain no secrets. The inner View has only allow-scripts and an opaque origin; external Apps have no Native execution switch.

Serve `/mcp-sandbox.html`, `/mcp-sandbox.js`, and `/host-config.json` containing exact allowedParents. Generate HTML response headers with the public `sandboxHeaders(new URL(request.url,origin),allowedParents,allowedExternalOrigins)`; reject failures with 403. This sets CSP, no-referrer, Permissions-Policy, nosniff and no-store. Query parentOrigin must match exactly. Query CSP may narrow the deployment policy and cannot add allowed domains. Copying HTML into an ordinary static folder without these headers is insufficient.

`scripts/serve-embedded-host.ts` is the complete reference; chatbot:prepare exports it as a standalone static server. A2UI pages retain a separate policy. Resource `_meta.ui.csp` intersects the Gateway resourceDomains/connectDomains allowlists; Preview further restricts it through MCP_RESOURCE_ORIGINS. Exact origins only: no wildcards, nested frames, custom base URI or browser permissions. The View cannot loosen inherited HTTP CSP through its HTML meta tags. Unlisted UI-only resource URIs work without being present in resources/list. Single text/blob complete HTML documents are supported only with matching ui:// URI and text/html;profile=mcp-app MIME. Invalid/oversized UI preserves ordinary results.

Opaque policy excludes Apps depending on localStorage, cookies or direct parent DOM access. Explicit parent configuration plus message origin/source validation establish the binding without relying on document.referrer. Remote server endpoints require HTTPS and public addresses; approved DNS resolution is pinned for the connection and redirects are rejected. Local demo connections require explicit allowLocal. Never accept untrusted endpoint/policy configuration. Existing plugin Docker and original reference ZIP constraints remain in force.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm mcp:dev
# Another terminal:
pnpm exec playwright test tests/e2e/mcp-apps.spec.ts tests/e2e/mcp-isolation.spec.ts
pnpm chatbot:prepare
MCP_SERVERS_JSON='[{"id":"expense-demo","name":"Expense","url":"http://127.0.0.1:3002/mcp","allowLocal":true,"allowedTools":["expense_dashboard","approve_expense"]}]' pnpm chatbot:consumer
MCP_JAVA_HOME=/path/to/jdk21 pnpm mcp:java
```

Official source/license/provenance is in examples/mcp/official-quickstart. Demo servers are test inputs, not a provider publication product. See the acceptance and compatibility records for measured results and policy limits.
