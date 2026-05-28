# PU-020 GAP-006 Policy Gate HE Code Review Lens

Status: pass

## Review Focus

Checked the implementation as a Harness Engineering code-review slice: behavior, traceability, command contract, and false-success risk.

## Findings

No code-review blocker found.

The patch closes the primary false-success path: high-risk files no longer pass as warn-only when the policy chain is the deciding authority. Both explicit repo contract and omitted-policyChain fallback behavior now fail closed.

The follow-up patch closes the implementation-review false-success path as well: max-tier violations no longer ask the contract how to render a `block`, and invalid contracts that try `block -> pass` are rejected by the runtime validator and public JSON schema.

## Evidence

- `harness.contract.json`: high tier maps to `block`.
- `src/lib/contract/types-core.ts`: default high tier maps to `block`.
- `src/lib/contract/validator-core.ts`: `actionToVerdict.block` must be `fail`.
- `src/lib/contract/json-schema-core.ts`: schema publishes the same `const: "fail"` invariant.
- `src/commands/policy-gate.ts`: failed decisions retain violating file paths even without `maxTier`.
- `src/lib/output/normalise-policy-gate.ts`: no-`maxTier` policy blocks get a policy-action reason, not a fake threshold reason.
- `src/commands/policy-gate.test.ts`: regression coverage covers omitted-policyChain, no max tier, max-tier high, max-tier medium, medium pass, low pass, and JSON reason clarity.
- `test-fixtures/contract-block-pass.json`: captures the invalid custom remap case.

## Validation Evidence

- `pnpm vitest run src/commands/policy-gate.test.ts` -> pass
- `pnpm vitest run src/commands/policy-gate.test.ts -t block` -> pass
- `pnpm vitest run src/lib/contract/validator.test.ts -t policyChain` -> pass
- `pnpm vitest run src/commands/contract.test.ts -t policyChain` -> pass
- `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-he-code-review.md
