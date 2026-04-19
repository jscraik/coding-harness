---
schema_version: 1
---

# Coding Harness - AGENTS.md

## Table of Contents
- [Project Description](#project-description)
- [Mandatory Workflow Snippet](#mandatory-workflow-snippet)
- [Required Essentials](#required-essentials)
- [Harness CLI for Agents](#harness-cli-for-agents)
- [Codex Discovery and Cross-Tool Parity](#codex-discovery-and-cross-tool-parity)
- [Startup and Preflight](#startup-and-preflight)
- [Quality and Validation](#quality-and-validation)
- [Repo Workflow](#repo-workflow)
- [Instruction Routing](#instruction-routing)
- [Memory and Project Brain](#memory-and-project-brain)
- [Implementation Conventions](#implementation-conventions)
- [References](#references)

## Project Description
This repository is a TypeScript control plane for agentic development and review workflows.

## Mandatory Workflow Snippet
1. Explore project first, then invoke a task-relevant skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook, and Chat Widget tasks.
3. Read the repo-root [CODESTYLE.md](./CODESTYLE.md) before edits or validation claims.
4. Add a Table of Contents when creating or materially restructuring docs.

## Required Essentials
- Runtime/toolchain: `pnpm@10.33.0` and Node `>=24.0.0` (source of truth: `package.json`).
- Baseline gates: `pnpm check`, `bash scripts/validate-codestyle.sh`, and `bash scripts/verify-work.sh`.
- Compatibility posture: canonical-only.
- Treat repo evidence (`package.json`, lockfiles, `tsconfig.json`, scripts) as authoritative over copied instructions.

## Harness CLI for Agents
Use `harness` directly with canonical command names (`kebab-case` or explicit `:` families). Prefer `--json` when output feeds automation.

CLI exit contract:
- `0`: success/pass.
- `1`: fail, gate blocked, or unknown command.
- `2`: usage error (missing or invalid required values).

Common machine-readable commands:
```bash
harness blast-radius --files src/auth.ts --json
harness policy-gate --contract harness.contract.json --json
harness risk-tier --files src/payments.ts --json
```

## Codex Discovery and Cross-Tool Parity
Discovery order:
1. `/Users/jamiecraik/.codex/AGENTS.md`
2. This root `AGENTS.md`
3. Any deeper `AGENTS.md` or `AGENTS.override.md`

Parity contract:
- `AGENTS.md` is canonical for repo-wide operational policy.
- `CLAUDE.md` and `GEMINI.md` are mirrors and must stay aligned when operational defaults, validation rules, or routing guidance changes.
- `docs/agents/*.md` are progressive-disclosure references, not auto-discovered Codex instruction files.
- If instruction precedence is unclear, stop and resolve before edits.

## Startup and Preflight
1. Read this file, then [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md), then only the SOPs needed for the task.
2. Run `bash scripts/codex-preflight.sh --stack auto --mode required` before multi-step, destructive, or path-sensitive work.
3. Run shell commands with `zsh -lc`; prefer `rg`, `fd`, and `jq`.
4. Before editing, confirm `pwd`, repo root, required binaries, and target paths.
5. For first push from a new worktree, run `bash scripts/prepare-worktree.sh` (or `make worktree-ready`) then `bash scripts/verify-work.sh --fast`.

## Quality and Validation
- During iteration, start with the narrowest relevant check, then `bash scripts/validate-codestyle.sh --fast`.
- Before handoff when behavior changed, run `bash scripts/validate-codestyle.sh`; broaden to `bash scripts/verify-work.sh` or `pnpm check` as risk increases.
- If runtime or artifact behavior changed, run `pnpm test:deep`.
- Report exact commands and outcomes, and update the matching Linear issue when findings represent durable repo work.

## Repo Workflow
- Branch from `main`; never push directly to `main`.
- Use `codex/<linear-key>-<short-description>` when tracked in Linear.
- Open a PR for every merge to `main`; use `Refs JSC-N` while in review and `Closes JSC-N` only when merge fully completes the issue.
- CodeRabbit review remains independent; the coding agent cannot self-approve.
- If you touch tooling/runtime contract surfaces (hooks, `Makefile`, `.mise.toml`, readiness scripts, generated Codex environment actions), update [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md) and [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md) in the same change.

## Instruction Routing
Start with [docs/README.md](./docs/README.md) and [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md), then route to the matching SOP.

Primary route targets:
- Architecture and cross-command work: [docs/agents/00-architecture-bootstrap.md](./docs/agents/00-architecture-bootstrap.md)
- Tooling and command policy: [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md)
- Validation and testing gates: [docs/agents/04-validation.md](./docs/agents/04-validation.md), [docs/agents/10-agent-testing-gates.md](./docs/agents/10-agent-testing-gates.md)
- Security and governance: [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md), [docs/agents/07a-role-governance.md](./docs/agents/07a-role-governance.md), [docs/agents/07b-agent-governance.md](./docs/agents/07b-agent-governance.md)
- AI review, Linear workflow, and automation: [docs/agents/12-ai-review-governance.md](./docs/agents/12-ai-review-governance.md), [docs/agents/13-linear-production-workflow.md](./docs/agents/13-linear-production-workflow.md), [docs/agents/18-github-linear-automation.md](./docs/agents/18-github-linear-automation.md)
- Additional operational references: [WORKFLOW.md](./WORKFLOW.md), `/Users/jamiecraik/dev/config/codex/instructions/project-brain.md`

## Memory and Project Brain
- At session start, read `~/.codex/instructions/Learnings.md` and `.harness/memory/LEARNINGS.md` (bootstrap via [docs/agents/03-local-memory.md](./docs/agents/03-local-memory.md) if missing).
- Repo-local telemetry and overrides live under `.harness/memory/codex-learned/` and `.harness/memory/codex-preflight-overrides.env`.
- Project Brain guidance lives at `/Users/jamiecraik/dev/config/codex/instructions/project-brain.md`; bootstrap with `bash /Users/jamiecraik/dev/config/codex/scripts/init-project-brain.sh --domains cli,ci,governance,tooling --index`.

## Implementation Conventions
- Local ESM imports must include `.js` extensions.
- This repo publishes a harness skill to downstream repos via `harness init`; installed path is `.agents/skills/coding-harness/` in target repos.
- Treat repo-root `CODESTYLE.md` as a required checked-in contract surface in this repo and downstream harness-managed repos.

## References
- [Docs index](./docs/README.md)
- [Instruction map](./docs/agents/01-instruction-map.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CLAUDE.md](./CLAUDE.md)
- [GEMINI.md](./GEMINI.md)
- `/Users/jamiecraik/.codex/AGENTS.md`
- `/Users/jamiecraik/.codex/instructions/standards.md`
- `/Users/jamiecraik/.codex/instructions/rvcp-common.md`
