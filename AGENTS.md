---
schema_version: 1
---

# Coding Harness - AGENTS.md

## Table of Contents
- [Project Description](#project-description)
- [Mandatory Workflow Snippet](#mandatory-workflow-snippet)
- [Required Essentials](#required-essentials)
- [Harness CLI for Agents](#harness-cli-for-agents)
- [Codex Discovery Order](#codex-discovery-order)
- [Startup Workflow](#startup-workflow)
- [Command Preflight](#command-preflight)
- [Fresh Worktree Bootstrap](#fresh-worktree-bootstrap)
- [Quality Checks](#quality-checks)
- [Repo Workflow](#repo-workflow)
- [Instruction Routing](#instruction-routing)
- [Memory Layer](#memory-layer)
- [Project Brain](#project-brain)
- [Implementation Conventions](#implementation-conventions)
- [References](#references)

## Project Description
This repository is a TypeScript control plane for agentic development and review workflows.

## Mandatory Workflow Snippet
1. Explore project first, then invoke skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
3. Read the repo-root [CODESTYLE.md](./CODESTYLE.md) before making edits or claiming validation.
4. Add a Table of Contents for docs.

## Required Essentials
- Package manager: `pnpm` (`packageManager: "pnpm@10.0.0"`).
- Node runtime: `>=24.0.0` (see `engines` in `package.json`).
- Baseline aggregate gate: `pnpm check`.
- Fail-closed code-style gate: `bash scripts/validate-codestyle.sh`.
- Canonical repo verification entrypoint: `bash scripts/verify-work.sh`.
- Compatibility posture: canonical-only.
- Treat repo evidence (`package.json`, lockfiles, tsconfig, scripts) as authoritative over copied instructions.

## Harness CLI for Agents

Use `harness` directly in CI and local workflows with canonical command names (`kebab-case` or explicit `:` command families). Prefer `--json` when output feeds automation and parse stdout only.

CLI contract:
- Exit code `0`: success/pass.
- Exit code `1`: fail/gate blocked/unknown command.
- Exit code `2`: usage error (missing or invalid required values).

Common machine-readable invocations:
```bash
harness blast-radius --files src/auth.ts --json
harness policy-gate --contract harness.contract.json --json
harness risk-tier --files src/payments.ts --json
harness doctor --json
```

Discovery:
```bash
harness --help
harness --version
```

## Codex Discovery Order
1. `/Users/jamiecraik/.codex/AGENTS.md`
2. This root `AGENTS.md`
3. Any deeper scoped `AGENTS.md` or `AGENTS.override.md`

Notes:
- `README.md` is the repo-facing product surface (overview, install, workflows), not an operator-policy file.
- `docs/agents/*.md` are progressive-disclosure governance references, not auto-discovered instruction files.
- `CLAUDE.md` and `GEMINI.md` are mirrored tool-specific surfaces in this repo, not part of Codex's default project-doc discovery unless fallback filenames are explicitly configured.
- If instruction precedence is unclear, stop and resolve it before editing behavior.

## Startup Workflow
1. Read this file first, then [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md) to route into extension docs, and open only task-relevant linked SOPs.
2. Run `bash scripts/codex-preflight.sh --stack auto --mode required` before multi-step, destructive, or path-sensitive work.
3. Summarize repo structure, active constraints, and blockers before edits.
4. Make the smallest change that satisfies the task.
5. Run the narrowest validation that proves the change works; widen only as risk increases.

## Command Preflight
- Run shell commands with `zsh -lc`; prefer `rg`, `fd`, and `jq`.
- Before edits, confirm `pwd`, repo root, required binaries, and target paths.
- Keep `bash scripts/codex-preflight.sh --stack auto --mode required` as the bootstrap gate beneath `bash scripts/verify-work.sh`.
- Treat repo-root `CODESTYLE.md` and `bash scripts/validate-codestyle.sh` as required verification surfaces.
- For detailed tooling and command-selection policy, use [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md).

## Fresh Worktree Bootstrap
- Before the first push from a newly created git worktree, run `bash scripts/prepare-worktree.sh` (or `make worktree-ready`).
- Reason: local pre-push hooks execute in the current worktree, and fresh worktrees often do not have `node_modules/` yet.
- After bootstrap, run `bash scripts/verify-work.sh --fast` before pushing.

## Quality Checks
- During iteration, run the narrowest check first, then `bash scripts/validate-codestyle.sh --fast`.
- Before handoff when behavior changed, run `bash scripts/validate-codestyle.sh`.
- Use `bash scripts/verify-work.sh` as the broader readiness gate.
- If runtime or artifact behavior changed, run `pnpm test:deep`.
- Report exact commands/outcomes in handoff notes and update the matching Linear issue for durable findings.

## Repo Workflow
- Branch from `main`; never push directly to `main`.
- Use `codex/<linear-key>-<short-description>` when the work is tracked in Linear.
- Open a PR for every merge to `main`.
- PR description linking: use `Refs JSC-N` while the issue is in review; use `Closes JSC-N` only when the merge fully completes the issue.
- CodeRabbit review must remain independent; the coding agent cannot self-approve.
- If you touch tooling/runtime contract surfaces such as hooks, `Makefile`, `.mise.toml`, readiness scripts, or generated Codex environment actions, update [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md) and [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md) in the same change.
- See [docs/agents/18-github-linear-automation.md](./docs/agents/18-github-linear-automation.md) for the full GitHub to Linear automation config and known gaps.

## Instruction Routing
This file is the compact operator baseline. Start with [docs/README.md](./docs/README.md) for layered docs discovery, then use [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md) to route governance SOPs:

- Architecture and cross-command changes: [docs/agents/00-architecture-bootstrap.md](./docs/agents/00-architecture-bootstrap.md)
- Tooling, shell, command contracts, and setup: [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md)
- Memory and Project Brain operations: [docs/agents/03-local-memory.md](./docs/agents/03-local-memory.md)
- Validation, test gates, and flaky artifacts: [docs/agents/04-validation.md](./docs/agents/04-validation.md), [docs/agents/10-agent-testing-gates.md](./docs/agents/10-agent-testing-gates.md), [docs/agents/11-flaky-test-artifacts.md](./docs/agents/11-flaky-test-artifacts.md)
- Security, governance, and auditability: [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md), [docs/agents/07a-role-governance.md](./docs/agents/07a-role-governance.md), [docs/agents/07b-agent-governance.md](./docs/agents/07b-agent-governance.md), [docs/agents/09-audit-trail-policy.md](./docs/agents/09-audit-trail-policy.md)
- Release/process control and docs-gate rollout: [docs/agents/08-release-and-change-control.md](./docs/agents/08-release-and-change-control.md), [docs/agents/14-docs-gate-rollout.md](./docs/agents/14-docs-gate-rollout.md)
- AI review and tracker operations: [docs/agents/12-ai-review-governance.md](./docs/agents/12-ai-review-governance.md), [docs/agents/13-linear-production-workflow.md](./docs/agents/13-linear-production-workflow.md), [docs/agents/15-context-integrity-compact.md](./docs/agents/15-context-integrity-compact.md), [docs/agents/16-linear-production-compact.md](./docs/agents/16-linear-production-compact.md), [docs/agents/18-github-linear-automation.md](./docs/agents/18-github-linear-automation.md), [docs/agents/19-linear-templates.md](./docs/agents/19-linear-templates.md)
- Additional workflow definitions: [WORKFLOW.md](./WORKFLOW.md), `/Users/jamiecraik/dev/config/codex/instructions/project-brain.md`

## Memory Layer
- Read `~/.codex/instructions/Learnings.md` at session start.
- If `.harness/memory/LEARNINGS.md` exists, read it; if it is missing, bootstrap it per [docs/agents/03-local-memory.md](./docs/agents/03-local-memory.md).
- Repo-local preflight telemetry lives under `.harness/memory/codex-learned/`; repo-local override writes land in `.harness/memory/codex-preflight-overrides.env`.
- Repo-specific fixes belong in `.harness/memory/LEARNINGS.md`; universal fixes belong in `~/.codex/instructions/Learnings.md`.

## Project Brain
- Use Project Brain files in `.harness/` as the project knowledge and decision layer, together with Local Memory.
- Canonical guidance lives at `/Users/jamiecraik/dev/config/codex/instructions/project-brain.md`.
- Bootstrap command: `bash /Users/jamiecraik/dev/config/codex/scripts/init-project-brain.sh --domains cli,ci,governance,tooling --index`.
- Use `--force` only when running init again, and only after backing up `.harness/memory/LEARNINGS.md`.

## Implementation Conventions
- Local ESM imports must include `.js` extensions.
- This repo publishes a harness skill to downstream repos via `harness init`. The installed skill lands in the target repo's `.agents/skills/coding-harness/`; it is not a local skill directory for this repo.
- This repo keeps the repo-root `CODESTYLE.md` path as a symlink to `/Users/jamiecraik/.codex/instructions/CODESTYLE.md` so the authoring source stays global while local enforcement still targets the repo-root path.
- Downstream harness-managed repositories should keep a real repo-local `CODESTYLE.md` scaffolded from that canonical source rather than a user-home symlink.
- Use repo scripts as the command contract: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm build`, `pnpm check`, and `pnpm test:artifacts`.
- Toolchain/runtime guardrails and hook policy live in [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md).

## References
- [Docs index](./docs/README.md)
- [Instruction map](./docs/agents/01-instruction-map.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CLAUDE.md](./CLAUDE.md)
- [GEMINI.md](./GEMINI.md)
- `/Users/jamiecraik/.codex/AGENTS.md`
- `/Users/jamiecraik/.codex/instructions/standards.md`
- `/Users/jamiecraik/.codex/instructions/rvcp-common.md`
