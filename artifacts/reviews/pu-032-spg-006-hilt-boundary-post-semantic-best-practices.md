# PU-032 / SPG-006 Post-Semantic Best-Practices Re-Review

## Scope Reviewed
- scripts/validate-decision-request.cjs
- scripts/validate-runtime-packet-schemas.cjs
- contracts/runtime-packet-schemas.manifest.json
- contracts/decision-request.schema.json
- src/dev/validate-runtime-packet-schemas-script.test.ts
- src/lib/decision-request/hilt-boundary.ts
- src/lib/decision-request/builder.ts
- src/commands/decision-request.test.ts
- docs/cli-reference.md

## Findings (Severity-Ranked)

No material issues found in scoped files.

## Verification of Prior Finding
- Prior semantic-bypass finding status: fixed.
- Evidence:
  - Manifest now wires a semantic validator for `decision-request/v1`: `semanticValidatorPath` in `contracts/runtime-packet-schemas.manifest.json:69-76`.
  - Manifest validator resolves, existence-checks, and executes semantic validators, and fails the run on non-zero exit: `scripts/validate-runtime-packet-schemas.cjs:502-607`.
  - Decision-request semantic validator enforces claim-sensitive constraints and stale-claim freshness rule:
    - requires non-empty evidence refs and non-current stale state for claim-sensitive boundaries: `scripts/validate-decision-request.cjs:128-135`
    - rejects `stale_claim_support` with `freshness=current`: `scripts/validate-decision-request.cjs:136-145`
  - Regression test proves schema-valid but semantically invalid decision-request examples now fail validator runs: `src/dev/validate-runtime-packet-schemas-script.test.ts:306-347`.

## Runtime vs External Validation Alignment
Materially aligned for claim-sensitive HILT boundaries in this scope.
- Runtime builder guard:
  - claim-sensitive evidence/stale-state enforcement: `src/lib/decision-request/hilt-boundary.ts:76-104`
  - boundary taxonomy/risk/blocker mapping in runtime builder: `src/lib/decision-request/hilt-boundary.ts:11-30`, `107-149`
- External packet semantic guard:
  - same boundary taxonomy/risk/blocker mapping and claim-sensitive checks: `scripts/validate-decision-request.cjs:5-24`, `34-75`, `128-145`
- Behavioral coverage:
  - runtime-side tests for claim-sensitive enforcement and blank evidence refs: `src/commands/decision-request.test.ts:305-348`
  - manifest-side semantic execution test: `src/dev/validate-runtime-packet-schemas-script.test.ts:306-347`

## Residual Risks
- Duplication risk (medium, non-blocking): boundary taxonomy and mapping logic are duplicated across runtime TS and external CJS validator (`src/lib/decision-request/hilt-boundary.ts` and `scripts/validate-decision-request.cjs`). Future edits could drift unless both are updated together.
- Integration confidence risk (low): this review validated script behavior and existing tests; it did not add new end-to-end fixtures beyond scoped files.

## Recommended Follow-up (Non-Blocking)
1. Add a parity fixture test that asserts runtime-emitted packet and semantic-validator acceptance for each boundary type to reduce mapping drift risk.
2. Consider centralizing boundary mapping data in one machine-readable contract consumed by both TS runtime and CJS semantic validator.

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-post-semantic-best-practices.md
