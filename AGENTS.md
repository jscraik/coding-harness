# Coding Harness - AGENTS.md

## Table of Contents
- [Project Description](#project-description)
- [Mandatory Workflow Snippet](#mandatory-workflow-snippet)
- [Required Essentials](#required-essentials)
- [Codex Discovery Order](#codex-discovery-order)
- [Command Preflight](#command-preflight)
- [Fresh Worktree Bootstrap](#fresh-worktree-bootstrap)
- [Repo Workflow](#repo-workflow)
- [Instruction Routing](#instruction-routing)
- [Memory Layer](#memory-layer)
- [Implementation Conventions](#implementation-conventions)
- [References](#references)

## Project Description
This repository is a TypeScript control plane for agentic development and review workflows.

## Mandatory Workflow Snippet
1. Explore project first, then invoke skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
3. Add a Table of Contents for docs.

## Required Essentials
- Package manager: `pnpm` (`packageManager: "pnpm@10.0.0"`).
- Baseline aggregate gate: `pnpm check`.
- Compatibility posture: canonical-only.
- Treat repo evidence (`package.json`, lockfiles, tsconfig, scripts) as authoritative over copied instructions.

## Codex Discovery Order
1. `/Users/jamiecraik/.codex/AGENTS.md`
2. This root `AGENTS.md`
3. Any deeper scoped `AGENTS.md` or `AGENTS.override.md`

Notes:
- `docs/agents/*.md` are progressive-disclosure references, not auto-discovered instruction files.
- `CLAUDE.md` is a mirrored tool-specific surface in this repo, not part of Codex's default project-doc discovery unless fallback filenames are explicitly configured.
- If instruction precedence is unclear, stop and resolve it before editing behavior.

## Command Preflight
- Run shell commands with `zsh -lc`.
- Prefer `rg`, `fd`, and `jq`.
- Before mutating work, confirm `pwd`, repo root, required binaries, and target paths.
- For this repo, verify `docs/agents/` and `scripts/` for path-sensitive work.
- Run `./scripts/codex-preflight.sh --stack auto --mode required` before multi-step, destructive, or path-sensitive workflows.
- Use `./scripts/verify-work.sh` as the canonical repo-local verification entrypoint; keep `scripts/codex-preflight.sh` as the lower-level bootstrap gate beneath it.
- Ask before adding dependencies or changing system-level settings.

## Fresh Worktree Bootstrap
- Before the first push from a newly created git worktree, run `bash scripts/prepare-worktree.sh` (or `make worktree-ready`).
- Reason: local pre-push hooks execute in the current worktree, and fresh worktrees often do not have `node_modules/` yet.
- After bootstrap, run `bash scripts/verify-work.sh --fast` before pushing.

## Repo Workflow
- Branch from `main`; never push directly to `main`.
- Use `codex/<linear-key>-<short-description>` when the work is tracked in Linear.
- Open a PR for every merge to `main`.
- **PR description linking:** use `Refs JSC-N` while the issue is still in review; use `Closes JSC-N` only when the merge fully completes the issue.
- Run the smallest focused validation first, then `pnpm check` before handoff when behavior changed.
- CodeRabbit review must remain independent; the coding agent cannot self-approve.
- If you touch tooling/runtime contract surfaces such as hooks, `Makefile`, `.mise.toml`, readiness scripts, or generated Codex environment actions, update [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md) and [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md) in the same change.
- If you find a reproducible bug, policy gap, workflow regression, automation follow-up, or release follow-up, create or update the matching Linear issue before handoff.
- See [docs/agents/18-github-linear-automation.md](./docs/agents/18-github-linear-automation.md) for the full GitHub → Linear automation config and known gaps.

## Instruction Routing
Start with [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md), then open only the docs that match the task:

- Architecture or cross-command changes: [docs/agents/00-architecture-bootstrap.md](./docs/agents/00-architecture-bootstrap.md)
- Tooling, shells, command contract, or private package setup: [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md)
- Local learnings and durable memory workflow: [docs/agents/03-local-memory.md](./docs/agents/03-local-memory.md)
- Validation planning and gate expectations: [docs/agents/04-validation.md](./docs/agents/04-validation.md)
- Contradictions or stale guidance cleanup: [docs/agents/05-contradictions-and-cleanup.md](./docs/agents/05-contradictions-and-cleanup.md)
- Security, secrets, auth, or governance-sensitive changes: [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md)
- Role and accountability governance: [docs/agents/07a-role-governance.md](./docs/agents/07a-role-governance.md) + [docs/agents/07b-agent-governance.md](./docs/agents/07b-agent-governance.md)
- Release, rollback, or process control changes: [docs/agents/08-release-and-change-control.md](./docs/agents/08-release-and-change-control.md)
- Auditability requirements: [docs/agents/09-audit-trail-policy.md](./docs/agents/09-audit-trail-policy.md)
- Agent test policy and rollout gates: [docs/agents/10-agent-testing-gates.md](./docs/agents/10-agent-testing-gates.md)
- Flaky test artifacts and evidence capture: [docs/agents/11-flaky-test-artifacts.md](./docs/agents/11-flaky-test-artifacts.md)
- AI review workflow (CodeRabbit primary, Greptile legacy bridge): [docs/agents/12-greptile-ai-governance.md](./docs/agents/12-greptile-ai-governance.md)
- Linear-first work intake: [docs/agents/13-linear-production-workflow.md](./docs/agents/13-linear-production-workflow.md)
- Docs-gate rollout and promotion: [docs/agents/14-docs-gate-rollout.md](./docs/agents/14-docs-gate-rollout.md)
- Context integrity (agent-optimized): [docs/agents/15-context-integrity-compact.md](./docs/agents/15-context-integrity-compact.md)
- Linear workflow (agent-optimized): [docs/agents/16-linear-production-compact.md](./docs/agents/16-linear-production-compact.md)
- GitHub → Linear automation config: [docs/agents/18-github-linear-automation.md](./docs/agents/18-github-linear-automation.md)
- Linear templates, saved views, and blocked-routing: [docs/agents/19-linear-templates.md](./docs/agents/19-linear-templates.md)
- Symphony workflow definition: [WORKFLOW.md](./WORKFLOW.md)

## Memory Layer
- Read `~/.codex/instructions/Learnings.md` at session start.
- If `.harness/memory/LEARNINGS.md` exists, read it; if it is missing, bootstrap it per [docs/agents/03-local-memory.md](./docs/agents/03-local-memory.md).
- Repo-specific fixes belong in `.harness/memory/LEARNINGS.md`; universal fixes belong in `~/.codex/instructions/Learnings.md`.

## Implementation Conventions
- Local ESM imports must include `.js` extensions.
- This repo publishes a harness skill to downstream repos via `harness init`. The installed skill lands in the target repo's `.agents/skills/coding-harness/` — it is not a local skill directory for this repo.
- Use repo scripts as the command contract: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm build`, `pnpm check`, and `pnpm test:artifacts`.
- Canonical repo-local verification entrypoint: `bash scripts/verify-work.sh` (`--fast` for preflight + lint + typecheck + focused tests).
- Node `>=24.0.0` required (see `engines` in `package.json`).
- Linter/formatter: Biome (`biome.json`). Run with `pnpm lint` / `pnpm fmt`.
- Git hooks: `simple-git-hooks` wired through `Makefile` targets (`hooks-pre-commit`, `hooks-pre-push`).
- Toolchain: pinned in `.mise.toml`. Run `mise trust` before first use.
- First-time setup: `make setup` (installs deps + configures git hooks).

## References
- [Instruction map](./docs/agents/01-instruction-map.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CLAUDE.md](./CLAUDE.md)
- `/Users/jamiecraik/.codex/AGENTS.md`
- `/Users/jamiecraik/.codex/instructions/standards.md`
- `/Users/jamiecraik/.codex/instructions/rvcp-common.md`
