---
status: complete
priority: p3
tags: [code-review, documentation, deduplication]
dependencies: []
---

# Deduplicate AGENTS.md Content

## Problem Statement

The expanded `AGENTS.md` duplicates content from `docs/agents/02-tooling-policy.md`, specifically the "Non-standard repo commands" section. This violates the repository's own cleanup policy in `05-contradictions-and-cleanup.md` which states: "duplication without added operational value should be removed."

## Findings

**Location:** `AGENTS.md:41-47`

**Current Duplication:**
```markdown
## Non-standard repo commands
- `pnpm check` — runs `lint`, `typecheck`, `test`, and `audit`.
- `pnpm lint` — runs `biome check .`.
- `pnpm typecheck` — runs `tsc --noEmit`.
- `pnpm test` — runs `vitest run`.
- `pnpm build` — compiles TypeScript and sets executable bit on `dist/cli.js`.
- `pnpm audit` — dependency risk check.
```

This duplicates the table in `docs/agents/02-tooling-policy.md:25-35`.

**Additional Issue:**
- Code block uses `ts` language tag while project convention in `CLAUDE.md` uses `typescript`
- Documentation map links don't use `./` prefix for clarity

## Proposed Solutions

### Option A: Replace with Reference Link (Recommended)
Replace the detailed table with a brief reference to the authoritative source:

```markdown
## Non-standard repo commands
See [Tooling and command policy](docs/agents/02-tooling-policy.md) for full details.

Quick reference: `pnpm check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit`
```

**Pros:** Single source of truth, prevents drift
**Cons:** One extra click for full details
**Effort:** Minimal
**Risk:** None

### Option B: Keep Both but Add Sync Comment
Add comments in both files noting they must be kept in sync.

**Pros:** No structural changes
**Cons:** Still prone to drift, violates cleanup policy
**Effort:** Minimal
**Risk:** Documentation will become inconsistent

## Recommended Action

Implement Option A: Replace the detailed command table in `AGENTS.md` with a link to the authoritative documentation in `02-tooling-policy.md`.

Also fix:
1. Change ` ```ts ` to ` ```typescript ` for consistency
2. Add `./` prefix to documentation map links

## Technical Details

**Affected File:** `AGENTS.md`
**Lines:** 30-60 (ESM import block, commands section, documentation map)

**Policy Reference:**
- `docs/agents/05-contradictions-and-cleanup.md` - "duplication without added operational value should be removed"

## Acceptance Criteria

- [ ] Command table replaced with link to 02-tooling-policy.md
- [ ] Code block language tag changed to `typescript`
- [ ] Documentation map links use `./` prefix
- [ ] No content drift between AGENTS.md and tooling-policy.md

## Work Log

- **2026-02-23**: Issue identified during code review
