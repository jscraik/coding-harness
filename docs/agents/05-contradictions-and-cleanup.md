---
last_validated: 2026-04-18
---

# Contradictions and cleanup

## Why this exists

Conflicting instructions are common across global and repo-local guidance. This file exists to resolve those conflicts before execution risk increases.

## Conflict categories

- **Command authority conflicts** (e.g., package manager mismatch)
- **Behavior conflicts** (e.g., two different validation requirements)
- **Scope conflicts** (e.g., duplicate docs saying opposite priorities)

## Current authoritative rule

For repo execution:

- Prefer repository evidence (`package.json`, `pnpm-lock.yaml`, `tsconfig.json`) over inherited defaults.
- Keep command and security guidance consistent with `AGENTS.md` + `CLAUDE.md`.

## Resolution process

1. Capture the conflicting lines and sources.
2. Apply the local-first precedence rule.
3. Record the resolution decision in the relevant doc update.
4. If ambiguous, ask for human confirmation before continuing.

## Cleanup triggers

- Duplication without added operational value.
- Stale references to tools/commands not present in repo evidence.
- Instructions that contradict the project’s canonical workflow.

## Current status

- Resolved: package manager defaults to `pnpm` using repo lockfile/script evidence.
- Confirmed: validation workflow anchored on `pnpm check`.
- No additional blocking contradictions currently.

## Cleanup procedure

- Keep edits scoped to one conceptual issue.
- Remove or tighten duplicated guidance; do not remove unique safety rules.
- Re-run quick docs sanity checks after cleanup.

## Escalation

If a contradiction appears across required safety/security instructions, pause and request explicit precedence decision before editing code or check scripts.
