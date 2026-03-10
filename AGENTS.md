# Coding Harness - AGENTS.md

## Project description
This repository is a TypeScript control plane for agentic development and review workflows.

## Mandatory workflow snippet
1. Explore project first, then invoke skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
3. Add a Table of Contents for docs.

## Required essentials
- Package manager: `pnpm` (`packageManager: "pnpm@10.0.0"`, `pnpm-lock.yaml`).
- Baseline checks: `pnpm check` (lint + docs:lint + typecheck + test + audit).
- Compatibility posture: canonical-only.

## Always-on PR governance (mandatory)
1. Branch from `main` for every change.
2. Agent branch naming: `codex/<linear-key>-<short-description>` when work is tracked in Linear.
3. Never push directly to `main`.
4. Open a PR for every merge into `main`.
5. Required local gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm check`.
6. Required CI gates: `risk-policy-gate`, `dependency-review`, `actions-pinning`, `security-scan`, `docs-gate`, `Greptile Review`.
7. Required review artifacts: Greptile + Codex.
8. Greptile setup must be verified via `greploop` or `check-pr` with `.greptile/config.json`, `.greptile/rules.md`, and `.greptile/files.json` present.
9. Greptile review must be independent (coding agent cannot self-approve).
10. Merge only after all checks/artifacts pass; then delete branch/worktree.

Details: [CONTRIBUTING.md](./CONTRIBUTING.md), [Agent governance](./docs/agents/07b-agent-governance.md), [Greptile AI governance](./docs/agents/12-greptile-ai-governance.md)

## References (informational)
- Global protocol: `/Users/jamiecraik/.codex/AGENTS.md`
- Standards baseline: `/Users/jamiecraik/.codex/instructions/standards.md`
- RVCP source of truth: `/Users/jamiecraik/.codex/instructions/rvcp-common.md`

## Architecture-first bootstrap
- First read: `AI/diagrams/manifest.json`, `AI/context/diagram-context.md`.
- If stale/missing: `bash scripts/refresh-diagram-context.sh --force`.

## Tooling essentials
- Use `zsh -lc`.
- Prefer `rg`, `fd`, `jq`.
- Read `/Users/jamiecraik/.codex/instructions/tooling.md` before tool selection.
- Ask before adding dependencies or changing system-level settings.

## Internal work intake routing
- The package `bugs.url` points to the Linear project for this repository: `https://linear.app/jscraik/project/coding-harness-bb735dbbda79`.
- If an agent finds a reproducible coding-harness bug, policy gap, workflow regression, automation task, or release follow-up, it must create (or update) a **Linear issue** before handoff.
- Before creating a new Linear issue, search the project/team backlog and reuse an existing issue when it matches.
- Include minimal repro steps, expected vs actual behavior, validation evidence, and links to repo docs or PRs in the issue body.
- GitHub remains the system for branches, pull requests, CI, and merge history; it is not the default issue intake path for this repository.
- Never print token values in logs, docs, or command output.

## Global discovery order
1. `/Users/jamiecraik/.codex/AGENTS.md`
2. `AGENTS.md`
3. `CLAUDE.md`
4. `docs/agents/00-architecture-bootstrap.md`, then `docs/agents/*.md` as needed

## ESM import convention
Local imports must include `.js` extension.

```typescript
import { foo } from "./lib/foo.js";
```

## Non-standard repo commands
- Quick set: `pnpm check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit`, `pnpm test:artifacts`
- Branch protection bootstrap: `harness branch-protect --owner <owner> --repo <repo>`

## Documentation map
### Table of Contents
- [Architecture bootstrap](./docs/agents/00-architecture-bootstrap.md)
- [Instruction map](./docs/agents/01-instruction-map.md)
- [Validation and checks](./docs/agents/04-validation.md)
- [Greptile AI governance](./docs/agents/12-greptile-ai-governance.md)
- [Docs-gate rollout](./docs/agents/14-docs-gate-rollout.md)

## Repository preflight helper
- Use `scripts/codex-preflight.sh` before multi-step, destructive, or path-sensitive work.
- Run: `source scripts/codex-preflight.sh && preflight_repo`.
