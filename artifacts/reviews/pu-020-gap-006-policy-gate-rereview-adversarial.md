# Adversarial Re-review: PU-020 GAP-006 policy-gate risk chain

## Scope
- Intent: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json`
- Reviewed files:
  - `harness.contract.json`
  - `src/lib/contract/types-core.ts`
  - `src/lib/contract/validator-core.ts`
  - `src/lib/contract/json-schema-core.ts`
  - `src/lib/contract/validator.test.ts`
  - `src/commands/contract.test.ts`
  - `src/commands/policy-gate.ts`
  - `src/commands/policy-gate.test.ts`
  - `src/lib/output/normalise-policy-gate.ts`
  - `test-fixtures/contract-block-pass.json`
  - `docs/agents/06-security-and-governance.md`

## Findings (severity-ranked)
- None. No remaining material blocker found for GAP-006.

## Adversarial evidence

### Assumption violation checks
- Scenario: omitted `policyChain` might fall back to a permissive mapping and silently pass high-tier files.
- Result: closed. Default mapping is explicit fail-closed (`block: "fail"`) in `src/lib/contract/types-core.ts:1462-1473`, and policy-gate resolves omitted policyChain through `resolvePolicyChain` in `src/lib/policy/policy-chain.ts:16-20`.

- Scenario: caller supplies `--max-tier high` and expects threshold path to override a high-tier block into pass.
- Result: closed. Violation path now hard-sets `passed: false`, `action: "block"`, `verdict: "fail"` when actual tier exceeds max in `src/commands/policy-gate.ts:128-139`. Regression exists in `src/commands/policy-gate.test.ts:151-167`.

### Composition failure checks
- Scenario: validator accepts `policyChain.actionToVerdict.block = "pass"`, but runtime assumes fail-closed.
- Result: closed at multiple boundaries:
  - Validator rejects non-fail block mapping in `src/lib/contract/validator-core.ts:386-387` and surfaces contract error at `src/lib/contract/validator-core.ts:2066-2075`.
  - JSON schema enforces `const: "fail"` at `src/lib/contract/json-schema-core.ts:620-625`.
  - Contract schema regression asserts this at `src/commands/contract.test.ts:278-299`.
  - Runtime rejection regression exists in `src/commands/policy-gate.test.ts:210-229`.
  - Direct invalid fixture proving attempted bypass is present at `test-fixtures/contract-block-pass.json:15-18`.

### Cascade construction checks
- Trigger chain tested: high-risk file + permissive threshold + custom mapping.
- Cascade outcome after patch: stops at contract validation boundary before gate evaluation, returning validation error rather than false pass.

### Abuse-case checks
- Boundary walking: valid-looking contract shape with semantically unsafe `block -> pass`.
- Result: blocked by both validator and schema; no pass-through route observed.

## Residual risks
- No bypass path found in reviewed slice for the specific GAP-006 false-success class.
- Low residual risk remains for future regressions if policy-chain evaluation or contract loading paths are refactored without keeping validator/schema/test parity.

## Testing gaps
- No material gap for GAP-006 closure in this slice.
- Optional future hardening: add one end-to-end CLI contract-schema validation test that loads generated schema and validates `test-fixtures/contract-block-pass.json` against it directly (defense-in-depth against schema-export drift).

## Accountability receipt
- status: complete
- artifact_paths:
  - artifacts/reviews/pu-020-gap-006-policy-gate-rereview-adversarial.md
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6846-e8ce-7a31-b088-7cf7f4fb35e3/manifest.json
- findings: []
- failures_or_blockers:
  - `agents/templates/review-artifact.md` not found in this checkout; used explicit artifact structure instead.
- improvement_opportunities:
  - Add the missing reviewer template path or update contract docs to current canonical template location.
- strengths:
  - Enforcement now exists at default config, runtime logic, validator, schema, and tests.
  - Negative fixture and targeted regressions directly encode the prior exploit chain.
- validation_evidence:
  - Source evidence cited above from policy-gate, validator-core, json-schema-core, and tests.
- next_action:
  - Coordinator may treat GAP-006 as closed unless new evidence shows a non-reviewed loader or compatibility surface bypass.
- useful_findings: 0
- avoided_false_positive: confirmed no remaining false-success in reviewed scope
- evidence_quality: high (line-level code + regression test evidence)
- followed_scope: yes
- reusable_learning: enforce fail-closed invariants in both validator and schema with fixture-based negative tests
- coordinator_score: strong closure signal for targeted risk chain

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-rereview-adversarial.md
