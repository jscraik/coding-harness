# PR 336 Live CI Triage Recovery Note

## Scope

This artifact records current PR #336 route truth after the PR body repair and
remote rerun. It is a coordinator recovery note, not an independent reviewer
artifact: the bounded PR-triage subagent reported \`WROTE:
artifacts/reviews/pr336-live-ci-triage.md\`, but the file was absent from both
the active worktree and source checkout when verified.

## Evidence

- Command: \`git ls-remote origin codex/jsc-363-cnf-006-steering-application-receipt\` -> pass
  - Remote head: \`787ceb1c1c67fb244600728bdb5bca99eb1f998f\`
- Command: \`gh pr view 336 --repo jscraik/coding-harness --json number,state,isDraft,mergeable,mergeStateStatus,headRefOid,baseRefName,headRefName,url\` -> pass
  - PR: \`https://github.com/jscraik/coding-harness/pull/336\`
  - State: \`OPEN\`
  - Draft: \`true\`
  - Base: \`codex/jsc-363-cnf-005-prompt-context-authority\`
  - Head: \`codex/jsc-363-cnf-006-steering-application-receipt\`
  - Head SHA: \`787ceb1c1c67fb244600728bdb5bca99eb1f998f\`
  - Mergeable: \`MERGEABLE\`
  - Merge state: \`UNSTABLE\`
- Command: \`gh pr checks 336 --repo jscraik/coding-harness --watch=false\` -> blocked
  - \`ci/circleci: pr-template\` passed on CircleCI job 24852.
  - All visible CircleCI lanes and aggregate \`pr-pipeline\` pass at the latest refresh.
  - External GitHub App check \`security/snyk (jscraik)\` failed with private-test quota exhaustion.
  - CircleCI repo-run \`ci/circleci: snyk-dependency-scan\` passed and must stay separate from the external Snyk App quota lane.

## Classification

- Local implementation validation: previously passed for CNF-006; this artifact does not rerun it.
- PR state: open draft.
- Mergeability: mergeable but unstable.
- CircleCI pr-template: repaired and now green remotely.
- CircleCI remaining lanes: passed at the latest refresh.
- External Snyk App: blocked by private-test quota, not evidence of a code regression from this slice.
- Review artifact lane: still blocked for independent reviewer artifacts because the runtime repeatedly failed to persist requested reviewer outputs.

## Next Coordinator Action

Classify the external Snyk App quota lane, draft PR state, and missing
independent reviewer artifacts before any remote-green, merge-ready, or
slice-done claim. Keep Snyk App quota, CircleCI repo-run Snyk, CodeRabbit draft
behavior, review artifacts, mergeability, and goal completion as separate truth
lanes.

## Non-Claims

This artifact does not prove slice completion, remote CI green state, external
Snyk resolution, independent reviewer completion, merge readiness, Judge/PM
readiness, Linear completion, delivery-truth consumption, or parent goal
completion.

WROTE: artifacts/reviews/pr336-live-ci-triage.md
