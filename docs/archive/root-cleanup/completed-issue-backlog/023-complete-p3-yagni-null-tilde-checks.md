---
status: complete
priority: p3
issue_id: 023
tags: [cleanup, yagni, code-review]
dependencies: [016, 018]
created: 2026-02-23
---

# YAGNI: Redundant Null Byte and Tilde Checks

## Problem Statement

The null byte (`\0`) and tilde (`~`) checks in `validatePath` (sanitize.ts) are redundant with Node.js behavior and the `startsWith()` jail check.

**Severity:** NICE-TO-HAVE (code cleanup)

## Findings

**Location:** `src/lib/input/sanitize.ts:47-54`

```typescript
// Null byte check - Node.js already rejects these
if (inputPath.includes("\0")) {
    throw new Error("Path contains invalid characters");
}

// Tilde check - resolve() treats ~ as literal, not home expansion
if (inputPath.includes("..") || inputPath.includes("~")) {
    throw new Error("Path traversal detected in input");
}
```

**Why YAGNI:**
1. **Null byte:** Modern Node.js does not allow null bytes in paths. File system operations will fail naturally.
2. **Tilde:** Shell expansion happens before the program runs. `resolve()` treats `~` as a literal directory name, not home. The `startsWith()` check catches any path escaping.

**Evidence:** Code-simplicity-reviewer identified these as YAGNI violations.

## Proposed Solutions

### Option A: Remove redundant checks (Recommended)
- **Description:** Delete null byte and tilde checks
- **Pros:** Simpler code, relies on Node.js and jail check
- **Cons:** None (defense-in-depth already provided)
- **Effort:** Small
- **Risk:** None

### Option B: Document and keep
- **Description:** Add comments explaining why checks exist
- **Pros:** Defense-in-depth explicit
- **Cons:** Unnecessary code
- **Effort:** Small
- **Risk:** None

## Recommended Action

**Option A** - If consolidating to `validator.ts` (todo 016), ensure those checks aren't needed there. The `validator.ts` version doesn't have them and is secure.

## Technical Details

**Note:** This todo is dependent on 016/018. If we consolidate to `validator.ts`, this cleanup happens automatically.

## Acceptance Criteria

- [ ] Redundant checks removed or documented
- [ ] `pnpm test` passes
- [ ] Security posture maintained

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-23 | Review completed | Code-simplicity-reviewer identified YAGNI |
| 2026-02-23 | Fixed | Removed duplicate validatePath entirely - validator.ts version doesn't have these checks |

## Resources

- Related: `docs/archive/root-cleanup/completed-issue-backlog/016-complete-p1-symlink-bypass-validatePath.md`
