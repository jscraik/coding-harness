---
last_validated: 2026-04-18
---

# Bugfix Template

## Purpose
Template for systematic bug investigation and resolution.

## Required Inputs

### Constraints
- [ ] Bug reproduction steps documented
- [ ] Affected versions/commits identified
- [ ] Impact severity assessed (critical/high/medium/low)
- [ ] Regression risk evaluated

### Acceptance Criteria
- [ ] Root cause identified and documented
- [ ] Fix addresses root cause, not symptoms
- [ ] Regression test added
- [ ] Verification steps confirmed

## Expected Outputs

### Files Touched
- Minimal set to fix the bug
- Test file with regression test
- Documentation if behavior change

### Tests
- Regression test that fails before fix, passes after
- Existing tests continue to pass
- Edge case tests if applicable

### Documentation
- Root cause analysis in PR description
- Comment explaining fix if non-obvious
- Changelog entry if user-facing bug

## Do Not Do

- **Do not** fix symptoms without understanding root cause
- **Do not** remove existing tests to make fix pass
- **Do not** introduce new abstractions during bugfix
- **Do not** bundle unrelated changes with fix
- **Do not** skip regression test
- **Do not** assume the fix works without reproduction verification

## Verification Checklist

- [ ] Bug reproduced before fix
- [ ] Fix verified against reproduction steps
- [ ] Regression test passes
- [ ] All existing tests pass
- [ ] Edge cases tested
- [ ] No new warnings/errors introduced

## Investigation Framework

1. **Reproduce**: Create minimal reproduction case
2. **Isolate**: Narrow down triggering conditions
3. **Analyze**: Identify root cause
4. **Fix**: Apply minimal targeted fix
5. **Verify**: Confirm fix resolves issue
6. **Prevent**: Add regression test

## Example Usage

```markdown
Bugfix: Fix race condition in cache invalidation

Reproduction:
1. Start two concurrent requests
2. Both read stale value
3. Both write different new values
4. Cache ends with inconsistent state

Root Cause:
Read-modify-write not atomic

Fix:
Use atomic compare-and-swap operation

Regression Test:
Simulate 100 concurrent updates, verify consistency
```
