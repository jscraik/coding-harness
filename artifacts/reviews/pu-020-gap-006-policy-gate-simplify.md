# PU-020 GAP-006 Policy Gate Simplify Lens

Status: pass

## Scope

Reviewed whether the implementation is the smallest useful fix for GAP-006.

## Findings

No simplification blocker found.

The implementation avoids adding a new approval schema, new command family, or new runtime packet. It changes the two policy-chain sources of truth and adds one tiny helper in `policy-gate.ts` so failed policy decisions keep file evidence.

## Simplification Assessment

- Keep: contract/default `high -> block` alignment.
- Keep: focused tests for no-`policyChain`, no-`maxTier`, `maxTier=high`, and medium/low pass behavior.
- Keep: clearer JSON reason for policy-chain block failures.
- Avoid now: tracked exception schema, decision-request integration, PR closeout integration, or live approval checks.

## Residual Risk

The helper `filesForFailedDecision` is intentionally small. If more gates need this pattern later, extract only after a second caller appears.

## Post-Review Hardening

The only added fixture after review is `test-fixtures/contract-block-pass.json`, which is intentionally cheaper than a new exception subsystem. It captures one unsafe contract shape and lets the existing loader/validator reject it. No new command, receipt family, or approval flow was introduced.

## Validation Evidence

- `pnpm vitest run src/commands/policy-gate.test.ts` -> pass
- `pnpm vitest run src/commands/policy-gate.test.ts -t block` -> pass
- `node_modules/.bin/biome check harness.contract.json src/lib/contract/types-core.ts src/lib/contract/validator-core.ts src/lib/contract/json-schema-core.ts src/lib/contract/validator.test.ts src/commands/contract.test.ts src/commands/policy-gate.ts src/commands/policy-gate.test.ts src/lib/output/normalise-policy-gate.ts test-fixtures/contract-block-pass.json docs/agents/06-security-and-governance.md .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json` -> pass

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-simplify.md
