---
last_validated: 2026-04-18
---

# Refactor Template

## Purpose
Template for safe code refactoring without behavior changes.

## Required Inputs

### Constraints
- [ ] Behavior preservation contract defined
- [ ] Test coverage baseline established
- [ ] Rollback plan identified
- [ ] Risk tier assessed (complexity of change)

### Acceptance Criteria
- [ ] No functional changes (behavior identical)
- [ ] All existing tests pass without modification
- [ ] Performance not degraded (benchmark if critical)
- [ ] Code metrics improved (complexity, duplication)

## Expected Outputs

### Files Touched
- Refactored implementation files
- Test files only if test quality improvements
- No contract/schema changes (if pure refactor)

### Tests
- All existing tests pass
- New tests only for previously untested behavior
- Performance benchmarks (if applicable)

### Documentation
- PR explains motivation for refactor
- Design notes if pattern changes
- No user-facing docs (no behavior change)

## Do Not Do

- **Do not** mix behavior changes with refactoring
- **Do not** refactor without test coverage
- **Do not** change public APIs (breaking change, not refactor)
- **Do not** introduce new dependencies
- **Do not** optimize without measuring
- **Do not** delete tests unless truly redundant

## Verification Checklist

- [ ] All tests pass unchanged
- [ ] Manual verification of critical paths
- [ ] Diff reviewed for accidental changes
- [ ] Performance verified (if applicable)
- [ ] Rollback tested

## Safety Rules

1. **Green tests first**: Ensure baseline is green
2. **Small steps**: Refactor in minimal increments
3. **Verify often**: Run tests after each change
4. **Stop if red**: Revert and reassess if tests fail
5. **Document why**: Explain the improvement

## Example Usage

```markdown
Refactor: Extract validation logic from controller

Motivation:
Controller doing too much, validation logic duplicated

Plan:
1. Extract validation to pure functions
2. Move to validators/ module
3. Update imports
4. Verify no behavior change

Success Metrics:
- Controller under 100 lines
- Validation reusable
- Test coverage maintained
```
