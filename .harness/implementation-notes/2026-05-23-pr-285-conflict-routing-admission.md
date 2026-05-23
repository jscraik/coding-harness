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

When a user mentions merge conflicts, `DIRTY`, or a PR review URL during PR
delivery, first report and act on the exact mergeability surface:

1. Local worktree conflict state.
2. GitHub PR `mergeStateStatus` for every referenced PR.
3. The branch that will actually be pushed or merged.
4. Whether a sibling PR is a superseding recovery lane or the referenced PR
   itself must be repaired.

**Failure-handling procedures:**

- When `git diff --diff-filter=U` finds conflicted files: abort delivery, list the conflicted files, attempt automatic rebase/merge with `git mergetool` guidance, fallback to creating a "conflict-repair" branch with a PR.
- Map `mergeStateStatus` values to actions: `CONFLICTING` => block and require repair branch + reviewer assignment; `BEHIND` => rebase/update branch and re-run CI; `UNKNOWN`/other => run diagnostics and mark for human review.
- Define escalation/handoff workflow when resolution or supersede is impossible: assign to original author first, then repo-maintainer after N hours with a required status comment and checklist.
- Define "concrete owner" as the assigned author or maintainer with required communication templates (comment text, Slack/email subject) and a required blocker reason field in PR metadata.

Do not move into review-thread synthesis until the conflict surface is either
resolved, explicitly superseded, or blocked with a concrete owner and reason.

## Validation

- **Local conflict probe:** `git diff --name-only --diff-filter=U`
  - Expected outputs:
    - Empty = no conflicts
    - List of paths = conflicted files
  - Failure handling: If conflicted files found, abort delivery and initiate conflict-repair workflow per Guardrail section.

- **PR truth probe:** `gh pr view NUMBER --json mergeStateStatus,headRefName,headRefOid,state,isDraft`
  - `mergeStateStatus` values to act on:
    - `CLEAN` = OK, proceed
    - `CONFLICTING` = requires repair
    - `BEHIND` = rebase/update branch and re-run CI
  - Ownership: Agent runs pre-synthesis check; human verifies after conflict mention.

- **Delivery proof:** Exact command sequence after repair:
  ```
  git push <remote> <branch> && gh pr view NUMBER --json mergeStateStatus,headRefName,headRefOid,state,isDraft
  ```
  - Success condition: `mergeStateStatus == CLEAN` and PR state unchanged.
  - On failure: Re-enter conflict-repair workflow or escalate per Guardrail procedures.
