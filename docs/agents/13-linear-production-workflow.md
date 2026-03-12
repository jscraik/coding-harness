# Linear production workflow

## Table of Contents

- [Purpose](#purpose)
- [Operating model](#operating-model)
- [Intake rules](#intake-rules)
- [Issue types and labels](#issue-types-and-labels)
- [Execution flow](#execution-flow)
- [Harness command surface](#harness-command-surface)
- [System boundaries](#system-boundaries)
- [Definition of done](#definition-of-done)
- [Manual workspace follow-ups](#manual-workspace-follow-ups)

## Purpose

This document defines the production workflow for coding-harness work tracked in Linear and executed through coding-harness, Codex, and GitHub pull requests.

## Operating model

- **Linear** is the system of record for bugs, features, policy gaps, workflow regressions, automation work, orchestration work, and release tasks.
- **coding-harness** is the execution and policy engine that validates work, collects evidence, and enforces handoff rules.
- **GitHub** remains the source of truth for branches, pull requests, CI, reviews, and merge history.
- **GitHub Issues are not the default intake path** for this repository.
- The repo-level GitHub issue-form entry points are retired and replaced with Linear/docs/security contact links.

## Intake rules

1. Open or update a **Linear issue** for every reproducible repository bug, feature request, policy gap, workflow regression, automation task, or release follow-up.
2. Reuse an existing Linear issue when the work matches an active or historical item.
3. Include enough context for a new agent or reviewer to act without reconstructing intent:
   - repro steps when applicable,
   - expected vs actual behavior,
   - validation evidence,
   - relevant repo doc links,
   - linked PR/branch/commit once implementation starts.
4. Prefer project-scoped work in the `coding-harness` Linear project and avoid ad hoc tracking outside the project unless the item is clearly cross-project.

## Issue types and labels

Use the existing core labels:

- `Bug`
- `Feature`
- `Improvement`
- `Docs`
- `Research`
- `Refactor`
- `Infra`
- `Chore`
- `Security`

Use the workflow labels for orchestration/reporting when relevant:

- `Blocked`
- `Automation`
- `Policy`
- `Agent`
- `Release`

## Execution flow

1. Start from a Linear issue in the `coding-harness` project.
2. Create a branch using the required `codex/` prefix and include the Linear issue key where practical.
3. Move the issue to `In Progress` when implementation starts.
4. Keep a single running progress update on the issue instead of scattering status across multiple comments.
5. Attach the PR, branch, commit, and validation evidence before moving the issue to `In Review`.
6. Move the issue to `Done` only after merge and required checks have passed.
7. If the work is blocked by missing auth, permissions, or human input, keep the issue active, mark it clearly as blocked, and record the unblock action.
8. If a PR is closed without merge, return the issue to an active state (for example `In Progress`) with a note describing why the PR lane was abandoned.

## Harness command surface

The repository now includes a Linear-first CLI surface for the common workflow transitions:

```bash
harness linear prepare --issue JSC-37 --field branch
harness linear-gate --branch codex/jsc-37-enable-github-to-linear-branch-and-pr-automation-for-the --pr-title "JSC-37: Enable GitHub to Linear branch and PR automation" --pr-body "Refs JSC-37"
harness linear claim --issue JSC-36 --branch codex/jsc-36-linear-claim --workspace /path/to/worktree
harness linear handoff --issue JSC-36 --pr-url https://github.com/org/repo/pull/123 --evidence-url https://example.com/evidence.json
harness linear close --issue JSC-36 --pr-url https://github.com/org/repo/pull/123
```

Operational notes:

- `prepare` generates repo-safe GitHub metadata from the Linear issue:
  - branch: `codex/<linear-key>-<slug>`
  - PR title: `<LINEAR-KEY>: <issue title>`
  - link line: `Refs <LINEAR-KEY>`
  - closing line: `Fixes <LINEAR-KEY>`
- `linear-gate` enforces the contract-level policy offline in CI or locally:
  - `package.json` must point `bugs.url` at the Linear project when required
  - `.github/ISSUE_TEMPLATE/config.yml` must retire public GitHub issue intake and point to Linear
  - branch names must keep the configured prefix and include the Linear issue key
  - PR titles/bodies must include the Linear key plus the required `Refs`/`Fixes` reference line
- `claim` defaults to assigning the issue to the current Linear API user unless `--no-assign` is set.
- `handoff` moves the issue to `In Review`, posts a workflow comment, and can attach PR/evidence/reference URLs.
- `close` moves the issue to `Done`, posts a closure comment, and can attach the merge PR/evidence URLs.
- Set `LINEAR_API_KEY` in the runtime environment or pass `--token` explicitly.
- Use `--state` when a team/project uses a non-standard state name.
- When you want GitHub merge activity to close the Linear issue automatically, put `Fixes <LINEAR-KEY>` in the PR body or title.
- When you only want linking without merge-time closeout, use `Refs <LINEAR-KEY>` instead.
- For predictable GitHub→Linear linking, branches should keep the required `codex/` prefix **and** include the Linear issue key, for example `codex/jsc-37-enable-github-to-linear-branch-and-pr-automation-for-the`.
- `.github/workflows/linear-pr-sync.yml` mirrors PR lifecycle events into Linear when `LINEAR_API_KEY` is configured:
  - `opened`/`reopened` → `harness linear handoff` (`In Review`)
  - `closed` + merged → `harness linear close` (`Done`)
  - `closed` + not merged → `harness linear claim --state "In Progress" --no-assign`
  - fail-closed behavior: if multiple Linear keys are detected in PR metadata, automation stops and reports ambiguity.

## System boundaries

- Use **Linear** for intake, ownership, prioritization, delegation, and status.
- Use **GitHub** for PR discussion, CI signals, code review artifacts, and merge provenance.
- Use repo docs under `docs/` and `todos/` for durable technical detail that would be too verbose or volatile to duplicate in tracker fields.

## Definition of done

Before a coding-harness issue is ready for review:

- the linked branch/PR exists,
- required validation commands have been run (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm check`),
- CI gates pass including `docs-gate` for documentation parity,
- evidence is attached or summarized,
- blockers and risks are explicit,
- the reviewer can continue without re-deriving context.

## Manual workspace follow-ups

These items should be configured in the Linear UI as workspace/team administration tasks:

- issue templates for Bug, Feature, Research, Automation, and Release,
- saved views for Triage, Ready, In Progress, In Review, Blocked, and Delegated,
- git automation to assign/move issues when branch names are copied,
- GitHub integration connected to the matching Linear user so branch and PR events resolve back to the correct workspace identity,
- optional `Blocked` workflow status if status-level reporting is preferred over labels.
