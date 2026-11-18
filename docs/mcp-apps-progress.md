# MCP Apps Host progress

2026-11-18: Goal active. M1 started. Baseline `pnpm typecheck` and `pnpm test` passed (18 files, 87 tests). Existing untracked deployment and architecture assets retained. Docker available. Java runtime absent; a local development JDK will be needed to execute the Java contract example. No product feature accepted yet.

Published SDK lookup: ext-apps 2.0.4, client/server 2.4.0, node transport 2.1.2. Dependencies confined to the new package with Zod 4; existing A2UI code retains Zod 3.

M1–M3 implementation checkpoint:
- Real official quickstart (upstream commit recorded in examples/mcp/official-quickstart/provenance.json) and independent expense App both run through actual AppBridge and opaque sandbox. Official source stays unmodified; build bundles dependencies.
- `pnpm exec vitest run packages/mcp-apps-host/test/gateway.test.ts`: 8 real HTTP tests passed, including pagination, blob/unlisted resources, invalid resource fallback, visibility/ownership, cancel/late result, timeout/TTL and redirects.
- `pnpm exec playwright test tests/e2e/mcp-apps.spec.ts`: 3 passed after fixes for strict SDK `_meta` normalization, HTML string replacement, and empty DELETE Content-Type. Dev API restarts caused intermediate failures; stable server rerun passed.
- `MCP_SERVERS_JSON=<controlled local demo config> pnpm chatbot:consumer`: passed clean npm ci/build and deployment outside repository; real A2UI approval/recovery and MCP App interaction/callback/coexistence; exactly one initial MCP call. Evidence artifacts/chatbot-consumer/report.json (ignored).
- `pnpm typecheck` and `pnpm test` passed after these changes. Full lint still reports the original 49 errors, all in unrelated untracked docs/architecture. Scoped checks pass.
- M4 remains active: expanded isolation/context tests, visual matrix, Java execution, final package/regression and bilingual documentation remain required. No acceptance completion claimed yet.


M4 final acceptance — 2026-11-18:
- MH01–MH15 all pass; see mcp-apps-acceptance.md for the evidence mapping and supported boundaries. The earlier checkpoint above is historical and is superseded by this final record.
- Genuine SDK HTTP tests plus existing unit checks: 97 passed. Full main browser regression: 90 passed. After the last lifecycle/standards-mode changes, all 6 MCP browser tests passed again.
- Final clean consumer installation outside the repository passed public-export/type/build verification, production dual-channel interaction, development StrictMode/remount/reload/Reset and all 18 Chatbot browser regressions. Initial MCP execution remained exactly once. Temporary child services cleaned up; pre-existing local services were preserved.
- JDK 21 compiled/executed the Java HTTP client against the actual Gateway. Bilingual guides, transport/deployment contract, SDK/provenance/limits and visual evidence are recorded.
- Final responsive language/theme/error captures were reviewed; unpainted resize frames were replaced. No mocked performance or visual similarity score is claimed.
- Build, strict typecheck and scoped lint pass. Full lint retains 49 original errors in unrelated untracked docs/architecture scripts. Original ZIP hash and private/unrelated files are preserved. No publishing or Git commit was performed.
- Goal status changed to complete on 2026-11-18 after all MH01–MH15 passed. Execution elapsed approximately 1 hour 49 minutes (Goal tool: 6547 seconds); no required work remains.


Post-acceptance startup fix — 2026-11-18:
- A duplicate mcp:dev launch collided with the development stack retained after acceptance (expense listener PID 10554). Existing stack health, /api/v1/mcp/servers, Playground and correctly parameterized sandbox requests remain healthy.
- scripts/dev.ts now probes all required ports before starting any child process. Duplicate launch exits 1 with a bilingual occupied-port list and reuse/restart instructions; it does not stop the existing stack. Verified against the actual running services; expense listener PID remained unchanged. Strict typecheck, scoped script lint and diff whitespace checks pass.
