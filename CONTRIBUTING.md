# Contributing

## Table of Contents

- [Minimum workflow contract](#minimum-workflow-contract)
- [Why this workflow exists](#why-this-workflow-exists)
- [Branching and PR rule](#branching-and-pr-rule)
- [Required pre-merge gates](#required-pre-merge-gates)
- [Greptile setup baseline](#greptile-setup-baseline)
- [Greptile config hierarchy](#greptile-config-hierarchy)
- [Greptile merge logic for multi-scope PRs](#greptile-merge-logic-for-multi-scope-prs)
- [Greptile confidence score policy](#greptile-confidence-score-policy)
- [Greptile strictness policy](#greptile-strictness-policy)
- [Greptile training and feedback loop](#greptile-training-and-feedback-loop)
- [Recommended security scanner baseline](#recommended-security-scanner-baseline)
- [Benchmark cadence and artifacts](#benchmark-cadence-and-artifacts)
- [One-click review workflow](#one-click-review-workflow)
- [Credential-safe evidence snippets](#credential-safe-evidence-snippets)
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
   - Human-authored prefixes (when not using `codex/`): `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`.

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
- `dependency-review` GitHub Actions check
- `actions-pinning` GitHub Actions check
- `security-scan` GitHub Actions check (gitleaks + trivy + semgrep)

For docs-only edits, run at minimum:

- `pnpm lint` (if docs lint is enabled),
- `pnpm typecheck` if any types or imports changed.

## Greptile setup baseline

- Greptile must be configured correctly before relying on Greptile review gates.
- Use the `grepfile` skill to set up/refresh all required Greptile files for this repository.
- If Greptile files are missing or stale, treat the review gate as blocked and do not merge.
- Required local structure:
  - `.greptile/config.json`
  - `.greptile/rules.md`
  - `.greptile/files.json`
- Independent validation is mandatory: the coding agent cannot approve its own changes.

## Greptile config hierarchy

When settings conflict, use this precedence (highest first):

1. Org-enforced rules from the Greptile dashboard.
2. Directory-scoped `.greptile/` folders (cascading inheritance).
3. `greptile.json` legacy repo-wide config (ignored if `.greptile/` exists in the same directory).
4. Dashboard defaults.

## Greptile merge logic for multi-scope PRs

For PRs touching multiple directories with different configs:

- Strictness: use the most restrictive value (`MAX`).
- `fileChangeLimit`: use the smallest value (`MIN`).
- Comment types: union all requested comment types.
- Boolean settings: if any scope enables it, treat as enabled (`OR`).

## Greptile confidence score policy

Use confidence score as a merge gate signal:

- `5/5`: production-ready, merge allowed.
- `4/5`: minor polish, merge allowed after non-logic fixes.
- `3/5`: implementation issues, must address feedback and re-review.
- `2/5`: significant bugs, blocked.
- `0-1/5`: critical issues, blocked.

## Greptile strictness policy

- Level 1 (Verbose): required for security-critical directories and new project setup.
- Level 2 (Default): required baseline for PRs targeting `main`/production branches.
- Level 3 (Critical-only): reserved for stable, non-critical internal infrastructure.

Important indexing caveat:

- `ignorePatterns` excludes files from review only; it does **not** exclude indexing.
- Large binaries/assets and `node_modules` must be excluded at repository/dashboard indexing level.

## Greptile training and feedback loop

- Developers must provide regular 👍/👎 feedback on review comments.
- A 👎 should include a brief rationale to train the system.
- Commit analysis and the 3-ignore rule are active signals and must be respected.
- New repositories should expect a 2-3 week calibration period.

Manual trigger standards:

- Use `@greptileai` on draft PRs or when settings/context changed and a forced re-review is needed.
- Use targeted prompts for scoped checks (for example: `@greptileai check for memory leaks`).

## Recommended security scanner baseline

For repositories that use Harness, recommend installing these scanners as project prerequisites:

- Gitleaks
- Trivy
- Semgrep

Recommended policy:

- Keep scanner binaries available in local development environments and CI runners.
- Run scanner checks in CI on pull requests and pushes to protected branches.
- Treat scanner findings as merge blockers unless explicitly waived with rationale.
- Keep the canonical `security-scan` workflow aligned to this exact trio (`gitleaks`, `trivy`, `semgrep`).

## Benchmark cadence and artifacts

Use benchmark artifacts as release evidence:

- Run the SWE benchmark track at least weekly on `main`.
- Run the benchmark track again before release tags.
- Store run artifacts using `scripts/benchmarks/run-swe-track.sh` and validate output
  against `docs/benchmarks/schema/benchmark-run.schema.json`.

## One-click review workflow

Use this checklist per task:

1. Open PR with a complete title/body.
2. Run and paste local gate output:

   - `pnpm check`
   - `pnpm test:artifacts` (if requested by maintainer)

3. Capture review artifacts:

   - Greptile review result reference (URL or report file),
   - Codex review result reference (URL or report file),
   - Greptile confidence score for the PR,
   - confirmation that reviewer agent is independent from coding agent.

4. Fix findings, re-run gates, and update artifacts.
5. Merge only after all checklist items are checked and confidence policy allows merge.

## Credential-safe evidence snippets

- Never use command substitution in commit messages, PR bodies, or evidence notes for secrets.
- Do **not** use `$(gh auth token)` (or similar) inside `git commit -m ...` / `gh pr create --body ...`.
- Use placeholders in text output:
  - ✅ `$GITHUB_TOKEN`
  - ✅ `${GITHUB_TOKEN}`
  - ❌ expanded token values
- If a token value is ever exposed in commit/PR text, treat it as compromised: rotate/revoke, rewrite history where applicable, and document remediation in the issue/PR.

## Recommended GitHub branch protection settings

Configure repository settings on `main` to make the workflow enforceable:

- Bootstrap baseline via harness:
  - `harness branch-protect --owner <owner> --repo <repo>`
- Token resolution for `branch-protect`:
  - `--token <PAT>` or env `GITHUB_TOKEN` / `GITHUB_PERSONAL_ACCESS_TOKEN`
- Require PRs before merging.
- Require at least one review before merge.
- Require status checks:
  - `pr-template`
  - `risk-policy-gate`
  - `dependency-review`
  - `actions-pinning`
  - `consistency-drift-health`
  - `lint`
  - `typecheck`
  - `test`
  - `audit`
  - `check`
  - `memory`
  - `security-scan`
  - `Greptile Review`
- Require workflows to pin third-party actions to full commit SHAs.
- Configure required checks workflows to run on both `pull_request` and `merge_group` when using merge queue.
- Dismiss stale approvals when new commits are pushed.
- Restrict pushes to `main` to `main` repository settings/admin workflows only.
- Optionally require signed commits if your policy requires it.

## Reviewer setup (solo dev friendly)

Yes, this is still valid for solo development.

- You can use Greptile and Codex as review providers and record their outputs in the PR.
- If automated review is unavailable for a moment, block merge by leaving an explicit PR checklist item unchecked.
- Keep a clear audit trail: every PR should show what changed, what failed, and what was fixed.
