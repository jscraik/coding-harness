# PU-020 GAP-006 Policy Gate Architecture Lens

Status: pass

## Scope

Reviewed the narrow architecture of the PU-020 policy-gate safety-floor slice:

- `harness.contract.json`
- `src/lib/contract/types-core.ts`
- `src/commands/policy-gate.ts`
- `src/lib/output/normalise-policy-gate.ts`
- `src/commands/policy-gate.test.ts`
- `docs/agents/06-security-and-governance.md`

## Findings

No architecture blocker found.

The slice keeps the policy decision in the existing contract and policy-gate seams instead of creating a parallel approval system. That is the right placement for GAP-006: the contradiction was between the stated safety floor and executable policy-chain behavior, so the fix changes the governed contract/default policy chain and preserves the existing command facade.

## Positive Evidence

- `DEFAULT_POLICY_CHAIN.high` now maps to `block`, so omitted-policyChain contracts inherit the fail-closed high-risk behavior.
- `harness.contract.json` now maps `policyChain.tierToAction.high` to `block`, so the governed repo contract matches the stated safety boundary.
- `runPolicyGate` now preserves violating file evidence when a policy-chain decision fails without a `maxTier` threshold.
- Output normalization distinguishes policy-chain blocking from max-tier threshold violations.

## Residual Risk

This slice intentionally does not implement tracked exceptions or decision-request artifacts. That is acceptable because the intent records it as out of scope and keeps high-risk pass-through unsupported until a future GAP-005/exception-management slice adds owner-approved receipts.

## Post-Review Hardening

The first implementation review found a second false-success path: a custom contract could remap `policyChain.actionToVerdict.block` to `pass`. The architecture fix stayed in the same deep contract and policy-gate seams rather than adding a parallel verifier:

- `src/commands/policy-gate.ts` now makes max-tier violations literal `passed=false` / `verdict=fail`.
- `src/lib/contract/validator-core.ts` rejects any `actionToVerdict.block` value other than `fail`.
- `src/lib/contract/json-schema-core.ts` publishes the same invariant as `const: "fail"`.
- `test-fixtures/contract-block-pass.json` captures the invalid drift case.

## Validation Evidence

- `pnpm vitest run src/commands/policy-gate.test.ts` -> pass
- `pnpm vitest run src/commands/policy-gate.test.ts -t omitted-policyChain` -> pass
- `pnpm vitest run src/commands/policy-gate.test.ts -t block` -> pass
- `node --import tsx src/cli.ts policy-gate --contract test-fixtures/contract.json --files src/auth/login.ts --json` -> expected fail exit 1, blocked by policy chain
- `node --import tsx src/cli.ts policy-gate --contract test-fixtures/contract-block-pass.json --files src/auth/login.ts --json` -> expected validation fail exit 1
- `node --import tsx src/cli.ts policy-gate --contract harness.contract.json --files src/auth/login.ts --json` -> expected fail exit 1, blocked by policy chain
- `node --import tsx src/cli.ts policy-gate --contract harness.contract.json --files src/lib/utils.ts --max-tier medium --json` -> pass

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-improve-codebase-architecture.md
