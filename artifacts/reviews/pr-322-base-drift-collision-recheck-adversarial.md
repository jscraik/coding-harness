# Adversarial Recheck: PR #322 Base Drift Fallback

## Scope
- src/commands/pr-closeout/git-branch.ts
- src/commands/pr-closeout.test.ts

## Depth Calibration
- Size estimate: quick-to-standard (targeted diff slice in two files)
- Risk signals: delivery-state classification (implementation vs orientation) derived from git remote/base drift evidence.
- Techniques applied: assumption violation, composition failures, abuse-case boundary walk.

## Findings (Severity Ranked)
- No material adversarial findings in the scoped recheck.

## Evidence
- Exact-branch matching guard:
  - remoteBaseRefs enumerates refs/remotes/*, strips remote name, and only includes refs where branch tail equals baseRefName exactly (branchName === trimmed), preventing suffix collisions like release/main.
  - Evidence: src/commands/pr-closeout/git-branch.ts:41
  - Evidence: src/commands/pr-closeout/git-branch.ts:45
- Fallback retains origin-first probe but only permits exact branch-name peers:
  - Origin candidate always included (refs/remotes/origin/<base>), then optional discovered remotes with exact same branch component.
  - Evidence: src/commands/pr-closeout/git-branch.ts:30
  - Evidence: src/commands/pr-closeout/git-branch.ts:74
- Regression coverage validates both sides of the boundary:
  - Positive case: origin fails, exact peer upstream/main succeeds and permits implementation.
  - Evidence: src/commands/pr-closeout.test.ts:1500
  - Negative case: upstream/release/main is present but must not be queried for drift; lifecycle remains orientation.
  - Evidence: src/commands/pr-closeout.test.ts:1592
  - Evidence: src/commands/pr-closeout.test.ts:1667

## Residual Risks
- If a repository intentionally uses a base branch whose literal name contains slashes and equals baseRefName (for example, release/main), this logic is still correct, but test corpus currently focuses on main as the caller-provided base. This is a minor coverage gap, not a blocker.

## Testing Gaps
- Optional hardening test: add a scenario where baseRefName itself contains a slash and ensure exact matching still works across multiple remotes.
- Optional hardening test: add a case where for-each-ref fails and verify origin-only fallback remains deterministic.

## Remaining Material Blocker Before Commit
- None identified in the scoped review.

## Accountability Receipt
- status: complete
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e7c57-742b-78e1-958d-3eaae0a5e168/manifest.json
- artifact_paths:
  - artifacts/reviews/pr-322-base-drift-collision-recheck-adversarial.md
- findings:
  - useful_findings: 0 material defects
  - avoided_false_positive: 1 (did not flag upstream/release/main path after exact-match verification)
  - evidence_quality: high
  - followed_scope: true
  - reusable_learning: exact branch-tail matching is the key invariant
  - coordinator_score: ready
- failures_or_blockers:
  - none
- improvement_opportunities:
  - add one slash-in-base-name test to reduce future assumption drift
- strengths:
  - explicit exact-match guard in implementation
  - paired positive/negative regression tests for boundary behavior
- validation_evidence:
  - read-path verification: src/commands/pr-closeout/git-branch.ts and src/commands/pr-closeout.test.ts targeted sections
  - coordinator-supplied checks previously passed: vitest scoped suite, git-env sanitizer, diff check, codestyle fast
- next_action:
  - Safe to proceed to commit from adversarial-risk perspective for this scoped change.

WROTE: artifacts/reviews/pr-322-base-drift-collision-recheck-adversarial.md
