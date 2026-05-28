# Adversarial Intent Review - PU-033 SPG-007 ReviewLifecycle

## Scope and depth
- Depth: Standard (intent slice with review-state and closeout-proof boundary risk).
- Reviewed artifacts:
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json
  - docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
  - docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml

## Findings (severity-ranked)

### 1) High - Artifact-lineage self-certification path allows review-proof forgery inside allowed scope
- Evidence:
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json:21 allows writes to artifacts/reviews/pu-033-spg-007-review-lifecycle-*.md.
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json:37 requires artifact lineage checks for covered verdicts.
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json:43-44 says pass depends on matching head SHA/current artifacts and rejects missing lineage.
  - docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:310 and :333 require separate claim-support lanes and no blended closeout proof.
- Failure scenario:
  1. Implementation writes or overwrites a reviewer markdown file inside the same allowed slice.
  2. New ReviewLifecycle logic checks file existence/size/head SHA and treats that generated file as lineage evidence.
  3. Coverage/verdict elevates to pass for review-lifecycle even when no independent human/subagent review occurred.
  4. Downstream consumers receive a mechanically valid but semantically forged review-coverage signal, weakening the anti-blending contract.
- Impacted behavior:
  - ReviewLifecycle/v1 can be made to appear reviewer-covered by slice code itself, collapsing independent-review trust boundaries.
- Remediation:
  - Remove reviewer artifact paths from allowedFiles for implementation slices, or require lineage producer identity bound to independent reviewer role plus run manifest outside the implementation write scope.
  - Add a negative test: implementation-produced artifact with matching size/head SHA but wrong producer/role must force blocked or unknown.
- Confidence: 75
- Validation ownership: introduced by current intent contract.

### 2) Medium - No explicit gate in validation plan that proves non-promotion to merge/CI/Linear/closeout authority
- Evidence:
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json:47 states ReviewLifecycle must not alter pr-closeout/delivery-truth/harness next/merge-ready behavior.
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json:52-59 validation plan runs review-lifecycle tests and schema validators, but has no explicit command targeting delivery-truth/pr-closeout negative behavior for this boundary.
  - docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:214 introduces SPG-007, while :310 and :333 require independent claim lanes and anti-blending.
- Failure scenario:
  1. A helper in src/lib/review-state/** is changed to emit a stronger verdict semantic than intended.
  2. Existing review-lifecycle tests pass because they validate packet shape and local semantics only.
  3. No validation command asserts that closeout/merge-readiness/CI/Linear claim logic remains unchanged.
  4. Slice lands with subtle authority creep where review lifecycle begins influencing strong claims indirectly.
- Impacted behavior:
  - ReviewLifecycle/v1 may drift from orientation/audit evidence toward de facto claim authority without immediate detection.
- Remediation:
  - Add at least one explicit negative contract check in the validation plan that exercises delivery-truth/pr-closeout behavior and proves no new claim-support route is opened by ReviewLifecycle/v1.
  - Require a fixture where ReviewLifecycle is pass but merge/CI/Linear claims remain blocked/unknown absent their own evidence lanes.
- Confidence: 50
- Validation ownership: introduced by current intent contract.

## Strengths
- Intent clearly states orientation-only evidence posture and anti-authority constraints (intent.json:34-35, :47, :82).
- Forbidden list explicitly blocks merge/CI/Linear proof promotion (intent.json:29).
- Acceptance criteria include stale/unresolved/mismatch blockers and secret/transcript exclusions (intent.json:44-45).

## Residual risks
- Local Memory CLI bootstrap/search unavailable in this runtime, so memory corroboration could not be refreshed for this run.

## Accountability receipt
- status: findings_reported
- artifact_paths:
  - artifacts/reviews/pu-033-spg-007-review-lifecycle-intent-adversarial.md
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6d44-7cc4-78c1-8647-327ddb0b1a4e/manifest.json
- findings:
  - high: artifact-lineage self-certification path enables reviewer-proof forgery
  - medium: validation plan missing explicit non-promotion gate for closeout authority boundaries
- failures_or_blockers:
  - blocked_local_memory_cli: local-memory bootstrap --mode minimal --include_questions --session_id repo:coding-harness/task:pu-033-spg-007-intent-review --json failed with failed to write PID file: /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted
  - blocked_local_memory_cli: local-memory search SPG-007 ReviewLifecycle verifier merge CI Linear proof boundaries --session_filter_mode all --json failed with same PID-file permission error
- improvement_opportunities:
  - enforce independent-producer constraints for reviewer artifacts in lineage checks
  - add explicit negative closeout-authority regression to slice validation plan
- strengths:
  - clear anti-blending language and explicit forbidden scope around merge/CI/Linear proof
  - good semantic rejection coverage for stale/unresolved/zero-byte/secret-like payloads
- validation_evidence:
  - Command: nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json | sed -n 1,320p -> pass
  - Command: rg -n SPG-007|ReviewLifecycle|merge|Linear|CI|proof|closeout docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md -> pass
- next_action:
  - patch intent to remove reviewer-artifact write scope from implementation slice and add explicit non-promotion regression command before implementation starts
- useful_findings: 2
- avoided_false_positive: avoided flagging schema/fixture specifics as missing where acceptance criteria already capture those checks
- evidence_quality: high for line-level intent/goal references; medium for downstream integration risk until implementation diff exists
- followed_scope: yes (intent-only, no runtime code edits)
- reusable_learning: treat reviewer artifact paths as privileged evidence surfaces and avoid allowing same-slice mutation by producer under test
- coordinator_score: strong signal; patch intent before implementation to preserve trust boundaries

WROTE: artifacts/reviews/pu-033-spg-007-review-lifecycle-intent-adversarial.md
