# Adversarial Review: PU-033 / SPG-007 ReviewLifecycle Final Re-review

## Scope
- contracts/review-lifecycle.schema.json
- contracts/examples/review-lifecycle.example.json
- scripts/validate-review-lifecycle.cjs
- src/lib/review-state/review-lifecycle.ts
- src/lib/review-state/review-lifecycle-validation-helpers.ts
- src/lib/review-state/review-lifecycle.test.ts
- src/dev/validate-runtime-packet-schemas-script.test.ts
- contracts/runtime-packet-schemas.manifest.json

## Findings (severity-ranked)

### 1) High: Pass verdict can coexist with contradictory unresolved-thread buckets
- Evidence:
  - [src/lib/review-state/review-lifecycle.ts:843](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.ts:843) validates pass verdict with only `unresolvedThreads.total === 0` and `unresolvedThreads.needsHuman === 0`.
  - [src/lib/review-state/review-lifecycle.ts:853](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.ts:853) does not enforce consistency between `total` and `autofixable`.
  - [scripts/validate-review-lifecycle.cjs:493](/Users/jamiecraik/dev/coding-harness/scripts/validate-review-lifecycle.cjs:493) mirrors the same rule in CJS semantic validation.
- Impacted behavior:
  - Constructed scenario: packet sets `verdict.status="pass"`, `verdict.readyForReviewClaim=true`, `unresolvedThreads.total=0`, `unresolvedThreads.needsHuman=0`, and `unresolvedThreads.autofixable>0`.
  - Both TS and CJS validators accept this contradictory state, allowing downstream consumers to treat the review lifecycle as pass/ready while unresolved autofixable work still exists by bucket evidence.
- Remediation:
  - Add a cross-field invariant in both TS and CJS validators that enforces bucket consistency, at minimum:
    - `total >= needsHuman`
    - `total >= autofixable`
    - optionally `total === needsHuman + autofixable` if mutually exclusive semantics are intended.
  - Add table-driven tests in [src/lib/review-state/review-lifecycle.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.test.ts) and script-level parity tests to reject contradictory count tuples under pass and non-pass verdicts.
- Confidence: 90

## Re-test of previously patched false-pass classes
- Nested unknown-field rejection:
  - TS path is schema-closed at nested objects via `requireAllowedKeys` and is covered by the explicit test for `reviewer.extra` rejection in [src/lib/review-state/review-lifecycle.test.ts:255](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.test.ts:255).
  - CJS path applies `requireOnlyKeys` for reviewer, coverage, lineage, and other nested objects.
- Reviewer identity binding:
  - TS validates `reviewer.role` membership in `coverage.coveredRoles` and existence in `artifactLineage[*].role` at [src/lib/review-state/review-lifecycle.ts:786](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.ts:786).
  - CJS mirrors this at [scripts/validate-review-lifecycle.cjs:447](/Users/jamiecraik/dev/coding-harness/scripts/validate-review-lifecycle.cjs:447).

## Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6d6e-540a-7d53-9b34-432215cf382f/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-033-spg-007-review-lifecycle-implementation-adversarial-final.md
- findings:
  - 1 high-severity adversarial composition finding (contradictory pass verdict state)
- failures_or_blockers:
  - `agents/templates/review-artifact.md` not found in this checkout (searched with `fd review-artifact.md .`), so artifact was produced using required contract fields directly.
- improvement_opportunities:
  - Add count-consistency invariants and parity tests so pass verdict cannot coexist with contradictory unresolved-thread buckets.
- strengths:
  - TS and CJS validators now consistently reject unknown nested fields on schema-closed objects.
  - TS and CJS validators now bind `reviewer.role` to both coverage and lineage.
  - Semantic validator is wired in manifest entry for `review-lifecycle/v1`.
- validation_evidence:
  - Static source inspection with line-level checks across TS + CJS validators and tests in scoped files.
- next_action:
  - Implement unresolved-thread count consistency checks in both validators, then add negative tests proving contradiction rejection.

WROTE: artifacts/reviews/pu-033-spg-007-review-lifecycle-implementation-adversarial-final.md
