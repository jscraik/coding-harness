# PR 336 Triage

status: current_failing

## Scope

- repo: `jscraik/coding-harness`
- pr: `336`
- branch: `codex/jsc-363-cnf-006-steering-application-receipt`
- base: `codex/jsc-363-cnf-005-prompt-context-authority`
- head_sha: `dd4add15b5802fd811305b86ae9ea92ccf4cebc0`

## Current PR State

- PR is `OPEN` and marked `draft`.
- GitHub reports `mergeable: MERGEABLE` and `mergeStateStatus: UNSTABLE`.
- `reviewDecision` is empty.
- Review threads are empty in GraphQL (`reviewThreads.nodes: []`).
- CodeRabbit skipped because the PR is draft.

## CI State

- `pr-pipeline` failed on the current head.
- `ci/circleci: pr-template` failed on the current head.
- `security/snyk (jscraik)` failed with `You have used your limit of private tests`.
- CircleCI security checks and GitHub-native checks that did not fail are green, including `security-scan`, `test`, `typecheck`, `lint`, `check`, `audit`, `memory`, `orb-pinning`, `dependency-scan`, `consistency-drift-health`, `smarter-testing-comparison`, `docs-gate`, and `snyk-dependency-scan`.

## Likely Cause

- The explicit external failure is Snyk quota exhaustion, which is clearly not introduced by the patch.
- The CircleCI workflow failure is on the latest head, so it is current-state and not stale.
- The available metadata does not expose the job log or failing step for `pr-pipeline` or `pr-template`, so the exact root cause remains unconfirmed from GitHub metadata alone.
- Most likely ownership split:
  - `security/snyk`: `external_service`
  - `pr-pipeline` / `pr-template`: `introduced_by_current_patch` is plausible because the failures are on the latest head, but confidence is only medium until the CircleCI job log is inspected.

## Review State

- No unresolved review threads are currently exposed.
- The only visible review-like activity is the Linear linkback comment and the CodeRabbit draft-skip notice.

## Local Worktree Signal

- The worktree is dirty with an unrelated modified file: `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`.
- That local change does not explain the remote PR failures, but it means local truth and remote truth should stay separate.

## Recommended Coordinator Action

1. Open the CircleCI workflow `2aa74ef0-39ee-4ce5-8781-12cabf3240b6` and inspect the failing `pr-pipeline` and `pr-template` job logs for the exact step.
2. Treat the Snyk failure as a quota / external-service issue and verify whether it is expected for draft PRs or should be bypassed for this lane.
3. Keep the PR in draft until the workflow root cause is understood, because review state is effectively absent while draft.
4. Re-run mergeability and check-state after the CircleCI failure is resolved.

## Accountability Receipt

- status: `current_failing`
- artifact_paths:
  - `/private/tmp/coding-harness-cnf004-runtime-card-continuity-1780540044/artifacts/reviews/pr336-triage.md`
- findings:
  - severity: high
    evidence: `gh pr checks 336` shows `pr-pipeline` = FAILURE and `ci/circleci: pr-template` = FAILURE on head `dd4add15b5802fd811305b86ae9ea92ccf4cebc0`
    impacted_behavior: PR cannot be treated as release-ready or merge-ready
    remediation: inspect the failing CircleCI workflow logs and fix the failing gate
    confidence: medium
    validation_ownership: introduced_by_current_patch_or_unknown
  - severity: medium
    evidence: `gh pr checks 336` shows `security/snyk (jscraik)` failed with `You have used your limit of private tests`
    impacted_behavior: external security lane is unavailable
    remediation: renew or bypass the private-test quota path if the policy allows it
    confidence: high
    validation_ownership: external_service
- failures_or_blockers:
  - CircleCI job logs were not retrievable from the available metadata in this pass
  - the PR is still draft, so review state is intentionally thin
- improvement_opportunities:
  - capture the exact failing CircleCI step name in the artifact next time
  - record whether draft PRs are expected to hit the Snyk quota gate
- strengths:
  - current-head checks were queried directly instead of relying on stale summaries
  - review state was separated from CI state and local worktree dirt
- validation_evidence:
  - `gh pr view 336 --json isDraft,mergeable,mergeStateStatus,reviewDecision,headRefOid,baseRefName,headRefName`
  - `gh pr view 336 --json comments,reviews`
  - `gh api graphql ... reviewThreads(first:100) ...`
  - `gh pr checks 336 --json name,state,bucket,workflow,description,link,startedAt,completedAt`
- next_action: inspect the CircleCI workflow logs and resolve the failing gates before any merge-readiness claim
- manifest_path: `/private/tmp/coding-harness-cnf004-runtime-card-continuity-1780540044/artifacts/agent-runs/harness-ci-release-reviewer-019e9127-b210-7d20-955a-2a40797c90e4/manifest.json`

WROTE: artifacts/reviews/pr336-triage.md
