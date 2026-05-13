---
last_validated: 2026-05-13
---

# Security and governance

- [Security posture](#security-posture)
- [Code-style parity verification surface](#code-style-parity-verification-surface)
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
- [Frontmatter metadata](#frontmatter-metadata)
- [Plan traceability](#plan-traceability)

## Security posture

This repository follows conservative defaults:

- Minimal command surface in docs and scripts.
- Explicitly avoid ad hoc global installs and hidden mutation.
- Preserve existing dependency and execution boundaries (`pnpm` + lockfile-driven installs).
- Codex environment setup should use non-destructive tool resolution (`pnpm` direct, Homebrew path fallback, then `corepack`) and fail closed on missing baseline tools instead of mutating global installs implicitly.
- Treat the repo-root `CODESTYLE.md` path plus `scripts/validate-codestyle.sh` as governed contract surfaces: if either drifts, readiness and closeout claims must fail closed.
- Treat `scripts/check-codestyle-parity.sh` as the required code-style integrity gate for `codestyle/` and `codestyle/CHECKSUMS.sha256`; parity drift must block readiness.
- Repo-specific exception: this repository may satisfy that `CODESTYLE.md` path with a symlink to `/Users/jamiecraik/.codex/instructions/CODESTYLE.md`, but downstream harness-managed repos should keep a real repo-local `CODESTYLE.md` copy.
- Repo-specific linting invariant: Biome must ignore the repo-root `CODESTYLE.md` path so hosted CI does not fail on a broken developer-home symlink while local readiness still validates the path via preflight.
- Repo-specific preflight rule: `scripts/codex-preflight.sh` may allow that one documented `CODESTYLE.md` symlink when it matches the repo-local allow-list in `.codex/preflight-allowed-external-paths.txt` (or `CODEX_PREFLIGHT_ALLOWED_EXTERNAL_PATHS`), even though it resolves outside repo root; other out-of-repo paths must still fail closed.
- Security/runtime invariant: scaffold rendering and packaged distributions must read `CODESTYLE.md` from a checked-in template copy (`src/templates/CODESTYLE.md` / `dist/templates/CODESTYLE.md`), not by following a user-home symlink that may be absent on CI or downstream machines.
- Repo-specific preflight maintenance rule: author downstream-facing changes in `src/templates/codex-preflight.sh`, then sync the repo runtime mirror with `node scripts/sync-codex-preflight.cjs --write`. `pnpm lint` runs the matching `--check` gate so runtime/template drift is treated as a policy failure, not a later merge surprise.
- Local Memory preflight fallback probes must fail fast: keep bounded curl timeouts in `scripts/codex-preflight-local-memory-legacy.sh`, validate only the `rest_api.*` settings actually used to construct the health URL, and treat helper-runner exit code `3` as "unavailable, try the next runner" rather than a terminal failure.
- Harness-managed consumer repositories are a defined exception: `scripts/check-environment.sh` should prefer a repo-local CLI runner or wrapper, then a mise-resolved harness binary (`mise which harness`), and use a global npm install of `@brainwav/coding-harness` only as the final fallback with explicit `NPM_TOKEN` auth wiring.
- CircleCI bootstrap is allowed to install baseline shell tooling (`gh`, `rg`, `fd`, `jq`, `make`, `realpath`) and `mise`, then trust `.mise.toml`, before readiness gates run; the readiness gate itself must remain fail-closed and should not hide missing-tool drift by self-installing them.
- Generated Codex environment setup may add known user/Homebrew/system tool directories to `PATH` and may trust `.mise.toml` in the active worktree, but it must preserve caller-provided `PATH` precedence when `PATH` is already set, and it must not perform unbounded global installs or silently bypass the repository readiness gates.
- Agent documentation CLIs such as `ctx7` must be pinned through mise and represented in `.mise.toml`, `scripts/check-environment.sh`, `harness.contract.json`, and `.codex/environments/environment.toml` before they become required readiness tools.
- Detached-worktree bootstrap in generated environment actions should create a local feature branch and track `origin/main` before dependency setup so validation, commit, and push evidence stays attached to an auditable branch.
- Global npm harness fallback checks should run an already-installed executable before requiring private-registry authentication; missing install diagnostics may ask for npm auth, but local readiness must not leak tokens into repo files or generated scaffolds.
- Flow Ops closure-evidence changes that alter validation routing or source classification are governance-sensitive and must refresh architecture context plus docs-gate-required governance surfaces in the same PR.
- CircleCI orb-pinning enforcement should verify `ralph` availability (`ralph --version`) and may install pinned `ralph-gold` in ephemeral CI jobs when the CLI is missing.
- Project Brain memory-extension checks must stay project-local: keep required `.harness/**` knowledge paths in `toolingPolicy.projectBrainMemoryExtension.requiredPaths` and do not gate on workspace-level `~/.codex` state.
- `.harness/README.md` is the governance map for selective `.harness` tracking. Curated Markdown and JSON contract files are reviewable repo inputs; runtime databases, backups, caches, run output, and bulk snapshots must stay local unless a validator or fixture contract admits them.
- Tracked secondary context under `.harness/review`, `.harness/strategy`, `.harness/triage`, `.harness/features`, `.harness/ideate`, and `.harness/brainstorm` is evidence only. It becomes implementation authority only through an admitted `.harness/linear`, `.harness/refactors`, `.harness/specs`, or `.harness/plan` slice.
- CI pnpm bootstrap must avoid privileged shim rewrites. Prefer a user-writable prefix such as `$HOME/.local` plus `$BASH_ENV`/`$GITHUB_PATH` path propagation over `corepack enable`, which can fail on hosted runners when `/usr/local/bin/pnpm` is not writable.
- OpenSSF baseline tracking for this repository is grounded by `docs/security/2026-04-09-openssf-osps-baseline-status.md`; keep its control matrix synchronized with `security/openssf-scorecard-policy.json` and `scripts/check-scorecard-regressions.mjs`.
- Greptile is a legacy cleanup concern only. Keep active review governance, scaffold defaults, and runtime verification aligned to CodeRabbit, and treat any live Greptile scaffold path as contract drift unless it exists solely to remove or quarantine old artifacts.
- Security/policy hook configuration files must fail closed because of findings, not because the config is syntactically broken; keep Semgrep rule YAML quoted where patterns include mapping-like text such as `shell: true`.

## Code-style parity verification surface

`bash scripts/check-codestyle-parity.sh` is a required verification surface in the bootstrap lane (`bash scripts/codex-preflight.sh --stack auto --mode required`) and in broader readiness checks (`bash scripts/verify-work.sh`).

The parity gate must validate repo-root `CODESTYLE.md`, `codestyle/**`, and `codestyle/CHECKSUMS.sha256`.

Failure mode is intentionally fail-closed: missing code-style files, checksum drift, malformed manifest entries, or path traversal outside repo root must exit non-zero and block readiness until corrected.

## Secret handling

- Never place tokens, keys, or PII in docs, command output, commit text, or memory notes.
- If sensitive material appears in a file, sanitize and rotate as soon as practical.
- Keep environment-specific credentials outside repo and out of command snippets unless placeholders are explicit.
- Keep repo-specific Gitleaks allow lists in the repo-root `.gitleaks.toml` so staged scans and manual secret scans share the same reviewed exceptions.
- CircleCI now owns repo-run non-release security scanning in this repository. Keep `security-scan` in `.circleci/config.yml` and avoid reintroducing non-release GitHub Actions security workflows. Semgrep Cloud is enforced separately through the external GitHub App check `semgrep-cloud-platform/scan`; do not fold that required check into CircleCI workflow metadata.
- `harness.contract.json` `ciOwnership` is the machine-readable contract for that split: `primaryPrGate` must remain `circleci`, `reviewProvider` must remain `coderabbit`, `securityChecks` must include `semgrep-cloud-platform/scan`, and any GitHub Actions fallback PR workflow must stay manual/emergency-only unless the contract is intentionally migrated.

## Code and data governance

- Validate behavior changes before merge using documented gates.
- Validate behavior changes with the smallest real executable path that exercises the exact production code touched whenever feasible; broad gates are necessary but not sufficient on their own.
- Keep audit trail artifacts (closeout outputs, validation status) in the task record.
- For high-risk edits (policy/validation gates), include rollback expectations in docs.
- Validation evidence must name the wrapper that ran (`validate-codestyle.sh`, `verify-work.sh`, or deeper gates), not just the underlying tool categories.

## Risk controls

- Do not skip required gates to save time.
- If checks fail repeatedly, stop and request decision on risk acceptance.
- Treat stale check output as non-evidence.
- If the exact touched path cannot run because it depends on unavailable credentials, external services, unsafe side effects, or missing generated runtime state, record that blocker explicitly and run the nearest meaningful validation instead.
- Do not replace `bash scripts/validate-codestyle.sh` with an informal list of roughly equivalent commands when documenting or attesting verification; the wrapper is the governed proof surface.
- Treat hook-exported repository git environment (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*` variables) as untrusted input for nested validation scripts; `scripts/validate-codestyle.sh` should sanitize those values before invoking `pnpm run` so fixture-local git checks are isolated from hook context.
- CircleCI test reliability guardrail: use `pnpm test:ci` so the long-running `ci-migrate` suite executes in an isolated lane with scoped Vitest worker-timeout mitigation (`--dangerouslyIgnoreUnhandledErrors`) while all functional assertions remain enforced.
- Source-checkout harness-gate fallback is narrow by design: `scripts/run-harness-gate.sh` may fall back from the source CLI command to `node dist/cli.js` only when the actual command emits the known runner IPC `EPERM` temp-pipe signature. Missing `pnpm`, missing source files, or non-matching runner failures must remain fail-closed.

## Governance escalation

- Escalate to human owner for:
  - Security policy conflicts
  - Permission or secret leakage concerns
  - Any command that modifies global environment settings

## Operational check list

- Package manager consistency verified in repo files.
- No unauthorized command or toolchain mutation.
- Validation gate outputs captured.
- `bash scripts/validate-codestyle.sh` output captured whenever behavior or command-contract surfaces changed.
- Exact behavior evidence captured whenever executable behavior changed, or the blocker recorded when the touched path could not be run safely.
- No secrets in docs/memory.
- For harness scaffold/setup checks, run `bash scripts/run-harness-setup-checks.sh` so preflight, environment posture (`CLAUDE_APPROVAL_POSTURE=require`), pinned `uv`, and quality gates are evaluated as one auditable sequence.
- For fresh git worktrees, run `bash scripts/prepare-worktree.sh` before the first push so local pre-push hooks do not fail from missing dependencies in the new worktree.
- `scripts/prepare-worktree.sh` should auto-attach detached HEAD checkouts to a local branch with exact base format `branch_base="jscraik/feature/$repo_slug-worktree-$short_sha"`, set `origin/main` tracking when available, and fast-forward to latest `origin/main` before dependency bootstrap so default git branch workflows are available immediately.
- Generated downstream setup surfaces, Codex environment setup, `Tools` actions, `make worktree-ready`, and manual or agent bootstrap runs consume that `jscraik/feature/<repo>-worktree-<short-sha>` branch rule; keep the generated worktree branch prefix synchronized with PR template and workflow branch guidance.
- When a merge refresh changes worktree helper behavior, keep this governance surface in the PR diff with the matching tooling policy update so docs-gate can verify the complete runtime-contract surface set.
- Treat `jscraik/feature/<repo>-worktree-<short-sha>` as a local worktree-readiness branch intended for bootstrap and hook execution. Do not grant it broader permissions than other agent-created branches, do not infer Linear ownership from that prefix, and prune or rename stale local instances only through the normal worktree cleanup flow.

### Worktree branch naming: security and governance implications

The canonical worktree branch format `jscraik/feature/$repo_slug-worktree-$short_sha` (as defined in `scripts/prepare-worktree.sh`) carries the following security and governance considerations:

**Naming semantics:**

- The `jscraik/feature/*-worktree-*` pattern explicitly identifies branches created by the readiness script
- The embedded commit SHA provides traceability to the exact commit at branch creation time
- Collision handling (numeric suffixes `-1`, `-2`, etc.) ensures unique branch names without overwriting existing branches

**Permissions:**

- Worktree-readiness branches should receive the same permission boundaries as other agent-created branches
- Do not grant elevated push/merge privileges based solely on the `jscraik/feature/` prefix
- Repository protection rules should not exempt these branches from required checks or review requirements

**Retention and cleanup:**

- These branches are ephemeral by design: intended for bootstrap, hook execution, and temporary development
- Stale instances should be pruned through normal worktree cleanup flows (`git worktree prune`, manual `git branch -d`)
- Do not implement special retention policies or automated cleanup for this prefix unless it's part of a broader agent-branch cleanup strategy
- Branch retention beyond active worktree lifecycle is acceptable but should be treated as developer-local state

**Distinction from task branches:**

- Worktree-readiness branches (`jscraik/feature/*-worktree-*`) are mechanically generated for bootstrap purposes
- Linear-tracked task branches (`codex/<issue-key>-<slug>`) represent intentional feature work with issue tracking
- Tooling must not infer Linear ownership, task status, or work-in-progress semantics from the worktree-readiness prefix
- CI workflows and review automation should treat worktree-readiness branches as regular development branches without special task-tracking semantics
- `scripts/check-git-common-config.sh` should fail preflight, verification, and worktree bootstrap if shared non-bare `.git/config` contains `core.worktree`. Repair by removing the shared value and using per-worktree config for worktree-local settings.
- `scripts/new-task.sh` should fetch the latest remote base branch before `git worktree add` so newly created task worktrees start from current upstream commits.
- `scripts/new-task.sh --bootstrap <issue-key>-<slug>` is the preferred one-shot path when you want creation plus immediate bootstrap in a single command.
- `scripts/codex-enforced` should guard `main` by auto-creating a dedicated `codex/<issue-key>-<slug>` task branch/worktree (via `scripts/new-task.sh --bootstrap`) before launching Codex for feature work.
- Generated `.codex/environments/environment.toml` setup and `Tools` actions should invoke `scripts/prepare-worktree.sh` when present so Codex app bootstraps enforce the same hook and dependency guarantees as manual worktree setup.
- `harness init --check-updates`, `harness init --update`, and `harness upgrade` should auto-repair legacy `.harness/restore-manifest.json` files when `ciProvider` can be inferred safely from `harness.contract.json`, an unambiguous CI layout on disk, or the current requested/default provider.
- If `scripts/run-harness-setup-checks.sh` still hits an incomplete legacy `.harness/restore-manifest.json`, treat it as a drift warning that blocks only the tracked update lane; keep running `check-environment` and repo quality gates, and print the manifest repair remediation explicitly.
- Keep `scripts/codex-preflight.sh` executable as a CLI script and invoke it with `bash scripts/codex-preflight.sh --stack auto --mode required` (or `--mode optional` for softer checks); do not source it.
- Treat `scripts/verify-work.sh` as the canonical repo-local verification entrypoint; it should keep `required` Local Memory enforcement and repo-scoped preflight expectations without depending on codex-maintenance-only paths.
- Hook-governance scope in `scripts/verify-work.sh` should default to `project-local`; workspace-level mutation and reporting must stay opt-in behind `--workspace-governance`, and direct governance scripts must require explicit input file flags (`--manifest`, `--inventory`, `--classification`, `--metrics`) instead of implicit workspace fallbacks.
- Environment variables controlling external normalization behavior in `scripts/verify-work.sh`:
  - `HARNESS_VERIFY_WORK_SKIP_EXTERNAL_NORMALIZATION` — When set to an enabled value (`1`, `true`, `yes`, or `on`, case-insensitive where applicable), opts out of external manifest normalization (the flow that may call mise-provided harness or harness on PATH). Defaults to unset (external normalization is attempted). Security implication: bypasses external harness binary fallback; may cause verify-work to use raw-fallback manifest mode when repo-local normalization also fails. See `prepare_normalized_required_checks_manifest` in the script for details.
  - `HARNESS_VERIFY_WORK_EXTERNAL_NORMALIZE_TIMEOUT_SECONDS` — Configurable timeout in integer seconds for external normalization operations (for example mise which harness). Defaults to `5`. Operational implication: longer timeouts permit slower external tool resolution but delay verify-work startup when external binaries are slow. See `external_normalization_timeout` in `scripts/verify-work.sh` for the timeout application point.
- When scorecard policy surfaces change, confirm `security/openssf-scorecard-policy.json`, `scripts/check-scorecard-regressions.mjs`, and `docs/security/2026-04-09-openssf-osps-baseline-status.md` remain aligned, then capture that command path in change evidence.
- Treat scaffolded `scripts/harness-cli.sh` resolution failures as local install/bootstrap drift rather than harness command failures, and remediate with repo-local dependency repair (`pnpm install`, `pnpm add -D @brainwav/coding-harness`, then `pnpm exec harness <command>`).
- For Local Memory enforcement, pin `~/.local-memory/config.yaml` to `host: 127.0.0.1` and `auto_port: false`, and prefer the pinned REST health endpoint as the source of truth when CLI status output is stale under sandboxed execution.
- If using local shell helpers, prefer `source scripts/codex-shell-helpers.sh` and launch through `codex_d`/`cdxd` so Codex runs with `--profile d` and `--cd` anchored to the repo root.
- Treat harness-scaffolded governance artifacts as part of the runtime contract: `.npmrc` should exist with baseline security defaults plus scope-only registry routing, keep pnpm's isolated linker as default (hoisted linker opt-in only), and `.harness/ci-provider-transition-status.json` should exist before strict `ci-migrate verify`. Repo `.npmrc` files must not carry auth token overrides; auth belongs in user-level or CI-injected `~/.npmrc`.
- If `toolingPolicy.projectBrainMemoryExtension.enabled=true`, capture verification evidence that the required `.harness/**` paths exist and that `scripts/check-environment.sh` still declares `required_project_brain_paths`.
- When bumping tooling dependencies that have mirrored configuration schemas, update the package version, the repo config, and the scaffold template in the same change. The init suite enforces this for the Biome schema URL.
- Diagram freshness enforcement should compare only git-tracked artifacts before and after refresh. Gitignored `.diagram/` refresh output may exist for local analysis, but it must not block `pre-push` unless tracked architecture artifacts actually drift.
- Agent-native cockpit and fleet remediation changes must keep command evidence machine-readable and permission-aware: `harness next --json` should carry required local source blockers before recommending work, optional network source errors should remain metadata rather than silent assumptions, and `harness fleet-plan --from <upgrade-matrix> --json` should separate dry-run recommendations from approval-required mutation steps.

## Pre-commit hooks

This repository uses `prek` as the canonical local hook installer, and `prek.toml` remains the source of truth for installed `pre-commit` and `pre-push` commands:

### Hooks installed

| Hook         | Purpose                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | Runs `make hooks-pre-commit` (`pnpm lint`, `pnpm docs:lint`, `pnpm typecheck`, changed-code docstring and size gates, staged `gitleaks`, staged-doc `vale`, related tests)                                                                                                                                                                                                                                 |
| `commit-msg` | Validates conventional commit format, reminds about PR template                                                                                                                                                                                                                                                                                                                                            |
| `pre-push`   | Runs `make hooks-pre-push` (`docs-gate --mode required`, push-scoped diagram freshness, `tooling-audit`, `check-environment`, changed-file `semgrep`, `make codestyle`, `pnpm build`); environment-only pushes that change only `.codex/environments/environment.toml` run `check-environment` only, and the branch diff includes type changes so file-mode or symlink changes still trigger the full lane |

The staged `gitleaks` lane should prefer the repo-root `.gitleaks.toml` when present so approved fixture/example exceptions are consistent across local hooks, manual scans, and downstream scaffold expectations.
`hooks-commit-msg` remains a required Makefile wrapper even though `prek.toml` only installs `pre-commit` and `pre-push`; use that wrapper for deterministic commit-policy verification and cross-repo governance checks.
`scripts/setup-git-hooks.js` must run `prek install --overwrite`, resolve the installed hook directory with `git rev-parse --git-path hooks`, and patch generated `prek` shims with `PREK_HOME="${PREK_HOME:-$HERE/../.cache/prek}"` so hook logs/cache writes stay repo-local under sandboxed executions and legacy hook wrappers are not chained.
`scripts/check-environment.sh` must treat installed generated `pre-commit`, `pre-push`, and `commit-msg` shims without that repo-local `PREK_HOME` patch as hook drift, with `node scripts/setup-git-hooks.js` or `make hooks` as the repair path.

`docs-gate` no longer covers only branch/CI governance wording. Local hook, readiness, tooling-runtime, and architecture-context changes are expected to update this guide together with `docs/agents/02-tooling-policy.md`, `docs/agents/00-architecture-bootstrap.md`, and the operator-facing surfaces (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`) in the same change so pre-push drift is caught before GitHub does.
Agent-native cockpit changes that alter next-action safety, generated environment actions, or hook setup must preserve that same docs-gate synchronization so permission, execution-profile, and validation evidence remain auditable before merge.
Port-free usage should remain scoped to app-style run actions that map to `dev`/`start` scripts. CLI-only repositories can omit port-free run actions without violating governance.

## Frontmatter metadata

- `last_validated` must use ISO date format (`YYYY-MM-DD`) and represents when the document was last verified against current tooling or governance behavior.
- Update `last_validated` when validation wrappers, required checks, or policy contracts change and this document is re-checked.
- Keep `last_validated` aligned with any in-body freshness marker (for example `Last updated:`) so document evidence is not contradictory.

## Plan traceability

- Pull requests must declare `Plan IDs` in the PR template summary.
- Each declared ID must resolve to a `docs/plans/*` document with matching `plan_id` frontmatter.
- Completed acceptance checklist items in referenced plans must carry evidence links or refs before merge.
- `risk-policy-gate` enforces this in CI, and `review-gate` treats missing or invalid plan traceability as a merge blocker even when the review check itself passed.

`scripts/check-semgrep-changed.sh` is intentionally narrow: it compares `HEAD` to the upstream merge-base (or the nearest main/master fallback), filters to changed implementation files under `src/**`, and runs only the local `scripts/semgrep-pre-push.yml` ruleset. That keeps the local lane useful without duplicating the full CI security scan. Keep the script pinned to the same Semgrep version used by the CircleCI `security-scan` lane in `.circleci/config.yml` (`semgrep==1.153.1`) so local and CI findings stay aligned. Keep Semgrep Cloud's `semgrep-cloud-platform/scan` branch-protection check as an independent external app gate.

### Setup

Hooks are installed via the canonical repo wrapper:

```bash
node scripts/setup-git-hooks.js
```

Equivalent wrappers:

```bash
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
