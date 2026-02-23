---
status: complete
priority: p1
issue_id: 004
tags: [security, dos, code-review]
dependencies: []
date: 2026-02-23
incorporated_in_plan: true
---

# Missing JSON Depth Limit (DoS Vector)

## Problem Statement

While the plan enforces a 1MB size limit on contract files, deeply nested JSON can cause stack overflow with just a few kilobytes.

## Findings

**Location:** `src/lib/contract/loader.ts` - JSON parsing

**Current code:**
```typescript
let data: unknown;
try {
  data = JSON.parse(content);  // No depth limit
} catch (e) {
  // ...
}
```

**Attack vector:**
```json
{"a":{"a":{"a":{"a":...  // 10,000 deep ...}}}}
```

A 1KB file with 10,000 nested objects exceeds V8's default stack limit, causing RangeError.

**CVSS Score:** 7.5 (HIGH) - Availability impact

## Proposed Solutions

### Solution A: Add depth tracking with reviver (Recommended)

```typescript
const MAX_JSON_DEPTH = 100;
let currentDepth = 0;

function safeParse(content: string): unknown {
  currentDepth = 0;
  return JSON.parse(content, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      currentDepth++;
      if (currentDepth > MAX_JSON_DEPTH) {
        throw new Error(`JSON depth exceeds maximum (${MAX_JSON_DEPTH})`);
      }
    }
    return value;
  });
}
```

**Pros:** Simple, uses built-in JSON.parse
**Cons:** Reviver called for every value (slight overhead)
**Effort:** Small
**Risk:** Low

### Solution B: Use streaming JSON parser

```typescript
import { parse as streamParse } from 'streaming-json-parse';

function safeParse(content: string): unknown {
  return streamParse(content, { maxDepth: 100 });
}
```

**Pros:** No stack overflow possible
**Cons:** Adds dependency, more complex
**Effort:** Medium
**Risk:** Medium

**Recommendation:** Solution A is sufficient for contract files. Solution B only if performance issues arise.

## Technical Details

**Affected files:**
- `src/lib/contract/loader.ts` (implementation)
- `src/lib/contract/loader.test.ts` (tests needed)

**Constants:**
- `MAX_JSON_DEPTH = 100` (sufficient for any reasonable contract)

## Acceptance Criteria

- [ ] JSON deeper than 100 levels is rejected
- [ ] Clear error message indicates depth limit
- [ ] Unit test for deep JSON attack
- [ ] Error code in validation result for programmatic handling

## Work Log

- 2026-02-23: Issue identified during technical review by Security Sentinel agent
