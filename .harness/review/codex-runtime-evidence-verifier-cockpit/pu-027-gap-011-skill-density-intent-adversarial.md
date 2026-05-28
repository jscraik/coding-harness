# Adversarial Re-review: PU-027 GAP-011 Skill-density Intent

## Verdict
do not proceed

## Severity-ranked Findings

1. **High — Mixed artifact namespaces can reintroduce ghost-pass review evidence**
- Severity: high
- Evidence: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-027-gap-011-skill-density-intent.json:206, :211, :216, :236, :241, :247
- Impacted behavior: The intent now requires tracked .harness/review/... artifacts, but it still embeds prior reviewer evidence pointers under ignored artifacts/reviews/.... A coordinator or automation that reads reviewFindingsAddressed/rereviewOutcome.agentRecommendations.reportedArtifact can accept stale or non-existent evidence while believing re-review completion is true.
- Failure scenario:
  - Trigger: A closeout helper reads reviewFindingsAddressed and rereviewOutcome.agentRecommendations.
  - Path: It resolves reportedArtifact entries to artifacts/reviews/*.
  - Path: artifacts/ is ignored, and those files are absent from tracked history.
  - Outcome: The helper emits a false "review evidence exists" state or silently drops evidence checks, allowing implementation start despite missing tracked artifacts.
- Remediation: Rewrite all persisted reviewer artifact references in this intent to the tracked .harness/review/codex-runtime-evidence-verifier-cockpit/pu-027-gap-011-skill-density-intent-*.md namespace and prohibit mixed review artifact roots in intent metadata.
- Confidence: 90
- Validation ownership: introduced by current patch

2. **Medium — Artifact repair gate can be bypassed by status drift because repair status remains pending**
- Severity: medium
- Evidence: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-027-gap-011-skill-density-intent.json:222, :203, :259
- Impacted behavior: trackedReviewArtifactRepair.status is still pending while rereviewOutcome contains positive mailbox recommendations. If a consumer prioritizes recommendation summaries over repair status and explicit artifact existence probes, implementation can start before all required tracked artifacts exist.
- Failure scenario:
  - Trigger: A coordinator script prioritizes reviewer recommendation text.
  - Path: reportedOutcome values indicate "implementation can proceed."
  - Path: The same object still carries artifactVerification.status: fail and repair status pending.
  - Outcome: Inconsistent state causes a split-brain decision and a premature proceed.
- Remediation: Add a deterministic ready_to_implement boolean computed only from tracked artifact existence checks (wc -c .harness/review/...) and force consumers to gate on it.
- Confidence: 78
- Validation ownership: introduced by current patch

## Residual Risks
- Required peer artifacts for agent-native-reviewer and best-practices-researcher were not present at review time in .harness/review/codex-runtime-evidence-verifier-cockpit/; cross-review coverage remains incomplete.
- The intent contains both enforcement language and narrative mailbox history, which increases parsing ambiguity for downstream automation.

## Testing Gaps
- No explicit fixture/check is described for mixed artifact root references (tracked vs ignored) within intent metadata fields.
- No explicit test proves that proceed decisions fail closed when any required tracked review artifact is missing.

## Accountability Receipt
- status: completed_with_findings_do_not_proceed
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6a0b-b02a-7c43-b105-2fe53a6fc8f3/manifest.json
- artifact_paths:
  - .harness/review/codex-runtime-evidence-verifier-cockpit/pu-027-gap-011-skill-density-intent-adversarial.md
- findings:
  - high: mixed artifact namespace can produce ghost-pass evidence
  - medium: pending repair status can be bypassed by recommendation-text drift
- failures_or_blockers:
  - missing companion tracked artifacts from other required reviewers at time of this pass
- improvement_opportunities:
  - normalize all artifact references to tracked paths only
  - add computed fail-closed readiness field
  - add metadata lint for forbidden artifacts/reviews/ references in intent files
- strengths:
  - tracked review artifact destination is explicitly declared and aligns with .gitignore exceptions
  - verification command for artifact presence is present in intent
- validation_evidence:
  - git check-ignore -v artifacts/reviews/foo.md -> ignored by .gitignore:158
  - git check-ignore -v .harness/review/codex-runtime-evidence-verifier-cockpit/foo.md -> explicitly unignored by .gitignore:82
  - git ls-files .harness/review | head shows tracked review surfaces exist
- next_action:
  - regenerate all three required tracked reviewer artifacts and rerun the intent artifact existence probe before implementation starts
- useful_findings: 2
- avoided_false_positive:
  - did not re-raise previously resolved overlap/advisory deterministic-policy blockers
- evidence_quality: high for path/ignore behavior; medium for downstream consumer behavior assumptions
- followed_scope: yes (artifact-persistence recovery intent re-review only)
- reusable_learning:
  - intent metadata should never mix tracked and ignored artifact namespaces after a persistence contract change
- coordinator_score: 0.84

WROTE: .harness/review/codex-runtime-evidence-verifier-cockpit/pu-027-gap-011-skill-density-intent-adversarial.md
