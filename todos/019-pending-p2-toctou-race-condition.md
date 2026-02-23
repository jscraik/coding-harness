---
status: pending
priority: p2
issue_id: 019
tags: [security, race-condition, code-review]
dependencies: []
created: 2026-02-23
---

# TOCTOU Race Condition Between Validation and File Operations

## Problem Statement

Time-of-check to time-of-use vulnerability exists between path validation and actual file operations. An attacker could swap a validated path with a symlink in the microsecond gap.

**Severity:** IMPORTANT (security - race condition)

## Findings

**Vulnerable Pattern in `link-checker.ts:59-68`:**
```typescript
validatedPath = validatePath(basePath);  // CHECK
// ... several lines of code ...
if (!existsSync(validatedPath)) {        // USE (gap between)
```

**Vulnerable Pattern in `quality-scorer.ts:127-139`:**
```typescript
validatedPath = validatePath(docsPath);  // CHECK
// ...
const filePath = join(validatedPath, "QUALITY_SCORE.md");
writeFileSync(filePath, content, "utf-8");  // USE
```

**Attack Scenario:**
1. Attacker provides legitimate path `/docs`
2. `validatePath` passes
3. Attacker swaps `/docs` with symlink to `/etc` in the microsecond gap
4. File operation writes to `/etc/QUALITY_SCORE.md`

**Evidence:** Security-sentinel identified this as a HIGH severity TOCTOU vulnerability.

## Proposed Solutions

### Option A: Re-validate immediately before use
- **Description:** Add validation call right before each file operation
- **Pros:** Minimal code changes
- **Cons:** Duplicated validation calls
- **Effort:** Small
- **Risk:** Low

### Option B: Use realpathSync at point of use
- **Description:** After validation, canonicalize path immediately before file operation
- **Pros:** Catches symlink swaps
- **Cons:** Requires careful implementation
- **Effort:** Medium
- **Risk:** Medium

### Option C: Use file descriptors where possible
- **Description:** Open file immediately after validation, use descriptor for operations
- **Pros:** Most robust solution
- **Cons:** Significant refactor, not always possible
- **Effort:** Large
- **Risk:** Medium

## Recommended Action

**Option A** for immediate fix; **Option B** for enhanced security.

## Technical Details

**Affected files:**
- `src/lib/gardener/link-checker.ts:59-82`
- `src/lib/gardener/quality-scorer.ts:127-139`
- `src/lib/gardener/quality-scorer.ts:151-158`

## Acceptance Criteria

- [ ] Gap between validation and use minimized
- [ ] Consider realpathSync at point of use
- [ ] Security review of changes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-23 | Review completed | Security-sentinel identified TOCTOU risk |

## Resources

- CWE-367: Time-of-check Time-of-use (TOCTOU) Race Condition
