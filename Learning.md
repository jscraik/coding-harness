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

## 2026-03-16
- CircleCI failure on branch `codex/JSC-security-fixes-batch-2026-03-14` was a lint gate failure in `scripts/check-architecture-rules.cjs` (not API token/auth); keep branch-local lint green before reruns.
- Repo preflight path checks should validate `docs/agents/` and `scripts/` for this project, not a generic top-level `instructions/` directory.
- Migration is still incomplete at policy level: contract status currently indicates `ciProviderPolicy.activeProvider = github-actions` in `shadow` mode; this remains outstanding if CircleCI should be authoritative.
- From CircleCI improvement docs: next pipeline iteration should add test splitting with historical timings and test insights surfacing to reduce rerun cost and speed diagnosis.
- CircleCI JUnit reporter flags (`--reporter=junit --outputFile.junit=...`) currently trigger `src/commands/ci-migrate.test.ts` failures in CI job context; keep canonical `pnpm test` until reporter-mode parity is debugged.
- CircleCI full-suite test runs can trigger `src/commands/ci-migrate.test.ts` race-like failures when Vitest parallelism is unconstrained; pinning CI test execution to `--maxWorkers=1` is a practical stabilization step.
