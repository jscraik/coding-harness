---
date: 2026-05-30
report_type: delivery-lifecycle-implementation-plan
status: advisory
repo: coding-harness
branch: codex/jsc-363-intermediary-receipt-coverage
---

# Delivery Lifecycle Implementation Plan

## Objective

Convert findings into an execution-complete plan with owners, sequencing, acceptance checks, and measurable exits.

## Source

Plan derived from [delivery-lifecycle-audit](/Users/jamiecraik/dev/coding-harness/.harness/audits/2026-05-30-delivery-lifecycle-audit.md).

## Scope

This plan is active for the next two implementation rounds unless re-baselined. It targets the top three throughput bottlenecks and tracks completion status for each.

## Governance and Update Rule

1. Owner for execution: delivery operator.
2. Update frequency: one update per workday.
3. Hard stop: no high-impact item may sit blocked for more than 72 hours without an updated blocker owner and next unblock action.

## Work Item Queue

1. Work item 1: External Truth Reconciliation Pipeline
2. Throughput impact: very high
3. Status: in progress
4. Work owner: runtime operator
5. Work entering: PR closeout, handoff, and reopen events from Linear and review lanes.
6. Work leaving: fewer closeout blockers and predictable status before resume.
7. Acceptance:
    - Add a compact snapshot artifact covering local validation, PR metadata, CI state, review state, external-state freshness, and judge/PM state.
    - Tag stale evidence classes in one place (stale-pr-metadata, stale-ci, stale-review, stale-linear, stale-external).
    - Add handoff-required evidence pointers with evidence ref, freshness, and source-of-truth.
8. Exit criteria:
    - A resumed PR can move from handoff to next action without manual cross-tool state reconstruction.

2. Work item 2: Root and Worktree Drift Guardrails
3. Throughput impact: very high
4. Status: complete
5. Work owner: platform operator
6. Work entering: all slices moving into implementation.
7. Work leaving: fewer merge-conflict-style rollbacks and fewer false local-blocker claims.
8. Acceptance:
    - Add a pre-implementation checkpoint note with branch state, drift state, ahead/behind, and worktree role.
    - Add explicit branch intent options: clean, dirty-with-justification, fresh-worktree.
    - Add one-line drift-check recipe in onboarding and handoff records.
9. Exit criteria:
    - New work starts from clean or intentionally justified context.

3. Work item 3: Review Queue and Independent Approval Compression
4. Throughput impact: high
5. Status: in progress
6. Work owner: review coordinator
7. Work entering: items waiting in IN_REVIEW for external approvals.
8. Work leaving: reduced review dwell and clear transfer ownership.
9. Acceptance:
    - Standardize unresolved artifact naming and status fields.
    - Include waiting owner, unblock action, and next-check timestamp in handoff artifacts.
    - Track unresolved thread count by owner instead of relying on binary resolved state.
10. Exit criteria:
    - Review-ready PRs have no unresolved artifact-gating blockers.

## Completion Backlog (Ranked)

1. Evidence snapshot schema and generation step (status: not started).
2. Worktree checkpoint and exception path (status: complete).
3. Review artifact naming convention (status: not started).
4. Arrival-rate and age metrics capture (status: not started).
5. Cross-lane blockage taxonomy in handoff artifact (status: not started).

## Queue Signal Definitions

1. arrival_rate: new entries per queue per half-day.
2. leave_rate: exits per queue per half-day.
3. hold_reason: blocked class.
4. queue_age_p95: p95 age in queue, hours.
5. queue_age_max: oldest item age, hours.
6. cost_of_delay: delay proxy using blocked SLA, review staleness, and release hold impact.

## Cadence

1. Daily queue review: update arrival_rate, hold_reason, and blocker owners.
2. End-of-day checkpoint: record leave_rate and queue_age values.
3. Weekend triage: promote anything held over three days.
4. Restart rule: block any very high-impact item from staying unscheduled past one week.

## Handoff Template (Required)

1. current queue
2. queue entry timestamp
3. blocker class
4. assigned owner
5. earliest unblock action
6. per-lane evidence freshness

## Completion Status

1. Work item 1: external truth snapshot - in progress
2. Work item 2: worktree drift guardrails - complete
3. Work item 3: review queue compression - in progress
