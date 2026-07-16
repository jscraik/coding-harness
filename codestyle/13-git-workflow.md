# Git Workflow Standards

## Table of Contents
- [Scope](#scope)
- [Branch and sync discipline](#branch-and-sync-discipline)
- [Commit discipline](#commit-discipline)
- [Pull request discipline](#pull-request-discipline)
- [Enforcement](#enforcement)

## Scope
- This module defines Git workflow standards for local branches, commits, and PR preparation.
- For the broader feature lifecycle before Git operations, see [19-development-workflow.md](./19-development-workflow.md).

## Branch and sync discipline
- Start from the repository target base branch and keep your branch current before requesting review.
- Fetch the remote before work that depends on current repository truth. A stale
  local default branch is not authority for current branch, PR, or CI state.
- When issue tracking is enabled, agent-created branches MUST use `codex/<issue-key>-<slug>`.
- Use explicit comparison ranges when summarizing change scope:
  - `git diff <base-branch>...HEAD`
- Do not bypass hooks or governance checks with `--no-verify`.
- Do not push directly to protected branches unless the repository has a
  documented emergency carve-out and explicit maintainer approval.

## Commit discipline
- Commit messages MUST follow the repository commit contract in [04-docs-config-and-release.md](./04-docs-config-and-release.md).
- Keep commits atomic: one logical change per commit.
- Commit validation claims MUST be evidence-backed and match commands actually run.

## Pull request discipline
- PR summaries MUST cover the full branch delta, not only the latest commit.
- PR titles/bodies MUST reference the issue key with `Refs <KEY>` or `Fixes <KEY>` when issue tracking is required by policy.
- PR descriptions MUST follow `.github/PULL_REQUEST_TEMPLATE.md` exactly.
- Testing sections MUST include exact commands and outcomes.
- If checks are blocked, record concrete blocker reasons rather than placeholders.
- Do not add `[skip ci]`, disable checks, weaken required workflows, or remove
  validation steps to unblock a branch. Fix the failure or record the blocker.
- After pushing a PR branch, inspect the current check or CI state before making
  pass/fail, mergeability, or readiness claims.
- Unplanned CI workflow edits discovered mid-task require explicit scope
  confirmation or a separate follow-up unless they are the direct fix.

## Enforcement
- Before PR handoff, run and record:
  - `git status --short --branch`
  - `git diff <base-branch>...HEAD`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm run audit`
  - `pnpm check`
  - `bash scripts/validate-codestyle.sh`
  - `bash scripts/verify-work.sh --fast`
- Validation evidence MUST use:
  - `Command: <exact command> -> pass|fail|blocked (<reason>)`
