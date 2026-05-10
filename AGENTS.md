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
- Branch-protection defaults include the external Semgrep Cloud GitHub App check `semgrep-cloud-platform/scan`; keep it aligned across generated contracts, `.harness/ci-required-checks.json`, and required-check docs.
- CircleCI owns repo-run PR governance and security checks; GitHub Actions is reserved for release publishing, and Semgrep Cloud remains an independent external required check.
- `harness.contract.json` records this split in `ciOwnership`: CircleCI is the primary PR gate, CodeRabbit is the independent review check, Semgrep Cloud is the independent external security check, and GitHub Actions fallback/release workflows must not become automatic PR gates without an intentional contract migration.
- Tag-triggered release publishing must install `ripgrep` (`rg`) before `pnpm check` because `docs:ubiquitous:guard` depends on it in GitHub-hosted runners.
- Release packaging, E2E runner, or eval artifact changes that trigger a pre-push diagram-context refresh must commit the refreshed architecture context with the docs-gate-required governance surfaces.
- Generated Codex environment action changes must keep setup PATH bootstrapping, detached-worktree branch attachment, and script-derived test/eval actions synchronized with the tooling and security governance docs.
- Release readiness updates to governed north-star status surfaces must keep `docs/roadmap/agent-first-status.md` and the matching `harness.contract.json` `lastReviewedAt` entry synchronized.
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
- This repo is OpenAI Codex only; no mirrored tool-specific instruction surfaces are maintained.
- If instruction precedence is unclear, stop and resolve it before editing behavior.

## Startup Workflow
1. After global discovery surfaces (`~/.codex/AGENTS.md`), read this file first in-repo, then [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md) to route into extension docs, and open only task-relevant linked SOPs.
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
- `scripts/check-git-common-config.sh` is a required worktree-safety guard: shared non-bare `.git/config` must not contain `core.worktree`; use per-worktree config for worktree-local values.
- After bootstrap, run `bash scripts/verify-work.sh --fast` before pushing.
- Git hooks must be installed through `make hooks`, `make setup`, or `node scripts/setup-git-hooks.js`; `scripts/check-environment.sh` fails generated `prek` `pre-commit`, `pre-push`, or `commit-msg` shims that do not export repo-local `PREK_HOME="${PREK_HOME:-$HERE/../.cache/prek}"`.

## Quality Checks
- During iteration, run the narrowest check first, then `bash scripts/validate-codestyle.sh --fast`.
- Changed production source must satisfy `pnpm run quality:docstrings`, `pnpm run quality:size`, and `pnpm run test:related`; these are wired into `pnpm check`, `bash scripts/validate-codestyle.sh --fast`, and local pre-commit hooks.
- When executable behavior changes, run the smallest real code path that exercises the exact production code touched before claiming the change is verified.
- Prefer invoking the production function, class, CLI command, shell script, validator, or route directly. If no existing test covers the path, create a temporary reproduction harness under `codex-scripts/` and keep that directory gitignored.
- If the exact path cannot run because of unavailable credentials, external services, unsafe side effects, or missing generated state, state the blocker clearly, run the nearest meaningful validation, and do not describe production behavior as verified unless the touched path actually ran.
- Before handoff when behavior changed, run `bash scripts/validate-codestyle.sh`; use `bash scripts/verify-work.sh` as the broader readiness gate.
- If runtime or artifact behavior changed, run `pnpm test:deep`.
- When docs-gate categories are affected, run `bash scripts/run-harness-gate.sh docs-gate --mode required --json` and clear warnings before merge.
- Agent-native cockpit, generated environment action, hook setup, and architecture-artifact changes must keep the docs-gate required surfaces synchronized in the same PR so `harness next --json` recommendations, local runtime setup, and reviewer-facing evidence describe the current contract.
- Validation gate graph changes that add typed gate specs, parity tests, or resume-checkpoint guards are architecture-artifact changes; refresh `AI/context/diagram-context.md` and keep docs-gate-required governance surfaces synchronized in the same PR.
- Goal-continuation or approval-plan contract changes must keep `harness next --json` safety metadata, snapshot-only state evidence, and agent-governance docs synchronized in the same PR.
- When AGENTS/vocabulary surfaces change, run `pnpm run docs:ubiquitous:guard` to ensure `AGENTS.md` keeps the glossary linkage contract.
- Before PR handoff, run or explicitly mark `n.a.` for the north-star learning loop when changed files can be matched against imported CodeRabbit evidence: `harness learnings gate --source .harness/learnings/coderabbit.local.json --files <changed-files> --json`, `harness review-context --source .harness/learnings/coderabbit.local.json --files <changed-files> --json`, and `harness north-star-feedback --source .harness/learnings/coderabbit.local.json --json`. The `--files` value accepts comma-separated paths or multiple following path tokens.
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

## Shared Vocabulary
- Use [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md) as the canonical glossary for project-specific operator terms, aliases, and disambiguation.
- When user wording is terse, overloaded, or informal, map requests through the glossary `Prompt translations` table before executing.
- Keep command-language and closeout wording consistent with glossary canonical terms when reporting validation, drift, swarms, blockers, and lifecycle state.

## Project Brain
- Use Project Brain files in `.harness/` with Local Memory; canonical guidance lives at `/Users/jamiecraik/dev/config/codex/instructions/project-brain.md`.
- `.harness/README.md` is the tracked control-plane map for selective `.harness` tracking: durable Markdown and JSON contracts move with the repo, while runtime databases, backups, caches, run output, and bulk snapshots stay local unless explicitly promoted.
- `.harness/review`, `.harness/strategy`, `.harness/triage`, `.harness/features`, `.harness/ideate`, and `.harness/brainstorm` are secondary context; they do not drive implementation unless an admitted `.harness/linear`, `.harness/refactors`, `.harness/specs`, or `.harness/plan` slice references them.
- Bootstrap with `bash /Users/jamiecraik/dev/config/codex/scripts/init-project-brain.sh --domains cli,ci,governance,tooling --index`; use `--force` only for re-init after backing up `.harness/memory/LEARNINGS.md`.
- When the north-star learning loop finds a repeated high-value rule, keep the imported learning artifact as operational evidence and promote the distilled durable rule, decision, or explicit skip reason into Project Brain before closeout.

## Implementation Conventions
- Local ESM imports must include `.js` extensions.
- This repo publishes a harness skill to downstream repos via `harness init`; installed path is `.agents/skills/coding-harness/` in the target repo (not this repo's local skills tree).
- Keep the repo-root code-style pack (`CODESTYLE.md` + `codestyle/`) verbatim-synced from `/Users/jamiecraik/dev/configs/codex/instructions/` and enforce integrity with `codestyle/CHECKSUMS.sha256` plus `bash scripts/check-codestyle-parity.sh`.
- Use repo script contracts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm build`, `pnpm check`, and `pnpm test:artifacts` (see [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md)).

## References
- [Docs index](./docs/README.md) · [Instruction map](./docs/agents/01-instruction-map.md) · [Quickstart](./docs/agents/quickstart.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- Global: `~/.codex/AGENTS.md`, `~/.codex/instructions/standards.md`, `~/.codex/instructions/rvcp-common.md`
