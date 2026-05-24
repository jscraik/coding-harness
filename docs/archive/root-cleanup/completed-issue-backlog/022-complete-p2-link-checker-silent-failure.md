---
status: complete
priority: p2
issue_id: 022
tags: [error-handling, agent-native, code-review]
dependencies: []
created: 2026-02-23
---

# link-checker Returns Empty Array on Path Validation Failure

## Problem Statement

When path validation fails in `checkLinks()`, the error is logged to console but returns an empty array. Callers (and agents consuming JSON output) cannot distinguish between "no broken links" and "path validation failed."

**Severity:** IMPORTANT (agent-native design, error handling)

## Findings

**Location:** `src/lib/gardener/link-checker.ts:60-68`

```typescript
try {
    validatedPath = validatePath(basePath);
} catch (error) {
    console.error(
        "Invalid docs path:",
        error instanceof Error ? error.message : String(error),
    );
    return brokenLinks;  // Returns empty array - silent failure
}
```

**Comparison with quality-scorer.ts (correct pattern):**
```typescript
try {
    validatedPath = validatePath(docsPath);
} catch (error) {
    return {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid docs path",
    };
}
```

**Impact:**
- Agents consuming JSON cannot detect validation failures
- Silent data loss - caller assumes success with no broken links
- Inconsistent with repository's Result pattern

**Evidence:** Agent-native-reviewer and architecture-strategist identified this issue.

## Proposed Solutions

### Option A: Return structured result (Recommended)
- **Description:** Change return type to `Result<BrokenLink[], Error>`
- **Pros:** Consistent with quality-scorer pattern, agent-friendly
- **Cons:** Breaking change to function signature
- **Effort:** Medium
- **Risk:** Medium (requires caller updates)

### Option B: Throw error instead of returning empty
- **Description:** Let validation error propagate to caller
- **Pros:** Simple, existing error handling
- **Cons:** Exception-based flow control
- **Effort:** Small
- **Risk:** Low

### Option C: Log and continue (current)
- **Description:** Keep current behavior, document limitation
- **Pros:** No changes needed
- **Cons:** Silent failures continue
- **Effort:** None
- **Risk:** None

## Recommended Action

**Option B** implemented - validation errors now throw and are caught by the caller's try-catch block, allowing proper error detection.

## Technical Details

**If Option B:**
```diff
try {
    validatedPath = validatePath(basePath);
} catch (error) {
-   console.error(
-       "Invalid docs path:",
-       error instanceof Error ? error.message : String(error),
-   );
-   return brokenLinks;
+   throw error;  // Let caller handle
}
```

## Acceptance Criteria

- [x] Path validation failures are detectable by callers
- [x] Consistent error handling pattern across gardener modules
- [x] `pnpm test` passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-23 | Review completed | Agent-native-reviewer identified silent failure |
| 2026-02-23 | Fixed | Removed try-catch, let validation error propagate to caller |

## Resources

- Related: `docs/archive/root-cleanup/completed-issue-backlog/011-complete-p2-return-structured-result.md`
