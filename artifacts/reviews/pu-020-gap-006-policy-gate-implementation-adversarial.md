# Adversarial Review - PU-020 GAP-006 Policy Gate

STATUS: complete

## Findings

### 1) Threshold-bypass chain when contract remaps `block -> pass`
- severity: high
- evidence:
  - [src/commands/policy-gate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.ts#L129): max-tier violations force `action: "block"` but verdict is derived through `resolveGateVerdict("block", policyChain)`, not hard-fail.
  - [src/lib/policy/policy-chain.ts](/Users/jamiecraik/dev/coding-harness/src/lib/policy/policy-chain.ts#L29): verdict resolution is fully contract-driven.
  - [src/lib/contract/types-core.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types-core.ts#L38): contract type allows arbitrary `actionToVerdict` mapping, including `block: "pass"`.
- impacted behavior:
  - If a future contract edit sets `policyChain.actionToVerdict.block = "pass"`, a high-tier file that exceeds `--max-tier` will report `passed: true` and exit 0.
  - This creates a false-success path: the operator believes max-tier enforcement blocked high-risk scope, but the gate passes due to composed policy remap.
- failure scenario:
  1. Contract drift introduces `block -> pass` in `policyChain.actionToVerdict`.
  2. User runs `policy-gate --max-tier medium` on files resolving to tier `high`.
  3. Threshold path executes in [policy-gate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.ts#L129), sets `action: "block"`, then resolves verdict from contract mapping.
  4. Gate returns `passed: true`; CLI exits 0; CI lane can greenlight an over-tier change.
- remediation:
  - Make max-tier breach fail-closed independent of policyChain remapping: set verdict to literal `"fail"` for the threshold-violation branch, or validate contract so `block` is invariantly mapped to `fail`.
  - Add a regression test using a custom contract fixture with `block -> pass` proving max-tier still fails.
- confidence: 92
- validation ownership: introduced by current patch

## Positive checks
- No scope creep observed across listed slice files.
- Default chain behavior (`high->block/fail`, `medium->warn/pass`) and CLI JSON projection align with GAP-006 intent for baseline contracts.

## Residual risks
- Contract-level policy remaps are still a drift vector unless constrained or separately validated.

## Testing gaps
- Missing explicit adversarial test for non-default `policyChain.actionToVerdict` mappings affecting `--max-tier` behavior.

## Accountability receipt
- status: complete
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e683b-cdaa-7080-8fa4-3675a118db1e/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-020-gap-006-policy-gate-implementation-adversarial.md
- findings:
  - high: threshold-bypass chain via contract remap (`block -> pass`)
- failures_or_blockers:
  - none
- improvement_opportunities:
  - enforce fail-closed invariant for max-tier violations
  - add adversarial fixture test for `block -> pass` remap
- strengths:
  - baseline GAP-006 behavior is correctly expressed in defaults and tests for default mapping
- validation_evidence:
  - static source inspection with exact file/line trace
- next_action:
  - patch max-tier branch to fail closed, then add targeted regression test

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-implementation-adversarial.md
