# Learning.md

## Table of Contents
- [2026-03-15](#2026-03-15)

## 2026-03-15
- CircleCI runtime must match the repository engine contract (`node >=24`): pin `cimg/node:24.13` in workflow templates and generated outputs.
- Avoid `corepack prepare` in constrained CI environments when permissions are uncertain; install pnpm with a user-local npm prefix (`$HOME/.local`) for deterministic bootstrap.
- `.mise.toml` checks need to accept both quoted and unquoted TOML keys to avoid false negatives (`"node" = "24.13.1"` and `node = "24.13.1"`).
- If tooling docs have both `Learning.md` and `Learnings.md` naming in circulation, preflight output should resolve whichever path exists instead of hardcoding one that may be absent.
- Current Vitest runner occasionally exits non-zero with `[vitest-worker]: Timeout calling "onTaskUpdate"` after all suites pass; treat as runner instability evidence, not immediate product regression.
