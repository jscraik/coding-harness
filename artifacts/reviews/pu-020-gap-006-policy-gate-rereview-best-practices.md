# PU-020 GAP-006 Policy-Gate Re-Review (Best Practices)

## Scope
- Intent: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-020-gap-006-policy-gate-risk-chain-intent.json`
- Review mode: read-only re-review of patched files and targeted executable checks.
- Primary question: is GAP-006 (false-success block->pass path) closed by executable guardrails?

## Findings (Severity-Ordered)

### 1) LOW - CLI JSON error surface classifies contract validation failure as internal gate error
- Severity: low
- Evidence: [src/lib/output/normalise-policy-gate.ts](/Users/jamiecraik/dev/coding-harness/src/lib/output/normalise-policy-gate.ts#L51), [src/commands/policy-gate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.ts#L156), command output in this run: `node --import tsx src/cli.ts policy-gate --contract test-fixtures/contract-block-pass.json --files src/auth/login.ts --json` prints finding id `policy-gate.result.internal`.
- Impacted behavior: machine consumers can distinguish exit code 1, but JSON finding taxonomy labels a user-caused contract validation failure as an internal error bucket, which can blur triage semantics.
- Remediation: optionally map `VALIDATION_ERROR` to a dedicated finding id/message class (for example `policy-gate.result.validation`) while preserving fail-closed exit behavior.
- Confidence: high
- Validation ownership: pre-existing/non-blocking taxonomy gap (not a false-success safety failure).

## GAP-006 closure verdict
- No blocker remains for GAP-006.
- The false-success path where `actionToVerdict.block = "pass"` could produce success is now closed by executable guardrails:
  - Runtime path enforces hard fail for max-tier violations: [src/commands/policy-gate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.ts#L128) returns `passed: false`, `action: "block"`, `verdict: "fail"`.
  - Contract validation rejects `block -> pass`: [src/lib/contract/validator-core.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator-core.ts#L386).
  - Schema locks `actionToVerdict.block` to `const: "fail"`: [src/lib/contract/json-schema-core.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/json-schema-core.ts#L620).
  - Regression fixture and tests cover the bypass attempt:
    - [test-fixtures/contract-block-pass.json](/Users/jamiecraik/dev/coding-harness/test-fixtures/contract-block-pass.json#L17)
    - [src/lib/contract/validator.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.test.ts#L695)
    - [src/commands/policy-gate.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.test.ts#L210)
    - [src/commands/contract.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/contract.test.ts#L278)
  - Repo default contract remains fail-closed for block: [harness.contract.json](/Users/jamiecraik/dev/coding-harness/harness.contract.json#L148).
  - Documentation now states safety-floor behavior: [docs/agents/06-security-and-governance.md](/Users/jamiecraik/dev/coding-harness/docs/agents/06-security-and-governance.md#L100).

## Validation Evidence
- `pnpm vitest run src/commands/policy-gate.test.ts -t "does not let max-tier override a blocked high-risk policy action"` -> pass (1 test).
- `pnpm vitest run src/lib/contract/validator.test.ts -t "rejects policy chains that map block to pass"` -> pass (1 test).
- `node --import tsx src/cli.ts policy-gate --contract test-fixtures/contract-block-pass.json --files src/auth/login.ts --json` -> exit 1 (fail-closed), with validation failure surfaced.

## Accountability Receipt
- status: complete
- artifact_paths:
  - artifacts/reviews/pu-020-gap-006-policy-gate-rereview-best-practices.md
- manifest_path: artifacts/agent-runs/best-practices-researcher-2026-05-27T08-14-00Z/manifest.json
- findings:
  - low: CLI JSON error classification uses internal-error bucket for validation errors.
  - no medium/high/critical findings tied to GAP-006.
- failures_or_blockers:
  - none
- improvement_opportunities:
  - refine JSON finding taxonomy for `VALIDATION_ERROR` vs internal gate faults.
- strengths:
  - fail-closed invariant is now enforced at validator + schema + runtime + tests.
  - dedicated negative fixture prevents regression.
  - docs updated to align policy-gate safety-floor contract.
- validation_evidence:
  - targeted vitest + CLI rerun results listed above.
- next_action:
  - coordinator can treat GAP-006 as closed; optional follow-up issue for validation-error finding taxonomy.

## Scorecard
- useful_findings: 1 (low-severity usability/taxonomy)
- avoided_false_positive: did not flag fail-closed behavior as broken; verified with executable reruns.
- evidence_quality: high (line-level source + command outputs)
- followed_scope: yes (read-only, bounded to listed slice and risks)
- reusable_learning: enforce fail-closed invariants in validator + schema + runtime + fixture tests as a quartet
- coordinator_score: 9/10

WROTE: artifacts/reviews/pu-020-gap-006-policy-gate-rereview-best-practices.md
