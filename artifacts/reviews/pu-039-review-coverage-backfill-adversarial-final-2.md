# Adversarial Review - PU-039 Final 2 (Artifact Retry)

## Scope
- scripts/check-goal-review-backfill.py
- src/dev/check-goal-review-backfill-script.test.ts
- scripts/check-goal-board.py

## Depth
- Standard (risk signal: goal-governance validation and review-exception lineage enforcement)

## Findings
- None.

## Scenario Checks

### 1) Non-pass row without receipt-fragment acceptedExceptionRef
- Result: blocked (no bypass).
- Evidence:
  - Non-pass path always requires \`acceptedExceptionRef\` via \`resolve_receipt_ref(...)\` in [scripts/check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:241), [scripts/check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:242), [scripts/check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:183), [scripts/check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:184).
  - Test coverage for missing exception: [src/dev/check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:327), [src/dev/check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:339), [src/dev/check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:383), [src/dev/check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:397).
- Confidence: 100
- Validation ownership: introduced by current patch (explicitly covered by new tests and validator contract).

### 2) Arbitrary-file acceptedExceptionRef bypass
- Result: blocked (no bypass).
- Evidence:
  - Exception refs must be receipt fragments (\`.jsonl#R...\`) via [scripts/check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:183), [scripts/check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:184), and unsupported fragment rejection in [scripts/check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:173).
  - Test injects \`artifacts/reviews/exception.md\` and expects failure at [src/dev/check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:344), [src/dev/check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:355), [src/dev/check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:362).
- Confidence: 100
- Validation ownership: introduced by current patch.

### 3) Owner-only non-pass bypass
- Result: blocked (no bypass).
- Evidence:
  - For non-pass statuses, owner does not satisfy exception lineage; \`acceptedExceptionRef\` is mandatory before owner handling at [scripts/check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:241), [scripts/check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:242), [scripts/check-goal-review-backfill.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-review-backfill.py:247).
  - Owner-only not-applicable case fails in [src/dev/check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:366), [src/dev/check-goal-review-backfill-script.test.ts](/private/tmp/coding-harness-jsc363-review-backfill/src/dev/check-goal-review-backfill-script.test.ts:379).
- Confidence: 100
- Validation ownership: introduced by current patch.

### 4) Goal-board wiring obvious-bypass-free
- Result: no obvious bypass in wrapper path for target goal.
- Evidence:
  - Wrapper runs skill validator first, then always runs goal extensions when runtime-evidence goal path is present: [scripts/check-goal-board.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-board.py:324), [scripts/check-goal-board.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-board.py:221), [scripts/check-goal-board.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-board.py:223).
  - Review backfill validator is required and hard-fails if missing or non-zero: [scripts/check-goal-board.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-board.py:247), [scripts/check-goal-board.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-board.py:255), [scripts/check-goal-board.py](/private/tmp/coding-harness-jsc363-review-backfill/scripts/check-goal-board.py:265).
- Confidence: 75
- Validation ownership: introduced by current patch.
- Residual caveat: extension execution is intentionally conditional on the runtime-evidence goal path being passed in argv; invoking the script for unrelated goals will not run backfill checks.

## Validation Evidence
- \`pnpm exec vitest run src/dev/check-goal-review-backfill-script.test.ts\` -> pass (16 tests).

## Accountability Receipt
- status: complete
- manifest_path: n/a (no manifest contract path provided to this reviewer run)
- artifact_paths:
  - artifacts/reviews/pu-039-review-coverage-backfill-adversarial-final-2.md
- findings:
  - useful_findings: 0 defects; 4 bypass-attempt checks confirmed blocked.
  - avoided_false_positive: avoided reporting unrelated direct-invocation bypass because scope was wrapper and target goal routing.
  - evidence_quality: high (line-anchored code paths + targeted tests).
  - followed_scope: yes (exact three requested files only).
  - reusable_learning: receipt-fragment-only exceptions are now mechanically enforced for all non-pass statuses.
  - coordinator_score: strong patch hardening; explicit tests for two bypass classes.
- failures_or_blockers:
  - blocked_local_memory_cli: \`local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness-task:pu039-adversarial-final2" --json\` failed with \`open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted\`.
- improvement_opportunities:
  - Add a focused unit test around \`resolve_runtime_evidence_goal_path\` argument-shape permutations to make wrapper-goal detection guarantees explicit.
- strengths:
  - Validator now closes owner-only and arbitrary-file exception bypass classes with direct tests.
- validation_evidence:
  - vitest file run passed.
- next_action:
  - none required for this patch slice.

WROTE: artifacts/reviews/pu-039-review-coverage-backfill-adversarial-final-2.md
