# Learning.md

## Table of Contents
- [2026-03-15](#2026-03-15)
- [2026-03-16](#2026-03-16)

## 2026-03-15
- CircleCI runtime must match the repository engine contract (`node >=24`): pin `cimg/node:24.13` in workflow templates and generated outputs.
- Avoid `corepack prepare` in constrained CI environments when permissions are uncertain; install pnpm with a user-local npm prefix (`$HOME/.local`) for deterministic bootstrap.
- `.mise.toml` checks need to accept both quoted and unquoted TOML keys to avoid false negatives (`"node" = "24.13.1"` and `node = "24.13.1"`).
- If tooling docs have both `Learning.md` and `Learnings.md` naming in circulation, preflight output should resolve whichever path exists instead of hardcoding one that may be absent.
- Current Vitest runner occasionally exits non-zero with `[vitest-worker]: Timeout calling "onTaskUpdate"` after all suites pass; treat as runner instability evidence, not immediate product regression.
- Private package auth incident pattern: `~/.codex/.env` is a 1Password-hosted FIFO pipe, so `-f` checks fail and regular file loaders silently skip token export.
- 1Password session state is a prerequisite for local token availability; run `op account list` before retrying private package installs.
- Shell env loaders that rely on `timeout` can fail silently if `timeout` is unavailable; this left `NPM_TOKEN`/`NODE_AUTH_TOKEN` unset and caused repeated npm `E404` for private package installs.
- `NPM_TOKEN` in shell env is not sufficient by itself; npm also needs `~/.npmrc` auth mapping (`//registry.npmjs.org/:_authToken=${NPM_TOKEN}`) and correct scope registry entries before `npm whoami`/private `npm view` calls succeed.
- Non-interactive login shells can resolve stale CLIs first (for example `/usr/local/bin/codex`) unless mise paths are prepended in login startup files; verify with both `zsh -lc` and `zsh -ic`.
- For Codex alpha enforcement, verify command resolution and tag parity together: `type -a codex`, `codex --version`, and `npm view @openai/codex dist-tags --json`.
- `@brainwav/coding-harness@latest` (0.8.1 on 2026-03-15) can publish without CLI artifacts (`dist/cli.js` missing); verify tarball contents before promoting global pins. Current safe global channel is `@preview` (`0.8.1-pr.93.dcba8e1`) where `harness` resolves and runs.
- `beautiful-mermaid` publishes a library API but no CLI `bin`; if tooling contracts require a `beautiful-mermaid` command, provide a maintained `~/.local/bin/beautiful-mermaid` wrapper that reads Mermaid input and renders via the mise-managed module.
- `ralph` availability depends on uv tool registration, not just PATH ordering; if `uv tool list` no longer contains `ralph-gold`, restore by cloning `https://github.com/jscraik/ralph-gold.git` and reinstalling with `uv tool install --force ~/dev/ralph-gold`.

## 2026-03-16
- CircleCI failure on branch `codex/JSC-security-fixes-batch-2026-03-14` is in `pnpm test` (`src/commands/ci-migrate.test.ts`), not trigger wiring or token auth.
- In this repo, path preflight should check `docs/agents/` and `scripts/` (not top-level `instructions/`), and repository-local skills belong at `.agents/skills/<skill-name>/SKILL.md`.
- `ci-migrate.test.ts` mock wiring is most stable with explicit injectable overrides (`setCIMigrateTestOverrides`) and strongly typed hoisted mocks for `runInitCLI` and `scanOpenPullRequestSatisfiability`.
- HubSpot tracking links in CircleCI emails can hide destinations behind JS redirects; resolve them by extracting the `/events/public/v1/encoded/track/...&_jss=-2` URL from page HTML and replaying it with `_jss=1`.
- From CircleCI improvement docs: next pipeline iteration should add test splitting with historical timings and test insights surfacing to reduce rerun cost and speed diagnosis.
- Outstanding: migration policy still shows `ciProviderPolicy.activeProvider = github-actions` in `shadow` mode; complete promotion to CircleCI required mode when governance evidence is ready.
- Outstanding: keep watching for `[vitest-worker]: Timeout calling "onTaskUpdate"` runner instability after this wiring fix.
- CircleCI `Typecheck` regression after the test hardening cherry-pick came from a stale type-only import path in `src/commands/ci-migrate.test.ts` (`../lib/init/cli.js` does not exist); importing `runInitCLI` type from `./init.js` fixes the failure.
- Added overload-aware timing assertion guard (`src/lib/test/overload-guard.ts`) so performance checks skip only timing assertions under host overload, emit explicit diagnostics, and keep functional assertions executing.
- Portable contract for common stacks now lives in env flags: `HARNESS_TEST_SKIP_TIMING_ASSERTIONS`, `HARNESS_TEST_OVERLOADED`, `HARNESS_TEST_MAX_LOAD_PER_CPU`, and `HARNESS_TEST_MIN_FREE_MEMORY_RATIO`.
- Outstanding: integrate the overload-guard env contract into harness init/deployment scaffolding so downstream repos inherit the same timing-assertion behavior by default.
- CircleCI `pnpm test` instability root cause is a Vitest worker transport timeout (`[vitest-worker]: Timeout calling "onTaskUpdate"`) in `src/commands/ci-migrate.test.ts`; assertions pass but the process exits non-zero without mitigation.
- Added a hardened CI test entrypoint (`pnpm test:ci` → `scripts/test-ci.sh`) that runs standard suites normally and isolates `ci-migrate` with scoped `--dangerouslyIgnoreUnhandledErrors` so functional failures still fail while the known transport bug is contained.
- Resolved HubSpot redirects for CircleCI release notes/docs and captured actionable pipeline improvements: use GitHub trigger event options for non-draft PR behavior, and split growing workflows with multiple config files.
- Outstanding: upstream the new `test:ci` strategy into harness init/deployment templates so all generated repositories inherit this CircleCI hardening by default.
