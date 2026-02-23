---
status: complete
priority: p1
issue_id: 005
tags: [security, prototype-pollution, code-review]
dependencies: []
date: 2026-02-23
incorporated_in_plan: true
---

# Prototype Pollution via riskTierRules

## Problem Statement

The validator does not block `__proto__`, `constructor`, and `prototype` keys in riskTierRules, allowing prototype pollution attacks.

## Findings

**Location:** `src/lib/contract/validator.ts` - `isValidRiskTierRules()`

**Current code:**
```typescript
function isValidRiskTierRules(value: unknown): value is Record<string, RiskTier> {
  if (typeof value !== "object" || value === null) return false;
  for (const [pattern, tier] of Object.entries(value as Record<string, unknown>)) {
    // Does NOT block __proto__, constructor, toString
    if (typeof pattern !== "string" || !isValidRiskTier(tier)) return false;
  }
  return true;
}
```

**Attack vector:**
```json
{
  "version": "1.0",
  "riskTierRules": {
    "__proto__": "high",
    "constructor": "high"
  }
}
```

**Impact:** While current code uses rules read-only, future code iterating with `for...in` or `Object.assign()` could be affected.

**CVSS Score:** 7.3 (HIGH)

## Proposed Solutions

### Solution A: Block forbidden keys (Recommended)

```typescript
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

function isValidRiskTierRules(value: unknown): value is Record<string, RiskTier> {
  if (typeof value !== "object" || value === null) return false;
  for (const [pattern, tier] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(pattern as typeof FORBIDDEN_KEYS[number])) {
      return false;
    }
    if (typeof pattern !== "string" || !isValidRiskTier(tier)) return false;
  }
  return true;
}
```

**Pros:** Simple, defensive, no runtime overhead
**Cons:** None
**Effort:** Small
**Risk:** Low

### Solution B: Use Object.create(null)

```typescript
const rules = Object.create(null) as Record<string, RiskTier>;
// ... populate rules ...
```

**Pros:** No prototype chain to pollute
**Cons:** More invasive changes throughout codebase
**Effort:** Medium
**Risk:** Low

**Recommendation:** Solution A for immediate fix. Solution B as future hardening.

## Technical Details

**Affected files:**
- `src/lib/contract/validator.ts` (implementation)
- `src/lib/contract/loader.test.ts` (tests needed)

**Forbidden keys:**
- `__proto__`
- `constructor`
- `prototype`

## Acceptance Criteria

- [ ] `__proto__` key is rejected
- [ ] `constructor` key is rejected
- [ ] `prototype` key is rejected
- [ ] Unit test for prototype pollution attempt
- [ ] Error message indicates which key is forbidden

## Work Log

- 2026-02-23: Issue identified during technical review by Security Sentinel agent
