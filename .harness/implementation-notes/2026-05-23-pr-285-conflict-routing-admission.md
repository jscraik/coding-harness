# PR 285 Conflict Routing Admission

## Table of Contents

- [Feedback Signal](#feedback-signal)
- [Operational Failure](#operational-failure)
- [Guardrail](#guardrail)
- [Validation](#validation)

## Feedback Signal

Jamie raised the merge-conflict blocker more than once while the agent focused
on adjacent PR review and auto-merge status. That repeated steering is
operational telemetry: the delivery loop failed to prioritize the live GitHub
mergeability blocker before secondary review triage.

## Operational Failure

- Category: lack of verification / poor workflow design.
- Root failure: PR mergeability, local branch cleanliness, and active-review URL
  state were not separated into distinct truths before reporting progress.
- Impact: a stale dirty PR could remain open while a cleaner sibling PR appeared
  to be sufficient, creating contradictory delivery state.

## Guardrail

When a user mentions merge conflicts, \`DIRTY\`, or a PR review URL during PR
delivery, first report and act on the exact mergeability surface:

1. Local worktree conflict state.
2. GitHub PR \`mergeStateStatus\` for every referenced PR.
3. The branch that will actually be pushed or merged.
4. Whether a sibling PR is a superseding recovery lane or the referenced PR
   itself must be repaired.

Do not move into review-thread synthesis until the conflict surface is either
resolved, explicitly superseded, or blocked with a concrete owner and reason.

## Validation

- Local conflict probe: \`git diff --name-only --diff-filter=U\`.
- PR truth probe: \`gh pr view NUMBER --json mergeStateStatus,headRefName,headRefOid,state,isDraft\`.
- Delivery proof: push the repaired branch and re-read the same PR state.
