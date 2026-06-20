---
last_validated: 2026-06-20
---

# Security and governance

- [Security posture](#security-posture)
- [Code-style parity verification surface](#code-style-parity-verification-surface)
- [Secret handling](#secret-handling)
- [Policy-gate risk chain](#policy-gate-risk-chain)
- [Execution-input governance](#execution-input-governance)
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
- CircleCI bootstrap is allowed to install baseline shell tooling (`gh`, `rg`, `fd`, `jq`, `make`, `realpath`) and `mise`, then trust `.mise.toml` (via `mise trust --yes`), before readiness gates run; reusable governance jobs that run `pnpm check` must also install and verify pinned `uv` through trusted `mise` before Python/Pydantic type-contract gates run, and the readiness gate itself must remain fail-closed instead of hiding missing-tool drift by self-installing required tools.
- uv-backed Python validation helpers must route through
  `scripts/run-uv-python.sh` so worktree-scoped uv cache and virtual
  environment settings stay centralized and do not drift across package scripts,
  hook governance helpers, or generated init scaffolds.
- Node engine drift is a governance blocker, not a package-manager warning: `scripts/check-node-engine.mjs` should recover by re-executing through the `.mise.toml`-pinned Node when available, must fail when the pinned runtime cannot be resolved, and governed validation wrappers should run it before broader gates that would otherwise produce stale or misleading evidence.
- Generated Codex environment setup may add known user/Homebrew/system tool directories to `PATH` and may trust `.mise.toml` in the active worktree (via `mise trust --yes` when both file and CLI are present), but it must preserve caller-provided `PATH` precedence when `PATH` is already set, and it must not perform unbounded global installs or silently bypass the repository readiness gates.
- Agent documentation CLIs such as `ctx7` must be pinned through mise and represented in `.mise.toml`, `scripts/check-environment.sh`, `harness.contract.json`, and `.codex/environments/environment.toml` before they become required readiness tools.
- Detached-worktree bootstrap in generated environment actions should create a local feature branch and track `origin/main` before dependency setup so validation, commit, and push evidence stays attached to an auditable branch.
- Global npm harness fallback checks should run an already-installed executable before requiring private-registry authentication; missing install diagnostics may ask for npm auth, but local readiness must not leak tokens into repo files or generated scaffolds.
- Flow Ops closure-evidence changes that alter validation routing or source classification are governance-sensitive and must refresh architecture context plus docs-gate-required governance surfaces in the same PR.
- Advisory stale-document archive-candidate reporting is governance evidence, not mutation authority: `pnpm docs:archive-candidates` and `pnpm --silent docs:archive-candidates -- --json` may identify stale candidates and repair hints, but archive, move, delete, demotion, metadata rewrite, manifest, active-artifact, or archive-index repair actions require a separate reviewed decision. Mutation-shaped flags for those actions fail closed with usage exit code `2` and `destructive_option_unsupported`.
- Archive-candidate route evidence must not manufacture governance debt from generated projections: generated docs stay ignored, while tracked parseable JSON route artifacts can verify active-artifact references without Markdown frontmatter.
- Flow Ops closure-evidence merge repairs that keep generated environment setup
  or init scaffolding behavior current must also keep this guide in the PR when
  docs-gate reports tooling-runtime or init-scaffold categories.
- Closure-evidence fail-closed changes for missing checks, wrong `checkedSha`
  values, or skipped required checks should be reviewed as governance changes:
  update the operator-facing docs surfaces that docs-gate reports before push so
  required-check evidence and rollback expectations stay auditable.
- Project Brain memory-extension checks must stay project-local: keep required `.harness/**` knowledge paths in `toolingPolicy.projectBrainMemoryExtension.requiredPaths` and do not gate on workspace-level `~/.codex` state.
- `.harness/README.md` is the governance map for selective `.harness` tracking. Curated Markdown and JSON contract files are reviewable repo inputs; runtime databases, backups, caches, run output, and bulk snapshots must stay local unless a validator or fixture contract admits them.
- `.harness/active-artifacts.md` is an `execution-input` index for active slices. Treat it as routing authority only after validating referenced artifacts and current branch/PR state; it is not validation evidence, tracker closure evidence, or release authority by itself.
- Tracked secondary context under `.harness/review`, `.harness/strategy`, `.harness/triage`, `.harness/features`, `.harness/ideate`, and `.harness/brainstorm` is evidence only. It becomes implementation authority only through an admitted `.harness/linear`, `.harness/refactors`, `.harness/specs`, `.harness/plan`, or `.harness/active-artifacts.md` slice reference.
- CI pnpm bootstrap must avoid privileged shim rewrites. Prefer a user-writable prefix such as `$HOME/.local` plus `$BASH_ENV`/`$GITHUB_PATH` path propagation over `corepack enable`, which can fail on hosted runners when `/usr/local/bin/pnpm` is not writable.
- CI validation splits are governance-sensitive: keep the full `pnpm test:ci`
  lane owned by the CircleCI `test` job, keep `pnpm test:related` in a
  required PR lane for changed-source coverage, and reserve
  `pnpm check:static` for non-Vitest static validation so speed work does not
  silently remove evidence.
- OpenSSF baseline tracking for this repository is grounded by `docs/security/2026-04-09-openssf-osps-baseline-status.md`; keep its control matrix synchronized with `security/openssf-scorecard-policy.json` and `scripts/check-scorecard-regressions.mjs`.
- Greptile is a legacy cleanup concern only. Keep active review governance, scaffold defaults, and runtime verification aligned to CodeRabbit, and treat any live Greptile scaffold path as contract drift unless it exists solely to remove or quarantine old artifacts.
- Security/policy hook configuration files must fail closed because of findings, not because the config is syntactically broken; keep Semgrep rule YAML quoted where patterns include mapping-like text such as `shell: true`.
- Security policy routing is part of the security control plane. Changes to
  Semgrep scripts, staged-secret scripts, secret-scanner configuration,
  `.semgrep/**`, `security/**`, `.gitleaks.toml`, or
  `.trufflehog-exclude.txt` must route through
  `codestyle/16-security.md` and the matching security gates so cold agents do
  not under-validate the scripts and configs that enforce scanning.
- Action-review receipts for merge, release, destructive cleanup, or external
  tracker mutation are governance/audit evidence only. Keep
  `action-review-receipt/v1` under `src/lib/action-review/`, require
  independent reviewer identity and canonical actor identity separation, bind
  allow decisions to current evidence refs, and preserve allow/block/mismatch
  semantics. A receipt must not authorize the action, satisfy delivery-truth,
  prove merge readiness, or replace policy-gate, PR closeout, or human approval.

## Code-style parity verification surface

`bash scripts/check-codestyle-parity.sh` is a required verification surface in the bootstrap lane (`bash scripts/codex-preflight.sh --stack auto --mode required`) and in broader readiness checks (`bash scripts/verify-work.sh`).

The parity gate must validate repo-root `CODESTYLE.md`, `codestyle/**`, and `codestyle/CHECKSUMS.sha256`.

Failure mode is intentionally fail-closed: missing code-style files, checksum drift, malformed manifest entries, or path traversal outside repo root must exit non-zero and block readiness until corrected.

## Secret handling

- Never place tokens, keys, or PII in docs, command output, commit text, or memory notes.
- If sensitive material appears in a file, sanitize and rotate as soon as practical.
- Keep environment-specific credentials outside repo and out of command snippets unless placeholders are explicit.
- Keep repo-specific Gitleaks allow lists in the repo-root `.gitleaks.toml` so staged scans and manual secret scans share the same reviewed exceptions.
- CircleCI now owns repo-run non-release security scanning in this repository. Keep `security-scan` in `.circleci/config.yml` and avoid reintroducing non-release GitHub Actions security workflows. The workflow includes the repo-run Semgrep lane and an explicit report-only Snyk dependency lane; Snyk CLI install, auth, and findings must not fail CircleCI PRs that the external GitHub Snyk delta check has cleared. Semgrep Cloud is enforced separately through the external GitHub App check `semgrep-cloud-platform/scan`; do not fold that required check into CircleCI workflow metadata.
- CircleCI PR governance checks must fail closed only after bounded PR-context resolution attempts. The `pr-template` and `linear-gate` jobs may retry `CIRCLE_PULL_REQUEST`, `CIRCLE_PULL_REQUESTS`, branch lookups, and commit-to-PR lookup briefly, but must not bypass PR-template, Linear, or security policy gates when PR context remains unavailable.
- The CircleCI PR-context resolver is a shared packaged helper
  (`scripts/resolve-circleci-pr-ref.sh`), not inline duplicated shell. Keep the
  live CircleCI config, scaffold templates, package files, generated
  environment support-file inventory, and script-level regression tests aligned
  when changing that lookup sequence or retry budget.
- `harness.contract.json` `ciOwnership` is the machine-readable contract for that split: `primaryPrGate` must remain `circleci`, `reviewProvider` must remain `coderabbit`, `securityChecks` must include `semgrep-cloud-platform/scan`, and any GitHub Actions fallback PR workflow must stay manual/emergency-only unless the contract is intentionally migrated.

## Policy-gate risk chain

`harness policy-gate` must fail closed for governed high-risk files. The
repository contract and default contract policy chain map `high` risk to
`block`, and `block` must map to the `fail` verdict. Contract validation and the
public JSON schema reject `policyChain.actionToVerdict.block` values other than
`fail` so a local override cannot make max-tier or high-risk block decisions
look like passes.

Medium-risk files may remain `warn`/`pass` when the contract explicitly allows
that advisory behavior. This distinction keeps low and medium-risk automation
available while preserving the high-risk human-mediated safety floor in the
executable gate, not only in prose.

## Execution-input governance

`execution-input` artifacts can route work, so they are governance-sensitive.
Before acting on `.harness/active-artifacts.md`, confirm each referenced
Linear/spec/plan artifact exists, has a clear lifecycle status, and matches live
branch or PR reality. If the index conflicts with tracked artifacts, local Git
state, or live PR/CI evidence, stop and reconcile instead of implementing.

Review changes to `execution-input` artifacts as control-plane edits. The risk
model is stale or forged routing: an agent could implement the wrong slice, skip
required gates, or treat old validation as current. Mitigations are small diffs,
source links, explicit lifecycle status, exact validation evidence, and
post-change markdown/docs validation.

## Code and data governance

- Validate behavior changes before merge using documented gates.
- Validate behavior changes with the smallest real executable path that exercises the exact production code touched whenever feasible; broad gates are necessary but not sufficient on their own.
- Keep high-trust evidence-bearing test suites covered by `pnpm run quality:behavior-tests` so manifest-listed PR closeout, delivery truth, runtime-card, Local Memory preflight, policy-gate, and external-state snapshot failures carry `Given ... should ...` reproduction context.
- Keep git child-process environment cleanup routed through `src/lib/git/safe-env.ts` and validated by `pnpm run quality:git-env-sanitizer` so hook-provided `GIT_*` state cannot leak into nested fixture repositories.
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
- Treat evidence-bearing tests, git child-process environment handling, and
  durable audit tracking as governance surfaces. Changes in these lanes must
  pass `pnpm run quality:behavior-tests`,
  `pnpm run quality:git-env-sanitizer`, and
  `pnpm run harness:audit-tracking` as applicable before push, because these
  guards stop local assertions, hook-exported git state, or untracked
  `.harness` artifacts from becoming unsupported closeout evidence.
- CircleCI test reliability guardrail: use `pnpm test:ci` (which invokes `scripts/test-ci.sh`) so the long-running `ci-migrate` suite executes in an isolated lane with scoped Vitest worker-timeout mitigation configured in `vitest.config.ts` (timeout settings and `onUnhandledError` handler) while all functional assertions remain enforced.
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
- For fresh git worktrees, run `bash scripts/prepare-worktree.sh` before the first push so the active worktree's repo-local `.mise.toml` is trusted when `mise` is available and local pre-push hooks do not fail from missing dependencies in the new worktree.
- `.mise.toml` trust behavior: `scripts/prepare-worktree.sh` automatically trusts the repository's `.mise.toml` via `mise trust --yes` when both the file and `mise` CLI are present. This grants mise permission to execute the tool definitions in `.mise.toml` without interactive prompts. Security implication: The trust operation runs without user confirmation when conditions are met, relying on repository checkout integrity and the user's PATH configuration. The trust step is skipped silently if `.mise.toml` is absent or `mise` is unavailable. Cache-write failures from `mise trust` emit warnings and do not block worktree preparation, but any other `mise trust` validation errors follow a fail-closed path and will stop the worktree preparation during the VALIDATION state.
- `scripts/prepare-worktree.sh` should auto-attach detached HEAD checkouts to a local branch with base format `branch_base="${BRANCH_PREFIX:-jscraik/feature}/$repo_slug-worktree-$short_sha"` (BRANCH_PREFIX can be overridden with an environment variable and defaults to `jscraik/feature`), check both local and reachable `origin` branch names before choosing that branch name, set `origin/main` tracking when available, and fast-forward to latest `origin/main` before dependency bootstrap so default git branch workflows are available immediately. Ambiguous remote branch lookup must fail closed rather than guessing.
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
- `scripts/check-git-common-config.sh` should fail preflight, verification, and worktree bootstrap if shared non-bare `.git/config` contains `core.worktree`. Repair with `bash scripts/check-git-common-config.sh --repair`, which removes the shared value from the resolved common Git config path; use per-worktree config for worktree-local settings.
- `scripts/new-task.sh` should fetch the latest remote base branch before `git worktree add` so newly created task worktrees start from current upstream commits. If the default-base fetch fails, it should refuse stale local refs unless the caller explicitly passes `--allow-stale-base`.
- `scripts/new-task.sh --bootstrap <issue-key>-<slug>` is the preferred one-shot path when you want creation plus immediate bootstrap in a single command.
- `scripts/codex-enforced` should guard `main` by auto-creating a dedicated `codex/<issue-key>-<slug>` task branch/worktree (via `scripts/new-task.sh --bootstrap`) before launching Codex for feature work.
- Generated `.codex/environments/environment.toml` setup, `Tools` actions, and tool bootstrap actions should invoke `scripts/prepare-worktree.sh` when present so Codex app bootstraps enforce the same hook, dependency, and branch-collision guarantees as manual worktree setup.
- `harness init --check-updates`, `harness init --update`, and `harness upgrade` should auto-repair legacy `.harness/restore-manifest.json` files when `ciProvider` can be inferred safely from `harness.contract.json`, an unambiguous CI layout on disk, or the current requested/default provider.
- If `scripts/run-harness-setup-checks.sh` still hits an incomplete legacy `.harness/restore-manifest.json`, treat it as a drift warning that blocks only the tracked update lane; keep running `check-environment` and repo quality gates, and print the manifest repair remediation explicitly.
- Keep `scripts/codex-preflight.sh` executable as a CLI script and invoke it with `bash scripts/codex-preflight.sh --stack auto --mode required` (or `--mode optional` for softer checks); do not source it. Legacy positional invocations are compatibility-only and default to required Local Memory mode unless `off` or `optional` is explicitly supplied, so older aliases cannot bypass Local Memory by omission.
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

| Hook         | Purpose                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | Runs the leaf adapter `bash scripts/hook-pre-commit.sh` (`pnpm lint`, `pnpm docs:lint`, `pnpm typecheck`, changed-code docstring and size gates, staged `gitleaks`, staged-doc `vale`, related tests); `make hooks-pre-commit` is only a manual wrapper around that leaf adapter.                                                                                                                       |
| `commit-msg` | Validates conventional commit format, reminds about PR template                                                                                                                                                                                                                                                                                                                                         |
| `pre-push`   | Runs the leaf adapter `bash scripts/hook-pre-push.sh` (`validation-locks`, `docs-gate --mode required`, push-scoped diagram freshness, `tooling-audit`, `check-environment`, changed-file `semgrep`, `make codestyle`, `pnpm build`); `make hooks-pre-push` is only a manual wrapper, and environment-only pushes that change only `.codex/environments/environment.toml` run `check-environment` only. |

The staged `gitleaks` lane should prefer the repo-root `.gitleaks.toml` when present so approved fixture/example exceptions are consistent across local hooks, manual scans, and downstream scaffold expectations.
`hooks-commit-msg` remains a required Makefile wrapper even though `prek.toml` only installs `pre-commit` and `pre-push`; use that wrapper for deterministic commit-policy verification and cross-repo governance checks.
`scripts/run-prek.sh` is the supported direct `prek` entrypoint because it defaults `PREK_HOME` to the worktree-local `.cache/prek` directory before invoking `prek`. `scripts/setup-git-hooks.js` must run `scripts/run-prek.sh install --overwrite`, resolve the installed hook directory with `git rev-parse --git-path hooks`, and patch generated `prek` shims to derive `WORKTREE_ROOT` with `git rev-parse --show-toplevel` before setting `PREK_HOME="${PREK_HOME:-$WORKTREE_ROOT/.cache/prek}"` so hook logs/cache writes stay local to the active worktree under sandboxed executions and linked worktrees do not write through the shared git directory.
Hook entrypoints must not invoke hook orchestration commands such as `make hooks-pre-commit`, `make hooks-pre-push`, `.git/hooks/*`, `pre-commit run`, or recursive `prek` hook paths. They may orchestrate leaf validators and scripts only.
`scripts/check-environment.sh` must treat installed generated `pre-commit`, `pre-push`, and `commit-msg` shims without that worktree-local `PREK_HOME` patch as hook drift. It must also fail `prek.toml` drift when `pre-commit` is not restricted to `stages = ["pre-commit"]` or `pre-push` is not restricted to `stages = ["pre-push"]`, with `node scripts/setup-git-hooks.js` or `make hooks` as the repair path.

`validation-locks` is the first pre-push guard so repeated local CI-equivalent
lanes cannot silently stack behind the same repository checkout. The guard uses
repo-contained lock directories and live PID checks rather than conversational
state: active locks fail the push before heavier gates start, while dead locks
are removed by the checker. Keep `scripts/with-validation-lock.sh`,
`scripts/check-validation-locks.sh`, `package.json` validation scripts, and
`scripts/check-environment.sh` synchronized when this contract changes.

`docs-gate` no longer covers only branch/CI governance wording. Local hook, readiness, tooling-runtime, and architecture-context changes are expected to update this guide together with `docs/agents/02-tooling-policy.md`, `docs/agents/00-architecture-bootstrap.md`, and the operator-facing surfaces (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`) in the same change so pre-push drift is caught before GitHub does.
Agent-native cockpit changes that alter next-action safety, generated environment actions, or hook setup must preserve that same docs-gate synchronization so permission, execution-profile, and validation evidence remain auditable before merge.
Port-free usage should remain scoped to app-style run actions that map to `dev`/`start` scripts. CLI-only repositories can omit port-free run actions without violating governance.

## Frontmatter metadata

- `last_validated` must use ISO date format (`YYYY-MM-DD`) and represents when the document was last verified against current tooling or governance behavior.
- Update `last_validated` when validation wrappers, required checks, or policy contracts change and this document is re-checked.
- Keep `last_validated` aligned with any in-body freshness marker (for example `Last updated:`) so document evidence is not contradictory.

## Action review governance

This repository uses `action-review-receipt/v1` as a narrow guardian-style receipt contract for high-risk actions:

- **Packet type**: `action-review-receipt/v1` is a review artifact, not an executor, approval token, or delivery-truth proof
- **High-risk action envelopes**: merge, release, destructive cleanup, and external tracker mutation require current evidence refs and head SHA
- **Reviewer independence**: reviewer must not be the same as requester/producer (no self-approval)
- **Canonical actor identity separation**: reviewer and requester canonical identity refs must differ (not only by display alias or shared runtime/source identity ref)
- **Decision semantics**: allow, block, mismatch, unknown, N/A
  - `allow` verdicts require current supporting evidence, non-expired review time, independent reviewer identity, differing canonical identity refs, and no unresolved blockers
  - `block` and `unknown` verdicts must carry blocker classes and next action text
  - `mismatch` verdicts must require expected and actual action envelopes plus explicit mismatch reason
  - N/A verdicts are forbidden for merge, release, destructive cleanup, and external tracker mutation envelopes
- **Docs-gate requirement**: these companion documentation surfaces must be updated in the same PR as any action-review governance change
- **Reference diagrams**: see `AI/context/diagram-context.md` for required architecture diagrams

## Plan traceability

- Pull requests must declare `Plan IDs` in the PR template `## Work performed` ledger.
- Each declared ID must resolve to a `docs/plans/*` document with matching `plan_id` frontmatter.
- Completed acceptance checklist items in referenced plans must carry evidence links or refs before merge.
- `risk-policy-gate` enforces this in CI, and `review-gate` treats missing or invalid plan traceability as a merge blocker even when the review check itself passed.

### Local Semgrep Scope

`scripts/check-semgrep-changed.sh` is intentionally narrow: it compares `HEAD`
to the upstream merge-base, or the nearest main/master fallback, filters to
changed implementation files under `src/**`, and runs only the local
`scripts/semgrep-pre-push.yml` ruleset. The shared Semgrep bootstrap keeps
local scanner runtime state in the worktree-local ignored `.cache/semgrep`
directory by default; use `SEMGREP_STATE_ROOT` only when a controlled CI or
operator cache location is intentional.

### Safety Aggregate

`pnpm run safety:local` is the explicit local safety aggregate for agent
handoff. It runs `secrets:staged` and `semgrep:changed` so local handoff can
catch focused security drift without duplicating the full CI security scan.

### Verify-Work Recording

`scripts/verify-work.sh` records the local safety gates as
available-but-not-run unless the operator runs `pnpm run safety:local`
separately.

### Version Alignment

Keep the local Semgrep script pinned to the same version used by the CircleCI
`security-scan` lane in `.circleci/config.yml` (`semgrep==1.153.1`) so local
and CI findings stay aligned.

### Snyk Workflow

CircleCI runs Snyk through an explicit report-only CLI step with `SNYK_TOKEN`
supplied by CircleCI project environment variables. Install failures, auth
failures, and issue findings must not fail the workflow because the external
GitHub Snyk PR check remains the blocking dependency-delta signal.

### Semgrep Cloud

Keep Semgrep Cloud's `semgrep-cloud-platform/scan` branch-protection check as
an independent external app gate.

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
- ## Work performed (plan IDs, phase/slice, session IDs, trace IDs, AI session/traceability mapping, completed work, documentation impact, documentation lifecycle impact, SemVer impact, acceptance trace, validation evidence, review artifacts, learning/reinforcement, deferred work)
- ## Checklist (all items checked)
- ## Testing (test commands and evidence)
- ## Review artifacts (links to review outputs)
- ## Notes (merge rationale, risks, rollback)
