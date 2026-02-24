---
status: complete
priority: p2
issue_id: 009
tags: [architecture, srp, code-review]
dependencies: []
date: 2026-02-23
incorporated_in_plan: true
---

# Move validatePath to input/validator.ts

## Problem Statement

The `validatePath()` function is defined in `loader.ts` but belongs in `input/validator.ts` for Single Responsibility Principle compliance.

## Findings

**Location:** `src/lib/contract/loader.ts` (planned)

**Current structure:**
```
src/lib/
  contract/
    loader.ts        # Contains validatePath() - WRONG
  input/
    validator.ts     # Should contain validatePath()
```

**SRP violation:** `loader.ts` currently has multiple reasons to change:
1. Changes to file I/O (reading contracts)
2. Changes to path validation logic
3. Changes to JSON parsing
4. Changes to contract structure

## Proposed Solutions

### Solution A: Extract to input/validator.ts (Recommended)

```typescript
// src/lib/input/validator.ts
export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathTraversalError";
  }
}

export function validatePath(baseDir: string, userPath: string): string {
  const resolved = resolve(baseDir, normalize(userPath));
  const realBase = realpathSync(baseDir);

  let realResolved: string;
  try {
    realResolved = realpathSync(resolved);
  } catch {
    const parentDir = dirname(resolved);
    const realParent = realpathSync(parentDir);
    if (!realParent.startsWith(realBase)) {
      throw new PathTraversalError("Path traversal detected");
    }
    return resolved;
  }

  if (!realResolved.startsWith(realBase)) {
    throw new PathTraversalError("Path traversal detected");
  }
  return realResolved;
}

// src/lib/contract/loader.ts
import { validatePath, PathTraversalError } from "../input/validator.js";

export function loadContract(path: string): HarnessContract {
  const cwd = process.cwd();
  const validatedPath = validatePath(cwd, path);
  // ... rest of loader
}
```

**Pros:** Proper SRP, cleaner dependencies, reusable path validation
**Cons:** One more import
**Effort:** Small
**Risk:** Low

### Solution B: Keep in loader.ts, rename to internal

```typescript
// Keep but mark as internal
/** @internal */
function validatePathForContract(baseDir: string, userPath: string): string { ... }
```

**Pros:** No file moves
**Cons:** Still violates SRP
**Effort:** Small
**Risk:** Low

**Recommendation:** Solution A for proper architecture. The path validation is a generic input validation concern, not contract-specific.

## Technical Details

**Affected files:**
- `src/lib/input/validator.ts` (new home for validatePath)
- `src/lib/contract/loader.ts` (remove validatePath, add import)

## Acceptance Criteria

- [ ] `validatePath` moved to `src/lib/input/validator.ts`
- [ ] `PathTraversalError` class added
- [ ] `loader.ts` imports from `input/validator.js`
- [ ] All tests pass after move

## Work Log

- 2026-02-23: Issue identified during technical review by Architecture Strategist
