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

The `harness` binary is designed to be called directly by AI agents in CI and local workflows. All commands share a consistent interface.

### Command structure

```
harness <command> [flags]
```

Always use the canonical command name — most are kebab-case (e.g., `blast-radius`, not `blastRadius` or `blast_radius`), but some use colon separators (e.g., `ui:verify`, `workflow:generate`). The CLI auto-corrects minor variants with a note on stderr, but using the canonical name avoids that overhead.

### Machine-readable output

Add `--json` to any command to receive structured JSON on stdout:

```bash
harness blast-radius --files src/auth.ts,src/api.ts --json
harness policy-gate --contract harness.contract.json --json
harness preflight-gate --files src/foo.ts --json
harness doctor --json
```

The JSON envelope shape varies per command but always includes `status` and relevant findings. Error responses use `status: "error"` with an `error` field. Parse stdout only; the CLI may emit correction notes or warnings on stderr.

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Pass / success |
| `1` | Fail / gate blocked / unknown command |
| `2` | Usage error (missing required flag value) |

### Auto-correction

The CLI is forgiving for common mistakes:

- `blast_radius` and `blastRadius` both resolve to `blast-radius` (with a stderr note).
- Single-character typos like `blas-radius` resolve to the nearest match (with a stderr note).
- On a genuinely unknown command, you receive a JSON or plain-text message listing the top-3 closest commands with summaries and example invocations.

### Common agent workflows

```bash
# Check what gates apply to changed files
harness blast-radius --files src/auth.ts --json

# Run the full policy gate before opening a PR
harness policy-gate --contract harness.contract.json --json

# Classify file risk before making changes
harness risk-tier --files src/payments.ts --json

# Verify harness health in a new environment
harness doctor --json

# Run a full gate scorecard
harness health --json
```

### Discovering commands

```bash
harness --help          # list all commands with summaries
harness --version       # print the installed version
```

## Codex Discovery Order
1. `/Users/jamiecraik/.codex/AGENTS.md`
2. This root `AGENTS.md`
3. Any deeper scoped `AGENTS.md` or `AGENTS.override.md`

Notes:
- `docs/agents/*.md` are progressive-disclosure references, not auto-discovered instruction files.
- `CLAUDE.md` and `GEMINI.md` are mirrored tool-specific surfaces in this repo, not part of Codex's default project-doc discovery unless fallback filenames are explicitly configured.
- If instruction precedence is unclear, stop and resolve it before editing behavior.

## Startup Workflow
1. Read this file, then [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md), and only the task-relevant linked docs.
2. Run `bash scripts/codex-preflight.sh --stack auto --mode required` before multi-step, destructive, or path-sensitive work.
3. Summarize repo structure, active constraints, and blockers before edits.
4. Make the smallest change that satisfies the task.
5. Run the narrowest validation that proves the change works; widen only as risk increases.

## Command Preflight
- Run shell commands with `zsh -lc`.
- Prefer `rg`, `fd`, and `jq`.
- Before mutating work, confirm `pwd`, repo root, required binaries, and target paths.
- For this repo, verify `docs/agents/` and `scripts/` for path-sensitive work.
- Prefer `./scripts/codex-enforced "<prompt>"` for repo-local Codex launches so failures are recorded into repo-scoped learn state.
- Treat repo-root `CODESTYLE.md` and `scripts/validate-codestyle.sh` as required contract files for local verification.
- Keep `scripts/codex-preflight.sh` as the bootstrap gate beneath `scripts/verify-work.sh`.
- Ask before adding dependencies or changing system-level settings.

## Fresh Worktree Bootstrap
- Before the first push from a newly created git worktree, run `bash scripts/prepare-worktree.sh` (or `make worktree-ready`).
- Reason: local pre-push hooks execute in the current worktree, and fresh worktrees often do not have `node_modules/` yet.
- After bootstrap, run `bash scripts/verify-work.sh --fast` before pushing.

## Quality Checks
- During iteration, run the smallest focused validation first, then `bash scripts/validate-codestyle.sh --fast`.
- Before handoff when behavior changed, run `bash scripts/validate-codestyle.sh`.
- Use `bash scripts/verify-work.sh` as the canonical broader gate for repo-local readiness.
- If runtime or artifact behavior changed, also run `pnpm test:deep`.
- Report commands and outcomes in handoff notes.
- If validation/audit findings represent durable repo work, create or update the matching Linear issue before handoff.

## Repo Workflow
- Branch from `main`; never push directly to `main`.
- Use `codex/<linear-key>-<short-description>` when the work is tracked in Linear.
- Open a PR for every merge to `main`.
- PR description linking: use `Refs JSC-N` while the issue is in review; use `Closes JSC-N` only when the merge fully completes the issue.
- CodeRabbit review must remain independent; the coding agent cannot self-approve.
- If you touch tooling/runtime contract surfaces such as hooks, `Makefile`, `.mise.toml`, readiness scripts, or generated Codex environment actions, update [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md) and [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md) in the same change.
- See [docs/agents/18-github-linear-automation.md](./docs/agents/18-github-linear-automation.md) for the full GitHub to Linear automation config and known gaps.

## Instruction Routing
Start with [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md), then open only the docs that match the task:

- Architecture or cross-command changes: [docs/agents/00-architecture-bootstrap.md](./docs/agents/00-architecture-bootstrap.md)
- Tooling, shells, command contract, or private package setup: [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md)
- Local learnings and durable memory workflow: [docs/agents/03-local-memory.md](./docs/agents/03-local-memory.md)
- Validation planning and gate expectations: [docs/agents/04-validation.md](./docs/agents/04-validation.md)
- Contradictions or stale guidance cleanup: [docs/agents/05-contradictions-and-cleanup.md](./docs/agents/05-contradictions-and-cleanup.md)
- Security, secrets, auth, or governance-sensitive changes: [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md)
- Role and accountability governance: [docs/agents/07a-role-governance.md](./docs/agents/07a-role-governance.md) plus [docs/agents/07b-agent-governance.md](./docs/agents/07b-agent-governance.md)
- Release, rollback, or process control changes: [docs/agents/08-release-and-change-control.md](./docs/agents/08-release-and-change-control.md)
- Auditability requirements: [docs/agents/09-audit-trail-policy.md](./docs/agents/09-audit-trail-policy.md)
- Agent test policy and rollout gates: [docs/agents/10-agent-testing-gates.md](./docs/agents/10-agent-testing-gates.md)
- Flaky test artifacts and evidence capture: [docs/agents/11-flaky-test-artifacts.md](./docs/agents/11-flaky-test-artifacts.md)
- AI review workflow: [docs/agents/12-ai-review-governance.md](./docs/agents/12-ai-review-governance.md)
- Linear-first work intake: [docs/agents/13-linear-production-workflow.md](./docs/agents/13-linear-production-workflow.md)
- Docs-gate rollout and promotion: [docs/agents/14-docs-gate-rollout.md](./docs/agents/14-docs-gate-rollout.md)
- Context integrity (agent-optimized): [docs/agents/15-context-integrity-compact.md](./docs/agents/15-context-integrity-compact.md)
- Linear workflow (agent-optimized): [docs/agents/16-linear-production-compact.md](./docs/agents/16-linear-production-compact.md)
- GitHub to Linear automation config: [docs/agents/18-github-linear-automation.md](./docs/agents/18-github-linear-automation.md)
- Linear templates, saved views, and blocked-routing: [docs/agents/19-linear-templates.md](./docs/agents/19-linear-templates.md)
- Symphony workflow definition: [WORKFLOW.md](./WORKFLOW.md)
- Project Brain operating model: `/Users/jamiecraik/dev/config/codex/instructions/project-brain.md`

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
- Linter/formatter: Biome (`biome.json`). Run with `pnpm lint` and `pnpm fmt`.
- Git hooks: `prek` installs the repo-local `pre-commit` and `pre-push` entries from `prek.toml`; `Makefile` also exposes `hooks-commit-msg` as the canonical commit-policy wrapper.
- Toolchain: pinned in `.mise.toml`. Run `mise trust` before first use.
- First-time setup: `make setup` (installs deps plus configures git hooks).

## References
- [Instruction map](./docs/agents/01-instruction-map.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CLAUDE.md](./CLAUDE.md)
- [GEMINI.md](./GEMINI.md)
- `/Users/jamiecraik/.codex/AGENTS.md`
- `/Users/jamiecraik/.codex/instructions/standards.md`
- `/Users/jamiecraik/.codex/instructions/rvcp-common.md`
