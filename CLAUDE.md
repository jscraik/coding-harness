# CLAUDE.md

## Imports
- @/Users/jamiecraik/.codex/AGENTS.md
- @/Users/jamiecraik/.codex/instructions/rvcp-common.md
- @/Users/jamiecraik/.codex/instructions/standards.md
- @./AGENTS.md
- @./docs/agents/01-instruction-map.md
- @./docs/agents/02-tooling-policy.md
- @./docs/agents/03-local-memory.md
- @./docs/agents/04-validation.md
- @./docs/agents/05-contradictions-and-cleanup.md

## Mandatory workflow snippet
1. Explore project first, then invoke skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
3. Add a Table of Contents for docs.

## Project context
This repository is the control plane for agentic development and policy validation, with source in TypeScript.

## Table of Contents
- [Project context](#project-context)
- [Command defaults](#command-defaults)
- [Code style and repo conventions](#code-style-and-repo-conventions)
- [Execution and validation workflow](#execution-and-validation-workflow)
- [Git and PR etiquette](#git-and-pr-etiquette)
- [Include / exclude guidance](#include--exclude-guidance)
- [Contradictions and cleanup](#contradictions-and-cleanup)
- [Inputs](#inputs)

## Command defaults
### Shell and discovery
- Shell: `zsh -lc`.
- Discovery/search: prefer `rg`, `fd`, and `jq` (per repo tooling profile).
- Read `/Users/jamiecraik/.codex/instructions/tooling.md` before choosing tooling.

### Verified repo commands
- `pnpm install`
- `pnpm check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm audit`
- `cat package.json`
- `cat .npmrc`
- `cat tsconfig.json`

## Code style and repo conventions
- Keep TypeScript repo settings in mind: ESM modules (`"type": "module"`) and `.js`-suffixed local imports.
- Deterministic changes: small diffs, one objective per slice.
- No new dependencies unless explicitly requested.
- If uncertain, ask before altering behavior beyond current scope.

## Execution and validation workflow
1. Read `AGENTS.md` and relevant `docs/agents/*.md` files first.
2. Make minimal edits in one pass when possible.
3. Validate with `pnpm lint`, `pnpm typecheck`, `pnpm test` (and `pnpm check` when feasible).
4. Explain what changed and how to verify before finalizing.
5. Keep risk, rollback, and follow-up notes explicit.

## Git and PR etiquette
- Mention intended scope briefly before edits.
- Cite exact command outputs in closeout.
- Keep changes reviewable and scoped.

## Include / exclude guidance
### Include always-on
- Repo-specific command behavior.
- Non-obvious workflow gates and contradictions.
- Canonical decision/validation requirements.

### Exclude from always-on
- Deep how-tos for rare one-off commands.
- Volatile implementation details that quickly age out.

## Contradictions and cleanup
- The repo’s `packageManager` and lockfile confirm `pnpm` as authoritative for command execution, even where global docs are less specific.
- Keep only instructions that prevent mistakes; prefer links over duplicated copy in multiple instruction files.

## Inputs
- Preferred scope for expansion (docs only vs `AGENTS.md` updates too).
- Any task-specific constraints not covered by existing checks.
