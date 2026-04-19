---
last_validated: 2026-04-18
---

# Security and governance

- [Security posture](#security-posture)
- [Secret handling](#secret-handling)
- [Code and data governance](#code-and-data-governance)
- [Risk controls](#risk-controls)
- [Governance escalation](#governance-escalation)
- [Operational check list](#operational-check-list)
- [Pre-commit hooks](#pre-commit-hooks)
- [Hooks installed](#hooks-installed)
- [Setup](#setup)
- [Commit message format](#commit-message-format)
- [PR template reminder](#pr-template-reminder)
- [Plan traceability](#plan-traceability)

## Security posture

This repository follows conservative defaults:

- Keep command and runtime mutation minimal: avoid ad hoc global installs, preserve lockfile-driven `pnpm` execution boundaries, and use non-destructive tool resolution (`pnpm` direct, Homebrew path fallback, then `corepack`) that fails closed on missing baseline tools.
- Treat the repo-root `CODESTYLE.md` path plus `scripts/validate-codestyle.sh` as governed contract surfaces: if either drifts, readiness and closeout claims must fail closed.
- Repo-specific `CODESTYLE.md` exception remains narrow: this repository may use a symlink to `/Users/jamiecraik/.codex/instructions/CODESTYLE.md`, Biome must ignore that repo-root path for hosted CI stability, and `scripts/codex-preflight.sh` may allow only that symlink when it matches `.codex/preflight-allowed-external-paths.txt` (or `CODEX_PREFLIGHT_ALLOWED_EXTERNAL_PATHS`); all other out-of-repo paths fail closed.
- Scaffold rendering and packaged distributions must read `CODESTYLE.md` from checked-in templates (`src/templates/CODESTYLE.md` and `dist/templates/CODESTYLE.md`) rather than user-home symlinks that may be absent on CI/downstream machines.
- For preflight template maintenance, author downstream-facing baseline changes in `src/templates/codex-preflight.sh`. Project runtime `scripts/codex-preflight.sh` is allowed to diverge intentionally; run `node scripts/sync-codex-preflight.cjs --write` only when explicit synchronization is required.
- Local Memory preflight fallback probes must fail fast: keep bounded curl timeouts in `scripts/codex-preflight-local-memory-legacy.sh`, validate only the `rest_api.*` settings actually used to construct the health URL, and treat helper-runner exit code `3` as "unavailable, try the next runner" rather than a terminal failure.
- Harness-managed consumer repositories are a defined exception: `scripts/check-environment.sh` should prefer a repo-local CLI runner or wrapper, then a mise-resolved harness binary (`mise which harness`), and use a global npm install of `@brainwav/coding-harness` only as the final fallback with explicit `NPM_TOKEN` auth wiring.
- `scripts/check-environment.sh` should fail closed on core tooling/runtime contract drift and report optional capability drift as warnings so day-to-day governance is portable across narrower local toolchains.
- Project Brain memory-extension checks must stay project-local: keep required `.harness/**` knowledge paths in `toolingPolicy.projectBrainMemoryExtension.requiredPaths` and do not gate on workspace-level `~/.codex` state.
- CI pnpm bootstrap must avoid privileged shim rewrites. Prefer a user-writable prefix such as `$HOME/.local` plus `$BASH_ENV`/`$GITHUB_PATH` path propagation over `corepack enable`, which can fail on hosted runners when `/usr/local/bin/pnpm` is not writable.
- OpenSSF baseline tracking for this repository is grounded by `docs/security/2026-04-09-openssf-osps-baseline-status.md`; keep its control matrix synchronized with `.github/workflows/openssf-scorecard.yml`, `security/openssf-scorecard-policy.json`, and `scripts/check-scorecard-regressions.mjs`.
- Greptile is a legacy cleanup concern only. Keep active review governance, scaffold defaults, and runtime verification aligned to CodeRabbit, and treat any live Greptile scaffold path as contract drift unless it exists solely to remove or quarantine old artifacts.
- Security/policy hook configuration files must fail closed because of findings, not because the config is syntactically broken; keep Semgrep rule YAML quoted where patterns include mapping-like text such as `shell: true`.

## Secret handling

- Never place tokens, keys, or PII in docs, command output, commit text, or memory notes; keep environment-specific credentials outside the repo and sanitize/rotate immediately if sensitive material is committed.
- Keep repo-specific Gitleaks allow lists in the repo-root `.gitleaks.toml` so staged scans and manual secret scans share the same reviewed exceptions.
- Scaffolded `secret-scan.yml` workflows should default to least privilege. Do not grant `pull-requests: write` unless PR commenting is intentionally enabled for a scanner; the default scaffold should keep `contents: read` only.

## Code and data governance

- Validate behavior changes before merge using documented gates.
- Keep audit trail artifacts (closeout outputs, validation status) in the task record.
- For high-risk edits (policy/validation gates), include rollback expectations in docs.
- Validation evidence must name the wrapper that ran (`validate-codestyle.sh`, `verify-work.sh`, or deeper gates), not just the underlying tool categories.

## Risk controls

- Do not skip required gates to save time, and stop for human risk acceptance if checks fail repeatedly.
- Treat stale check output as non-evidence and do not replace `bash scripts/validate-codestyle.sh` with informal command lists; the wrapper is the governed proof surface.
- CircleCI test reliability guardrail: use `pnpm test:ci` so the long-running `ci-migrate` suite executes in an isolated lane with scoped Vitest worker-timeout mitigation (`--dangerouslyIgnoreUnhandledErrors`) while all functional assertions remain enforced.

## Governance escalation

- Escalate to human owner for:
  - Security policy conflicts
  - Permission or secret leakage concerns
  - Any command that modifies global environment settings

## Operational check list

- Package manager consistency, allowed toolchain mutation boundaries, and validation gate outputs must be verified and captured for every behavior/command-contract change.
- `bash scripts/validate-codestyle.sh` output is required evidence whenever behavior or command-contract surfaces changed, and secrets must never appear in docs or memory notes.
- For harness scaffold/setup checks, run `bash scripts/run-harness-setup-checks.sh` so preflight, environment posture (`CLAUDE_APPROVAL_POSTURE=require`), pinned `uv`, and quality gates are evaluated as one auditable sequence.
- For new task isolation in harness-managed repositories, start with `bash scripts/new-task.sh <slug>` so one task maps to one repo-local worktree and agent thread; use `--detached` for exploration/background work when Local may need the same branch checked out.
- For automation and wrapper scripts, prefer `bash scripts/new-task.sh --json <slug>` and `bash scripts/prepare-worktree.sh --json` so agents can consume branch/path/bootstrap hints without brittle text parsing.
- For one-shot orchestration, use `bash scripts/new-task-and-bootstrap.sh <slug>` so task creation and bootstrap execute as one command with one consolidated JSON output.
- When app run detection is nonstandard, use `scripts/new-task.sh --run-cmd '<command>'`; use `--no-portless` only when direct run hints are explicitly required, and `--bootstrap` when immediate bootstrap in the new worktree is intended.
- For fresh git worktrees, run `bash scripts/prepare-worktree.sh` before the first push so local pre-push hooks do not fail from missing dependencies in the new worktree.
- For app-style repositories with `dev`/`start` scripts, prefer the `portless run -- <pm run dev|start>` command emitted by `scripts/new-task.sh` so concurrent worktrees avoid manual port collision handling.
- Treat `scripts/prepare-worktree.sh` as the detached-head safety lane: it should attach detached worktrees to a local branch before push, set upstream to `origin/main` when available, and fast-forward to current upstream state before bootstrap gates run.
- Git branch checkout ownership is single-writer per worktree. If Local must keep a branch checked out, do not create a worktree on that same branch; prefer `scripts/new-task.sh --detached` and branch later when ready to promote the worktree changes.
- For lifecycle hygiene, inventory with `git worktree list --porcelain` before deletion, remove only after branch/PR state is confirmed, and follow cleanup with `git worktree prune`.
- `harness init --check-updates`, `harness init --update`, and `harness upgrade` should auto-repair legacy `.harness/restore-manifest.json` files when `ciProvider` can be inferred safely from `harness.contract.json`, an unambiguous CI layout on disk, or the current requested/default provider.
- If `scripts/run-harness-setup-checks.sh` still hits an incomplete legacy `.harness/restore-manifest.json`, treat it as a drift warning that blocks only the tracked update lane; keep running `check-environment` and repo quality gates, and print the manifest repair remediation explicitly.
- Keep `scripts/codex-preflight.sh` executable as a CLI script and invoke it with `bash scripts/codex-preflight.sh --stack auto --mode required` (or `--mode optional` for softer checks); do not source it.
- Treat `scripts/verify-work.sh` as the canonical repo-local verification entrypoint; it should keep `required` Local Memory enforcement and repo-scoped preflight expectations without depending on codex-maintenance-only paths.
- Hook-governance scope in `scripts/verify-work.sh` should default to `project-local`; workspace-level mutation and reporting must stay opt-in behind `--workspace-governance`, and direct governance scripts must require explicit input file flags (`--manifest`, `--inventory`, `--classification`, `--metrics`) instead of implicit workspace fallbacks.
- In project-local mode, treat `.codex/hook-conformance.json` as optional local state: missing files should not fail `verify-work`, while explicit `--workspace-governance` runs should continue enforcing conformance-artifact rollout checks.
- When scorecard policy surfaces change, confirm `.github/workflows/openssf-scorecard.yml` still runs with `warn` mode on pull requests and `fail` mode on `main` or scheduled runs, then capture that command path in change evidence.
- Treat scaffolded `scripts/harness-cli.sh` resolution failures as local install/bootstrap drift rather than harness command failures, and remediate with repo-local dependency repair (`pnpm install`, `pnpm add -D @brainwav/coding-harness`, then `pnpm exec harness <command>`).
- For Local Memory enforcement, pin `~/.local-memory/config.yaml` to `host: 127.0.0.1` and `auto_port: false`, and prefer the pinned REST health endpoint as the source of truth when CLI status output is stale under sandboxed execution.
- If using local shell helpers, prefer `source scripts/codex-shell-helpers.sh` and launch through `codex_d`/`cdxd` so Codex runs with `--profile d` and `--cd` anchored to the repo root.
- Treat harness-scaffolded governance artifacts as part of the runtime contract: `.npmrc` should exist with baseline security defaults plus scope-only registry routing, keep pnpm's isolated linker as default (hoisted linker opt-in only), and `.harness/ci-provider-transition-status.json` should exist before strict `ci-migrate verify`. Repo `.npmrc` files must not carry auth token overrides; auth belongs in user-level or CI-injected `~/.npmrc`.
- If `toolingPolicy.projectBrainMemoryExtension.enabled=true`, capture verification evidence that the required `.harness/**` paths exist and that `scripts/check-environment.sh` still declares `required_project_brain_paths`.
- When bumping tooling dependencies that have mirrored configuration schemas, update the package version, the repo config, and the scaffold template in the same change. The init suite enforces this for the Biome schema URL.
- Diagram freshness enforcement should compare only git-tracked artifacts before and after refresh. Gitignored `.diagram/` refresh output may exist for local analysis, but it must not block `pre-push` unless tracked architecture artifacts actually drift.

## Pre-commit hooks

This repository uses `prek` as the canonical local hook installer, and `prek.toml` remains the source of truth for installed `pre-commit`, `commit-msg`, and `pre-push` commands:

### Hooks installed

| Hook | Purpose |
| --- | --- |
| `pre-commit` | Runs `make hooks-pre-commit` (`pnpm lint`, `pnpm docs:lint`, `pnpm typecheck`, staged `gitleaks`, staged-doc `vale`, related tests) |
| `commit-msg` | Validates conventional commit format, reminds about PR template |
| `pre-push` | Runs `make hooks-pre-push` (`docs-gate --mode required`, diagram freshness, `tooling-audit`, `check-environment`, changed-file `semgrep`, `make codestyle`, `pnpm build`) |

- The staged `gitleaks` lane should prefer the repo-root `.gitleaks.toml` so approved fixture/example exceptions stay consistent across local hooks, manual scans, and scaffold expectations.
- Keep `hooks-commit-msg` as a required Makefile wrapper, and require `scripts/setup-git-hooks.js` to run `prek install --overwrite` plus `PREK_HOME="${PREK_HOME:-$HERE/../.cache/prek}"` shim patching under the hook directory resolved via `git rev-parse --git-path hooks` so hook logs/cache writes remain repo-local under sandboxed execution.
- `scripts/setup-git-hooks.js` must fail if a generated `prek` shim cannot be patched at the expected exec insertion point; silent skip-on-failure behavior is not allowed for hook patching.
- Keep `minimum_prek_version = "0.3.9"` in `prek.toml` and aligned with `.mise.toml` (`cargo:prek`) so commit/push shims run against a known-compatible runtime.
- For local hook/readiness/tooling-runtime changes, update this guide and `docs/agents/02-tooling-policy.md` in the same change so `docs-gate` catches drift before GitHub; keep port-free usage scoped to app-style `dev`/`start` actions (CLI-only repos may omit it).

## Plan traceability

- Pull requests must declare `Plan IDs` in the PR template summary.
- Each declared ID must resolve to a `docs/plans/*` document with matching `plan_id` frontmatter.
- Completed acceptance checklist items in referenced plans must carry evidence links or refs before merge.
- `risk-policy-gate` enforces this in CI, and `review-gate` treats missing or invalid plan traceability as a merge blocker even when the review check itself passed.

`scripts/check-semgrep-changed.sh` is intentionally narrow: it compares `HEAD` to the upstream merge-base (or the nearest main/master fallback), filters to changed implementation files under `src/**`, and runs only the local `scripts/semgrep-pre-push.yml` ruleset. That keeps the local lane useful without duplicating the full CI security scan. Keep the script pinned to the same Semgrep version used by `.github/workflows/secret-scan.yml` (`semgrep==1.153.1`) so local and CI findings stay aligned.

### Setup

Hooks are installed via the canonical repo wrapper (`node scripts/setup-git-hooks.js`), with equivalent `make` wrappers:

```bash
node scripts/setup-git-hooks.js
make hooks
make setup
```

### Commit message format

All commits must follow conventional commit format:

```
type(scope)!: description

Detailed body (optional).

Co-Authored-By: Name <email>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`, `build`, `revert`

### PR template reminder

On agent branches (`codex/*`, `claude/*`), the commit-msg hook reminds about PR template requirements:
- ## Summary (1-3 bullet points)
- Plan IDs
- ## Checklist (all items checked)
- ## Testing (test commands and evidence)
- ## Review artifacts (links to review outputs)
- ## Notes (merge rationale, risks, rollback)
