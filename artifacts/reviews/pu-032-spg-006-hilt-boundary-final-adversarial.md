# Adversarial Final Re-Review: PU-032 / SPG-006

## Findings (severity-ranked)

### 1) High - External packet path can bypass claim-sensitive HILT semantics through schema-only acceptance

- Severity: high
- Evidence:
  - Trigger: An externally-authored `decision-request/v1` packet uses a claim-sensitive boundary such as `merge_readiness` with non-empty `evidenceRefs`, but keeps `freshness: "current"` and supplies only current/not_applicable stale-state entries (or none that are non-current).
  - Execution path:
    - Runtime packet schema validation for decision-request in `scripts/validate-runtime-packet-schemas.cjs` only performs JSON Schema shape checks against `contracts/decision-request.schema.json` and the example payload; there is no decision-request semantic parity hook in this script path ([scripts/validate-runtime-packet-schemas.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-runtime-packet-schemas.cjs:556), [scripts/validate-runtime-packet-schemas.cjs](/Users/jamiecraik/dev/coding-harness/scripts/validate-runtime-packet-schemas.cjs:565)).
    - The schema now correctly rejects whitespace-only evidence refs via `pattern: "\\S"` ([contracts/decision-request.schema.json](/Users/jamiecraik/dev/coding-harness/contracts/decision-request.schema.json:87)).
    - But schema does not encode boundary-conditional requirements that claim-sensitive boundaries require non-current stale evidence and freshness constraints.
  - Failure outcome: Externally-authored packets can satisfy schema and pass runtime schema checks while violating builder/HILT semantics enforced only in code path `buildHiltBoundary()` ([src/lib/decision-request/hilt-boundary.ts](/Users/jamiecraik/dev/coding-harness/src/lib/decision-request/hilt-boundary.ts:82), [src/lib/decision-request/hilt-boundary.ts](/Users/jamiecraik/dev/coding-harness/src/lib/decision-request/hilt-boundary.ts:96)).
- Impacted behavior:
  - Composition failure between producer paths:
    - Builder path enforces claim-sensitive semantics.
    - External packet path validated via schema script does not enforce the same semantics.
  - This reintroduces drift risk where governance packets appear structurally valid but semantically under-constrained.
- Remediation:
  - Add semantic parity validation for `decision-request` in the runtime packet schema validator workflow (either a manifest-wired semantic validator call or explicit decision-request semantic check in `validate-runtime-packet-schemas.cjs`).
  - Add a regression test that mutates a decision-request example to a claim-sensitive boundary plus semantically invalid freshness/staleState combination and asserts validator failure on the external example path.
- Confidence: 75
- Validation ownership: introduced by current patch (the patch fixed whitespace-ref schema enforcement but did not close the broader external semantic parity gap).

## What is fixed by this patch

- Whitespace-only `evidenceRefs` are now rejected in schema for external examples ([contracts/decision-request.schema.json](/Users/jamiecraik/dev/coding-harness/contracts/decision-request.schema.json:82), [src/dev/validate-runtime-packet-schemas-script.test.ts](/Users/jamiecraik/dev/coding-harness/src/dev/validate-runtime-packet-schemas-script.test.ts:270)).
- Builder path already rejects blank refs for claim-sensitive boundaries and trims refs before emission ([src/lib/decision-request/hilt-boundary.ts](/Users/jamiecraik/dev/coding-harness/src/lib/decision-request/hilt-boundary.ts:86), [src/lib/decision-request/builder.ts](/Users/jamiecraik/dev/coding-harness/src/lib/decision-request/builder.ts:163), [src/commands/decision-request.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/decision-request.test.ts:333)).

## Residual risks

- External producer packets remain schema-valid without full claim-sensitive semantic parity checks unless runtime schema validator is extended as noted above.

## Accountability receipt

- status: completed_with_findings
- artifact_paths:
  - artifacts/reviews/pu-032-spg-006-hilt-boundary-final-adversarial.md
- manifest_path: n/a (single-review artifact run; no run manifest requested by coordinator)
- findings:
  - 1 high-severity composition failure (external schema path semantic bypass)
- failures_or_blockers:
  - none
- improvement_opportunities:
  - enforce decision-request semantic parity in runtime schema validation script
  - add explicit external-path regression for claim-sensitive stale-state/freshness semantics
- strengths:
  - schema hardening for whitespace-only evidence refs is correctly implemented
  - builder and CLI tests preserve trim/reject behavior for evidence refs
- validation_evidence:
  - Reviewed targeted files and validator script behavior at:
    - /Users/jamiecraik/dev/coding-harness/contracts/decision-request.schema.json
    - /Users/jamiecraik/dev/coding-harness/src/dev/validate-runtime-packet-schemas-script.test.ts
    - /Users/jamiecraik/dev/coding-harness/src/lib/decision-request/hilt-boundary.ts
    - /Users/jamiecraik/dev/coding-harness/src/lib/decision-request/builder.ts
    - /Users/jamiecraik/dev/coding-harness/src/commands/decision-request.test.ts
    - /Users/jamiecraik/dev/coding-harness/scripts/validate-runtime-packet-schemas.cjs
- next_action:
  - Add decision-request semantic parity check to external packet validation path and cover with failing regression fixture.
- useful_findings:
  - Identified schema/builder parity split that remains after whitespace-ref fix.
- avoided_false_positive:
  - Did not report whitespace-only evidence ref acceptance as open; verified schema pattern and regression test now close that case.
- evidence_quality:
  - line-level file references plus concrete trigger/path/outcome chain
- followed_scope:
  - yes (review constrained to coordinator-provided file set plus validator script needed for external-path confirmation)
- reusable_learning:
  - schema-level hardening does not guarantee semantic parity for externally-authored packets; parity validators must execute semantic checks where conditionals are not expressible in allowed schema subset.
- coordinator_score:
  - 0.86

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-final-adversarial.md
