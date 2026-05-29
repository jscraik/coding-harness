# Adversarial Review - PU-039 Review Coverage Backfill (Final)

## Scope
- Diff focus: `scripts/check-goal-review-backfill.py`, `scripts/check-goal-board.py`, `src/dev/check-goal-review-backfill-script.test.ts`, `src/dev/check-goal-board-script.test.ts`, `docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json`
- Depth: Standard (high-governance data-mutation lane; review/closeout gating logic)

## Severity-Ranked Findings

### 1) High - Not-applicable/blocked/fail statuses can bypass accepted-exception evidence binding
- Severity: high
- Validation ownership: introduced by current patch
- Evidence:
  - `scripts/check-goal-review-backfill.py:248` only requires `owner` OR `acceptedExceptionRef` for non-pass statuses.
  - `scripts/check-goal-review-backfill.py:252-257` allows non-pass entries with owner-only and no accepted exception.
  - Repro command:
    - `tmp=$(mktemp /tmp/backfill.XXXXXX.json); jq '.lifecycleUnits[0].sliceSkillLensResults.testing |= del(.acceptedExceptionRef)' docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json > "$tmp"; PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-review-backfill.py "$tmp" --repo .; rm -f "$tmp"`
  - Repro outcome: validator returns pass (exit 0) even after removing `acceptedExceptionRef`.
- Impacted behavior:
  - The ledger can claim historical ratification for a required member without any receipt-fragment evidence link, weakening closeout truth from "evidence-backed exception" to "owner assertion."
- Remediation:
  - Require `acceptedExceptionRef` for every non-pass status in `validate_member_result` and keep `owner` optional metadata only.
  - Add a regression test that deletes `acceptedExceptionRef` for a non-pass member and expects validation failure.
- Confidence: 100 (mechanically reproduced in this worktree)

## Targeted Questions Requested By Coordinator

- acceptedExceptionRef arbitrary-file bypass fixed?
  - Partially fixed.
  - File-path traversal/absolute-path bypass is blocked by path canonicalization and repo containment (`scripts/check-goal-review-backfill.py:98-118`).
  - Non-receipt fragment bypass is blocked where member exceptions are parsed via `resolve_receipt_ref` (`scripts/check-goal-review-backfill.py:176-187`).
  - Remaining gap: accepted-exception can be omitted entirely for non-pass statuses due to owner-only fallback (`scripts/check-goal-review-backfill.py:248-257`).

- goal-board wiring has an obvious bypass?
  - Yes, transitively.
  - `scripts/check-goal-board.py:255-266` delegates to the backfill validator and trusts its exit code; because the validator currently allows owner-only non-pass entries, the goal-board gate can be passed with under-evidenced historical rows.
  - No additional direct wiring bypass found beyond that validator contract hole.

## Final Confidence
- 92/100 (single high-confidence, mechanically validated failure chain; no additional independent high-severity cascades found in reviewed scope)

## Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e723b-5e10-7512-8b33-9e8141e8da31/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-039-review-coverage-backfill-adversarial-final.md
- findings:
  - 1 high-severity finding (owner-only non-pass bypass)
- failures_or_blockers:
  - none
- improvement_opportunities:
  - Strengthen non-pass exception contract from "owner or exception" to "mandatory exception ref"
  - Add explicit regression for missing `acceptedExceptionRef` in non-pass members
- strengths:
  - Canonical path validation and receipt-fragment resolution are strict and effective against arbitrary-file references
  - Goal-board now enforces execution of the backfill validator in the runtime-evidence extension path
- validation_evidence:
  - Static analysis of script lines cited above
  - Repro command and pass result proving bypass
- next_action:
  - Patch `validate_member_result` to require `acceptedExceptionRef` for non-pass statuses; add failing regression test before fix and passing test after fix.

WROTE: artifacts/reviews/pu-039-review-coverage-backfill-adversarial-final.md
