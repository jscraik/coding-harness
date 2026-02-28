# Contributing

## Table of Contents

- [Minimum workflow contract](#minimum-workflow-contract)
- [Why this workflow exists](#why-this-workflow-exists)
- [Branching and PR rule](#branching-and-pr-rule)
- [Required pre-merge gates](#required-pre-merge-gates)
- [One-click review workflow](#one-click-review-workflow)
- [Recommended GitHub branch protection settings](#recommended-github-branch-protection-settings)
- [Reviewer setup (solo dev friendly)](#reviewer-setup-solo-dev-friendly)

## Minimum workflow contract

This repository is maintained with a hard rule:

- No direct pushes to `main`.
- Every code change goes through a dedicated branch and a pull request.
- Every PR must include local verification + review artifacts before merge.

## Why this workflow exists

In 2026, the accepted baseline for auditable software delivery remains:

1. isolate work on a branch,
2. run required checks before merge,
3. require peer tooling review (human or automated),
4. merge only after checks + reviews pass.

This protects history, simplifies rollback, and provides a review trail even for solo projects.

## Branching and PR rule

### Branch and PR workflow

1. Create a branch/worktree per task:

   - Agent-created branch: `git switch -c codex/<short-description>`
   - Agent-created worktree: `git worktree add ../tmp-worktree -b codex/<short-description>`
   - Human-authored optional prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`.

2. Make targeted changes and keep commits small and atomic.

3. Run required local gates before opening the PR.

4. Open a PR:

   - `gh pr create --base main --head <branch> --title "..." --body "..."`.

5. Merge only after:

   - required checks pass,
   - Greptile review is completed,
   - Codex review is completed,
   - PR description/checklist is complete.

6. After merge, delete the remote branch and clean up any local worktree/branch copy.

### Branch name policy

- Use lower-case, kebab-case slugs.
- Agent-created branches must use `codex/<short-description>`.
- Human-authored branches may use: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`.
- Avoid `main`-like names and do not include secrets or issue-pii.

## Required pre-merge gates

For behavior-affecting changes:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm audit`
- `pnpm check`

For docs-only edits, run at minimum:

- `pnpm lint` (if docs lint is enabled),
- `pnpm typecheck` if any types or imports changed.

## One-click review workflow

Use this checklist per task:

1. Open PR with a complete title/body.
2. Run and paste local gate output:

   - `pnpm check`
   - `pnpm test:artifacts` (if requested by maintainer)

3. Capture review artifacts:

   - Greptile review result reference (URL or report file),
   - Codex review result reference (URL or report file).

4. Fix findings, re-run gates, and update artifacts.
5. Merge only after all checklist items are checked.

## Recommended GitHub branch protection settings

Configure repository settings on `main` to make the workflow enforceable:

- Require PRs before merging.
- Require at least one review before merge.
- Require status checks:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm audit`
  - `pnpm check`
- Dismiss stale approvals when new commits are pushed.
- Restrict pushes to `main` to `main` repository settings/admin workflows only.
- Optionally require signed commits if your policy requires it.

## Reviewer setup (solo dev friendly)

Yes, this is still valid for solo development.

- You can use Greptile and Codex as review providers and record their outputs in the PR.
- If automated review is unavailable for a moment, block merge by leaving an explicit PR checklist item unchecked.
- Keep a clear audit trail: every PR should show what changed, what failed, and what was fixed.
