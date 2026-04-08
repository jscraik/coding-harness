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

- Minimal command surface in docs and scripts.
- Explicitly avoid ad hoc global installs and hidden mutation.
- Preserve existing dependency and execution boundaries (`pnpm` + lockfile-driven installs).
- Treat the repo-root `CODESTYLE.md` path plus `scripts/validate-codestyle.sh` as governed contract surfaces: if either drifts, readiness and closeout claims must fail closed.
- Repo-specific exception: this repository may satisfy that `CODESTYLE.md` path with a symlink to `/Users/jamiecraik/.codex/instructions/CODESTYLE.md`, but downstream harness-managed repos should keep a real repo-local `CODESTYLE.md` copy.
- Repo-specific preflight rule: `scripts/codex-preflight.sh` may allow that one documented `CODESTYLE.md` symlink when it matches the repo-local allow-list in `.codex/preflight-allowed-external-paths.txt` (or `CODEX_PREFLIGHT_ALLOWED_EXTERNAL_PATHS`), even though it resolves outside repo root; other out-of-repo paths must still fail closed.
- Security/runtime invariant: scaffold rendering and packaged distributions must read `CODESTYLE.md` from a checked-in template copy (`src/templates/CODESTYLE.md` / `dist/templates/CODESTYLE.md`), not by following a user-home symlink that may be absent on CI or downstream machines.
- Repo-specific preflight maintenance rule: author downstream-facing changes in `src/templates/codex-preflight.sh`, then sync the repo runtime mirror with `node scripts/sync-codex-preflight.cjs --write`. `pnpm lint` runs the matching `--check` gate so runtime/template drift is treated as a policy failure, not a later merge surprise.
- Local Memory preflight fallback probes must fail fast: keep bounded curl timeouts in `scripts/codex-preflight-local-memory-legacy.sh`, validate only the `rest_api.*` settings actually used to construct the health URL, and treat helper-runner exit code `3` as "unavailable, try the next runner" rather than a terminal failure.
- Harness-managed consumer repositories are a defined exception: `scripts/check-environment.sh` should prefer a repo-local CLI runner or wrapper, then a mise-resolved harness binary (`mise which harness`), and use a global npm install of `@brainwav/coding-harness` only as the final fallback with explicit `NPM_TOKEN` auth wiring.
- CI pnpm bootstrap must avoid privileged shim rewrites. Prefer a user-writable prefix such as `$HOME/.local` plus `$BASH_ENV`/`$GITHUB_PATH` path propagation over `corepack enable`, which can fail on hosted runners when `/usr/local/bin/pnpm` is not writable.
- Greptile is a legacy cleanup concern only. Keep active review governance, scaffold defaults, and runtime verification aligned to CodeRabbit, and treat any live Greptile scaffold path as contract drift unless it exists solely to remove or quarantine old artifacts.
- Security/policy hook configuration files must fail closed because of findings, not because the config is syntactically broken; keep Semgrep rule YAML quoted where patterns include mapping-like text such as `shell: true`.

## Secret handling

- Never place tokens, keys, or PII in docs, command output, commit text, or memory notes.
- If sensitive material appears in a file, sanitize and rotate as soon as practical.
- Keep environment-specific credentials outside repo and out of command snippets unless placeholders are explicit.
- Keep repo-specific Gitleaks allow lists in the repo-root `.gitleaks.toml` so staged scans and manual secret scans share the same reviewed exceptions.
- Scaffolded `secret-scan.yml` workflows should default to least privilege. Do not grant `pull-requests: write` unless PR commenting is intentionally enabled for a scanner; the default scaffold should keep `contents: read` only.

## Code and data governance

- Validate behavior changes before merge using documented gates.
- Keep audit trail artifacts (closeout outputs, validation status) in the task record.
- For high-risk edits (policy/validation gates), include rollback expectations in docs.
- Validation evidence must name the wrapper that ran (`validate-codestyle.sh`, `verify-work.sh`, or deeper gates), not just the underlying tool categories.

## Risk controls

- Do not skip required gates to save time.
- If checks fail repeatedly, stop and request decision on risk acceptance.
- Treat stale check output as non-evidence.
- Do not replace `bash scripts/validate-codestyle.sh` with an informal list of roughly equivalent commands when documenting or attesting verification; the wrapper is the governed proof surface.
- CircleCI test reliability guardrail: use `pnpm test:ci` so the long-running `ci-migrate` suite executes in an isolated lane with scoped Vitest worker-timeout mitigation (`--dangerouslyIgnoreUnhandledErrors`) while all functional assertions remain enforced.

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
- No secrets in docs/memory.
- For harness scaffold/setup checks, run `bash scripts/run-harness-setup-checks.sh` so preflight, environment posture (`CLAUDE_APPROVAL_POSTURE=require`), pinned `uv`, and quality gates are evaluated as one auditable sequence.
- For fresh git worktrees, run `bash scripts/prepare-worktree.sh` before the first push so local pre-push hooks do not fail from missing dependencies in the new worktree.
- `harness init --check-updates`, `harness init --update`, and `harness upgrade` should auto-repair legacy `.harness/restore-manifest.json` files when `ciProvider` can be inferred safely from `harness.contract.json`, an unambiguous CI layout on disk, or the current requested/default provider.
- If `scripts/run-harness-setup-checks.sh` still hits an incomplete legacy `.harness/restore-manifest.json`, treat it as a drift warning that blocks only the tracked update lane; keep running `check-environment` and repo quality gates, and print the manifest repair remediation explicitly.
- Keep `scripts/codex-preflight.sh` executable as a CLI script and invoke it with `bash scripts/codex-preflight.sh --stack auto --mode required` (or `--mode optional` for softer checks); do not source it.
- Treat `scripts/verify-work.sh` as the canonical repo-local verification entrypoint; it should keep `required` Local Memory enforcement and repo-scoped preflight expectations without depending on codex-maintenance-only paths.
- Treat scaffolded `scripts/harness-cli.sh` resolution failures as local install/bootstrap drift rather than harness command failures, and remediate with repo-local dependency repair (`pnpm install`, `pnpm add -D @brainwav/coding-harness`, then `pnpm exec harness <command>`).
- For Local Memory enforcement, pin `~/.local-memory/config.yaml` to `host: 127.0.0.1` and `auto_port: false`, and prefer the pinned REST health endpoint as the source of truth when CLI status output is stale under sandboxed execution.
- If using local shell helpers, prefer `source scripts/codex-shell-helpers.sh` and launch through `codex_d`/`cdxd` so Codex runs with `--profile d` and `--cd` anchored to the repo root.
- Treat harness-scaffolded governance artifacts as part of the runtime contract: `.npmrc` should exist with the baseline security defaults plus scope-only registry routing, and `.harness/ci-provider-transition-status.json` should exist before strict `ci-migrate verify`. Repo `.npmrc` files must not carry auth token overrides; auth belongs in user-level or CI-injected `~/.npmrc`.
- When bumping tooling dependencies that have mirrored configuration schemas, update the package version, the repo config, and the scaffold template in the same change. The init suite enforces this for the Biome schema URL.
- Diagram freshness enforcement should compare only git-tracked artifacts before and after refresh. Gitignored `.diagram/` refresh output may exist for local analysis, but it must not block `pre-push` unless tracked architecture artifacts actually drift.

## Pre-commit hooks

This repository uses `simple-git-hooks` to install local hooks, and `prek.toml` mirrors the same commands so hook policy drift is visible in-repo:

### Hooks installed

| Hook | Purpose |
| --- | --- |
| `pre-commit` | Runs `make hooks-pre-commit` (`pnpm lint`, `pnpm docs:lint`, `pnpm typecheck`, staged `gitleaks`, staged-doc `vale`, related tests) |
| `commit-msg` | Validates conventional commit format, reminds about PR template |
| `pre-push` | Runs `make hooks-pre-push` (`docs-gate --mode required`, diagram freshness, `tooling-audit`, `check-environment`, changed-file `semgrep`, `make codestyle`, `pnpm build`) |

The staged `gitleaks` lane should prefer the repo-root `.gitleaks.toml` when present so approved fixture/example exceptions are consistent across local hooks, manual scans, and downstream scaffold expectations.

`docs-gate` no longer covers only branch/CI governance wording. Local hook, readiness, and tooling-runtime changes are expected to update this guide and `docs/agents/02-tooling-policy.md` in the same change so pre-push drift is caught before GitHub does.

## Plan traceability

- Pull requests must declare `Plan IDs` in the PR template summary.
- Each declared ID must resolve to a `docs/plans/*` document with matching `plan_id` frontmatter.
- Completed acceptance checklist items in referenced plans must carry evidence links or refs before merge.
- `risk-policy-gate` enforces this in CI, and `review-gate` treats missing or invalid plan traceability as a merge blocker even when the review check itself passed.

`scripts/check-semgrep-changed.sh` is intentionally narrow: it compares `HEAD` to the upstream merge-base (or the nearest main/master fallback), filters to changed implementation files under `src/**`, and runs only the local `scripts/semgrep-pre-push.yml` ruleset. That keeps the local lane useful without duplicating the full CI security scan. Keep the script pinned to the same Semgrep version used by `.github/workflows/secret-scan.yml` (`semgrep==1.153.1`) so local and CI findings stay aligned.

### Setup

Hooks are automatically installed after `pnpm install` via `postinstall` script.

To manually reinstall hooks:

```bash
node scripts/setup-git-hooks.js
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
