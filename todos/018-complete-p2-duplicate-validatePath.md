---
status: complete
priority: p2
issue_id: 018
tags: [architecture, maintainability, code-review]
dependencies: [016]
created: 2026-02-23
---

# Duplicate validatePath with Inconsistent Signatures

## Problem Statement

Two different `validatePath` functions exist with inverted and optionalized parameter orders, creating API confusion and agent uncertainty.

**Severity:** IMPORTANT (architectural inconsistency)

## Findings

**Locations:**
- `src/lib/input/validator.ts:15` - `validatePath(baseDir: string, userPath: string)`
- `src/lib/input/sanitize.ts:45` - `validatePath(inputPath: string, baseDir?: string)`

**Key differences:**

| Aspect | `validator.ts` | `sanitize.ts` |
|--------|---------------|---------------|
| Symlink handling | `realpathSync` | None (vulnerable) |
| Normalize | Yes | No |
| Error type | `PathTraversalError` | generic Error |
| Parameter order | `(baseDir, userPath)` | `(inputPath, baseDir?)` |
| baseDir required | Yes | No (defaults to cwd) |

**Impact:**
- Agents cannot reliably know which function to call
- Risk of calling with inverted arguments
- Different security postures depending on import

**Evidence:** Architecture-strategist, security-sentinel, and simplicity-reviewer all identified this issue.

## Proposed Solutions

### Option A: Single canonical implementation in validator.ts (Recommended)
- **Description:** Keep only `validator.ts` version, update all callers
- **Pros:** Clear single source of truth, consistent security
- **Cons:** Requires updating import sites
- **Effort:** Small
- **Risk:** Low

### Option B: Re-export from sanitize.ts
- **Description:** Remove implementation from sanitize.ts, re-export from validator.ts
- **Pros:** Backward compatible for sanitize.ts importers
- **Cons:** Indirection, two import paths for same function
- **Effort:** Small
- **Risk:** Low

## Recommended Action

**Option A** - Consolidate to single implementation in `validator.ts`.

## Technical Details

**Files to update:**
1. `src/lib/input/sanitize.ts` - remove validatePath (lines 37-66)
2. `src/lib/gardener/link-checker.ts` - change import
3. `src/lib/gardener/quality-scorer.ts` - change import

**Import signature change:**
```typescript
// Current (sanitize.ts style):
validatePath(inputPath, baseDir?)

// Required (validator.ts style):
validatePath(baseDir, userPath)
```

## Acceptance Criteria

- [x] Single `validatePath` in `validator.ts`
- [x] All imports updated to use `validator.ts` (via sanitize.ts re-export)
- [x] Signature change propagated to callers
- [x] `pnpm test` passes
- [x] `pnpm typecheck` passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-23 | Review completed | Multiple agents identified duplication |
| 2026-02-23 | Verified consolidation | sanitize.ts re-exports from validator.ts; all callers use correct (baseDir, userPath) signature |

## Resources

- Related: `todos/009-pending-p2-validate-path-location.md`
- Related: `todos/016-pending-p1-symlink-bypass-validatePath.md`
