# PU-020 GAP-006 Policy Gate Unslopify Lens

Status: pass

## Scope

Reviewed language, output clarity, and claim boundaries for the policy-gate slice.

## Findings

No wording or claim-boundary blocker found.

The first implementation made high-risk files fail closed, but the JSON reason initially said `exceeds allowed 'unset'` when no max tier was configured. That would confuse agents about whether the failure came from a threshold or the policy chain. The output now says `Tier 'high' is blocked by policy action 'block'.`

## Claim Boundaries

- The slice claims local policy-gate behavior only.
- It does not claim merge readiness, external-state freshness, review-thread truth, or tracked exception support.
- It explicitly leaves high-risk pass-through unsupported until a later owner-approved exception mechanism exists.
- The invalid `block -> pass` case is now described as contract validation failure, not as a recoverable warning.

## Validation Evidence

- `node --import tsx src/cli.ts policy-gate --contract harness.contract.json --files src/auth/login.ts --json` -> expected fail exit 1 with policy-chain block reason
- `node --import tsx src/cli.ts policy-gate --contract test-fixtures/contract-block-pass.json --files src/auth/login.ts --json` -> expected validation fail exit 1
- `pnpm vitest run src/commands/policy-gate.test.ts` -> pass, including regression against `max: unset` / `allowed 'unset'` wording
- `pnpm vitest run src/commands/contract.test.ts -t policyChain` -> pass, proving public schema exposes `block: { const: "fail" }`

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-unslopify.md
