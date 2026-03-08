# CLAUDE.md

## Imports
- @/Users/jamiecraik/.codex/AGENTS.md
- @/Users/jamiecraik/.codex/instructions/rvcp-common.md
- @/Users/jamiecraik/.codex/instructions/standards.md
- @./AGENTS.md
- @./docs/agents/01-instruction-map.md

## Canonical source
- Use `/Users/jamiecraik/dev/coding-harness/AGENTS.md` as the canonical source for repo-wide, cross-tool instructions.
- Follow the mandatory workflow snippet from `AGENTS.md` (do not duplicate it here).
- If guidance conflicts, pause and ask which instruction wins.

## Operator defaults
- Run shell commands with `zsh -lc`.
- Prefer `rg`, `fd`, and `jq`; read `/Users/jamiecraik/.codex/instructions/tooling.md` before choosing tools.
- Use repo-verified commands from `AGENTS.md` and `package.json`.
- Default validation: `pnpm check`. Fast loop when needed: `pnpm lint`, `pnpm docs:lint`, `pnpm typecheck`, `pnpm test`.

## Docs lookup (progressive disclosure)
- Start with [Architecture bootstrap](./docs/agents/00-architecture-bootstrap.md) for architecture-sensitive tasks.
- Start with [Instruction map](./docs/agents/01-instruction-map.md).
- Then open only the relevant SOP from `docs/agents/` for the current task type.

## Closeout contract
- Report changed files, commands run, outcomes, and any risks/rollback notes.

## Command preflight helper
- Source `scripts/codex-preflight.sh` and run `preflight_repo` before command-heavy, destructive, or path-sensitive work.
- Validate required bins and target paths first so mistakes are prevented before edits.
