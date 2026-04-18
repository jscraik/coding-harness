---
last_validated: 2026-04-18
---

# Tooling policy

- [Verified command authority](#verified-command-authority)
- [Tool and shell defaults](#tool-and-shell-defaults)
- [Required tooling baseline](#required-tooling-baseline)
- [Codex environment actions](#codex-environment-actions)
- [Repository command contract](#repository-command-contract)
- [Execution rule for tooling](#execution-rule-for-tooling)
- [Recommended command order](#recommended-command-order)
- [Tooling verification checklist](#tooling-verification-checklist)
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
- File reads: keep snippets bounded and explicit.
- Do not add dependencies or global tool changes unless requested.
- Optional local shell helper: `source scripts/codex-shell-helpers.sh` to expose preflight wrappers and `codex_d`/`cdxd` launchers. These wrappers use `codex --profile d --cd <repo-root> "<PROMPT>"`, where the prompt is positional (not `-p`).

## Required tooling baseline

Harness-managed repositories should treat this CLI surface as required:

- `prek`
- `diagram`
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

Repo-managed pins should live in `.mise.toml` where the tool can be managed there, and externally managed CLIs must still be present on `PATH`; missing commands should block readiness instead of degrading silently.
Baseline contracts also include the root `Makefile` targets required by `scripts/check-environment.sh` plus the `CODESTYLE.md` and `scripts/validate-codestyle.sh` pair.

For this repository only:
- The repo-root `CODESTYLE.md` path may be a symlink to `/Users/jamiecraik/.codex/instructions/CODESTYLE.md` so authoring can stay global while repo-local enforcement still targets the root path.
- `biome check` should ignore that repo-root `CODESTYLE.md` path so CI linting stays deterministic when the developer-home symlink target is absent on hosted runners.
- `scripts/codex-preflight.sh` should honor that symlink exception via `.codex/preflight-allowed-external-paths.txt` or `CODEX_PREFLIGHT_ALLOWED_EXTERNAL_PATHS` instead of failing the repo-root path check.
- Scaffold rendering and published builds must package a real checked-in `src/templates/CODESTYLE.md` copy so CI and downstream installs do not depend on a developer-home symlink resolving at runtime.
- `src/templates/codex-preflight.sh` remains the scaffold baseline, but `scripts/codex-preflight.sh` is project-owned after initialization and may diverge intentionally per-repo. Use `node scripts/sync-codex-preflight.cjs --write` only when you explicitly want to synchronize from template.
- `scripts/codex-preflight.sh` remains the public shell entrypoint, but structured Local Memory checks should run through the typed helper path (`local-memory-preflight`) when a harness runner is available. Keep `scripts/codex-preflight-local-memory-legacy.sh` only as the compatibility fallback for repos that cannot yet execute the helper.

For shared/distributed harness-managed repos, keep `CODESTYLE.md` as a real repo-local file scaffolded from the canonical source rather than a user-home symlink.
Treat this as a contract surface under `harness.contract.json > toolingPolicy`; use `harness tooling-audit --path <dir>` to check rollout drift across repositories.
Project Brain enforcement under `toolingPolicy.projectBrainMemoryExtension` should require listed `.harness/**` knowledge paths when `enabled=true` (project-local only, never workspace-global).
For repositories with UI or ChatGPT Apps SDK dependency signals, `toolingPolicy.packagePolicy` also requires `@brainwav/design-system-guidance` in `package.json`.
`docs-gate` treats tooling/runtime contract changes as documentation-authoritative work, so updates to hook wiring, readiness scripts, `.mise.toml`, or generated Codex environment actions should land with updates to this guide and `docs/agents/06-security-and-governance.md`.

The local hook contract is intentionally split by drag profile:

- `prek install --overwrite` (via `scripts/setup-git-hooks.js`) is the only supported hook installer path. Repositories should not keep legacy `simple-git-hooks` package metadata or post-install bootstraps once they migrate.
- `scripts/setup-git-hooks.js` is the required wrapper around `prek install --overwrite`; it must patch generated `.git/hooks/*` shims to set `PREK_HOME="${PREK_HOME:-$HERE/../.cache/prek}"` so hook logging works in sandboxed/home-read-only environments and legacy `.legacy` wrappers do not linger.
- `pre-commit` stays fast and now adds staged `gitleaks`, staged-doc `vale`, and `vitest related` alongside `lint`, `docs:lint`, and `typecheck`.
- The staged secret scan should use the repo-root `.gitleaks.toml` when present so fixture/example allow lists live in version control instead of hidden local defaults.
- `pre-push` keeps the heavier governance lane and adds a changed-files `semgrep` scan for `src/**` plus `pnpm build` before `audit`.
- `hooks-commit-msg` is the canonical wrapper target for commit-message policy checks. Keep it available even though `prek.toml` installs only `pre-commit` and `pre-push`.
- The Semgrep lane must stay path-filtered to changed implementation files under `src/**`, use `scripts/semgrep-pre-push.yml`, and pin `scripts/check-semgrep-changed.sh` to the same version as `.github/workflows/secret-scan.yml` (`semgrep==1.153.1`) so local and CI findings do not drift.
- OpenSSF scorecard posture drift is tracked by `.github/workflows/openssf-scorecard.yml` and evaluated against `security/openssf-scorecard-policy.json` via `scripts/check-scorecard-regressions.mjs`; keep these three surfaces aligned when scorecard policy changes.
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
Port-free wrapping is expected only for app run actions backed by `dev`/`start` scripts; CLI-first repositories may not include a port-free run action.

## Repository command contract

| Surface | Primary command | Purpose |
| --- | --- | --- |
| Install/deps | `pnpm install` | Dependency installation |
| Code-style gate | `bash scripts/validate-codestyle.sh` | Fail-closed repo-local code-style validation |
| Quality gate | `pnpm check` | `lint + typecheck + test + audit` |
| Lint | `pnpm lint` | `biome check .` |
| Typecheck | `pnpm typecheck` | `tsc --noEmit` |
| Tests | `pnpm test` | `vitest run` |
| Tests (CircleCI hardened lane) | `pnpm test:ci` | Runs standard suites plus isolated `ci-migrate` run with targeted Vitest worker-timeout mitigation |
| Audit | `pnpm audit` | dependency risk check |
| Build | `pnpm build` | compile TypeScript and generate `dist/cli.js` |

## Execution rule for tooling

Use repo scripts as the source of truth; do not assume global shortcuts. If a command is unavailable, record it immediately and treat the related gate as blocked until rerun where that command exists.

Harness readiness exception:
- `scripts/check-environment.sh` should prefer repo-local CLI execution (`pnpm exec tsx src/cli.ts`, `node dist/cli.js`, or `bash scripts/harness-cli.sh`) and only fall back to a global `harness` binary when no local runner exists.
- For global fallback resolution, prefer `mise which harness` before `PATH` discovery to avoid stale Homebrew/global binaries shadowing the pinned toolchain.
- If fallback install is required, use `npm i -g @brainwav/coding-harness` with private package auth wired for local shells and CI.
- `scripts/harness-cli.sh` must fail with actionable install hints (`pnpm install`, `pnpm add -D @brainwav/coding-harness`, `pnpm exec harness <command>`) rather than raw `MODULE_NOT_FOUND`.
- Semgrep hook configs under `scripts/` must remain valid YAML and valid Semgrep syntax; quote mapping-like pattern fragments such as `shell: true`.

## Recommended command order

For code changes:

1. Read/inspect target files.
2. Apply minimal patch.
3. Run `bash scripts/validate-codestyle.sh --fast`.
4. Run `bash scripts/validate-codestyle.sh` before handoff.
5. Run `pnpm test:deep` when runtime or artifact behavior changed beyond the baseline code-style gate.

Additional lanes:
- CircleCI parity and migration troubleshooting: `pnpm test:ci`
- Harness setup or scaffold sync verification in this repository: `bash scripts/run-harness-setup-checks.sh`
- New task boundary for project-local agent work: `bash scripts/new-task.sh <slug>`
- Fresh git worktrees before first push: `bash scripts/prepare-worktree.sh` (or equivalent wrapper target `make worktree-ready`)

Required sequence (via helper wrappers): `bash scripts/codex-preflight.sh --stack auto --mode required`, `pnpm build`, `harness init --check-updates` (and `--update` when needed), `bash scripts/check-environment.sh`, then `pnpm check`.

Contract-preserving notes:
- `scripts/codex-preflight.sh` is a CLI script and must be executed, not sourced (`--mode optional` is allowed for softer checks).
- `scripts/verify-work.sh` is the canonical repo-local verification entrypoint; keep Local Memory required by default and hook-governance project-local unless `--workspace-governance` is explicitly set.
- In project-local mode, `scripts/verify-work.sh` should skip hook-governance rollout failures when `.codex/hook-conformance.json` is absent, and reserve strict conformance-artifact enforcement for explicit `--workspace-governance` runs.
- `scripts/validate-codestyle.sh` remains the canonical fail-closed code-style wrapper reused by verify/hook/docs surfaces.
- `scripts/new-task.sh` is the canonical project-local task entrypoint; `scripts/prepare-worktree.sh` is the canonical new-worktree bootstrap lane.
- `harness init --check-updates`, `harness init --update`, and `harness upgrade` should auto-repair legacy `.harness/restore-manifest.json` when provider inference is safe; ambiguous inference should raise a targeted drift warning and continue remaining setup gates.
- Local Memory required mode should validate pinned REST host/port from `~/.local-memory/config.yaml`, and the legacy shell fallback must use bounded curl retries plus helper exit code `3` as "unavailable, try next runner".
- CI bootstrap should install pinned `pnpm` via user-writable prefixes (`$HOME/.local` + `$BASH_ENV`/`$GITHUB_PATH`) rather than mutating privileged shims.
- Active AI-review scaffolding is CodeRabbit-first; Greptile references in active paths should exist only for legacy cleanup.
- `scripts/check-diagram-freshness.sh` must compare only git-tracked artifacts and must not fail pre-push for gitignored `.diagram/` output alone.

## Tag-driven private npm release workflow

- Canonical publish workflow: `.github/workflows/release-private-npm.yml`
- Trigger: semantic-version tag pushes matching `vX.Y.Z` (for example `v0.12.0`) and guarded manual dispatch.
- Publish authority: GitHub Actions OIDC trusted publishing (default) with optional token fallback (`publish_auth=token`) for bootstrap recovery.
- CircleCI `release` is verification-only in this repository; do not add `pnpm publish` or token-based publish steps there.
- Keep release docs and scaffolds aligned with this split:
  - CircleCI: lint/test/security + release verification.
  - GitHub Actions: private npm publish + attestation + GitHub release creation.

## Tooling verification checklist

Before claiming a change is verified, confirm:

- The command invoked exists in repo docs or scripts.
- The command version/source is not in conflict with lockfile or repo settings.
- Output is captured in closeout notes.
- The repo-local tooling inventory at `docs/agents/tooling.md` stays aligned with `scripts/check-environment.sh` and `.mise.toml`.
- If a required command is absent, `pnpm` contract behavior conflicts, or you must deviate from `pnpm`, stop and mark the gate blocked before proceeding.

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
`harness init --update`, then `harness verify-coderabbit --check-npmrc` to confirm
that the repo keeps scope routing and security defaults without a repo-local
auth token override. If a scaffolded `scripts/harness-cli.sh` wrapper cannot
resolve the local package, treat that as bootstrap drift in the repo install,
not as a harness command logic failure.

## Required .npmrc settings for this repository

The `.npmrc` in this repository sets:

- `ignore-scripts=true` - Security: block scripts from dependencies
- `strict-peer-dependencies=false` - Warn on peer issues (not fail)
- `auto-install-peers=false` - Don't auto-install peers
- `shamefully-hoist=false` - Better isolation
- isolated linker default - keep `node-linker=hoisted` opt-in only for legacy compatibility

Projects using coding-harness should adopt similar security-conscious defaults.

## CI migration governance artifacts

Harness-managed repos should also keep `.harness/ci-provider-transition-status.json` under source control. Use `harness upgrade --dry-run` for routine upgrade planning; if the transition artifact is missing and must be re-scaffolded, `harness init --update` writes the baseline file with `nextGateComplete=false`. Teams must explicitly update that artifact when a CI cutover is approved before running strict `harness ci-migrate verify`.

## Project-type auto-detection

`harness init` automatically detects the project type from filesystem signals and persists it into `harness.contract.json` as `projectType`. Detection is pure and read-only.

| Rule | Type | Signal |
| --- | --- | --- |
| `tauri` | `desktop` | `src-tauri/` directory present |
| `cli-ts` | `cli` | `src/cli.ts` file present |
| `cli-js` | `cli` | `src/cli.js` file present |
| `vite` | `web` | `vite.config.*` glob match at root |
| `next` | `web` | `next.config.*` glob match at root |
| `nuxt` | `web` | `nuxt.config.*` glob match at root |
| `library` | `library` | `src/index.ts` file present |

Rules are priority-ordered (lower = higher priority). `"unknown"` is emitted when no rule matches and init proceeds with universal defaults.

**CLI flags:**
- `harness init --project-type <cli|desktop|library|web>` — explicit override; patches the existing contract atomically without requiring `--force`
- `harness init --json` — emits the full `InitOutput` structure as JSON, including `projectTypeDetection`

**Idempotency:**
- Re-init without `--project-type` preserves the stored value in `harness.contract.json`
- `--project-type` always wins and overwrites the stored value
- `"unknown"` is printed as a `console.warn` in human mode but suppressed in `--json` mode (result still appears in `projectTypeDetection`)
