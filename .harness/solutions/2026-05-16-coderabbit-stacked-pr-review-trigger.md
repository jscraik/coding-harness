---
title: CodeRabbit Stacked PR Review Trigger
date: 2026-05-16
module: github-review
problem_type: review-workflow
evidence:
  - https://github.com/jscraik/coding-harness/pull/251
  - https://github.com/jscraik/coding-harness/pull/252
  - https://github.com/jscraik/coding-harness/pull/253
  - https://github.com/jscraik/coding-harness/pull/254
project_brain_sync: not-required
tags: [coderabbit, stacked-pr, github, review, ci]
---

# CodeRabbit Stacked PR Review Trigger

## Command Summary

BLUF: This artifact tells the harness operator or agent how to recover
CodeRabbit review coverage on stacked PRs when auto-review skips a non-default
base branch. It matters because the skipped status can look like review
completion or a repository config defect, but the real fix is a one-off
`@coderabbitai review` command on each affected PR. The next action is to
trigger the review, wait for the GitHub `CodeRabbit` status to pass, and then
update the PR body review artifact so closeout evidence matches live review
state.

Decision Needed: Keep stacked PRs small, but do not retarget them to `main`
only to satisfy CodeRabbit auto-review.

Top Risks: Agents may misread the skipped-review status as a repo
configuration failure, retarget the stack and create a huge diff, or claim
review completion while CodeRabbit never reviewed the non-default-base PR.

Next Action: For stacked PRs, comment `@coderabbitai review` on each skipped PR,
then verify the `CodeRabbit` status context on GitHub.

## Problem

The JSC-311 stack used non-default base branches so each slice could stay
reviewable. CodeRabbit posted an important status message instead of running an
automatic review:

`Review skipped. Auto reviews are disabled on base/target branches other than
the default branch.`

That message is not fixed by `.coderabbit.yaml` when the repository keeps
auto-review enabled but CodeRabbit policy excludes non-default target branches.
The correct operator action is a one-off review command, not a branch retarget
or a broad config churn pass.

## Evidence

- PR #251, #252, #253, and #254 were stacked against non-default base branches.
- `.coderabbit.yaml` already had automatic reviews enabled.
- Posting `@coderabbitai review` to each skipped PR produced passing
  `CodeRabbit` GitHub statuses.
- After the manual trigger, `gh pr checks` reported `CodeRabbit` as `pass` for
  PR #251 through PR #254.

## Root Cause

The failure was a service-policy mismatch, not a local repository syntax bug.
The stack structure was intentional, but CodeRabbit auto-review only ran for
the default-branch target path. Stacked branches therefore needed an explicit
review command per PR.

## Fix Or Durable Guidance

When CodeRabbit skips a stacked PR because its target branch is not the default
branch:

1. Leave the stacked base alone unless the human explicitly wants a different
   review shape.
2. Comment exactly `@coderabbitai review` on the skipped PR.
3. Wait for the GitHub `CodeRabbit` status context to report `pass`.
4. Update the PR body review artifact field with the passing status evidence.
5. Only then treat CodeRabbit review as complete for that PR.

Do not create a duplicate config fix unless `.coderabbit.yaml` itself proves
auto-review is disabled for default-branch PRs too.

## Validation

- Command: `gh pr comment 251 --body '@coderabbitai review'` -> pass.
- Command: `gh pr comment 252 --body '@coderabbitai review'` -> pass.
- Command: `gh pr comment 253 --body '@coderabbitai review'` -> pass.
- Command: `gh pr comment 254 --body '@coderabbitai review'` -> pass.
- Command: `gh pr checks 251 --watch=false` -> pass for CodeRabbit status
  inspection; remaining failures were CircleCI, not CodeRabbit.
- Command: `gh pr checks 254 --watch=false` -> pass for CodeRabbit status
  inspection; remaining failures were CircleCI, not CodeRabbit.

## Prevention

- Treat CodeRabbit `Review skipped` as actionable review routing evidence, not
  as review completion.
- For stacked PRs, add a CodeRabbit review-trigger step to the closeout loop.
- Keep PR-body review artifacts aligned after the manual trigger so the
  `pr-template-gate` does not keep stale `pending` review text.
- Prefer one-off `@coderabbitai review` comments over retargeting stacked PRs
  to `main`, because retargeting can make the review diff much larger than the
  intended slice.

## Project Brain / Routing

This artifact is the primary learning record. A separate Project Brain rule is
not required yet because the fix is an external review-trigger action rather
than a source-code invariant. Promote it into `.harness/memory/LEARNINGS.md`
only if the skipped stacked-PR pattern repeats outside this JSC-311 stack.

## Related Artifacts

- `.coderabbit.yaml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.harness/solutions/2026-05-16-jsc-311-runtime-card-blocking-proof.md`
