# Adversarial Review - PU-045 CircleCI Env Project Brain Rule

## Scope
- Reviewed only the requested PU-045 slice surfaces:
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-045-circleci-env-project-brain-rule-intent.json
  - .harness/knowledge/ci/rules.md
  - .harness/knowledge/INDEX.md
  - .harness/active-artifacts.md
  - docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml
  - docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl (checked for corresponding new receipt evidence)

## Findings

### 1) High - Mutable route-truth claims can advance without append-only receipt evidence
- Severity: high
- Evidence:
  - Trigger: intent acceptance requires a goal receipt for this slice.
  - Path: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-045-circleci-env-project-brain-rule-intent.json:83` states "The goal receipt records that live PR #327 through PR #329 CircleCI lanes were already green..."
  - Path: `docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml:70-85` already asserts refreshed live PR/Linear state and PU-045 promotion in mutable board state.
  - Path: `docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml:88` explicitly says validation should run "after appending R198".
  - Observation: current diff for this slice does not append a new line to `docs/goals/.../receipts.jsonl`.
  - Outcome: a later agent can read current state as proven while append-only receipt proof is missing, breaking claim-vs-evidence ordering.
- Impacted behavior:
  - The board can present fresh remote-state claims without immutable receipt anchoring, creating stale-state and provenance drift risk in subsequent triage/closeout.
- Remediation:
  - Append the PU-045 receipt (R198 or current next ID) in `receipts.jsonl` before commit.
  - Include explicit lane-separated evidence: what was observed, at which heads/timestamps, and explicit non-claims.
  - Re-run goal-board and audit-freshness validators after the receipt append.
- Fixability now: fixable_now
- Confidence: 90
- Validation ownership: introduced_by_current_patch

### 2) Medium - "must use ~/.codex/.env first" can deadlock triage when env surface is a FIFO/no-writer
- Severity: medium
- Evidence:
  - Trigger: triage requests CircleCI API/log details during an opaque or failing lane.
  - Path: `.harness/knowledge/ci/rules.md:8-10` requires env usage before reporting credentials unavailable.
  - Path: `.harness/knowledge/ci/rules.md:19-22` acknowledges FIFO/no-writer as a blocker class, but does not specify a bounded-read contract.
  - Path: `.harness/active-artifacts.md:27-29` repeats FIFO/no-writer classification guidance.
  - Failure chain:
    1. Agent follows "must use env first".
    2. Env path resolves to FIFO/no-writer or unreadable surface.
    3. Rule lacks explicit timeout/probe sequence for this condition.
    4. Different agents may hang, retry indefinitely, or misclassify as missing credentials inconsistently.
- Impacted behavior:
  - CI triage can stall or diverge across agents under the exact recovery path this rule is meant to standardize.
- Remediation:
  - Add a deterministic probe contract to CI rules (for example: non-blocking readability check + short timeout + blocker class mapping + immediate fallback to public-check-only evidence lane).
  - Link to one canonical command shape for this probe so behavior is reproducible.
- Fixability now: fixable_now
- Confidence: 72
- Validation ownership: introduced_by_current_patch

## Validation And Claim-Separation Notes
- Strength:
  - The slice repeatedly preserves lane separation language (implementation/CI/review/tracker/merge/Judge-PM).
  - Secret non-disclosure constraint is clearly stated.
- Concern:
  - The highest-risk lane-separation break is not language drift; it is evidence-order drift (state claims preceding receipt append).

## Commit Readiness
- Can this slice be committed after remediation: yes
- Required before commit:
  - Append and validate the missing PU-045 receipt entry in `docs/goals/.../receipts.jsonl`.
  - Tighten CI rule with bounded FIFO/no-writer handling contract (or add explicit pointer to existing canonical probe contract).

## Accountability Receipt
- status: completed_with_findings
- artifact_paths:
  - artifacts/reviews/pu-045-circleci-env-project-brain-adversarial.md
- findings:
  - 2
- failures_or_blockers:
  - none
- improvement_opportunities:
  - Enforce acceptance criteria requiring receipt append by validator, not prose.
  - Encode deterministic FIFO/no-writer probe behavior in the CI rule itself.
- strengths:
  - Strong non-claim and lane-separation language.
  - Explicit secret-handling prohibition.
- validation_evidence:
  - git diff over scoped files
  - line-anchored reads via nl -ba for each scoped file
  - receipt file checked for corresponding new append
- next_action:
  - Add receipt append and bounded env-surface probe contract, then re-run goal-board/audit-freshness checks.
- useful_findings:
  - evidence-order drift between mutable board state and append-only receipts
- avoided_false_positive:
  - Did not flag existing "do not claim completion" language as overclaim.
- evidence_quality:
  - high
- followed_scope:
  - yes
- reusable_learning:
  - Acceptance criteria that name receipt evidence should be mechanically enforced in the same slice.
- coordinator_score:
  - 0.86

WROTE: artifacts/reviews/pu-045-circleci-env-project-brain-adversarial.md

