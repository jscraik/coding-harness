---
last_validated: 2026-05-09
---

# Tooling policy

- [Verified command authority](#verified-command-authority)
- [Tool and shell defaults](#tool-and-shell-defaults)
- [Required tooling baseline](#required-tooling-baseline)
- [Codex environment actions](#codex-environment-actions)
- [Repository command contract](#repository-command-contract)
- [Code-style parity gate](#code-style-parity-gate)
- [Execution rule for tooling](#execution-rule-for-tooling)
- [Exact behavior checks](#exact-behavior-checks)
- [Recommended command order](#recommended-command-order)
- [Tooling verification checklist](#tooling-verification-checklist)
- [Discovery constraints](#discovery-constraints)
- [Escalation triggers](#escalation-triggers)
- [Private npm package setup](#private-npm-package-setup)
- [Local auth](#local-auth)
- [CI auth](#ci-auth)
- [Verification](#verification)
- [Required .npmrc settings for this repository](#required-npmrc-settings-for-this-repository)
- [CI migration governance artifacts](#ci-migration-governance-artifacts)
- [Project-type auto-detection](#project-type-auto-detection)

## Verified command authority

For all repo operations, this repository treats scripts and package manager settings from repo files as authoritative:

- `package.json` (`packageManager`, scripts, repository command contract)
- `pnpm-lock.yaml` (lockfile and package provenance)
- `tsconfig.json` (TypeScript and module rules)

## Tool and shell defaults

- Shell: `zsh -lc`.
- Discovery: `rg`, `fd`, and `jq` (when available).

- File reads: keep snippets bounded and explicit. For TypeScript-family source
  in this checkout, prefer `bash scripts/harness-cli.sh source-outline <path>
--json` before opening the raw file, then use `--symbol <name>` when
  implementation detail is actually needed. In downstream repositories, the
  installed command shape is `harness source-outline <path>`.

- Do not add dependencies or global tool changes unless requested.
- Optional local shell helper: `source scripts/codex-shell-helpers.sh` to expose preflight wrappers and `codex_d`/`cdxd` launchers. These wrappers use `codex --profile d --cd <repo-root> "<PROMPT>"`, where the prompt is positional (not `-p`).

## Required tooling baseline

Harness-managed repositories should treat this CLI surface as required:

- `prek`
- `diagram`
- `ralph`
- `mise`
- `vale`
- `argos`
- `cosign`
- `cloudflared`
- `vitest`
- `ruff`
- `eslint`
- `agent-browser`
- `agentation` via `agentation-mcp`
- `mermaid-cli` via `mmdc`
- `markdownlint-cli2`
- `wrangler`
- `beautiful-mermaid`
- `semgrep`
- `semver`
- `trivy`
- `rsearch` for arXiv research
- `wsearch` for Wikidata search
- `make`

Repo-managed pins should live in `.mise.toml` where the tool can be managed there. Externally managed CLIs must still be present on `PATH`, and missing commands should block environment readiness rather than degrade silently.
The root `Makefile` is also part of the enforced baseline and must retain the harness contract targets required by `scripts/check-environment.sh`.
`CODESTYLE.md` and `scripts/validate-codestyle.sh` are part of the same baseline. A harness-managed repo should fail readiness if either file is missing or if the validator no longer maps cleanly to repo-defined scripts.
`scripts/check-codestyle-parity.sh` is part of the same governed surface and must fail closed when `codestyle/` or `codestyle/CHECKSUMS.sha256` drift.
For this repository only, the repo-root `CODESTYLE.md` path may be a symlink to `/Users/jamiecraik/.codex/instructions/CODESTYLE.md` so the authoring source stays global while repo-local enforcement still targets the root path.
For this repository only, `biome check` should ignore the repo-root `CODESTYLE.md` path so CI linting stays deterministic even when that developer-home symlink target is absent on hosted runners.
For this repository only, `scripts/codex-preflight.sh` should honor that documented `CODESTYLE.md` symlink exception via `.codex/preflight-allowed-external-paths.txt` or `CODEX_PREFLIGHT_ALLOWED_EXTERNAL_PATHS` instead of failing the repo-root path check.
For this repository only, scaffold rendering and published builds must package a real checked-in `src/templates/CODESTYLE.md` copy so CI and downstream installs do not depend on a developer-home symlink resolving at runtime.
For this repository only, `src/templates/codex-preflight.sh` is the canonical authored source for the downstream scaffold. Keep the repo runtime mirror at `scripts/codex-preflight.sh` byte-identical by running `node scripts/sync-codex-preflight.cjs --write`; `pnpm lint` enforces `--check` so drift fails fast.
For this repository only, `scripts/codex-preflight.sh` remains the public shell entrypoint, but structured Local Memory checks should run through the typed helper path (`local-memory-preflight`) when a harness runner is available. Keep `scripts/codex-preflight-local-memory-legacy.sh` only as the compatibility fallback for repos that cannot yet execute the helper.
For shared or distributed harness-managed repos, keep `CODESTYLE.md` as a real repo-local file scaffolded from the canonical authoring source rather than a user-home symlink.
This baseline is now a first-class contract surface under `harness.contract.json > toolingPolicy`, and `harness tooling-audit --path <dir>` should be used when checking rollout drift across multiple repositories.
Project Brain memory-extension enforcement is also part of this tooling contract under `toolingPolicy.projectBrainMemoryExtension`: when `enabled=true`, readiness and tooling-audit should require the listed `.harness/**` control-plane paths to exist (project-local only, never workspace-global). The baseline includes `.harness/README.md` as the selective tracking map, plus curated knowledge, decision, quality, and review-log surfaces.
Selective `.harness` tracking is a tooling contract: Markdown policy/decision/execution/context files and validator-consumed JSON contract files should be tracked, while runtime databases, backups, caches, run output, and bulk snapshots should stay ignored unless promoted to fixtures.
For repositories with UI or ChatGPT Apps SDK dependency signals, `toolingPolicy.packagePolicy` also requires `@brainwav/design-system-guidance` in `package.json`.
`docs-gate` now also treats tooling/runtime contract changes as documentation-authoritative work, so changes to hook wiring, readiness scripts, `.mise.toml`, or generated Codex environment actions should be landed with updates to this guide and `docs/agents/06-security-and-governance.md`.
When those changes also touch validation/required-check or architecture-context categories, land the same PR with synchronized updates to `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, and `docs/agents/00-architecture-bootstrap.md`.
For agent-native cockpit changes, keep `harness next --json` command recommendations aligned with this command contract, generated environment actions, and the hook/readiness scripts that prove the recommended next action is safe to run.

The local hook contract is intentionally split by drag profile:

- `prek install --overwrite` (via `scripts/setup-git-hooks.js`) is the only supported hook installer path. Repositories should not keep legacy `simple-git-hooks` package metadata or post-install bootstraps once they migrate.
- `scripts/setup-git-hooks.js` is the required wrapper around `prek install --overwrite`; it must resolve the installed hook directory with `git rev-parse --git-path hooks` and patch generated hook shims in that resolved directory to set `PREK_HOME="${PREK_HOME:-$HERE/../.cache/prek}"` so hook logging works in sandboxed/home-read-only environments and legacy `.legacy` wrappers do not linger.
- `scripts/check-environment.sh` must fail generated `prek` hook drift when installed `pre-commit`, `pre-push`, or `commit-msg` shims lack the repo-local `PREK_HOME` patch. Repair drift with `node scripts/setup-git-hooks.js` or `make hooks`, not raw `prek install`.
- `pre-commit` stays fast and now adds staged `gitleaks`, staged-doc `vale`, and `vitest related` alongside `lint`, `docs:lint`, and `typecheck`.
- The staged secret scan should use the repo-root `.gitleaks.toml` when present so fixture/example allow lists live in version control instead of hidden local defaults.
- `pre-push` keeps the heavier governance lane and now adds a narrow changed-files `semgrep` scan for `src/**` plus `pnpm build` before `audit`.
- `hooks-commit-msg` is the canonical wrapper target for commit-message policy checks. Keep it available even though `prek.toml` installs only `pre-commit` and `pre-push`.
- The Semgrep lane is path-filtered to changed implementation files under `src/**` and uses the local ruleset at `scripts/semgrep-pre-push.yml` to avoid turning pre-push into a full repo scan.
- `scripts/check-semgrep-changed.sh` pins the Semgrep version (`semgrep==1.153.1`) for changed-file hooks, and `scripts/check-semgrep-full.sh` reuses the same pinned runtime for full-repository CI scans. The CircleCI `security-scan` job calls `bash scripts/check-semgrep-changed.sh --all` directly. Keep both scripts, the `pnpm semgrep:changed` script, and the CircleCI `security-scan` invocation aligned when changing the Semgrep version.
- Semgrep Cloud enforcement is a separate external GitHub App required check named `semgrep-cloud-platform/scan`. Keep it in branch-protection required-check policy and do not model it as a CircleCI job.
- OpenSSF scorecard posture drift is tracked by the repo status document `docs/security/2026-04-09-openssf-osps-baseline-status.md` and evaluated against `security/openssf-scorecard-policy.json` via `scripts/check-scorecard-regressions.mjs`; keep those surfaces aligned when scorecard policy changes.
- CodeRabbit custom `ast-grep` rules for this repository live under `rules/`; keep them narrowly scoped to repo-specific contracts such as the required `.js` extension on relative ESM imports.

## Codex environment actions

The canonical Codex environment file is `.codex/environments/environment.toml`.

Harness-managed repositories should treat that file as autogenerated and keep these action/icon classes hardwired:

- `tool`: setup and utility actions such as `Tools` (compatibility-required), `Tooling` (expanded diagnostics), `Diagram`, `Mise`, `Agent Browser`, `Agentation`, `1Password`, `Beautiful Mermaid`, `Auth0`, `Semver`, `Research`, and `WSearch`
- `run`: runtime or deploy-adjacent actions such as `Run`, `Wrangler`, and `Cloudflared`
- `debug`: validation and analysis actions such as `Debug`, `Ralph`, `Vale`, `Cosign`, `Ruff`, `ESLint`, `MarkdownLint`, `Semgrep`, `Trivy`, and `Gitleaks`
- `test`: verification actions such as `Test`, `Prek`, `Argos`, and `Vitest`

`scripts/check-environment.sh` is expected to fail if those required action/icon pairs drift out of the generated file.
`Tools` must stay present for contract compatibility while `Tooling` can be added as an alias with richer version diagnostics.
The autogenerated setup and `Tools` action scripts in downstream scaffolded repositories should auto-attach detached git worktrees to a local `jscraik/feature/<repo>-worktree-<short-sha>` branch, set upstream tracking to `origin/main` (when available), and fast-forward to latest `origin/main` before dependency/bootstrap commands run. In this repository, Linear-tracked task branches remain `codex/<issue-key>-<slug>` unless a caller explicitly supplies a different branch prefix for downstream fixture validation.
Generated Codex environment actions are part of Flow Ops closure-evidence readiness: when release, diagram-context, or docs-gate commands depend on generated setup behavior, keep this tooling contract synchronized with the matching governance and architecture docs.
Port-free wrapping is expected only for app run actions backed by `dev`/`start` scripts; CLI-first repositories may not include a port-free run action.

### Worktree branch naming convention

The `scripts/prepare-worktree.sh` script defines a canonical branch naming convention for worktree-readiness branches:

**Format:** `jscraik/feature/$repo_slug-worktree-$short_sha`

**Components:**
- `$repo_slug`: sanitized repository directory name (lower-case, non-alphanumeric characters replaced with hyphens, leading/trailing hyphens trimmed)
- `$short_sha`: short commit SHA from `git rev-parse --short HEAD`

**Example:**
For a repository named "coding-harness" with commit `abcdef1`, the generated branch name would be:
```
jscraik/feature/coding-harness-worktree-abcdef1
```

**Expected callers/consumers:**
- Generated downstream setup surfaces in scaffolded repositories
- Generated Codex environment setup actions
- Generated `Tools` actions in `.codex/environments/environment.toml`
- `make worktree-ready` wrapper target
- Manual or agent bootstrap runs in temporary worktrees
- `scripts/prepare-worktree.sh` when invoked directly

**Tooling guidance:**
Branch name consumers should treat this pattern as an agent worktree-readiness branch intended for bootstrap and hook execution. This is distinct from Linear-tracked task branches (`codex/<issue-key>-<slug>`). When detecting branches, tooling should:
- Recognize the `jscraik/feature/*-worktree-*` pattern as a transient readiness branch
- Not infer Linear ownership or task tracking from this prefix
- Allow normal branch operations (push, pull, merge) but consider these branches ephemeral
- Handle collision suffixes: if the base branch name exists, `prepare-worktree.sh` appends `-1`, `-2`, etc.

## Repository command contract

| Surface                        | Primary command                                                                                     | Purpose                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install/deps                   | `pnpm install`                                                                                      | Dependency installation                                                                                                                                       |
| Code-style gate                | `bash scripts/validate-codestyle.sh`                                                                | Fail-closed repo-local code-style validation                                                                                                                  |
| Quality gate                   | `pnpm check`                                                                                        | `lint + typecheck + test + audit`                                                                                                                             |
| Lint                           | `pnpm lint`                                                                                         | `biome check .`                                                                                                                                               |
| Typecheck                      | `pnpm typecheck`                                                                                    | `tsc --noEmit`                                                                                                                                                |
| Tests                          | `pnpm test`                                                                                         | `vitest run`                                                                                                                                                  |
| Tests (CircleCI hardened lane) | `pnpm test:ci`                                                                                      | Runs standard suites plus isolated `ci-migrate` run with targeted Vitest worker-timeout mitigation                                                            |
| Audit                          | `pnpm audit`                                                                                        | dependency risk check                                                                                                                                         |
| Build                          | `pnpm build`                                                                                        | compile TypeScript and generate `dist/cli.js`                                                                                                                 |
| CodeRabbit learnings import    | `harness learnings import --provider coderabbit-csv --source <csv> --repo <repo> --json`            | Import local CodeRabbit CSV evidence into `.harness/learnings/coderabbit.local.json`                                                                          |
| CodeRabbit learnings gate      | `harness learnings gate --source .harness/learnings/coderabbit.local.json --files <files> --json`   | Match imported learning evidence to exact files and explicit path-prefix targets before review                                                                |
| CodeRabbit learnings promote   | `harness learnings promote --source .harness/learnings/coderabbit.local.json --min-usage 25 --json` | Generate high-usage promotion candidates so repeated learnings can become permanent gates, validators, scaffold rules, or documented exceptions               |
| Review context pack            | `harness review-context --source .harness/learnings/coderabbit.local.json --files <files> --json`   | Generate PR review context with applicable learning evidence and validation-plan entries                                                                      |
| Validation plan                | `harness validation-plan --source .harness/learnings/coderabbit.local.json --files <files> --json`  | Recommend repo-canonical validation commands from changed files and imported validation-contract learnings, with network-required commands separated          |
| North-star feedback            | `harness north-star-feedback --source .harness/learnings/coderabbit.local.json --json`              | Measure learning-loop hits, promoted learnings, high-usage unenforced items, and review feedback reduction signals for closeout evidence                      |
| Artifact provenance gate       | `harness artifact-gate --files <files> --json`                                                      | Check generated artifact changes against `.harness/artifact-provenance.json` so source/template changes accompany runtime mirrors                             |
| CI ownership gate              | `harness ci-ownership-gate --json`                                                                  | Validate that CircleCI owns the primary PR workflow while CodeRabbit and Semgrep Cloud remain independent required checks                                     |
| Existing-repo upgrade matrix   | `pnpm test:harness-upgrade-matrix -- <repo>...`                                                     | Run the built CLI package `init --update --dry-run --json` path across existing repos and fail if any target git status changes or omits update-mode evidence |
| Fleet remediation plan         | `harness fleet-plan --from artifacts/harness-upgrade-matrix-dev.json --json`                        | Convert the upgrade matrix artifact into agent-native next commands with safe dry-run boundaries and approval-required mutation steps                         |
| Current-repo upgrade preview   | `harness upgrade --dry-run --json`                                                                  | Preview tracked updates or existing-repo adoption with structured `updateMode`, `trackedManifest`, and `updateDetails` evidence                               |

**Phase 1A** supports `harness learnings import`, including local evidence at `.harness/learnings/coderabbit.local.json` and sanitized shareable output at `.harness/learnings/coderabbit.snapshot.json`. Shareable snapshots must redact sensitive token-like text and local `/Users/...` paths while preserving public GitHub URLs and row labels. Optional `--live-companion <json>` input accepts `live-companion/v1` coarse provider metadata for freshness context only; CodeRabbit CSV remains the only row-level learning source, and live companion metadata must keep `rowLevelEvidence=false`.

**Phase 1B** supports `harness learnings gate` for exact-file and explicit path-prefix matching.

**Phase 1C** supports `harness learnings promote` for promotion-candidate reporting.

**Phase 3** supports `harness review-context` plus `harness validation-plan` output.

**Phase 4** starts artifact provenance checks with `harness artifact-gate` plus CI ownership checks with `harness ci-ownership-gate`.

**Phase 4c** promotes the highest-signal scaffold-default learnings into generated-repo regression coverage for auth-free `.npmrc`, repo-local `scripts/harness-cli.sh`, real `CODESTYLE.md` templates, wrapper-first environment checks, first-class `toolingPolicy`, and Codex environment action sync.

**Implementation notes:** Treat imported CodeRabbit CSV rows as local, non-live operational evidence (`source.live=false`) unless a sanitized snapshot is explicitly requested. Strict review-context mode (`requireReviewContext: true`) is supported through review-gate configuration. Keyword-only fuzzy blocking and fuzzy/keyword-only gating remain reserved for later phases and must stay rejected until those command contracts land.
Rollback for learning-loop regressions: disable the affected gate at the invoking workflow or restore the prior `.harness/learnings/coderabbit.local.json` and `.harness/learnings/coderabbit.snapshot.json` snapshots, revert the command-specific change for `harness learnings import`, `harness learnings gate`, `harness learnings promote`, `harness review-context`, `harness validation-plan`, `harness artifact-gate`, `harness ci-ownership-gate`, or `harness north-star-feedback`, then run `harness upgrade --dry-run --json` to verify restoration before re-enabling enforcement.

Before restoring `last_validated` or re-enabling enforcement, prove the affected command family itself with the smallest real command path: `harness learnings gate --source .harness/learnings/coderabbit.local.json --files <files> --json`, `harness review-context --source .harness/learnings/coderabbit.local.json --files <files> --json`, `harness validation-plan --source .harness/learnings/coderabbit.local.json --files <files> --json`, `harness artifact-gate --files <files> --json`, `harness ci-ownership-gate --json`, or `harness north-star-feedback --source .harness/learnings/coderabbit.local.json --json`. The proof must exit `0` and emit valid JSON with either `status` or the command-specific result fields plus evidence references when that command produces them.

## Code-style parity gate

`bash scripts/check-codestyle-parity.sh` is a required bootstrap verification surface under the same gate family as `bash scripts/codex-preflight.sh --stack auto --mode required` and `bash scripts/verify-work.sh`.

It verifies:

- repo-root `CODESTYLE.md`
- `codestyle/**`
- `codestyle/CHECKSUMS.sha256`

Expected failure behavior is fail-closed: if any required code-style file is missing, if a checksum entry drifts, or if a manifest path resolves outside repo root, the command exits non-zero and readiness claims are blocked until parity is restored.

## Execution rule for tooling

Use repo scripts as the source of truth and do not assume global shortcuts. If a command is unavailable in the environment, record it immediately and treat the corresponding validation gate as blocked until rerun in an environment with the command.

Exception for harness readiness:

- Generated `scripts/check-environment.sh` in harness-managed repositories should prefer a dedicated harness runner using the following lookup order:
  1. `pnpm exec tsx src/cli.ts` (when repo-local TS source exists)
  2. `bash scripts/harness-cli.sh`
  3. `mise which harness`
  4. global `harness` binary
- `scripts/run-harness-gate.sh` should treat the real source CLI command as the source-checkout probe. Do not gate fallback on a separate runner version probe; in sandboxed runners, that probe can hit the same IPC `EPERM` startup failure that the fallback is meant to handle. Fallback to `node dist/cli.js` is allowed only for the explicit `listen EPERM: operation not permitted` runner temp-pipe signature.
- This lookup order avoids stale Homebrew/global binaries shadowing the pinned runtime toolchain.
- Keep `scripts/check-environment.sh` validation-only for `mise`: it may assert that `mise` exists, is trusted, and can activate the repo, but CI/bootstrap flows must install `mise` and run `mise trust --yes .mise.toml` before invoking the gate.
- The global fallback install path is `npm i -g @brainwav/coding-harness`.
- Private package auth must be wired where the global fallback is used:
  - Local shell: `export NPM_TOKEN=<token>`
  - GitHub Actions: `env: NPM_TOKEN: ${{ secrets.NPM_TOKEN }}`
- Harness-managed repos may also scaffold `scripts/harness-cli.sh` as the repo-local wrapper for the published CLI package. That wrapper must resolve `@brainwav/coding-harness/dist/cli.js` from the current repo and fail with actionable install hints such as `pnpm install`, `pnpm add -D @brainwav/coding-harness`, and `pnpm exec harness <command>` instead of surfacing a raw `MODULE_NOT_FOUND`.
- Semgrep hook configs under `scripts/` must remain valid YAML as well as valid Semgrep syntax; quote pattern strings that contain mapping-like fragments such as `shell: true` so pre-push parsing does not fail before policy checks run.

## Exact behavior checks

When executable behavior changes, do not stop at broad validation alone. Run
the smallest real code path that exercises the exact production code touched
before claiming the change is verified.

Prefer invoking the production function, class, CLI command, shell script,
validator, or route directly. If no existing test covers the path, create a
temporary local reproduction harness under `codex-scripts/`, keep it
gitignored, and import or invoke production code directly instead of copying
implementation into the harness.

If the exact path cannot run because it depends on unavailable credentials,
external services, unsafe side effects, or missing generated runtime state,
state that blocker explicitly, run the nearest meaningful validation, and do
not describe production behavior as verified unless the touched path actually
ran.

Changed production source also carries three local ratchet gates:
`pnpm run quality:docstrings` requires JSDoc on changed exported public API
declarations, `pnpm run quality:size` enforces changed-file function/file size
limits with explicit legacy allowlists, and `pnpm run test:related` runs Vitest
related mode without a no-tests pass-through. These commands are part of
`pnpm check`, `bash scripts/validate-codestyle.sh --fast`, and
`make hooks-pre-commit`.

## Recommended command order

For code changes:

1. Inspect TypeScript-family target files with `bash scripts/harness-cli.sh
source-outline <path> --json`; unwrap only the needed symbol with `--symbol
<name>` before reading full bodies.

2. Apply minimal patch.
3. Run the smallest real executable path that exercises the exact production code touched whenever feasible.
4. Run `bash scripts/validate-codestyle.sh --fast`.
5. Run `bash scripts/validate-codestyle.sh` before handoff.
6. Run `pnpm test:deep` when runtime or artifact behavior changed beyond the baseline code-style gate.

For CircleCI parity checks and migration troubleshooting, run:

1. `pnpm test:ci`

For harness setup or scaffold sync verification in this repository, run:

1. `bash scripts/run-harness-setup-checks.sh`

For fresh git worktrees before first push, run:

1. `bash scripts/prepare-worktree.sh`
2. `make worktree-ready` is an equivalent wrapper target
3. `bash scripts/new-task.sh --bootstrap <issue-key>-<slug>` is the optional one-command lane that creates then bootstraps the worktree immediately.
4. `./scripts/codex-enforced --worktree-slug <issue-key>-<slug> "<prompt>"` auto-creates and bootstraps a dedicated worktree when launched from `main`, then re-runs Codex inside that worktree.

The helper codifies the required sequence: `bash scripts/codex-preflight.sh --stack auto --mode required`, `pnpm build`, `harness init --check-updates` (and `--update` when needed), `bash scripts/check-environment.sh` (which resolves and validates pinned `uv`), and `pnpm check`.
`scripts/prepare-worktree.sh` is the lightweight bootstrap lane for new worktrees; it ensures dependencies are installed in the active worktree so pre-push hooks that execute `pnpm` gates do not fail from missing `node_modules/`.
When `scripts/prepare-worktree.sh` sees a detached HEAD, it must compute `branch_base="jscraik/feature/$repo_slug-worktree-$short_sha"`, create a local branch from that base with a numeric suffix only on collision, wire `origin/main` tracking when present, and fast-forward to latest `origin/main` so branch-aware workflows (for example `git pull` without explicit ref args) do not fail on fresh worktree sessions.
The expected callers and consumers are generated downstream setup surfaces, generated Codex environment setup, generated `Tools` actions, `make worktree-ready`, and human or agent bootstrap runs in temporary worktrees. For example, a detached checkout in `coding-harness` at `abcdef1` should attach to `jscraik/feature/coding-harness-worktree-abcdef1`. Tooling that reads branch names must treat this as an agent worktree-readiness branch, not as a Linear-tracked `codex/<issue-key>-<slug>` task branch.
`scripts/check-git-common-config.sh` must run before worktree-sensitive Git operations in preflight, verification, and worktree bootstrap. It fails when shared non-bare `.git/config` contains `core.worktree`, because that pins all linked worktrees to one path and can make temp PR fixtures poison the main checkout.
In this repository, `scripts/new-task.sh` should fetch the latest remote base branch (`origin/<base>`) and create the worktree branch from that updated ref under `codex/<issue-key>-<slug>` by default so fresh Linear-tracked task worktrees start from current upstream state while matching repo-local branch policy. The init scaffold renderer rewrites the emitted downstream helper default to `jscraik/feature/<issue-key>-<slug>` so generated repositories keep the downstream scaffold branch-prefix contract without changing this repository's local default.
`scripts/codex-enforced` should treat `main` as protected task-entry context: auto-create a dedicated `codex/<issue-key>-<slug>` worktree branch via `scripts/new-task.sh --bootstrap`, then re-launch Codex inside the new worktree.
Generated `.codex/environments/environment.toml` setup and `Tools` actions should run `scripts/prepare-worktree.sh` when available so Codex app bootstrap follows the same branch-attach, dependency, and hook-sync contract as manual worktree setup.
`harness init --check-updates`, `harness init --update`, and `harness upgrade` now auto-repair legacy `.harness/restore-manifest.json` files when `ciProvider` can be inferred from `harness.contract.json`, an unambiguous CI layout on disk, or the current requested/default provider.
If provider inference is still ambiguous, treat the incomplete manifest as a repo-drift warning for the update lane, print the remediation, and continue the remaining setup gates instead of aborting the whole audit.
`scripts/codex-preflight.sh` is a CLI script and should be executed, not sourced. Use `bash scripts/codex-preflight.sh --stack auto --mode required` for standard checks (or `--mode optional` for softer checks).
Scaffolded CI bootstrap should install pinned `pnpm` versions through a user-writable prefix (`$HOME/.local`) and persist that bin path through `$BASH_ENV` or `$GITHUB_PATH`; do not rely on `corepack enable` mutating privileged system shims such as `/usr/local/bin/pnpm`.
When Local Memory is enabled in required mode, `scripts/codex-preflight.sh` should validate the pinned REST host/port from `~/.local-memory/config.yaml` before trusting `local-memory status --json`, so healthy daemons on `127.0.0.1` do not trigger duplicate restart behavior from stale CLI status output.
The legacy shell fallback at `scripts/codex-preflight-local-memory-legacy.sh` must validate `rest_api.host`, `rest_api.port`, and `rest_api.auto_port` from that same config block directly, not by matching unrelated keys elsewhere in the file.
Local Memory REST health retries in the legacy shell fallback should use a bounded curl budget, and `run_local_memory_preflight_via_harness` should continue to the next harness candidate when a helper exits with sentinel code `3` (`unavailable`) instead of failing closed early.
`scripts/verify-work.sh` is the canonical repo-local verification entrypoint for harness-managed repos. Keep it repo-local, default it to `required` Local Memory mode, and scope its preflight path/binary expectations to scaffolded repo artifacts rather than codex-maintenance-only paths.
Hook-governance checks in `scripts/verify-work.sh` should default to `project-local` scope, use temporary outputs in local mode, and require an explicit `--workspace-governance` flag before reading workspace manifests or writing shared governance reports.

Environment variables controlling external normalization behavior:

- `HARNESS_VERIFY_WORK_SKIP_EXTERNAL_NORMALIZATION` — When set to an enabled value (`1`, `true`, `yes`, or `on`, case-insensitive where applicable), skips external manifest normalization invoked by the verify-work script (the normalization flow that may call external tools such as mise-provided harness or harness on PATH when attempting to normalize `.harness/ci-required-checks.json`). Defaults to unset (external normalization is attempted). Security/operational implication: setting this variable bypasses the external harness binary fallback path and may cause verify-work to use raw-fallback manifest mode if the repo-local dist CLI or pnpm/tsx runners also fail; see the `prepare_normalized_required_checks_manifest` function in `scripts/verify-work.sh` for behavior details.
- `HARNESS_VERIFY_WORK_EXTERNAL_NORMALIZE_TIMEOUT_SECONDS` — Configurable timeout in integer seconds for external normalization operations (for example mise which harness invocations). Defaults to `5` when unset. Security/operational implication: increasing this timeout allows slower external tool resolution at the cost of longer verify-work startup delays when external harness binaries are present but slow to resolve; see `external_normalization_timeout` usage in `scripts/verify-work.sh` for the timeout application point.
  `scripts/validate-codestyle.sh` is the canonical fail-closed code-style gate for harness-managed repos. Keep it wired to repo-defined scripts, make it fail when required scripts are absent, and reuse it from `verify-work`, hooks, and downstream repo docs rather than re-describing divergent command bundles in each place.
  When `scripts/validate-codestyle.sh` runs inside git hooks, it should clear hook-injected repository-bound `GIT_*` variables before invoking `pnpm run` scripts so fixture-local git checks execute against their own repositories instead of the parent hook context.
  Active AI-review scaffolding in this repository is CodeRabbit-first. Any remaining Greptile references in active tooling or scaffold paths should exist only for legacy cleanup and migration safety, not for new repo scaffolding or current review enforcement.
  `scripts/check-diagram-freshness.sh` should compare only git-tracked diagram artifacts before and after refresh. gitignored `.diagram/` refresh output outside tracked files must not fail `pre-push` with an empty "Changed tracked files" list.

## Tag-driven private npm release workflow

- Canonical publish workflow: `.github/workflows/release-private-npm.yml`
- Trigger: semantic-version tag pushes matching `vX.Y.Z` (for example `v0.12.0`) and guarded manual dispatch.
- Publish authority: GitHub Actions OIDC trusted publishing (default) with optional token fallback (`publish_auth=token`) for bootstrap recovery.
- CircleCI is non-release only in this repository. The only release-adjacent behavior allowed there is verification-only gating; do not add `pnpm publish`, token-based publish, or GitHub release creation steps there.
- Keep release docs and scaffolds aligned with this split:
  - CircleCI: PR governance and security checks.
  - GitHub Actions: private npm publish + attestation + GitHub release creation.

## Tooling verification checklist

Before claiming a change is verified, confirm:

- The command invoked exists in repo docs or scripts.
- The command version/source is not in conflict with lockfile or repo settings.
- Output is captured in closeout notes.
- The repo-local tooling inventory at `docs/agents/tooling.md` stays aligned with `scripts/check-environment.sh` and `.mise.toml`.

## Discovery constraints

- Prefer `rg` for content search.
- Use `fd` when you need file-name discovery.
- Use `jq` for JSON filtering/transforms.

## Escalation triggers

Stop and ask before proceeding if:

- You must deviate from `pnpm` due to environment constraints.
- A required command is absent.
- `pnpm` script behavior conflicts with local/global docs.

## Private npm package setup

Harness-managed repos should keep a project-level `.npmrc`, but it must stay
scope-only and auth-free. `harness init` scaffolds the baseline file with
security defaults plus the `@brainwav` scope mapping to `registry.npmjs.org`.

Use this project-level shape:

```bash
# .npmrc
@brainwav:registry=https://registry.npmjs.org/
ignore-scripts=true
```

Do not put `//registry.npmjs.org/:_authToken=...` in the repo `.npmrc`. That can
override a valid user `npm login` and break local installs.

### Local auth

For developer machines, auth should come from user-level `~/.npmrc` or a valid
`npm login` session. A workstation may also source `NPM_TOKEN` from 1Password,
but that token should populate user-level npm auth rather than a repo-local
auth override.

### CI auth

For CI repos, inject auth into `~/.npmrc` at runtime using repository secrets,
for example by appending `//registry.npmjs.org/:_authToken=$NPM_TOKEN` in the
workflow before install steps.

### Verification

Start with `harness upgrade --dry-run` for routine upgrades in existing installs.
If the baseline `.npmrc` is missing and needs to be re-scaffolded, run
`harness init --update`, then `harness verify-coderabbit` to confirm
that the repo keeps scope routing and security defaults without a repo-local
auth token override. Use `harness verify-coderabbit --json` for machine-readable output. If a scaffolded `scripts/harness-cli.sh` wrapper cannot
resolve the local package, treat that as bootstrap drift in the repo install,
not as a harness command logic failure.

## Required .npmrc settings for this repository

The `.npmrc` in this repository sets:

- `ignore-scripts=true` - Security: block scripts from dependencies
- `strict-peer-dependencies=false` - Warn on peer issues (not fail)
- `auto-install-peers=false` - Don't auto-install peers
- `shamefully-hoist=false` - Better isolation
- Keep pnpm's isolated linker as the default; use `node-linker=hoisted` only as an opt-in for legacy compatibility.

Projects using coding-harness should adopt similar security-conscious defaults.

## CI migration governance artifacts

Harness-managed repos should also keep `.harness/ci-provider-transition-status.json` under source control. Use `harness upgrade --dry-run` for routine upgrade planning; if the transition artifact is missing and must be re-scaffolded, `harness init --update` writes the baseline file with `nextGateComplete=false`. Teams must explicitly update that artifact when a CI cutover is approved before running strict `harness ci-migrate verify`.

## Project-type auto-detection

`harness init` automatically detects the project type from filesystem signals and persists it into `harness.contract.json` as `projectType`. Detection is pure and read-only.

| Rule      | Type      | Signal                             |
| --------- | --------- | ---------------------------------- |
| `tauri`   | `desktop` | `src-tauri/` directory present     |
| `cli-ts`  | `cli`     | `src/cli.ts` file present          |
| `cli-js`  | `cli`     | `src/cli.js` file present          |
| `vite`    | `web`     | `vite.config.*` glob match at root |
| `next`    | `web`     | `next.config.*` glob match at root |
| `nuxt`    | `web`     | `nuxt.config.*` glob match at root |
| `library` | `library` | `src/index.ts` file present        |

Rules are priority-ordered (lower = higher priority). `"unknown"` is emitted when no rule matches and init proceeds with universal defaults.

**CLI flags:**

- `harness init --project-type <cli|desktop|library|web>` — explicit override; patches the existing contract atomically without requiring `--force`
- `harness init --json` — emits the full `InitOutput` structure as JSON, including `projectTypeDetection`

**Idempotency:**

- Re-init without `--project-type` preserves the stored value in `harness.contract.json`
- `--project-type` always wins and overwrites the stored value
- `"unknown"` is printed as a `console.warn` in human mode but suppressed in `--json` mode (result still appears in `projectTypeDetection`)
