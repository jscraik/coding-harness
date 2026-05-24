---
status: complete
priority: p2
issue_id: 007
tags: [agent-native, validation, code-review]
dependencies: []
date: 2026-02-23
incorporated_in_plan: true
---

# Add Error Codes to ValidationError

## Problem Statement

Validation errors lack machine-readable codes, making it difficult for agents and automation to programmatically handle specific error types.

## Findings

**Location:** `src/lib/contract/validator.ts` (planned)

**Current interface:**
```typescript
export interface ValidationError {
  path: string;
  message: string;
  expected?: string;
  received?: string;
  fix?: string;
}
```

**Problem:** No error code field. Agents must parse human-readable `message` strings to identify error types, which is fragile.

## Proposed Solutions

### Solution A: Add error code enum (Recommended)

```typescript
export enum ValidationErrorCode {
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_TYPE = "INVALID_TYPE",
  INVALID_VALUE = "INVALID_VALUE",
  INVALID_RISK_TIER = "INVALID_RISK_TIER",
  FORBIDDEN_KEY = "FORBIDDEN_KEY",
  SIZE_LIMIT_EXCEEDED = "SIZE_LIMIT_EXCEEDED",
  DEPTH_LIMIT_EXCEEDED = "DEPTH_LIMIT_EXCEEDED",
  PATH_TRAVERSAL = "PATH_TRAVERSAL",
}

export interface ValidationError {
  code: ValidationErrorCode;
  path: string;
  message: string;
  expected?: string;
  received?: string;
  fix?: string;
}
```

**Pros:** Machine-readable, extensible, enables programmatic error handling
**Cons:** One more field to maintain
**Effort:** Small
**Risk:** Low

### Solution B: Use discriminated union

```typescript
type ValidationError =
  | { type: "MISSING_FIELD"; path: string; field: string }
  | { type: "INVALID_TYPE"; path: string; expected: string; received: string }
  | { type: "INVALID_VALUE"; path: string; value: unknown };
```

**Pros:** Type-safe narrowing
**Cons:** More complex, harder to extend
**Effort:** Medium
**Risk:** Medium

**Recommendation:** Solution A - simple enum is sufficient and easier to work with.

## Technical Details

**Affected files:**
- `src/lib/contract/validator.ts` (add enum, update interface)
- `src/lib/contract/loader.ts` (use codes when throwing)
- `src/lib/contract/loader.test.ts` (test for codes)

## Acceptance Criteria

- [ ] `ValidationErrorCode` enum defined with all error types
- [ ] `ValidationError.code` field added
- [ ] All validation errors include appropriate code
- [ ] Tests verify error codes are correct

## Work Log

- 2026-02-23: Issue identified during technical review by Agent-Native reviewer
