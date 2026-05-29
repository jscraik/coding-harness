# Adversarial Review - PU-039 Review Coverage Backfill

## Scope
- Reviewed files:
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-039-review-coverage-backfill-intent.json
  - docs/goals/codex-runtime-evidence-verifier-cockpit/review-coverage-backfill.json
  - docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml
  - scripts/check-goal-review-backfill.py
  - src/dev/check-goal-review-backfill-script.test.ts
  - artifacts/reviews/pu-039-review-coverage-backfill-*.md

## Findings

### 1) High - Backfill can claim unit-level ratification with unrelated receipt lineage
- Severity: high
- Validation ownership: introduced by current patch
- Evidence:
  - Validator only checks that each `sourceReceiptRefs[]` entry resolves to an existing fragment, not that fragment belongs to the specific lifecycle unit being claimed: `scripts/check-goal-review-backfill.py:230-231`.
  - Ledger currently reuses the same source receipt fragment for all units (`R004`) while claiming coverage for PU-001..PU-016: `docs/goals/codex-runtime-evidence-verifier-cockpit/review-coverage-backfill.json` (`lifecycleUnits[*].sourceReceiptRefs`).
  - Tests encode this same behavior as valid baseline (`baseEntry()` hardcodes `R004` for every unit): `src/dev/check-goal-review-backfill-script.test.ts:81`.
- Impacted behavior:
  - The validator reports pass even when PU-002..PU-016 are linked to receipts that do not prove those units. This allows historical coverage to appear complete while unit-to-receipt provenance is materially unbound.
- Failure scenario:
  1. Operator copies a single known-good receipt fragment (for one unit) into every lifecycle row.
  2. Each row still has full member maps and accepted exceptions, so structural checks pass.
  3. Validator returns success JSON with `"lifecycleUnitCount": 16`.
  4. Closeout consumers infer full historical ratification despite missing per-unit receipt lineage.
- Remediation:
  - Enforce unit-to-receipt consistency by requiring each unit to reference a unit-specific receipt id map (for example, per-unit allowed fragments in validator metadata), or validate against receipts.jsonl content that explicitly contains `lifecycleUnit` and matches the row key.
- Confidence: 95
- Validation ownership: human (goal coordinator + validator maintainer)

### 2) Medium - Pass evidence can be self-attested as "current" without freshness or semantic binding
- Severity: medium
- Validation ownership: introduced by current patch
- Evidence:
  - For `status: "pass"`, validator accepts any non-empty file path plus literal `freshness: "current"`; no timestamp/head-SHA/receipt linkage is required: `scripts/check-goal-review-backfill.py:170-179`.
  - `resolve_ref` only checks file existence/non-empty and optional jsonl receipt fragment presence; it does not verify evidence type relevance to member/role or contemporaneity: `scripts/check-goal-review-backfill.py:128-148`.
- Impacted behavior:
  - A pass member can be "proven" by any arbitrary non-empty file in-repo while asserting freshness textually, creating a bypass where fabricated current-pass evidence is structurally valid.
- Failure scenario:
  1. A future edit flips a historical member from `not applicable` to `pass`.
  2. Editor points `evidenceRef` to an unrelated markdown file and sets `freshness: "current"`.
  3. Validator accepts it because path exists and token equals current.
  4. Ledger now appears to contain verified pass evidence without real review artifact provenance.
- Remediation:
  - Require pass evidence to be receipt-backed (`.jsonl#Rxxx`) with explicit member/role metadata in receipt payload, or enforce evidenceRef patterns constrained to known review artifact paths plus freshness fields validated against receipt timestamp/head SHA.
- Confidence: 88
- Validation ownership: human (goal coordinator + delivery-truth/evidence contract owners)

## Residual Risks
- No explicit check verifies `coverageWindow.lifecycleUnits` content matches required PU bounds; this is low-risk today because lifecycle unit enforcement is done elsewhere, but metadata drift can reduce audit clarity.
- The validator does not ensure accepted exception refs correspond to the same lifecycle unit context, only that fragments exist.

## Testing Gaps
- Missing negative test proving validator rejects reused source receipt fragments across multiple lifecycle units when unit lineage is inconsistent.
- Missing negative test proving pass evidence cannot be an unrelated arbitrary file with self-asserted freshness.
- Missing integration test binding ledger pass members to receipt payload semantics (role/member/head freshness).

## Accountability Receipt
- status: completed_with_findings
- artifact_paths:
  - artifacts/reviews/pu-039-review-coverage-backfill-adversarial.md
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e7228-d46d-7770-a684-a35e4c576b72/manifest.json
- findings:
  - high: unit-to-receipt lineage can be fabricated while validator still passes
  - medium: pass freshness and evidence relevance are self-attested
- failures_or_blockers:
  - template path `agents/templates/review-artifact.md` not found in this checkout; used explicit structured artifact format instead
- improvement_opportunities:
  - add semantic receipt binding checks for source and pass evidence refs
  - add anti-fabrication fixtures in validator tests
- strengths:
  - strong structural completeness checks (required members, allowed statuses, duplicate/missing unit detection)
  - strict repo-relative reference handling and receipt-fragment existence checks
- validation_evidence:
  - `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-review-backfill.py docs/goals/codex-runtime-evidence-verifier-cockpit/review-coverage-backfill.json --repo .` -> pass
  - `pnpm vitest run src/dev/check-goal-review-backfill-script.test.ts --reporter=dot` -> 8 passed
- next_action:
  - harden validator with unit-specific receipt lineage and pass evidence semantic freshness constraints before using this ledger as closeout-proof quality evidence.

WROTE: artifacts/reviews/pu-039-review-coverage-backfill-adversarial.md
