# Blast Radius Map

This document maps file paths to required checks, enabling deterministic check routing based on changed files.

## Purpose

When files change, the harness uses this map to determine which checks must run. This prevents:
- Running all checks for every change (slow)
- Missing critical checks for high-risk changes (dangerous)

## Path-to-Check Mappings

### Critical Paths (Always Full Suite)

| Path Pattern | Required Checks | Rationale |
|-------------|-----------------|-----------|
| `src/auth/**` | auth-flows, security-scan, integration-tests | Authentication is security-critical |
| `src/payments/**` | payment-flows, compliance-check, e2e-tests | Financial transactions require verification |
| `**/encryption/**` | crypto-tests, security-audit | Cryptographic code is high-risk |
| `**/secrets/**` | secret-scan, access-control-tests | Secret handling is sensitive |

### API Contract Paths

| Path Pattern | Required Checks | Rationale |
|-------------|-----------------|-----------|
| `src/api/**` | contract-tests, openapi-validate, breaking-change-detection | API contracts affect consumers |
| `**/types.ts` | typecheck, api-surface-check | Type changes affect API |
| `**/schema/**` | schema-validation, migration-tests | Schema changes need migration path |

### UI Component Paths

| Path Pattern | Required Checks | Rationale |
|-------------|-----------------|-----------|
| `src/components/**` | component-tests, visual-regression, a11y-check | UI components need visual testing |
| `src/ui/**` | storybook-verify, ui-fast, ui-verify | UI paths need visual feedback |
| `**/*.css` | stylelint, visual-regression | CSS affects appearance |
| `**/*.scss` | stylelint, visual-regression | SCSS affects appearance |

### Database Paths

| Path Pattern | Required Checks | Rationale |
|-------------|-----------------|-----------|
| `**/migrations/**` | migration-tests, rollback-tests, schema-validation | Migrations must be reversible |
| `**/models/**` | model-tests, integration-tests | Model changes affect data layer |
| `**/queries/**` | query-tests, performance-check | Queries affect performance |

### Configuration Paths

| Path Pattern | Required Checks | Rationale |
|-------------|-----------------|-----------|
| `package.json` | dependency-audit, license-check, install-test | Dependencies affect security |
| `tsconfig.json` | typecheck, build-test | Config affects compilation |
| `.github/workflows/**` | workflow-validate, dry-run-tests | CI changes affect all builds |
| `harness.contract.json` | contract-validate, policy-gate | Contract changes affect enforcement |

### Documentation Paths

| Path Pattern | Required Checks | Rationale |
|-------------|-----------------|-----------|
| `docs/**` | docs-lint, link-check, freshness-check | Docs need quality checks |
| `README.md` | readme-validate, link-check | README is first impression |
| `CHANGELOG.md` | changelog-validate, version-check | Changelog tracks releases |

### Test Paths

| Path Pattern | Required Checks | Rationale |
|-------------|-----------------|-----------|
| `tests/**` | test-lint, coverage-check | Tests need validation |
| `**/*.test.ts` | test-run, coverage-check | Unit tests must pass |
| `**/*.spec.ts` | test-run, coverage-check | Spec tests must pass |

## Check Definitions

### Security Checks
- `security-scan` - SAST and dependency vulnerability scan
- `auth-flows` - Authentication flow integration tests
- `secret-scan` - Detect committed secrets
- `access-control-tests` - RBAC/permissions tests

### API Checks
- `contract-tests` - API contract validation
- `openapi-validate` - OpenAPI schema validation
- `breaking-change-detection` - Detect breaking changes

### UI Checks
- `component-tests` - Component unit tests
- `visual-regression` - Screenshot comparison
- `a11y-check` - Accessibility audit
- `storybook-verify` - Storybook build and test

### Database Checks
- `migration-tests` - Migration up/down tests
- `rollback-tests` - Verify rollbacks work
- `query-tests` - Query correctness tests
- `performance-check` - Query performance benchmarks

### General Checks
- `typecheck` - TypeScript type checking
- `lint` - Code linting
- `test-run` - Unit test execution
- `build-test` - Verify build succeeds
- `integration-tests` - Full integration test suite

## Usage

### Determining Checks for Changed Files

```typescript
import { resolveChecks } from './lib/blast-radius/resolver.js';

const changedFiles = ['src/auth/login.ts', 'src/ui/Button.tsx'];
const checks = resolveChecks(changedFiles);
// Returns: ['auth-flows', 'security-scan', 'component-tests', ...]
```

### CLI Usage

```bash
# Check which checks are needed for changed files
harness blast-radius --files src/auth/login.ts,src/ui/Button.tsx

# Output as JSON for CI integration
harness blast-radius --files src/auth/login.ts --json
```

## Maintenance

When adding new paths or check types:
1. Update this document with the mapping
2. Add the check to `src/lib/blast-radius/resolver.ts`
3. Ensure CI workflows can run the check
4. Document the check's purpose above

### Per-project configuration

`blastRadiusRules` can now be customized per repo in `harness.contract.json`.
Projects can override the default rule set by adding their own ordered list:

```json
{
  "blastRadiusRules": [
    {
      "pattern": "src/ui/**",
      "checks": ["test-run", "visual-regression", "lint"],
      "description": "UI changes need visual and lint verification"
    }
  ]
}
```

The harness uses the matching project rules when running:

```bash
harness blast-radius --files src/ui/Feature.tsx --contract harness.contract.json
```

If no matching rule is found for a file set, the command falls back to:

- `typecheck`
- `lint`
- `test-run`

## Fallback Behavior

If a changed file matches no specific pattern, these default checks run:
- `typecheck`
- `lint`
- `test-run`
