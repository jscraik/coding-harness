---
status: complete
priority: p2
issue_id: 006
tags: [consistency, code-review, refactoring]
dependencies: []
date: 2026-02-23
incorporated_in_plan: true
---

# SanitizeError Ownership and Duplication

## Problem Statement

The plan proposes a new `sanitizeError` in `src/lib/input/sanitize.ts` but does not address the existing `sanitizeError` in `src/cli.ts`. This creates duplication and ownership confusion.

## Findings

**Existing code in `src/cli.ts` (Phase 1):**
```typescript
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message
      .replace(/[a-zA-Z0-9_-]{20,}/g, "[REDACTED]")
      .replace(/\/Users\/[^/]+/g, "[HOME]")
      .replace(/\/home\/[^/]+/g, "[HOME]");
    return `${error.name}: ${message}`;
  }
  return String(error).replace(/[a-zA-Z0-9_-]{20,}/g, "[REDACTED]");
}
```

**Proposed in plan (`src/lib/input/sanitize.ts`):**
```typescript
export function sanitizeError(error: unknown): string {
  // Enhanced version with more patterns (35 lines)
}
```

**Issues:**
1. Two implementations will exist
2. Unclear which is the source of truth
3. Enhanced patterns may redact legitimate content

## Proposed Solutions

### Solution A: Extract and enhance in-place (Recommended)

1. Move existing `sanitizeError` from `cli.ts` to `lib/input/sanitize.ts`
2. Enhance with additional patterns
3. Update `cli.ts` to import from new location
4. Remove overly broad pattern

```typescript
// lib/input/sanitize.ts
export function sanitizeError(error: unknown): string {
  const patterns: [RegExp, string][] = [
    // Paths
    [/\/Users\/[^/]+/g, "[HOME]"],
    [/\/home\/[^/]+/g, "[HOME]"],
    [/C:\\Users\\[^\\]+/g, "[HOME]"],
    // Specific API keys only (not broad 20+ char pattern)
    [/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED]"],
    [/ghp_[a-zA-Z0-9]{36}/g, "[REDACTED]"],
    [/gho_[a-zA-Z0-9]{36}/g, "[REDACTED]"],
    [/github_pat_[a-zA-Z0-9_]{22,}/g, "[REDACTED]"],
    [/AKIA[A-Z0-9]{16}/g, "[REDACTED]"],
    [/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/g, "[REDACTED]"],
  ];

  if (error instanceof Error) {
    let message = error.message;
    for (const [pattern, replacement] of patterns) {
      message = message.replace(pattern, replacement);
    }
    return `${error.name}: ${message}`;
  }

  let message = String(error);
  for (const [pattern, replacement] of patterns) {
    message = message.replace(pattern, replacement);
  }
  return message;
}

// cli.ts
import { sanitizeError } from "./lib/input/sanitize.js";
```

**Pros:** Single source of truth, enhanced patterns, removes overly broad regex
**Cons:** Requires updating cli.ts import
**Effort:** Small
**Risk:** Low

### Solution B: Keep both, document difference

- cli.ts: Simple version for CLI bootstrap
- lib/input/sanitize.ts: Enhanced version for library use

**Pros:** No changes to existing code
**Cons:** Confusion, potential inconsistency
**Effort:** Small
**Risk:** Medium

**Recommendation:** Solution A - consolidate to single implementation.

## Technical Details

**Affected files:**
- `src/lib/input/sanitize.ts` (enhanced implementation)
- `src/cli.ts` (update import, remove local function)

## Acceptance Criteria

- [ ] Single `sanitizeError` implementation in `lib/input/sanitize.ts`
- [ ] `cli.ts` imports from new location
- [ ] Overly broad `/[a-zA-Z0-9_-]{20,}/g` pattern removed or refined
- [ ] All existing tests pass

## Work Log

- 2026-02-23: Issue identified during technical review by Pattern Recognition and Simplicity reviewers
