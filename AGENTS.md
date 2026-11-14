# Agent UI engineering instructions

Read `docs/GOAL_EXECUTION_SPEC.md`, the Handoff, Agent API design and UI review. Follow M1–M4 continuously. Use TypeScript strict and public package exports; do not invent A2UI SDK APIs.

## Boundaries
- Main app: trusted editor and tools only. Never import uploaded JavaScript here.
- Preview: `http://127.0.0.1:4173`, separate from main `http://localhost:5173`; no credentials. Native runs in preview, Sandbox in a nested opaque-origin iframe.
- Builder: Docker with network disabled, non-root, read-only root and CPU/memory/time/output limits. Do not run user scripts or arbitrary package installs. Fail closed if Docker is unavailable.
- Official Core owns Surface/Data Model. Playground owns configuration/playback/debug UI.
- Preserve docs/ui original ZIP. `.reference` is an extracted reference, not application source. Never edit reference to improve comparisons.

## Commands
`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm builder:image`, `pnpm reference`.

## Verification
Use genuine SDK, artifacts, DOM, Action and API tests. Compare reference and implementation at fixed sizes and data. Never report mocked performance or unsupported metrics as measured. Record progress, compatibility, decisions, acceptance and visual evidence in docs. Do not mark the Goal complete with required work remaining.
