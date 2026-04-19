# CLAUDE.md

## Imports
@/Users/jamiecraik/.codex/AGENTS.md
@/Users/jamiecraik/.codex/instructions/rvcp-common.md
@/Users/jamiecraik/.codex/instructions/standards.md
@./AGENTS.md
@./docs/agents/01-instruction-map.md

## Canonical source
- Treat `/Users/jamiecraik/dev/coding-harness/AGENTS.md` as the canonical repo instruction baseline.
- Keep this file in lockstep with `GEMINI.md` for shared operational policy.
- Follow `AGENTS.md` mandatory workflow snippet and command contracts; do not duplicate long policy text here.
- If guidance conflicts, stop and resolve precedence before edits.

## Operator defaults
- Run shell commands with `zsh -lc`; prefer `rg`, `fd`, and `jq`.
- Use repo-evidenced commands from `AGENTS.md`, `package.json`, and `scripts/`.
- Treat repo-root `CODESTYLE.md` and `bash scripts/validate-codestyle.sh` as required verification surfaces.

## Startup and validation
- Before command-heavy, destructive, or path-sensitive work, run `bash scripts/codex-preflight.sh --stack auto --mode required`.
- During iteration, run the narrowest relevant check, then `bash scripts/validate-codestyle.sh --fast`.
- Before handoff when behavior changed, run `bash scripts/validate-codestyle.sh`; broaden to `bash scripts/verify-work.sh` or `pnpm check` as needed.
- Run `pnpm test:deep` when runtime or artifact behavior changed.

## Routing and closeout
- Start with [Instruction map](./docs/agents/01-instruction-map.md), then open only the relevant SOP from `docs/agents/`.
- Before first push from a new worktree, run `bash scripts/prepare-worktree.sh` then `bash scripts/verify-work.sh --fast`.
- Report changed files, commands run, outcomes, and any risks/rollback notes.
- If validation or audit findings are durable repo work, create or update the matching Linear issue before handoff.
