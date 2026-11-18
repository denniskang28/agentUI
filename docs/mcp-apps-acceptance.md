# MCP Apps Host acceptance / 验收

2026-11-18. M1–M4 implemented and all MH01–MH15 accepted. Final independent-consumer regression passed; Goal closure is recorded in the progress log. Evidence is from actual SDK/HTTP/DOM execution, not mocked AppBridge, simulated performance or screenshot counts alone.

| ID | Result | Evidence |
|---|---|---|
| MH01 | Pass | Pinned official Client negotiates Apps capability; real tools/resource discovery and paginated SDK fixture return all five definitions. SDK aggregation uses listMaxPages=50. |
| MH02 | Pass | Real SDK Server serves unlisted blob HTML; matching URI/MIME, byte limits, invalid HTML/MIME/permissions and text fallback tested in packages/mcp-apps-host/test/gateway.test.ts. |
| MH03 | Pass | Official AppBridge/transport; browser reads `input,result` delivery order from actual App; early completed result survives mounting; official quickstart initializes and updates its DOM. |
| MH04 | Pass | Actual expense approval click → App-only tool → approved DOM; plain tool displays text; separate negative Server verifies invalid MIME and initialization timeout both retain real text and close. |
| MH05 | Pass | Main app never imports App code; trusted separate Preview + opaque View; actual parent DOM access denied, no server credentials in Preview; existing plugin boundary regressions pass. |
| MH06 | Pass | CSP allowed resource script/connect origin works, undeclared fetch denied; exact parent header rejects; authorized parent forwarding positive control and same-origin wrong-window spoof denial; wrong owner/connection/resource/tool visibility/payload/redirect tests. |
| MH07 | Pass | Actual cancel + close + late-result rejection, timeout, hard TTL, disposed-while-connecting, cursor-window recovery, instance isolation; consumer development StrictMode/remount/reload/Reset proves one initial execution and removes old iframe. |
| MH08 | Pass | Real App observes locale/theme changes, resizes after content growth, sends ui/message and model context; platform controls remain bilingual; only inline and declared callbacks advertised. |
| MH09 | Pass | Playground configured Server/tool selection, JSON validation, preview, input/result, semantic tool events and UI callback records, cancel/close/disconnect; fixed desktop/mobile language/theme/error captures. |
| MH10 | Pass | Actual tarball installed by clean offline npm ci outside repo; TypeScript build and Node public exports work; React runs against independently served Preview and /api/mcp transport, with no Playground process dependency. |
| MH11 | Pass | Isolated Chatbot keeps real A2UI approval and MCP App together, performs actual approval/message routing and theme/locale changes; trusted callForHost + attach executes initial MCP tool exactly once, also across StrictMode and reload. |
| MH12 | Pass | Unmodified upstream Get Time App (commit/blob provenance) and independently authored expense App exercise the same Host without tool/component branches. Negative protocol Server is separate from compatibility inputs. |
| MH13 | Pass | Main suite 90/90, unit/integration 97/97 and all 18 Chatbot regression tests passed. Chatbot tests run against freshly installed artifacts outside the repository, including original modes and recovery. |
| MH14 | Pass | Bilingual Host guides, public transport/types, full route/event/recovery/deployment contract, generated separate static server/assets, Java HttpClient/Gson source compiled and executed with JDK 21. |
| MH15 | Pass | Version/provenance, commands, boundaries, visual review and private-material preservation recorded. Final consumer report passed, including production/development flows and process cleanup. No required acceptance item remains. |

## Actual commands and outputs

- `pnpm install --frozen-lockfile --ignore-scripts`: passed.
- `pnpm typecheck`: passed (strict TypeScript).
- `pnpm test`: 19 files, 97 tests passed. Includes 10 real MCP HTTP tests and existing 87 checks. Test script builds genuine package/demo artifacts first, so a clean checkout does not depend on historical dist files.
- `NO_PROXY=localhost,127.0.0.1,::1 no_proxy=localhost,127.0.0.1,::1 pnpm test:e2e`: 90 passed. Earlier Python urllib runs used the system proxy for localhost and failed; local bypass resolved all five Python cases without changing the examples.
- After final lifecycle/standards-mode changes, `pnpm exec playwright test tests/e2e/mcp-apps.spec.ts tests/e2e/mcp-isolation.spec.ts`: 6 passed, including real initialization deadline and standards-mode/CSP behavior.
- `pnpm build`, `pnpm mcp:build`, `pnpm chatbot:prepare`: passed. Vite warns about existing large chunks; no fabricated bundle/performance thresholds are reported as measured.
- `MCP_SERVERS_JSON=<controlled local expense config> pnpm chatbot:consumer`: passed. Clean outside-repository npm installation, public exports and production browser flow passed; development StrictMode/remount/reload/Reset executed the initial tool once. All 18 Chatbot browser regression tests passed on fresh services. Final report: `artifacts/chatbot-consumer/report.json`, generated 2026-11-18T10:45:12Z, `passed: true`; all child-process cleanup passed.
- `pnpm chatbot:compare`: 11 unchanged files, 11 intentional integration differences, no unexpected differences. Existing agents and business service sources remain unchanged.
- `MCP_JAVA_HOME=<local JDK 21> pnpm mcp:java`: compiled and executed against the actual Gateway; discovered servers, executed tool, read result/events, destroyed instance and disconnected. Gson 2.13.2 SHA-256 is pinned in the runner. This is an HTTP client, not a Java Gateway/SDK.
- `pnpm lint`: original 49 errors in unrelated untracked docs/architecture generation scripts. `pnpm exec eslint . --ignore-pattern 'docs/architecture/**'`: passes. The latter is a scoped result and is not represented as a clean full-repository lint.

## Evidence and reproducibility

Local ignored evidence: `.private/evidence/mcp-apps/` (screenshots, matrix geometry, Java output); `.private/mcp-*.log` (commands); `artifacts/chatbot-consumer/report.json` (clean installation, public exports, production/development browser flows, complete Chatbot regression and child-process cleanup). Browser source assertions are checked in under tests/e2e; real HTTP tests under packages/mcp-apps-host/test. Capture script: `pnpm mcp:visual` with mcp:dev running.

The first additional Chatbot run targeted pre-existing long-lived local services. Their baseline artifact had a deployment subpath; its generated build was preserved while testing a local-root build, then restored. Repeated runs exhausted the old service's 100-session cap. No existing process/session was reset. Tests now accept DEMO_TEST_BASELINE_ORIGIN / DEMO_TEST_INTEGRATED_ORIGIN / DEMO_TEST_HOST_ORIGIN and run in the isolated consumer on fresh ports 5280/5281/4283 (development StrictMode on 5282). Defaults remain the original 5180/5181/4183. This tests current installed artifacts without touching old services.

Visual review uses 1440×900, 1280×800 and 375×812, zh-CN/en-US, light/dark, plus invalid JSON and narrow App states. Fixed fictional data is shared across captures. The new page has no original ZIP counterpart; existing tokens/control styles and local scrolling are reused. Dark form contrast and narrow navigation fit were corrected. Screenshots wait for actual DOM/paint after resizing; discarded unfinished paints are not acceptance evidence. No similarity percentage is claimed.

Original ZIP SHA-256 remains `7b1e5d5f71577e61a8b947dd05903c75da318761a45f48d047af3eb2d78a6b5a`. `.reference`, untracked docs/architecture, artifacts/aliyun-20261116 and docs/deployment-aliyun.md were not edited or staged. Raw logs, local JDK/dependencies and deployment backups remain ignored.

## Supported boundary

Controlled Streamable HTTP endpoints, inline Apps, opaque View, exact declared-and-approved resource/connect origins, and explicit business callbacks. No arbitrary stdio/endpoint proxy, OAuth/SSO, provider publication, production multi-tenancy or durable sessions. Ordinary fallback renders text; other result blocks remain inspectable in the workbench result JSON. Cookie/storage/parent-DOM dependent Apps are outside the opaque policy. Production authentication/connection ownership and link target policy belong to the business host. No private deployment or external publishing was performed.
