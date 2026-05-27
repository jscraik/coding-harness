# PU-023 GAP-009 Testing Lens

## Behavior Under Test

Reviewer artifact receipts inside review-state/v1 must be admissible for claim support only when they are pass/current/claim_support, non-empty, and still bound to path, producer, and PR head evidence. Judge/PM audit must preserve reviewer-specific blocker classifications for stale and non-claim-supporting reviewer artifacts.

## Selected Validation Route

1. Focused unit tests for review-state packet validation.
2. Focused unit tests for Judge/PM audit blocker preservation.
3. Runtime packet schema validation for public contract examples and manifest.
4. Focused Biome check for touched source/test/schema/intent files.
5. Goal receipt and goal-board validators after R081 is appended.

## Coverage Map

| Requirement | Test / Check | Status |
| --- | --- | --- |
| Reject non-pass reviewer artifact receipts | src/lib/review-state/review-state.test.ts:101 | Covered |
| Reject stale/missing/unknown/not-applicable freshness | src/lib/review-state/review-state.test.ts:127 | Covered |
| Reject non-claim-supporting evidence use | src/lib/review-state/review-state.test.ts:153 | Covered |
| Reject zero-byte blocked reviewer artifact receipts with explicit size path | src/lib/review-state/review-state.test.ts:177 | Covered |
| Preserve producer/path/head-SHA binding | src/lib/review-state/review-state.test.ts:201, src/lib/review-state/review-state.test.ts:223, src/lib/review-state/review-state.test.ts:248 | Covered |
| Preserve Judge/PM stale blocker | src/lib/delivery-truth/judge-pm-audit.test.ts:90 | Covered |
| Preserve Judge/PM non-claim-support blocker | src/lib/delivery-truth/judge-pm-audit.test.ts:110 | Covered |
| Publish representable schema constraints | contracts/review-state.schema.json:146 through contracts/review-state.schema.json:164 plus node scripts/validate-runtime-packet-schemas.cjs --all | Covered |

## Commands Already Run For This Slice

- pnpm vitest run src/lib/review-state/review-state.test.ts src/lib/delivery-truth/judge-pm-audit.test.ts -> pass.
- node scripts/validate-runtime-packet-schemas.cjs --all -> pass.
- pnpm exec biome check bounded PU-023 files -> pass after formatting.

## Remaining Validation Before Slice Done

- Verify all required skill lens and independent reviewer artifacts exist and are non-empty.
- Append R081 and run scripts/check-goal-slice-assurance.py.
- Run audit freshness and goal-board validation after the receipt is recorded.
- Run bounded git diff --check.

WROTE: artifacts/reviews/pu-023-gap-009-reviewer-artifact-testing.md
