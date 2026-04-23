---
schema_version: 1
---

# Coding Harness - AGENTS.md

## Project Description
This repository is a TypeScript control plane for agentic development and review workflows.

## Mandatory Workflow Snippet
1. Explore project first, then invoke a task-relevant skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
3. Read the repo-root [CODESTYLE.md](./CODESTYLE.md) before making edits or claiming validation, then route to [codestyle/README.md](./codestyle/README.md) for module-level standards.
4. Add a Table of Contents when creating or materially restructuring docs.

## Required Essentials
- Runtime/toolchain: `pnpm@10.33.0` and Node `>=24.0.0` (see `package.json`).
- Baseline gates: `pnpm codestyle:parity`, `pnpm check`, `bash scripts/validate-codestyle.sh`, and `bash scripts/verify-work.sh`.
- Compatibility posture: canonical-only.
- Treat repo evidence (`package.json`, lockfiles, tsconfig, scripts) as authoritative over copied instructions.

## Harness CLI for Agents

Use `harness` directly in CI and local workflows with canonical command names (`kebab-case` or explicit `:` command families). Prefer `--json` when output feeds automation; parse stdout JSON when present, and treat stderr text as fallback diagnostics for command families that still return usage/validation errors as text.

CLI contract:
- Exit code `0`: success/pass.
- Exit code `1`: fail/gate blocked/unknown command.
- Exit code `2`: usage error (missing or invalid required values).
- Some command families intentionally preserve richer process exit semantics; treat the `0/1/2` mapping as the default top-level contract unless command-specific docs state otherwise.

Common machine-readable invocations:
```bash
harness blast-radius --files src/auth.ts --json
harness policy-gate --contract harness.contract.json --json
harness risk-tier --files src/payments.ts --json
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
4. Make the smallest change that satisfies the task, then run the narrowest validation that proves it works; widen only as risk increases.

## Command Preflight
- Run shell commands with `zsh -lc`; prefer `rg`, `fd`, and `jq`.
- Before edits, confirm `pwd`, repo root, required binaries, and target paths.
- Keep `bash scripts/codex-preflight.sh --stack auto --mode required` as the bootstrap gate beneath `bash scripts/verify-work.sh`, and treat repo-root `CODESTYLE.md`, `codestyle/`, `codestyle/CHECKSUMS.sha256`, `bash scripts/check-codestyle-parity.sh`, and `bash scripts/validate-codestyle.sh` as required verification surfaces.
- For detailed tooling and command-selection policy, use [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md).

## Fresh Worktree Bootstrap
- Before the first push from a newly created git worktree, run `bash scripts/prepare-worktree.sh` (or `make worktree-ready`).
- After bootstrap, run `bash scripts/verify-work.sh --fast` before pushing.

## Quality Checks
- During iteration, run the narrowest check first, then `bash scripts/validate-codestyle.sh --fast`.
- Before handoff when behavior changed, run `bash scripts/validate-codestyle.sh`; use `bash scripts/verify-work.sh` as the broader readiness gate.
- If runtime or artifact behavior changed, run `pnpm test:deep`.
- When docs-gate categories are affected, run `bash scripts/run-harness-gate.sh docs-gate --mode required --json` and clear warnings before merge.
- When changing validation, required-check, tooling/runtime, or architecture-context behavior, update the docs-gate required surfaces in the same change (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/agents/02-tooling-policy.md`, `docs/agents/06-security-and-governance.md`, `docs/agents/00-architecture-bootstrap.md`).
- Report exact commands/outcomes in handoff notes and update the matching Linear issue for durable findings.

## Repo Workflow
- Branch from `main` and never push directly to `main`.
- Use `codex/<linear-key>-<short-description>` when the work is tracked in Linear, and open a PR for every merge to `main`.
- PR description linking: use `Refs JSC-N` while the issue is in review; use `Closes JSC-N` only when the merge fully completes the issue.
- CodeRabbit review must remain independent; the coding agent cannot self-approve.
- If you touch tooling/runtime contract surfaces such as hooks, `Makefile`, `.mise.toml`, readiness scripts, or generated Codex environment actions, update [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md) and [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md) in the same change.
- See [docs/agents/18-github-linear-automation.md](./docs/agents/18-github-linear-automation.md) for the full GitHub to Linear automation config and known gaps.

## Instruction Routing

Docs are layered for progressive disclosure (see [documentation layers](./docs/architecture/documentation-layers.md)):

| Layer | When | Where |
| --- | --- | --- |
| 0 | Always (this file) | `AGENTS.md` |
| 1 | Quick execution | [quickstart.md](./docs/agents/quickstart.md) |
| 2 | Domain work | Route via [01-instruction-map.md](./docs/agents/01-instruction-map.md) |
| 3 | Deep governance | Operational specs linked from Layer 2 |

Core routing (Layer 2):
- Tooling and commands: [02-tooling-policy.md](./docs/agents/02-tooling-policy.md)
- Validation gates: [04-validation.md](./docs/agents/04-validation.md)
- Security: [06-security-and-governance.md](./docs/agents/06-security-and-governance.md)
- Release: [08-release-and-change-control.md](./docs/agents/08-release-and-change-control.md)
- Linear workflow: [13-linear-production-workflow.md](./docs/agents/13-linear-production-workflow.md)
- Memory: [03-local-memory.md](./docs/agents/03-local-memory.md)
- Full map: [01-instruction-map.md](./docs/agents/01-instruction-map.md)

## Memory Layer
- At session start, read `~/.codex/instructions/Learnings.md` and `.harness/memory/LEARNINGS.md` (bootstrap via [docs/agents/03-local-memory.md](./docs/agents/03-local-memory.md) if missing).
- Repo-local telemetry/overrides live under `.harness/memory/codex-learned/` and `.harness/memory/codex-preflight-overrides.env`; store repo-specific fixes in `.harness/memory/LEARNINGS.md` and universal fixes in `~/.codex/instructions/Learnings.md`.

## Project Brain
- Use Project Brain files in `.harness/` with Local Memory; canonical guidance lives at `/Users/jamiecraik/dev/config/codex/instructions/project-brain.md`.
- Bootstrap with `bash /Users/jamiecraik/dev/config/codex/scripts/init-project-brain.sh --domains cli,ci,governance,tooling --index`; use `--force` only for re-init after backing up `.harness/memory/LEARNINGS.md`.

## Implementation Conventions
- Local ESM imports must include `.js` extensions.
- This repo publishes a harness skill to downstream repos via `harness init`; installed path is `.agents/skills/coding-harness/` in the target repo (not this repo's local skills tree).
- Keep the repo-root code-style pack (`CODESTYLE.md` + `codestyle/`) verbatim-synced from `/Users/jamiecraik/dev/configs/codex/instructions/` and enforce integrity with `codestyle/CHECKSUMS.sha256` plus `bash scripts/check-codestyle-parity.sh`.
- Use repo script contracts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm build`, `pnpm check`, and `pnpm test:artifacts` (see [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md)).

## References
- [Docs index](./docs/README.md) · [Instruction map](./docs/agents/01-instruction-map.md) · [Quickstart](./docs/agents/quickstart.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md) · [CLAUDE.md](./CLAUDE.md) · [GEMINI.md](./GEMINI.md)
- Global: `~/.codex/AGENTS.md`, `~/.codex/instructions/standards.md`, `~/.codex/instructions/rvcp-common.md`
