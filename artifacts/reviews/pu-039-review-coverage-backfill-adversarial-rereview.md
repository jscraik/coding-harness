# Adversarial Re-Review: PU-039 Review Coverage Backfill (Post-fix)

## Scope
- scripts/check-goal-review-backfill.py
- src/dev/check-goal-review-backfill-script.test.ts
- scripts/check-goal-board.py
- docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json

## Depth
- Standard (validator + test changes with review-evidence and lifecycle lineage semantics)

## Findings (Severity-ranked)

### 1) High - Exception-lineage bypass: non-pass members can cite arbitrary files and still validate as covered
- Severity: high
- Validation ownership: introduced by current patch
- Evidence:
  - Non-pass handling only requires `owner` and/or `acceptedExceptionRef`, and validates refs via `resolve_ref` (any existing non-empty repo file), not receipt fragments: `scripts/check-goal-review-backfill.py:247-255`, `scripts/check-goal-review-backfill.py:153-174`.
  - Repro mutation: set `lifecycleUnits[0].sliceSkillLensResults.testing.acceptedExceptionRef = "AGENTS.md"` and run validator; it returns pass:
    - command: `jq ".lifecycleUnits[0].sliceSkillLensResults.testing.acceptedExceptionRef=\"AGENTS.md\"" docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json > /tmp/ledger.json && python3 scripts/check-goal-review-backfill.py /tmp/ledger.json --repo .`
    - observed: JSON `"status": "pass"`, exit 0.
  - Tests do not assert that non-pass `acceptedExceptionRef` must be receipt-fragment-backed or bound to acceptedExceptionRefs contract key(s): `src/dev/check-goal-review-backfill-script.test.ts:316-320`.
- Impacted behavior:
  - A ledger can claim historical ratification while severing receipt-trail provenance for fail/not-applicable rows, defeating the intended "receipt trail" guarantee under non-pass paths.
- Failure scenario:
  1. Operator edits one or more non-pass member rows and points `acceptedExceptionRef` at unrelated but existing repo files.
  2. Unit source receipt refs remain valid, so lineage checks appear healthy at unit level.
  3. Validator returns pass, closeout consumers accept ledger as ratified.
  4. Review/exception provenance is no longer receipt-backed for those member judgments.
- Remediation:
  - Require non-pass `acceptedExceptionRef` to resolve via `resolve_receipt_ref` (receipt fragment only), and optionally enforce equality to explicitly declared accepted-exception contract refs (for example `acceptedExceptionRefs.preR064ReviewContract`) for this ledger family.
  - Add failing tests for plain-file acceptedExceptionRef under `fail`, `blocked`, and `not applicable`.
- Confidence: 95
- Owner: human

## Residual Risks
- Even after pass-evidence hardening, non-pass exception evidence remains weaker than pass-evidence semantics unless receipt-fragment constraints are enforced.

## Testing Gaps
- Missing negative tests that reject non-fragment `acceptedExceptionRef` for each non-pass status.
- Missing tests that enforce member-level non-pass exception refs align to declared acceptedExceptionRefs contract keys.

## Accountability Receipt
- status: completed_with_findings
- artifact_paths:
  - artifacts/reviews/pu-039-review-coverage-backfill-adversarial-rereview.md
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e7232-fa6c-7311-8428-89e78ae3d34a/manifest.json
- findings:
  - high: non-pass acceptedExceptionRef can bypass receipt-lineage by pointing at arbitrary files
- failures_or_blockers:
  - none
- improvement_opportunities:
  - tighten non-pass acceptedExceptionRef to receipt fragments and bind to accepted exception contract keys
  - add adversarial negative fixtures for fail/blocked/not-applicable exception refs
- strengths:
  - coverageWindow and per-unit source receipt lineage are now exact and enforced
  - pass evidence is now receipt-backed with member-role and current-freshness checks
- validation_evidence:
  - `pnpm exec vitest run src/dev/check-goal-review-backfill-script.test.ts` -> 14 passed
  - mutation command above -> validator still passed with `acceptedExceptionRef: "AGENTS.md"` (exit 0)
- next_action:
  - block R133 closeout until non-pass exception refs are receipt-fragment constrained and revalidated.

WROTE: artifacts/reviews/pu-039-review-coverage-backfill-adversarial-rereview.md
