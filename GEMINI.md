# GEMINI.md

## Imports
@/Users/jamiecraik/.codex/AGENTS.md
@/Users/jamiecraik/.codex/instructions/rvcp-common.md
@/Users/jamiecraik/.codex/instructions/standards.md
@./AGENTS.md
@./docs/agents/01-instruction-map.md

## Canonical source
- Use `/Users/jamiecraik/dev/coding-harness/AGENTS.md` as the canonical source for repo-wide, cross-tool instructions.
- Treat `AGENTS.md` as a compact baseline and use `docs/agents/01-instruction-map.md` for task routing.
- Follow the mandatory workflow snippet from `AGENTS.md` (do not duplicate it here).
- If guidance conflicts, pause and ask which instruction wins.

## Operator defaults
- Run shell commands with `zsh -lc`.
- Prefer `rg`, `fd`, and `jq`; read `/Users/jamiecraik/.codex/instructions/tooling.md` before choosing tools.
- Use repo-verified commands from `AGENTS.md` and `package.json`.
- Read the repo-root `CODESTYLE.md` before making edits or claiming validation, then route into `codestyle/README.md` modules as needed.
- Treat `CODESTYLE.md`, `codestyle/`, `codestyle/CHECKSUMS.sha256`, `bash scripts/check-codestyle-parity.sh`, and `bash scripts/validate-codestyle.sh` as required contract surfaces.
- Default validation baseline: `bash scripts/check-codestyle-parity.sh` and `bash scripts/validate-codestyle.sh --fast` during iteration, then `bash scripts/validate-codestyle.sh` before handoff when behavior changed.
- Use `bash scripts/verify-work.sh` or `pnpm check` when broader repo verification is needed, and run `pnpm test:deep` when runtime or artifact behavior changed.

## Docs lookup (progressive disclosure)
- Start with [Instruction map](./docs/agents/01-instruction-map.md).
- Use [Architecture bootstrap](./docs/agents/00-architecture-bootstrap.md) for architecture-sensitive tasks.
- Then open only the relevant SOP from `docs/agents/` for the current task type.

## Closeout contract
- Report changed files, commands run, outcomes, and any risks/rollback notes.
- If validation or audit findings represent durable repo work, create or update the matching Linear issue before handoff.

## Command preflight helper
- Run `bash scripts/codex-preflight.sh --stack auto --mode required` before command-heavy, destructive, or path-sensitive work.
- Validate required bins and target paths first so mistakes are prevented before edits.

## Fresh worktree helper
- Before first push from a newly created worktree, run `bash scripts/prepare-worktree.sh` (or `make worktree-ready`).
- Reason: local pre-push hooks run in the active worktree and can fail when dependencies are not installed yet.
- Then run `bash scripts/verify-work.sh --fast` before push.
