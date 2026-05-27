# PU-020 GAP-006 Policy Gate Testing Lens

Status: pass

## Test Coverage Reviewed

Focused on whether tests and commands prove the behavioral contract required by GAP-006.

## Covered Cases

- High-risk file with omitted `policyChain` and no `maxTier` fails closed.
- High-risk file with omitted `policyChain` and `maxTier=high` still fails closed.
- High-risk file with `maxTier=medium` fails and records `maxAllowed=medium`.
- Medium-risk file remains warn/pass.
- Low-risk and empty-file cases still pass.
- CLI JSON exit code is 1 for high-risk blocked behavior.
- CLI JSON exit code is 0 for medium-risk allowed behavior.
- JSON reason distinguishes policy-chain block from max-tier threshold failure.
- Contract validator still accepts complete policy-chain mappings.
- Contract validator rejects `actionToVerdict.block = "pass"`.
- Public contract schema exposes `actionToVerdict.block` as `const: "fail"`.

## Validation Evidence

- `pnpm vitest run src/commands/policy-gate.test.ts` -> pass (23 tests)
- `pnpm vitest run src/commands/policy-gate.test.ts -t omitted-policyChain` -> pass (2 tests)
- `pnpm vitest run src/commands/policy-gate.test.ts -t block` -> pass (3 tests)
- `pnpm vitest run src/lib/contract/validator.test.ts -t policyChain` -> pass (4 tests)
- `pnpm vitest run src/commands/contract.test.ts -t policyChain` -> pass (1 test)
- `node --import tsx src/cli.ts policy-gate --contract test-fixtures/contract.json --files src/auth/login.ts --json` -> expected fail exit 1
- `node --import tsx src/cli.ts policy-gate --contract test-fixtures/contract-block-pass.json --files src/auth/login.ts --json` -> expected validation fail exit 1
- `node --import tsx src/cli.ts policy-gate --contract harness.contract.json --files src/auth/login.ts --json` -> expected fail exit 1
- `node --import tsx src/cli.ts policy-gate --contract harness.contract.json --files src/lib/utils.ts --max-tier medium --json` -> pass exit 0

## Residual Risk

No full `pnpm check` or `bash scripts/validate-codestyle.sh` result is claimed for this slice yet. The focused tests and docs-gate prove the changed behavior, but broad repo readiness remains separate because the worktree contains many prior uncommitted lifecycle changes.

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-testing.md
