---
status: pending
priority: p3
tags: [code-review, gardener, refactoring, simplicity]
dependencies: []
---

# Deduplicate Code Patterns in Gardener

## Problem Statement

The gardener command has several code patterns that are duplicated or could be simplified, reducing maintainability and increasing the risk of inconsistencies.

## Findings

### 1. Duplicate Exit Code Logic
**Location:** `src/commands/gardener.ts:102` and `145`
**Issue:** Same ternary expression appears twice:
```typescript
return output.needsPR ? EXIT_CODES.ISSUES_FOUND : EXIT_CODES.SUCCESS;
```

### 2. Duplicated List Truncation Logic
**Location:** `src/commands/gardener.ts:113-123` and `127-134`
**Issue:** "Show first 5, then ellipsis" pattern repeated for stale docs and broken links:
```typescript
for (const doc of output.staleDocs.slice(0, 5)) { ... }
if (output.staleDocs.length > 5) { ... }

for (const link of output.brokenLinks.slice(0, 5)) { ... }
if (output.brokenLinks.length > 5) { ... }
```

## Proposed Solutions

### For Exit Code Duplication
Extract constant at top of success block:
```typescript
if (result.ok) {
    const output = result.output;
    const exitCode = output.needsPR ? EXIT_CODES.ISSUES_FOUND : EXIT_CODES.SUCCESS;

    if (options.json) {
        console.info(JSON.stringify(result.output, null, 2));
        return exitCode;
    }
    // ... human output ...
    return exitCode;
}
```

### For List Truncation
Extract helper function:
```typescript
function formatList<T>(items: T[], format: (item: T) => string, max = 5): string[] {
    const lines = items.slice(0, max).map(format);
    if (items.length > max) {
        lines.push(`  ... and ${items.length - max} more`);
    }
    return lines;
}
```

## Recommended Action

Implement both deduplications to improve maintainability. This is low priority as the current code is functional.

## Technical Details

**Affected File:** `src/commands/gardener.ts`

**Related Pattern:**
- See other commands for consistent exit code handling patterns

## Acceptance Criteria

- [ ] Exit code logic extracted to constant
- [ ] List truncation helper created
- [ ] Both stale docs and broken links use helper
- [ ] Tests still pass
- [ ] No behavioral changes

## Work Log

- **2026-02-23**: Issue identified during code review
