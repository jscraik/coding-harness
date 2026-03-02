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

## Always-on PR governance (mandatory)
For all code and docs changes in this repository:

1. Branch off `main` for every change.
2. For agent-created branches, use `codex/<short-description>`.
3. Do not push directly to `main`.
4. Open a PR for every merge into `main`.
5. Required gates before merge: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm check`, and CI `security-scan`.
6. Required review artifacts before merge: Greptile + Codex.
7. Greptile setup must be verified before merge: run the `grepfile` skill and ensure `.greptile/config.json`, `.greptile/rules.md`, and `.greptile/files.json` are present and current.
8. Greptile validation must be independent: the coding agent must not approve its own PR; use a separate review agent.
9. Merge only after all required checks and artifacts are complete.
10. After merge, delete branch/worktree.

Implementation details and checklists:
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [Agent governance](./docs/agents/07b-agent-governance.md)
- [Greptile AI governance](./docs/agents/12-greptile-ai-governance.md)

### Repo-native command map
- Install/dependencies: `pnpm install`
- Run scripts: `pnpm run <script>`
- Execute tools from deps: `pnpm exec <command>`

## References (informational)
- Global protocol: `/Users/jamiecraik/.codex/AGENTS.md`
- Standards baseline: `/Users/jamiecraik/.codex/instructions/standards.md`
- RVCP source of truth: `/Users/jamiecraik/.codex/instructions/rvcp-common.md`

## Tooling essentials
- Run shell commands with `zsh -lc`.
- Prefer `rg`, `fd`, and `jq` for search/discovery/json parsing.
- Read `/Users/jamiecraik/.codex/instructions/tooling.md` before deciding command/tooling.
- Ask before adding dependencies or changing system-level settings.

## Internal GitHub issue routing
- The package `bugs.url` points to the private repository issues page: `https://github.com/jscraik/coding-harness/issues`.
- If an agent finds a reproducible coding-harness bug, policy gap, or workflow regression, it must create (or update) a GitHub issue before handoff.
- Before creating a new issue, search open issues and reuse an existing issue when it matches.
- Include minimal repro steps, expected vs actual behavior, and validation evidence in the issue body.
- Agents may file issues directly when authenticated with `GITHUB_PERSONAL_ACCESS_TOKEN` sourced from `~/.claude.env` and/or `~/.codex/.env`.
- Compatibility note: if a tool expects `GITHUB_TOKEN`, map it from `GITHUB_PERSONAL_ACCESS_TOKEN` in the runtime environment.
- Never print token values in logs, docs, or command output.

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

```typescript
// WRONG
import { foo } from './lib/foo';

// CORRECT
import { foo } from './lib/foo.js';
```

## Non-standard repo commands

See [Tooling and command policy](./docs/agents/02-tooling-policy.md) for the full command reference.

Quick reference: `pnpm check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit`, `pnpm test:artifacts`

Branch protection bootstrap: `harness branch-protect --owner <owner> --repo <repo>` (token via `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN`)

## Documentation map
### Table of Contents
- [Instruction map](./docs/agents/01-instruction-map.md)
- [Tooling and command policy](./docs/agents/02-tooling-policy.md)
- [Local memory workflow](./docs/agents/03-local-memory.md)
- [Validation and checks](./docs/agents/04-validation.md)
- [Contradictions and cleanup](./docs/agents/05-contradictions-and-cleanup.md)
- [Security and governance](./docs/agents/06-security-and-governance.md)
- [Role governance](./docs/agents/07a-role-governance.md)
- [Agent governance](./docs/agents/07b-agent-governance.md)
- [Release and change-control checks](./docs/agents/08-release-and-change-control.md)
- [Audit trail policy](./docs/agents/09-audit-trail-policy.md)
- [Agent testing gates](./docs/agents/10-agent-testing-gates.md)
- [Flaky test artifact capture standard](./docs/agents/11-flaky-test-artifacts.md)
- [Greptile AI governance](./docs/agents/12-greptile-ai-governance.md)

## Notes
- This file is intentionally minimal. Detailed procedural guidance is in `docs/agents/*.md`.

## Flaky test artifacts
- See: [Flaky Test Artifact Capture](./docs/agents/11-flaky-test-artifacts.md)

## Repository preflight helper
- Use `scripts/codex-preflight.sh` before multi-step, destructive, or path-sensitive workflows.
- Source it with `source scripts/codex-preflight.sh` and run `preflight_repo` (or `preflight_js`, `preflight_py`, `preflight_rust`) as a guard before changing repo state.
