---
status: complete
priority: p1
issue_id: 001
tags: [security, path-traversal, code-review]
dependencies: []
date: 2026-02-23
incorporated_in_plan: true
---

# Path Traversal Bypass via Symlink Race

## Problem Statement

The `validatePath()` function in `loader.ts` does not canonicalize the resolved path before comparison, allowing symlink-based path traversal attacks.

## Findings

**Location:** `src/lib/contract/loader.ts` - `validatePath()` function

**Current vulnerable code:**
```typescript
function validatePath(baseDir: string, userPath: string): string {
  const resolved = resolve(baseDir, normalize(userPath));
  const realBase = realpathSync(baseDir);
  if (!resolved.startsWith(realBase)) {  // VULNERABLE
    throw new Error(`Path traversal detected`);
  }
  return resolved;
}
```

**Attack scenario:**
1. Attacker creates symlink: `ln -s /etc/passwd ./harness.contract.json`
2. Passes `./harness.contract.json` as contract path
3. `resolve()` returns `<baseDir>/harness.contract.json`
4. Check passes because path starts with `realBase`
5. `readFileSync()` follows symlink to `/etc/passwd`

**CVSS Score:** 9.1 (CRITICAL)

## Proposed Solutions

### Solution A: Canonicalize resolved path (Recommended)

```typescript
function validatePath(baseDir: string, userPath: string): string {
  const resolved = resolve(baseDir, normalize(userPath));
  const realBase = realpathSync(baseDir);

  let realResolved: string;
  try {
    realResolved = realpathSync(resolved);
  } catch {
    // Path doesn't exist - validate parent directory
    const parentDir = dirname(resolved);
    const realParent = realpathSync(parentDir);
    if (!realParent.startsWith(realBase)) {
      throw new Error("Path traversal detected");
    }
    return resolved;
  }

  if (!realResolved.startsWith(realBase)) {
    throw new Error("Path traversal detected");
  }
  return realResolved;
}
```

**Pros:** Fixes the vulnerability completely
**Cons:** Slightly more complex error handling
**Effort:** Small
**Risk:** Low

### Solution B: Use file descriptors

```typescript
const fd = openSync(validatedPath, 'r');
try {
  const stat = fstatSync(fd);
  if (!stat.isFile()) {
    throw new Error('Contract path must be a regular file');
  }
  const content = readFileSync(fd, 'utf-8');
  // ...
} finally {
  closeSync(fd);
}
```

**Pros:** Prevents TOCTOU race condition
**Cons:** More invasive changes
**Effort:** Medium
**Risk:** Medium

## Technical Details

**Affected files:**
- `src/lib/contract/loader.ts` (implementation)
- `src/lib/contract/loader.test.ts` (tests needed)

## Acceptance Criteria

- [ ] Symlink path traversal is blocked
- [ ] Error message does not leak attacker-controlled paths
- [ ] Non-existent paths handled gracefully (parent directory validation)
- [ ] Unit tests for symlink attack scenarios

## Work Log

- 2026-02-23: Issue identified during technical review by Security Sentinel agent
- 2026-02-24: Resolved - consolidated to symlink-safe validatePath in validator.ts (commit 1d1ccae)
