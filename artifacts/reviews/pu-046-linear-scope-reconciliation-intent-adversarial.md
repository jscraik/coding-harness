# Adversarial Intent Review — PU-046 Linear Scope Reconciliation

STATUS: blocked_validation

## Recommendation
Block implementation until the intent adds immutable evidence constraints and failure-path gates for the Linear attachment mutation.

## Findings (severity-ranked)

### 1) High — Attachment proof can succeed while owner-visible scope truth remains stale
- Severity: high
- Evidence:
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:12
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:39
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:86
  - .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md:19
  - docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:95
- Constructed failure scenario:
  1. Trigger: Linear issue still shows Phase-1 wording in title/description.
  2. Execution: Slice creates an attachment (allowed tool) and validates only attachment visibility.
  3. Composition failure: Existing owner workflow reads issue fields first; attachment is not the primary surfaced scope text.
  4. Outcome: Repo records “scope reconciled,” while planner-facing scope remains stale in the canonical issue body.
- Impacted behavior: The slice can pass local acceptance while failing the stated lifecycle requirement to reconcile tracker alignment before closeout claims.
- Remediation: Add explicit “not reconciled” verdict unless both (a) attachment exists and (b) issue-body update capability exists or a documented human handoff ticket/comment acknowledgment is captured as current evidence.
- Confidence: 75
- Validation ownership: introduced_by_current_patch

### 2) High — No immutable binding between attached note content and post-mutation verification
- Severity: high
- Evidence:
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:38
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:59
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:87
- Constructed failure scenario:
  1. Trigger: Attachment is created from a local markdown path.
  2. Execution: Post-check confirms an attachment exists, but does not verify content hash, exact body text, or immutable artifact identity.
  3. State propagation: Note file is edited later (or attachment points to a mutable reference), while receipts still claim reconciliation.
  4. Outcome: Evidence trail proves existence of an attachment, not the intended full-lifecycle scope statement.
- Impacted behavior: Claim-support can drift from what was actually reviewed by owners.
- Remediation: Require SHA256 of attached artifact, record attachment ID/URL, and verify retrieved attachment metadata/content fingerprint in the same closeout window.
- Confidence: 75
- Validation ownership: introduced_by_current_patch

### 3) Medium — Failure path allows local state advancement without external mutation success invariant
- Severity: medium
- Evidence:
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:29
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:49
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:88
- Constructed failure scenario:
  1. Trigger: create_attachment fails transiently (auth, API timeout, permission drift).
  2. Execution: Local note + receipts/state updates still run and pass goal-board checks.
  3. Cascade: Subsequent slices consume local receipt lane as if tracker-scope ambiguity was addressed.
  4. Outcome: Parent closeout logic may under-classify unresolved tracker ambiguity.
- Impacted behavior: External truth lane and local planning lane can diverge with no hard blocker.
- Remediation: Make external mutation success a strict prerequisite for writing slice receipt/state transition; on failure, emit blocker class and prevent “reconciled” state.
- Confidence: 50
- Validation ownership: introduced_by_current_patch

## Strengths
- Intent correctly narrows mutation authority to the only currently available connector operation (attachment creation).
- Non-goals explicitly forbid accidental over-claims (goal completion, Judge/PM readiness, merge readiness).

## Improvement opportunities
- Encode a formal “tracker alignment unresolved” state when attachment-only mitigation is used.
- Add a deterministic ownership acknowledgment requirement (comment/thread/ticket) before marking reconciliation complete.

## Accountability receipt
- status: blocked_validation
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e8260-e9b9-7511-9056-adc383543791/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-046-linear-scope-reconciliation-intent-adversarial.md
- findings:
  - high: attachment-only proof can leave canonical issue scope stale
  - high: no immutable binding between intended note content and verification
  - medium: local state can advance after external mutation failure
- failures_or_blockers:
  - Unable to execute normal zsh -lc discovery flow in this worktree due mise trust-cache permission errors; review completed with fallback shell reads.
- validation_evidence:
  - nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json
  - nl -ba docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
  - nl -ba .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md
- useful_findings: 3
- avoided_false_positive: Did not flag missing title/description edit as a bug by itself because intent explicitly scopes to available connector authority.
- evidence_quality: medium_high
- followed_scope: yes
- reusable_learning: attachment-existence checks need immutable content binding when used as tracker truth mitigation.
- coordinator_score: needs_intent_patch_before_mutation
- next_action: Patch intent acceptance criteria and validation plan with immutable attachment verification + strict external-mutation gate.

WROTE: artifacts/reviews/pu-046-linear-scope-reconciliation-intent-adversarial.md
