# MCP Apps compatibility

2026-11-18. Scope: MCP Apps Host, Streamable HTTP, inline display. No Provider publishing, arbitrary stdio, OAuth/SSO, persistent sessions or production multi-tenant authentication.

| Dependency | Verified installed release / actual public API |
|---|---|
| @modelcontextprotocol/ext-apps | 2.0.4: App, AppBridge, PostMessageTransport, registerAppTool/registerAppResource, getToolUiResourceUri |
| @modelcontextprotocol/client | 2.4.0: Client, StreamableHTTPClientTransport, two-argument callTool(params,options); listTools/listResources automatically aggregate pages without cursor, with SDK listMaxPages=50 |
| @modelcontextprotocol/server | 2.4.0: McpServer; low-level public setRequestHandler(method,handler) receives request.params |
| @modelcontextprotocol/node | 2.1.2: NodeStreamableHTTPServerTransport, localhostHostValidation/localhostOriginValidation |
| Zod / network | 4.6.7 and undici 7.30.2 confined to MCP package |
| Existing A2UI | Core/React 0.15.0, Zod 3.25.76 unchanged; regression covers genuine surfaces, actions and uploaded artifacts |

Apps extension target: stable 2026-01-26. MCP base protocol negotiation is performed by the pinned official Client, rather than hardcoding a guessed protocol date. Newer SDK request shapes, metadata and automatic pagination were verified from installed declarations/source and real HTTP tests. The package supports its declared Host capabilities; it does not claim all MCP Apps features.

Official external App: unmodified upstream quickstart at `modelcontextprotocol/ext-apps` commit `ea3e9d0e624a20bc1c51310292f09d9b8ed17161`. Source, LICENSE and Git blob hashes are in examples/mcp/official-quickstart/provenance.json. `git hash-object` matches all three recorded sources. Build inlines its actual SDK bundle; official Server logic is retained behind a transport wrapper. Browser test reads a real ISO server time, clicks Get Server Time, and observes a different real DOM result.

Independent second App: expense approval demo built from packages/mcp-apps-host/src/demo-view.ts and demo-server.ts. Actual pending result, App-only approval call, updated DOM, ui/message, context update, locale/theme, resize and cancellation exercise the same Host with no tool-name branches in Host code. It is deterministic fictional business data. Separate SDK fixture covers pagination, unlisted blob UI, invalid MIME/HTML/permissions/size and safe text fallback.

Security policy supports self-contained text/blob HTML and explicitly allowed external resource/connect origins. UI-only URIs need not appear in resources/list. Opaque View has no browser storage, cookies, parent DOM or native mode; origin-dependent third-party Apps may require changes and are outside this policy. Exact origins only; wildcard policies, browser permissions, nested frames and custom base URI are unsupported. Both Gateway and Preview policy must allow each declared origin. No-referrer is intentional: explicit parent config and actual message origin/source bind the proxy. The inner frame cannot loosen inherited header CSP.

Package consumer: actual isolated npm installation/build and separately served Preview with public exports; production and development React behavior are tested in the Chatbot consumer workflow. Java sample uses JDK 21 HttpClient and pinned Gson 2.13.2; it calls the same HTTP contract and does not implement MCP itself. No performance/compatibility percentage is inferred from fixture counts. Raw evidence remains in ignored local directories; acceptance report records commands and outcomes.
