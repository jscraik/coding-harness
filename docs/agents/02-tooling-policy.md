# Tooling policy

- [Verified command authority](#verified-command-authority)
- [Tool and shell defaults](#tool-and-shell-defaults)
- [Required tooling baseline](#required-tooling-baseline)
- [Codex environment actions](#codex-environment-actions)
- [Repository command contract](#repository-command-contract)
- [Execution rule for tooling](#execution-rule-for-tooling)
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

Repo-managed pins should live in `.mise.toml` where the tool can be managed there. Externally managed CLIs must still be present on `PATH`, and missing commands should block environment readiness rather than degrade silently.
The root `Makefile` is also part of the enforced baseline and must retain the harness contract targets required by `scripts/check-environment.sh`.
`CODESTYLE.md` and `scripts/validate-codestyle.sh` are part of the same baseline. A harness-managed repo should fail readiness if either file is missing or if the validator no longer maps cleanly to repo-defined scripts.
For this repository only, the repo-root `CODESTYLE.md` path may be a symlink to `/Users/jamiecraik/.codex/instructions/CODESTYLE.md` so the authoring source stays global while repo-local enforcement still targets the root path.
For this repository only, `scripts/codex-preflight.sh` should honor that documented `CODESTYLE.md` symlink exception via `.codex/preflight-allowed-external-paths.txt` or `CODEX_PREFLIGHT_ALLOWED_EXTERNAL_PATHS` instead of failing the repo-root path check.
For this repository only, `src/templates/codex-preflight.sh` is the canonical authored source for the downstream scaffold. Keep the repo runtime mirror at `scripts/codex-preflight.sh` byte-identical by running `node scripts/sync-codex-preflight.cjs --write`; `pnpm lint` enforces `--check` so drift fails fast.
For this repository only, `scripts/codex-preflight.sh` remains the public shell entrypoint, but structured Local Memory checks should run through the typed helper path (`local-memory-preflight`) when a harness runner is available. Keep `scripts/codex-preflight-local-memory-legacy.sh` only as the compatibility fallback for repos that cannot yet execute the helper.
For shared or distributed harness-managed repos, keep `CODESTYLE.md` as a real repo-local file scaffolded from the canonical authoring source rather than a user-home symlink.
This baseline is now a first-class contract surface under `harness.contract.json > toolingPolicy`, and `harness tooling-audit --path <dir>` should be used when checking rollout drift across multiple repositories.
For repositories with UI or ChatGPT Apps SDK dependency signals, `toolingPolicy.packagePolicy` also requires `@brainwav/design-system-guidance` in `package.json`.
`docs-gate` now also treats tooling/runtime contract changes as documentation-authoritative work, so changes to hook wiring, readiness scripts, `.mise.toml`, or generated Codex environment actions should be landed with updates to this guide and `docs/agents/06-security-and-governance.md`.

The local hook contract is intentionally split by drag profile:

- `pre-commit` stays fast and now adds staged `gitleaks`, staged-doc `vale`, and `vitest related` alongside `lint`, `docs:lint`, and `typecheck`.
- The staged secret scan should use the repo-root `.gitleaks.toml` when present so fixture/example allow lists live in version control instead of hidden local defaults.
- `pre-push` keeps the heavier governance lane and now adds a narrow changed-files `semgrep` scan for `src/**` plus `pnpm build` before `audit`.
- The Semgrep lane is path-filtered to changed implementation files under `src/**` and uses the local ruleset at `scripts/semgrep-pre-push.yml` to avoid turning pre-push into a full repo scan.
- `scripts/check-semgrep-changed.sh` should pin and execute the same Semgrep version used by `.github/workflows/secret-scan.yml` (`semgrep==1.153.1`) so local and CI security findings do not drift.
- CodeRabbit custom `ast-grep` rules for this repository live under `rules/`; keep them narrowly scoped to repo-specific contracts such as the required `.js` extension on relative ESM imports.

## Codex environment actions

The canonical Codex environment file is `.codex/environments/environment.toml`.

Harness-managed repositories should treat that file as autogenerated and keep these action/icon classes hardwired:

- `tool`: setup and utility actions such as `Tools`, `Diagram`, `Mise`, `Agent Browser`, `Agentation`, `1Password`, `Beautiful Mermaid`, `Auth0`, `Semver`, `Research`, and `WSearch`
- `run`: runtime or deploy-adjacent actions such as `Run`, `Wrangler`, and `Cloudflared`
- `debug`: validation and analysis actions such as `Debug`, `Ralph`, `Vale`, `Cosign`, `Ruff`, `ESLint`, `MarkdownLint`, `Semgrep`, `Trivy`, and `Gitleaks`
- `test`: verification actions such as `Test`, `Prek`, `Argos`, and `Vitest`

`scripts/check-environment.sh` is expected to fail if those required action/icon pairs drift out of the generated file.

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

Use repo scripts as the source of truth and do not assume global shortcuts. If a command is unavailable in the environment, record it immediately and treat the corresponding validation gate as blocked until rerun in an environment with the command.

Exception for harness readiness:
- Generated `scripts/check-environment.sh` in harness-managed repositories should prefer a repo-local CLI path first (`pnpm exec tsx src/cli.ts`, `node dist/cli.js`, or `bash scripts/harness-cli.sh`) and use the global `harness` binary only as a fallback when no repo-local runner exists.
- The global fallback install path is `npm i -g @brainwav/coding-harness`.
- Private package auth must be wired where the global fallback is used:
  - Local shell: `export NPM_TOKEN=<token>`
  - GitHub Actions: `env: NPM_TOKEN: ${{ secrets.NPM_TOKEN }}`
- Harness-managed repos may also scaffold `scripts/harness-cli.sh` as the repo-local wrapper for the published CLI package. That wrapper must resolve `@brainwav/coding-harness/dist/cli.js` from the current repo and fail with actionable install hints such as `pnpm install`, `pnpm add -D @brainwav/coding-harness`, and `pnpm exec harness <command>` instead of surfacing a raw `MODULE_NOT_FOUND`.
- Semgrep hook configs under `scripts/` must remain valid YAML as well as valid Semgrep syntax; quote pattern strings that contain mapping-like fragments such as `shell: true` so pre-push parsing does not fail before policy checks run.

## Recommended command order

For code changes:

1. Read/inspect target files.
2. Apply minimal patch.
3. Run `bash scripts/validate-codestyle.sh --fast`.
4. Run `bash scripts/validate-codestyle.sh` before handoff.
5. Run `pnpm test:deep` when runtime or artifact behavior changed beyond the baseline code-style gate.

For CircleCI parity checks and migration troubleshooting, run:

1. `pnpm test:ci`

For harness setup or scaffold sync verification in this repository, run:

1. `bash scripts/run-harness-setup-checks.sh`

For fresh git worktrees before first push, run:

1. `bash scripts/prepare-worktree.sh`
2. `make worktree-ready` is an equivalent wrapper target

The helper codifies the required sequence: `preflight_repo`, `pnpm build`, `harness init --check-updates` (and `--update` when needed), `check-environment` with pinned `uv` (`mise which uv`), and `pnpm check`.
`scripts/prepare-worktree.sh` is the lightweight bootstrap lane for new worktrees; it ensures dependencies are installed in the active worktree so pre-push hooks that execute `pnpm` gates do not fail from missing `node_modules/`.
`harness init --check-updates`, `harness init --update`, and `harness upgrade` now auto-repair legacy `.harness/restore-manifest.json` files when `ciProvider` can be inferred from `harness.contract.json`, an unambiguous CI layout on disk, or the current requested/default provider.
If provider inference is still ambiguous, treat the incomplete manifest as a repo-drift warning for the update lane, print the remediation, and continue the remaining setup gates instead of aborting the whole audit.
`scripts/codex-preflight.sh` must remain both executable and sourceable so `source scripts/codex-preflight.sh && preflight_repo` continues to work for bash-based setup flows.
When Local Memory is enabled in required mode, `scripts/codex-preflight.sh` should validate the pinned REST host/port from `~/.local-memory/config.yaml` before trusting `local-memory status --json`, so healthy daemons on `127.0.0.1` do not trigger duplicate restart behavior from stale CLI status output.
The legacy shell fallback at `scripts/codex-preflight-local-memory-legacy.sh` must validate `rest_api.host`, `rest_api.port`, and `rest_api.auto_port` from that same config block directly, not by matching unrelated keys elsewhere in the file.
Local Memory REST health retries in the legacy shell fallback should use a bounded curl budget, and `run_local_memory_preflight_via_harness` should continue to the next harness candidate when a helper exits with sentinel code `3` (`unavailable`) instead of failing closed early.
`scripts/verify-work.sh` is the canonical repo-local verification entrypoint for harness-managed repos. Keep it repo-local, default it to `required` Local Memory mode, and scope its preflight path/binary expectations to scaffolded repo artifacts rather than codex-maintenance-only paths.
`scripts/validate-codestyle.sh` is the canonical fail-closed code-style gate for harness-managed repos. Keep it wired to repo-defined scripts, make it fail when required scripts are absent, and reuse it from `verify-work`, hooks, and downstream repo docs rather than re-describing divergent command bundles in each place.
Active AI-review scaffolding in this repository is CodeRabbit-first. Any remaining Greptile references in active tooling or scaffold paths should exist only for legacy cleanup and migration safety, not for new repo scaffolding or current review enforcement.
`scripts/check-diagram-freshness.sh` should compare only git-tracked diagram artifacts before and after refresh. gitignored `.diagram/` refresh output outside tracked files must not fail `pre-push` with an empty "Changed tracked files" list.

## Tooling verification checklist

Before claiming a change is verified, confirm:

- The command invoked exists in repo docs or scripts.
- The command version/source is not in conflict with lockfile or repo settings.
- Output is captured in closeout notes.

## Discovery constraints

- Prefer `rg` for content search.
- Use `fd` when you need file-name discovery.
- Use `jq` for JSON filtering/transforms.

## Escalation triggers

Stop and ask before proceeding if:

- You must deviate from `pnpm` due environment constraints.
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
- `node-linker=hoisted` - Better compatibility

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
