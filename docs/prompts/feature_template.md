---
last_validated: 2026-04-18
---

# Feature Template

## Purpose
Template for implementing new features in a safe, maintainable way.

## Required Inputs

### Constraints
- [ ] Target repository identified
- [ ] Base branch/commit specified
- [ ] Risk tier assessed (low/medium/high)
- [ ] Scope boundaries defined (what is out of scope)

### Acceptance Criteria
- [ ] Specific behavior expectations listed
- [ ] Edge cases documented
- [ ] Test requirements specified
- [ ] Evidence requirements (screenshots for UI changes)

## Expected Outputs

### Files Touched
- Implementation files in `src/`
- Test files in `test/` or `*.test.ts`
- Documentation updates in `docs/`
- Contract/schema updates if API changes

### Tests
- Unit tests for new logic
- Integration tests for critical paths
- Evidence artifacts for UI flows (when applicable)

### Documentation
- Code comments for complex logic
- README updates if user-facing
- Architecture notes if design decisions made

## Do Not Do

- **Do not** add dependencies without explicit justification and security review
- **Do not** implement generic abstractions for single-use cases (YAGNI)
- **Do not** use silent catch blocks - fail fast with actionable errors
- **Do not** skip tests for "simple" changes
- **Do not** commit secrets, tokens, or credentials
- **Do not** break backward compatibility without migration plan
- **Do not** optimize prematurely - measure first

## Verification Checklist

- [ ] All acceptance criteria met
- [ ] Tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Evidence attached (if required by policy)
- [ ] Documentation updated

## Example Usage

```markdown
Feature: Add user authentication flow

Constraints:
- Target: src/auth/
- Risk tier: high (security-critical)
- Scope: Login/logout only, no password reset

Acceptance Criteria:
- Users can log in with email/password
- Failed attempts return generic error (no enumeration)
- Sessions expire after 24 hours
- Rate limiting: 5 attempts per minute

Verification:
- Unit tests for auth service
- Integration tests for login flow
- Security review required before merge
```
