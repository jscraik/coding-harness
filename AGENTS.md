# Coding Harness - AGENTS.md

## Table of Contents
- [Project description](#project-description)
- [Mandatory workflow snippet](#mandatory-workflow-snippet)
- [Required essentials](#required-essentials)
- [Global discovery order](#global-discovery-order)
- [Command preflight](#command-preflight)
- [Always-on PR governance](#always-on-pr-governance)
- [Internal work intake routing](#internal-work-intake-routing)
- [Implementation conventions](#implementation-conventions)
- [Instruction map](#instruction-map)
- [Repository preflight helper](#repository-preflight-helper)
- [References (informational)](#references-informational)

## Project description
This repository is a TypeScript control plane for agentic development and review workflows.

## Mandatory workflow snippet
1. Explore project first, then invoke skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
3. Add a Table of Contents for docs.

## Required essentials
- Package manager: `pnpm` (`packageManager: "pnpm@10.0.0"`).
- Baseline check bundle: `pnpm check` (lint + docs:lint + typecheck + test + audit).
- Compatibility posture: canonical-only.

## Global discovery order
1. `/Users/jamiecraik/.codex/AGENTS.md`
2. `AGENTS.md`
3. `CLAUDE.md`
4. `docs/agents/00-architecture-bootstrap.md`, then task-specific `docs/agents/*.md`

## Command preflight
- Run shell commands via `zsh -lc`.
- Prefer `rg`, `fd`, `jq`.
- Confirm repo context with `pwd` and verify required binaries before mutating work.
- Ask before adding dependencies or changing system-level settings.
- Tooling/runtime changes to hooks, `Makefile`, `.mise.toml`, readiness scripts, or generated Codex environment actions should update [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md) and [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md) in the same change.

## Always-on PR governance
1. Branch from `main`; never push directly to `main`.
2. Use `codex/<linear-key>-<short-description>` branch names when tracked in Linear.
3. Open a PR for every merge into `main`.
4. Run required local gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm check`.
5. Ensure required CI checks and review artifacts (Greptile + Codex) pass before merge.
6. Verify Greptile setup via `greploop` or `check-pr` with `.greptile/config.json`, `.greptile/rules.md`, `.greptile/files.json`.
7. Greptile review must be independent (coding agent cannot self-approve).
8. Merge only after all checks/artifacts pass; then delete branch/worktree.

See [CONTRIBUTING.md](./CONTRIBUTING.md), [Agent governance](./docs/agents/07b-agent-governance.md), and [Greptile AI governance](./docs/agents/12-greptile-ai-governance.md).

## Internal work intake routing
- Linear is the default issue intake for this repository (`bugs.url` in `package.json`).
- If a reproducible bug, policy gap, workflow regression, automation follow-up, or release follow-up is found, create or update a matching Linear issue before handoff.
- Reuse existing backlog issues when possible.
- Include repro steps, expected vs actual behavior, validation evidence, and relevant doc/PR links.
- Never print token values in logs, docs, or command output.

## Implementation conventions
- Local ESM imports must include `.js` extension.
- Non-standard command set: `pnpm check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit`, `pnpm test:artifacts`.

## Instruction map
Use [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md) as the routing index.

Key docs:
- [Architecture bootstrap](./docs/agents/00-architecture-bootstrap.md)
- [Tooling policy](./docs/agents/02-tooling-policy.md)
- [Validation and checks](./docs/agents/04-validation.md)
- [Release and change control](./docs/agents/08-release-and-change-control.md)
- [Agent testing gates](./docs/agents/10-agent-testing-gates.md)
- [Security and governance](./docs/agents/06-security-and-governance.md)
- [Agent governance](./docs/agents/07b-agent-governance.md)
- [Greptile AI governance](./docs/agents/12-greptile-ai-governance.md)
- [Docs-gate rollout](./docs/agents/14-docs-gate-rollout.md)

## Repository preflight helper
- Use `scripts/codex-preflight.sh` before multi-step, destructive, or path-sensitive workflows.
- Run: `source scripts/codex-preflight.sh && preflight_repo`.

## References (informational)
- Global protocol: `/Users/jamiecraik/.codex/AGENTS.md`
- Standards baseline: `/Users/jamiecraik/.codex/instructions/standards.md`
- RVCP source of truth: `/Users/jamiecraik/.codex/instructions/rvcp-common.md`
