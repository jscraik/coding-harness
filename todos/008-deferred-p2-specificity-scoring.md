---
status: complete
resolved_date: 2026-02-26
incorporated_in_plan: docs/plans/2026-02-25-feat-remediation-loop-implementation-plan.md
priority: p2
issue_id: 008
tags: [correctness, glob-matching, code-review]
dependencies: []
date: 2026-02-23
triage_decision: "DEFER - Implement during coding if pattern conflicts observed"
---

# Replace Length-Based Sorting with Specificity Scoring

## Problem Statement

Pattern length is a poor proxy for specificity. The current sorting algorithm can produce counter-intuitive matching order.

## Findings

**Location:** `src/lib/policy/risk-tier.ts` (planned)

**Current code:**
```typescript
const compiled: Rule[] = Object.entries(rules)
  .map(([pattern, tier]) => ({
    pattern,
    tier,
    matcher: picomatch(pattern),
  }))
  .sort((a, b) => b.pattern.length - a.pattern.length);
```

**Problem examples:**
- `src/**/*.ts` (length 11) sorts before `src/auth/**` (length 10)
- But `src/auth/**` is MORE specific for auth files
- A pattern like `**/*.test.ts` (length 12) could override `src/auth/login.test.ts` matching

## Proposed Solutions

### Solution A: Specificity scoring function (Recommended)

```typescript
function patternSpecificity(pattern: string): number {
  let score = 0;

  // No wildcards = most specific
  if (!pattern.includes("**") && !pattern.includes("*")) {
    score += 1000;
  }

  // More path segments = more specific
  score += (pattern.match(/\//g) || []).length * 10;

  // No globstar = more specific
  if (!pattern.includes("**")) score += 100;

  // No single wildcard = more specific
  if (!pattern.includes("*") || pattern.includes("**")) score += 50;

  // Longer literal portions = more specific
  const literalPortion = pattern.replace(/\*\*?/g, "");
  score += literalPortion.length;

  return score;
}

// Sort by specificity (highest first)
.sort((a, b) => patternSpecificity(b.pattern) - patternSpecificity(a.pattern))
```

**Pros:** More intuitive matching, better specificity ordering
**Cons:** Slightly more complex
**Effort:** Small
**Risk:** Low

### Solution B: Document current behavior, allow explicit ordering

```typescript
interface RiskTierRule {
  pattern: string;
  tier: RiskTier;
  priority?: number;  // Explicit override
}
```

**Pros:** User control over ordering
**Cons:** More complex contract schema
**Effort:** Medium
**Risk:** Medium

**Recommendation:** Solution A for Phase 2. Solution B can be added later if users need more control.

## Technical Details

**Affected files:**
- `src/lib/policy/risk-tier.ts` (add scoring function, update sort)
- `src/lib/policy/risk-tier.test.ts` (test specificity)

## Acceptance Criteria

- [x] `patternSpecificity()` function implemented
- [x] Rules sorted by specificity score
- [x] Test cases verify correct ordering:
  - `src/auth/**` > `src/**`
  - `src/auth/login.ts` > `src/auth/**`
  - `**/*.test.ts` does not override specific patterns

## Work Log

- 2026-02-23: Issue identified during technical review by Architecture Strategist

### 2026-02-26 - Completed
**By:** Codex
**Actions:** Verified implementation already in place in `src/lib/policy/risk-tier.ts` and tests in `src/lib/policy/risk-tier.test.ts`; confirmed ordering behavior for `src/auth/**`, `src/auth/login.ts`, and `**/*.test.ts` cases; marked TODO complete.
