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
- Use explicit comparison ranges when summarizing change scope:
  - `git diff <base-branch>...HEAD`
- Do not bypass hooks or governance checks with `--no-verify`.

## Commit discipline
- Commit messages MUST follow the repository commit contract in [04-docs-config-and-release.md](./04-docs-config-and-release.md).
- Keep commits atomic: one logical change per commit.
- Commit validation claims MUST be evidence-backed and match commands actually run.

## Pull request discipline
- PR summaries MUST cover the full branch delta, not only the latest commit.
- PR descriptions MUST follow `.github/PULL_REQUEST_TEMPLATE.md` exactly.
- Testing sections MUST include exact commands and outcomes.
- If checks are blocked, record concrete blocker reasons rather than placeholders.

## Enforcement
- Before PR handoff, run and record:
  - `git status --short --branch`
  - `git diff <base-branch>...HEAD`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `bash scripts/verify-work.sh --fast`
- Validation evidence MUST use:
  - `Command: <exact command> -> pass|fail|blocked (<reason>)`
