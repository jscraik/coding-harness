# GEMINI.md

## Imports
@/Users/jamiecraik/.codex/AGENTS.md
@/Users/jamiecraik/.codex/instructions/rvcp-common.md
@/Users/jamiecraik/.codex/instructions/standards.md
@./AGENTS.md
@./docs/agents/01-instruction-map.md

## Canonical source
- Use `/Users/jamiecraik/dev/coding-harness/AGENTS.md` as the canonical source for repo-wide instructions.
- Follow the mandatory workflow snippet from `AGENTS.md` (do not duplicate it here).
- If guidance conflicts, pause and ask which instruction wins.

## Operator defaults
- Run shell commands with `zsh -lc`.
- Prefer `rg`, `fd`, and `jq`.
- Use repo-verified commands from `AGENTS.md` and `package.json`.
- Read the repo-root `CODESTYLE.md` before making edits or claiming validation.
- In this repo, `CODESTYLE.md` is the enforced repo-root mount point and symlinks to `/Users/jamiecraik/.codex/instructions/CODESTYLE.md`.
- Treat the repo-root `CODESTYLE.md` path and `bash scripts/validate-codestyle.sh` as required contract surfaces for local verification.
- Default validation baseline: `bash scripts/validate-codestyle.sh --fast` during iteration, then `bash scripts/validate-codestyle.sh` before handoff when behavior changed.
- Use `bash scripts/verify-work.sh` or `pnpm check` when broader repo verification is needed, and run `pnpm test:deep` when runtime or artifact behavior changed.

## Command preflight helper
- Run `./scripts/codex-preflight.sh --stack auto --mode required` before command-heavy, destructive, or path-sensitive work.

## Fresh worktree helper
- Before first push from a newly created worktree, run `bash scripts/prepare-worktree.sh` (or `make worktree-ready`).
- Reason: local pre-push hooks run in the active worktree and can fail when dependencies are not installed yet.
- Then run `bash scripts/verify-work.sh --fast` before push.

## Closeout contract
- Report changed files, commands run, outcomes, and any risks/rollback notes.
- If validation or audit findings represent durable repo work, create or update the matching Linear issue before handoff.
