# Learning.md

## Table of Contents
- [2026-03-15](#2026-03-15)

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
