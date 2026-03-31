# GEMINI.md

## Imports
- @/Users/jamiecraik/.codex/AGENTS.md
- @/Users/jamiecraik/.codex/instructions/rvcp-common.md
- @/Users/jamiecraik/.codex/instructions/standards.md
- @./AGENTS.md
- @./docs/agents/01-instruction-map.md

## Canonical source
- Use `/Users/jamiecraik/dev/coding-harness/AGENTS.md` as the canonical source for repo-wide instructions.
- If guidance conflicts, pause and ask which instruction wins.

## Operator defaults
- Run shell commands with `zsh -lc`.
- Prefer `rg`, `fd`, and `jq`.
- Default validation: `pnpm check`; fast loop: `pnpm lint`, `pnpm docs:lint`, `pnpm typecheck`, `pnpm test`.

## Command preflight helper
- Run `./scripts/codex-preflight.sh --stack auto --mode required` before command-heavy, destructive, or path-sensitive work.

## Fresh worktree helper
- Before first push from a newly created worktree, run `bash scripts/prepare-worktree.sh` (or `make worktree-ready`).
- Reason: local pre-push hooks run in the active worktree and can fail when dependencies are not installed yet.
- Then run `bash scripts/verify-work.sh --fast` before push.

## Closeout contract
- Report changed files, commands run, outcomes, and any risks/rollback notes.
