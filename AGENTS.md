# Coding Harness - AGENTS.md

## Project description
This repository is a TypeScript control plane for agentic development and policy-driven review workflows.

## Mandatory workflow snippet
1. Explore project first, then invoke skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
3. Add a Table of Contents for docs.

## Required essentials
- Package manager: `pnpm` (per `packageManager: "pnpm@10.0.0"` and `pnpm-lock.yaml`).
- Required checks baseline: `pnpm check` (lint + docs:lint + typecheck + test + audit).
- Compatibility posture: canonical-only.

## References (informational)
- Global protocol: `/Users/jamiecraik/.codex/AGENTS.md`
- Standards baseline: `/Users/jamiecraik/.codex/instructions/standards.md`
- RVCP source of truth: `/Users/jamiecraik/.codex/instructions/rvcp-common.md`

## Tooling essentials
- Run shell commands with `zsh -lc`.
- Prefer `rg`, `fd`, and `jq` for search/discovery/json parsing.
- Read `/Users/jamiecraik/.codex/instructions/tooling.md` before deciding command/tooling.
- Ask before adding dependencies or changing system-level settings.

## Global discovery order
1. Read repo instructions in this order:
   - `/Users/jamiecraik/.codex/AGENTS.md`
   - `AGENTS.md`
   - `CLAUDE.md`
   - `docs/agents/*.md` (when needed)
2. Resolve conflicts by asking if they are non-obvious or blocking.
3. Make minimal, reversible changes and verify with local checks.

## ESM Import Convention
This project uses ESM. All local imports MUST include `.js` extension.

```ts
// WRONG
import { foo } from './lib/foo';

// CORRECT
import { foo } from './lib/foo.js';
```

## Non-standard repo commands
- `pnpm check` — runs `lint`, `docs:lint`, `typecheck`, `test`, and `audit`.
- `pnpm lint` — runs `biome check .`.
- `pnpm docs:lint` — runs `pnpm markdownlint`.
- `pnpm typecheck` — runs `tsc --noEmit`.
- `pnpm test` — runs `vitest run`.
- `pnpm build` — compiles TypeScript and sets executable bit on `dist/cli.js`.
- `pnpm audit` — dependency risk check.

## Documentation map
### Table of Contents
- [Instruction map](docs/agents/01-instruction-map.md)
- [Tooling and command policy](docs/agents/02-tooling-policy.md)
- [Local memory workflow](docs/agents/03-local-memory.md)
- [Validation and checks](docs/agents/04-validation.md)
- [Contradictions and cleanup](docs/agents/05-contradictions-and-cleanup.md)
- [Security and governance](docs/agents/06-security-and-governance.md)
- [Role governance](docs/agents/07a-role-governance.md)
- [Agent governance](docs/agents/07b-agent-governance.md)
- [Release and change-control checks](docs/agents/08-release-and-change-control.md)
- [Audit trail policy](docs/agents/09-audit-trail-policy.md)
- [Agent testing gates](docs/agents/10-agent-testing-gates.md)

## Notes
- This file is intentionally minimal. Detailed procedural guidance is in `docs/agents/*.md`.
