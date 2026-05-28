# Adversarial Re-Review: PU-033 / SPG-007 ReviewLifecycle/v1

## Findings (severity-ranked)

### 1) High - Nested unknown-field injection bypasses semantic validator and yields false pass
- Evidence:
  - `scripts/validate-review-lifecycle.cjs:416-420` rejects unknown keys only at top level; nested objects are not shape-closed.
  - Reproduction command (executed): add `.reviewer.extra="x"` to the example packet, then run `node scripts/validate-review-lifecycle.cjs <packet>`.
  - Observed output: `"status": "pass"` with empty errors.
- Impacted behavior:
  - A packet can include unauthorized nested fields (for example reviewer/tool/coverage payload extensions) and still pass the semantic validator, creating schema-vs-semantic parity drift and potential false-pass in flows that trust this validator output.
- Remediation:
  - Enforce nested `additionalProperties: false` parity in the CJS semantic validator for all object nodes that are schema-closed (`reviewer`, `mode`, `target`, `toolExposure`, tool classes, counts, coverage, verdict, artifact lineage entries, receipt object assumptions where applicable).
  - Add a regression test that mutates a nested object with an unknown key and requires semantic failure.
- Confidence: 95%

### 2) Medium - Reviewer identity can diverge from lineage/coverage identity without detection
- Evidence:
  - `scripts/validate-review-lifecycle.cjs:222-241` validates reviewer fields and independence but does not bind reviewer role/producer to coverage or artifact lineage role set.
  - `scripts/validate-review-lifecycle.cjs:320-363` enforces coveredRoles-to-lineage binding, but not reviewer-to-lineage binding.
  - Reproduction command (executed): set `.reviewer.role` and `.reviewer.producer` to `"different-reviewer"` while leaving lineage/coverage unchanged; semantic validator still returns pass.
- Impacted behavior:
  - A packet can claim one reviewer identity while deriving claim-support artifacts from another role, enabling attribution drift and reducing trust in reviewer-lane accountability.
- Remediation:
  - Add invariant: reviewer role (and producer, if equal-by-contract) must appear in `coverage.coveredRoles` and in at least one `artifactLineage[*].role`.
  - Add regression that fails when reviewer identity is not represented in lineage/coverage.
- Confidence: 90%

## Residual risk
- TS and CJS validators remain aligned on these same gaps, so parity tests may still pass while both implementations share the same blind spot.

Overall confidence: 93%
WROTE: artifacts/reviews/pu-033-spg-007-review-lifecycle-implementation-adversarial-rereview.md
