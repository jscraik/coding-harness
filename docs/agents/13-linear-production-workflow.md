---
last_validated: 2026-04-18
doc_schema: coding-harness-doc/v1
doc_type: lifecycle
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - coding-harness-maintainer
  - release-operator
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - linear-workflow-change
  - issue-state-change
  - pr-lifecycle-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/lifecycle/issue-to-main.md
  - docs/agents/19-linear-templates.md
  - .harness/README.md
---

# Linear production workflow

## Table of Contents

- [Purpose](#purpose)
- [Abbreviations](#abbreviations)
- [Metadata](#metadata)
- [Invariants](#invariants)
- [States](#states)
- [Transition Table (Canonical)](#transition-table-canonical)
- [Error Handling](#error-handling)
- [Idempotency](#idempotency)
- [Execution Modes](#execution-modes)
- [Dry-Run Simulation](#dry-run-simulation)
- [Observability Logs](#observability-logs)
- [Validation Checklist](#validation-checklist)

## Purpose

This document defines the production workflow for coding-harness work tracked in Linear and executed through coding-harness, Codex, and GitHub pull requests.

For the wider issue-to-main operating model, including spec, plan,
implementation, review, PR checks, merge, main sync, and feedback loops, see
[issue-to-main lifecycle](../lifecycle/issue-to-main.md).

## Setup boundary

This document owns lifecycle and transition behavior. Linear setup payloads
(templates, saved views, and blocked-routing setup details) are owned by
`docs/agents/19-linear-templates.md`.

## Operating model

- **Linear** is the system of record for bugs, features, policy gaps, workflow regressions, automation work, orchestration work, and release tasks.
- **coding-harness** is the execution and policy engine that validates work, collects evidence, and enforces handoff rules.
- **GitHub** remains the source of truth for branches, pull requests, CI, reviews, and merge history.
- **GitHub Issues are not the default intake path** for this repository.
- The repo-level GitHub issue-form entry points are retired and replaced with Linear/docs/security contact links.

## Abbreviations

| Abbr | Meaning |
| --- | --- |
| `LI` | Linear issue |
| `LK` | Linear issue key (example: `JSC-37`) |
| `PR` | Pull request |
| `S` | State |
| `E` | Event |
| `G` | Guard |
| `A` | Action |
| `N` | Next state |
| `DoD` | Definition of done |

## Metadata
| Field | Value |
| --- | --- |
| `owner` | `coding-harness-maintainers` |
| `max_duration` | `1 issue lifecycle` |
| `escalation` | `set Blocked marker with explicit unblock action` |

## Invariants
- Exactly one running LI progress thread per issue.
- Branch format is `codex/<lk>-<slug>`.
- `S2 IN_PROGRESS -> S3 IN_REVIEW` requires DoD pre-review checks.
- `pr_closed_unmerged` always routes back to active work.
- `Blocked` is a label overlay on active workflow states; it is not a canonical workflow state.
- Triage promotion is bounded by lane and cycle feasibility guards before mutation.

## States
```txt
S0 TRIAGE (non-terminal)
S1 READY (non-terminal)
S2 IN_PROGRESS (non-terminal)
S3 IN_REVIEW (non-terminal)
S4 DONE (terminal)
S5 FAIL (terminal)
```

### Blocked overlay (label-based)

- `Blocked` can be applied to `S1 READY`, `S2 IN_PROGRESS`, or `S3 IN_REVIEW`.
- Blocked/unblocked events update labels and unblock guidance, but keep the canonical status lane unchanged.

### FAIL lane (canonical state)

- `S5 FAIL` is a canonical terminal state for unrecoverable `VALIDATION_ERROR`,
  `POLICY_FAIL`, or unrecoverable `SYSTEM_ERROR`.
- Entering `S5 FAIL` records a failure packet with remediation guidance and
  requires explicit operator re-entry via triage or ready flow after remediation.

## Transition Table (Canonical)

`S | E | G | A | N`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| `S0 TRIAGE` | `scoped` | issue has clear next action | move LI to ready queue | `S1 READY` |
| `S1 READY` | `start` | branch created with `codex/` + `LK` | `harness linear claim --issue <LK> --branch <name>` | `S2 IN_PROGRESS` |
| `S2 IN_PROGRESS` | `progress_tick` | always | update single running LI comment | `S2 IN_PROGRESS` |
| `S2 IN_PROGRESS` | `pr_opened` | PR URL available | attach PR URL to LI | `S2 IN_PROGRESS` |
| `S2 IN_PROGRESS` | `handoff_ready` | DoD pre-review checks pass | `harness linear handoff --issue <LK> --pr-url <url> --evidence-url <url[,url]>` | `S3 IN_REVIEW` |
| `S3 IN_REVIEW` | `merged` | required checks pass | `harness linear close --issue <LK> --pr-url <url>` | `S4 DONE` |
| `S3 IN_REVIEW` | `pr_closed_unmerged` | PR closed without merge | `harness linear claim --issue <LK> --state "In Progress" --no-assign` and add rationale note | `S2 IN_PROGRESS` |
| `S1 READY` | `blocked` | missing auth, permission, or human input | add `Blocked` marker and unblock action | `S1 READY` |
| `S2 IN_PROGRESS` | `blocked` | missing auth, permission, or human input | add `Blocked` marker and unblock action | `S2 IN_PROGRESS` |
| `S3 IN_REVIEW` | `blocked` | missing auth, permission, or human input | add `Blocked` marker and unblock action | `S3 IN_REVIEW` |
| `S1 READY` | `unblocked` | dependency resolved | remove blocker marker and resume execution | `S1 READY` |
| `S2 IN_PROGRESS` | `unblocked` | dependency resolved | remove blocker marker and resume execution | `S2 IN_PROGRESS` |
| `S3 IN_REVIEW` | `unblocked` | dependency resolved | remove blocker marker and resume execution | `S3 IN_REVIEW` |
| `S1 READY` | `fail` | unrecoverable `VALIDATION_ERROR`, `POLICY_FAIL`, or `SYSTEM_ERROR` | record failure packet + remediation path; halt transition automation | `S5 FAIL` |
| `S2 IN_PROGRESS` | `fail` | unrecoverable `VALIDATION_ERROR`, `POLICY_FAIL`, or `SYSTEM_ERROR` | record failure packet + remediation path; halt transition automation | `S5 FAIL` |
| `S3 IN_REVIEW` | `fail` | unrecoverable `VALIDATION_ERROR`, `POLICY_FAIL`, or `SYSTEM_ERROR` | record failure packet + remediation path; halt transition automation | `S5 FAIL` |

## Error Handling
- `VALIDATION_ERROR`: missing/invalid LK or malformed branch/PR metadata.
- `BLOCKED_DEPENDENCY`: missing permission, auth, or required human input.
- `POLICY_FAIL`: required checks/docs-gate/branch policy fail.
- `SYSTEM_ERROR`: CLI/API failures while executing transition actions.

## Idempotency
- Key: `<LK>|<state>|<event>|<pr_url?>`.
- Replayed `progress_tick` and `pr_opened` events must update existing LI progress comment/attachment artifacts by idempotency key; duplicate artifacts must not be created.
- Replayed `handoff_ready` events must be guarded by a successful transition marker and should update existing evidence artifacts by idempotency key; do not replay `handoff_ready` after success unless duplicates are explicitly acceptable for that workflow.

## Execution Modes
- `STRICT`: fail on validation/policy errors and block transition.
- `ADVISORY`: emit warning artifacts and continue where safe.

## Dry-Run Simulation
- No stateful writes to Linear/GitHub and no side effects.
- Guards and transition selection run deterministically.
- Emit deterministic transition trace output for review.

## Observability Logs
```json
{
  "workflow_id": "linear-production-workflow",
  "transition_code": "S2:handoff_ready",
  "from_state": "S2 IN_PROGRESS",
  "to_state": "S3 IN_REVIEW",
  "correlation_id": "JSC-37:PR-123",
  "result": "success|blocked|failed"
}
```

## Validation Checklist
- non-terminal states have >=1 outbound transition
- deterministic event resolution per `(S,E)`
- failure events route deterministically to blocked overlay (`blocked`/`unblocked`) or canonical `S5 FAIL` lane
- terminal states have no outbound transitions
- DoD gate enforced before review transition

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

Type-label contract:

- every issue should carry exactly one primary type label from the core label set.
- if a triage candidate has no primary type label, `harness linear triage` infers one and reports it.
- in apply mode, `harness linear triage --apply` adds missing primary type labels to triage candidates before/while promotion updates.

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
harness linear triage --team JSC --limit 10 --json
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
- `triage` provides deterministic ranking and apply guards from the codified triage strategy:
  - score formula: `(3*impact) + (3*unblock_value) + (2*urgency) + confidence - (2*effort)`
  - promotion bands: `pull_now` (`>=13`) and `next_pull` (`10-12`)
  - default guards: metadata threshold `0.8`, global in-progress cap `3`, max promotions per run `2`
  - cycle guard: promotion writes are blocked when proposed moves exceed feasible cycle throughput
  - safety: apply mode requires `--confirm` when mutating more than one issue
  - label hygiene: missing type labels are added by default in apply mode (use `--no-type-label-sync` to opt out)
- `handoff` moves the issue to `In Review`, posts a workflow comment, and can attach PR/evidence/reference URLs.
- `close` moves the issue to `Done`, posts a closure comment, and can attach the merge PR/evidence URLs.
- Set `LINEAR_API_KEY` in the runtime environment (for example, `export LINEAR_API_KEY=...`) or pass `--token` explicitly.
- If you keep secrets in `~/.codex/.env`, load that file into the active shell/session before running `harness linear*` commands.
- When Linear secret discovery behavior changes, run `harness symphony-check` and include its output in validation evidence.
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
- Use repo docs under `docs/` and archived completed issue backlog entries for durable technical detail that would be too verbose or volatile to duplicate in tracker fields.

## Definition of done

Before a coding-harness issue is ready for review:

- the linked branch/PR exists,
- required validation commands have been run (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm check`),
- CI gates pass including `docs-gate` for documentation parity,
- evidence is attached or summarized,
- blockers and risks are explicit,
- the reviewer can continue without re-deriving context.

## Manual workspace follow-ups

Linear UI setup and workspace payload details are maintained in
`docs/agents/19-linear-templates.md`:

- issue templates for Bug, Feature, Research, Automation, and Release
- saved views for Triage, Ready, In Progress, In Review, Blocked, and Delegated
- blocked-routing setup conventions (`Blocked` label overlay and related guidance)
