# CI Migration Artifact Templates

These templates are tracked examples for strict `harness ci-migrate verify` preflight inputs.

## Files
- `ci-required-checks.template.json`: starter manifest with required check identity metadata.
- `ci-provider-transition-status.template.json`: starter transition status artifact.

## Usage
1. Copy each template into your repository-local `.harness/` directory.
2. Rename to:
   - `.harness/ci-required-checks.json`
   - `.harness/ci-provider-transition-status.json`
3. Update values to match your repository and provider state.
4. Run `harness ci-migrate verify`.
