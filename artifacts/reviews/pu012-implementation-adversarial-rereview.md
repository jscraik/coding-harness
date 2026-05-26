# Adversarial Rereview: PU-012 Runtime Evidence Producer

## Scope Reviewed
- src/lib/runtime/codex-runtime-source-provenance.ts
- src/lib/runtime/codex-runtime-source-provenance.test.ts
- src/lib/runtime/codex-runtime-evidence-producer.ts
- src/lib/runtime/codex-runtime-evidence-producer.test.ts

## Depth Calibration
- Size estimate: Standard (roughly 150+ changed lines across runtime producer + source provenance + tests).
- Risk signals: data-mutation of evidence contracts and external-state/runtime packet admission logic.

## Prior Findings Status

1. Source snapshot admission gap allows stale codex provenance claims.
- Status: Fixed.
- Evidence:
  - build path now requires both expected and observed source snapshots and validates before packet admission at src/lib/runtime/codex-runtime-evidence-producer.ts:121.
  - stale observed head now hard-fails with producer error, covered by test at src/lib/runtime/codex-runtime-evidence-producer.test.ts:161.
  - direct source snapshot validator checks head and blob parity at src/lib/runtime/codex-runtime-source-provenance.ts:48 and src/lib/runtime/codex-runtime-source-provenance.ts:149.

2. Write-capable profile without writable-root evidence could misclassify authority.
- Status: Fixed.
- Evidence:
  - write-capable profiles (workspace_write/escalated) with empty writableRoots are downgraded to unknown with explicit failureClass at src/lib/runtime/codex-runtime-evidence-producer.ts:165.
  - behavior is covered by regression test at src/lib/runtime/codex-runtime-evidence-producer.test.ts:180.

## Findings (Remaining)
- No new material adversarial findings in PU-012 scope.

## Residual Risks
- The source snapshot validator is strict by exact path-key match. If future producers normalize paths differently from expected snapshots, this will fail closed (safe) but may increase operational false negatives until path-normalization is standardized.

## Testing Gaps
- No blocking gaps for this patch scope.
- Optional hardening: add a focused test for escalated profile with empty writableRoots to mirror workspace_write coverage.

WROTE: artifacts/reviews/pu012-implementation-adversarial-rereview.md
