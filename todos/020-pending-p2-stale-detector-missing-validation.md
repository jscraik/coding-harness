---
status: pending
priority: p2
issue_id: 020
tags: [security, path-traversal, code-review]
dependencies: [016, 018]
created: 2026-02-23
---

# Missing Path Validation in stale-detector.ts

## Problem Statement

`detectStaleDocs()` receives `basePath` and performs file operations without any path validation, unlike link-checker and quality-scorer which now have validation.

**Severity:** IMPORTANT (inconsistent security coverage)

## Findings

**Location:** `src/lib/gardener/stale-detector.ts:101-115`

```typescript
export function detectStaleDocs(basePath: string, staleDays: number = DEFAULT_STALE_DAYS): StaleDoc[] {
    // NO validation here
    if (!existsSync(basePath)) { return stale; }
    const docs = findMarkdownFiles(basePath, basePath);
    // ...
    const fullPath = join(basePath, doc);
    const content = readFileSync(fullPath, "utf-8");  // Direct file read
}
```

**Call chain from `gardener.ts:47`:**
```typescript
const docsPath = resolve(options.docsPath ?? "docs");  // Just resolve, no validation
const staleDocs: StaleDoc[] = detectStaleDocs(docsPath, staleDays);  // Unvalidated
```

**Impact:**
- Path traversal attacks possible via gardener command
- Inconsistent security posture across gardener modules

**Evidence:** Security-sentinel identified this gap during review.

## Proposed Solutions

### Option A: Add validatePath in detectStaleDocs (Recommended)
- **Description:** Add validation at start of function, return empty array on failure
- **Pros:** Consistent with link-checker pattern
- **Cons:** Silent failure (same as link-checker)
- **Effort:** Small
- **Risk:** Low

### Option B: Validate in runGardener before calling
- **Description:** Validate once in orchestrator, pass validated path to all functions
- **Pros:** Single validation point
- **Cons:** Changes function contract
- **Effort:** Small
- **Risk:** Low

## Recommended Action

**Option A** - Add validation consistent with other gardener modules.

## Technical Details

**Implementation:**
```typescript
export function detectStaleDocs(basePath: string, staleDays: number = DEFAULT_STALE_DAYS): StaleDoc[] {
    const stale: StaleDoc[] = [];

    // Add validation
    let validatedPath: string;
    try {
        validatedPath = validatePath(process.cwd(), basePath);
    } catch {
        return stale;
    }

    if (!existsSync(validatedPath)) { return stale; }
    // ... rest of function uses validatedPath
}
```

## Acceptance Criteria

- [ ] `validatePath` call added to `detectStaleDocs`
- [ ] Behavior matches link-checker pattern
- [ ] `pnpm test` passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-23 | Review completed | Security-sentinel identified missing validation |

## Resources

- Related: `todos/016-pending-p1-symlink-bypass-validatePath.md`
