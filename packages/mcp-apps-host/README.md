# MCP Apps Host

React Host and Node Gateway for MCP Apps, alongside an independent A2UI channel.

Public entry points: `@enterprise/mcp-apps-host/react`, `/protocol`, `/server`.
Use `McpAppView` with a stable `HostTransport` and a separately deployed sandbox.
`McpGateway.attach` mounts an already executed tool result without executing it again.
`installMcpRoutes` provides the reference HTTP contract. Mount it behind your authentication boundary.

Deploy `dist/mcp-sandbox.html` and `dist/mcp-sandbox.js` on a separate, credential-free origin.
The sandbox requires `/host-config.json` with exact `allowedParents` and HTTP headers from
`sandboxHeaders`. Static HTML alone is insufficient. See the repository's bilingual MCP Host guides.

Pinned official SDK: ext-apps 2.0.4, client/server 2.4.0. React 19, Node 24+.
Only Streamable HTTP, inline display, exact configured resource/network origins and opaque iframe execution.
No arbitrary endpoint URLs, browser permissions, nested apps, OAuth, or provider publication workflow.
