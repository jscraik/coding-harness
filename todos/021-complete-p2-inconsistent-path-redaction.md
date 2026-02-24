---
status: complete
priority: p2
issue_id: 021
tags: [consistency, maintainability, code-review]
dependencies: []
created: 2026-02-23
---

# Inconsistent Path Redaction Patterns ([HOME] vs [USER])

## Problem Statement

Two different redaction labels are used for home directory paths across the codebase: `[HOME]` in `SENSITIVE_PATTERNS` and `[USER]` in `sanitizePathForDisplay`.

**Severity:** IMPORTANT (consistency/maintainability)

## Findings

**Duplication in `src/lib/input/sanitize.ts`:**

```typescript
// SENSITIVE_PATTERNS uses [HOME]
[/\/Users\/[^/]+/g, "[HOME]"],
[/\/home\/[^/]+/g, "[HOME]"],

// sanitizePathForDisplay uses [USER]
.replace(/\/Users\/[^/]+/g, "[USER]")
.replace(/\/home\/[^/]+/g, "[USER]")
```

**Impact:**
- Confusing output for users (inconsistent redaction labels)
- Duplicated patterns to maintain
- Potential for drift if one is updated without the other

**Evidence:** Code-simplicity-reviewer identified this duplication.

## Proposed Solutions

### Option A: Standardize on [HOME] (Recommended)
- **Description:** Change `sanitizePathForDisplay` to use `[HOME]`
- **Pros:** Consistent with existing `SENSITIVE_PATTERNS`
- **Cons:** Minor breaking change if output is parsed
- **Effort:** Small
- **Risk:** Low

### Option B: Reuse SENSITIVE_PATTERNS in sanitizePathForDisplay
- **Description:** Refactor to use shared patterns array
- **Pros:** Single source of truth
- **Cons:** More complex implementation
- **Effort:** Medium
- **Risk:** Low

### Option C: Standardize on [USER]
- **Description:** Change `SENSITIVE_PATTERNS` to use `[USER]`
- **Pros:** More descriptive label
- **Cons:** Changes existing behavior
- **Effort:** Small
- **Risk:** Medium (may affect existing consumers)

## Recommended Action

**Option A** - Standardize on `[HOME]` for consistency.

## Technical Details

**Fix in `sanitizePathForDisplay`:**
```diff
export function sanitizePathForDisplay(path: string): string {
  return path
-   .replace(/\/Users\/[^/]+/g, "[USER]")
-   .replace(/\/home\/[^/]+/g, "[USER]")
-   .replace(/C:\\Users\\[^\\]+/g, "[USER]")
+   .replace(/\/Users\/[^/]+/g, "[HOME]")
+   .replace(/\/home\/[^/]+/g, "[HOME]")
+   .replace(/C:\\Users\\[^\\]+/g, "[HOME]")
    .replace(process.cwd(), ".");
}
```

## Acceptance Criteria

- [ ] Consistent redaction label across codebase
- [ ] `pnpm test` passes
- [ ] No regression in sanitization coverage

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-23 | Review completed | Code-simplicity-reviewer identified inconsistency |
| 2026-02-23 | Fixed | Changed [USER] to [HOME] in sanitizePathForDisplay as part of P1-016 fix |

## Resources

- File: `src/lib/input/sanitize.ts`
