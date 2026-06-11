# Codex Runtime Evidence Verifier Cockpit Execution Tracker

## Table of Contents

- [Purpose](#purpose)
- [Current Control Surface](#current-control-surface)
- [Active Route](#active-route)
- [Active Slice](#active-slice)
- [Outstanding Work](#outstanding-work)
- [History Boundary](#history-boundary)
- [Resume Gate](#resume-gate)
- [Linear Update Payload](#linear-update-payload)

## Purpose

This tracker is the thin execution surface for restarting the JSC-363 goal. It
does not replace `goal.md`, `state.yaml`, or `receipts.jsonl`; it compresses
their current operational truth so old route history and context debt do not
drive the next implementation decision.

Mantra: thin surface, strong guardrails, durable memory, professional output.

## Current Control Surface

| Field               | Current Truth                                                |
| ------------------- | ------------------------------------------------------------ |
| Parent issue        | JSC-363                                                      |
| Canonical goal      | `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` |
| Current branch      | `main` pulled and branch/worktree cleanup complete           |
| Local main head     | `68c8019515641f4fe2ff8ada917d4f2b1a170b1e`                   |
| Origin main head    | `68c8019515641f4fe2ff8ada917d4f2b1a170b1e`                   |
| Main baseline       | `68c8019515641f4fe2ff8ada917d4f2b1a170b1e`                   |
| Active route count  | 1                                                            |
| Active route        | Remaining closeout/backlog audit                             |
| Last closed route   | PR #404 merged                                               |
| Current route       | Post-PR404 current-main audit route                          |
| Current slice       | Audit remaining goal/spec/backlog obligations                |
| Feature work status | No next feature slice started                                |

## Active Route

PR #404 is merged and local `main` plus `origin/main` are synced at
`68c8019515641f4fe2ff8ada917d4f2b1a170b1e`. This tracker refresh closes the
post-PR403 route-truth refresh and makes the remaining closeout/backlog audit the
active route. It does not claim Linear field-text currency, root-hygiene proof,
documentation accuracy, Judge/PM readiness, release readiness, or parent-goal
completion.

Current evidence:

- Local `main` and `origin/main` were synced at
  `68c8019515641f4fe2ff8ada917d4f2b1a170b1e` after PR #404 was merged and
  pulled back.
- Live GitHub reported PR #404 merged at `2026-06-11T10:52:14Z` from submitted
  head `1b1a292f3009a49f422286d9a65cb4fc7e3fc254` as squash merge commit
  `68c8019515641f4fe2ff8ada917d4f2b1a170b1e`; repo-owned CircleCI,
  aggregate `pr-pipeline`, aggregate `security-scan`, Socket, CodeRabbit,
  and review-thread checks passed or resolved before merge. The external
  `security/snyk (jscraik)` GitHub App quota/error lane remains owner-waived
  only for that external app status.
- Live GitHub reported zero open pull requests at this pullback refresh point.
- Local cleanup removed obsolete auxiliary worktrees and stale local/remote
  `codex/*` branches; only `main` and `origin/main` remain.
- Earlier Linear JSC-363 evidence recorded status `In Review`, Phase 1
  title/description text, and repo-truth comment
  `81cfdd41-ff0e-4df1-b884-c01789e30a50`. This tracker refresh does not claim a
  fresh Linear fetch, Linear field-text currency, or parent-goal completion.
- Next safe action: run the remaining closeout/backlog audit and state the next
  exact implementation slice or blocker.
- Historical PR details remain in `receipts.jsonl`; they are not active restart
  instructions.

## Active Slice

Selected next slice: `PU-055 current-main closeout evidence matrix`.

This is an audit and route-decision slice, not runtime feature implementation.
It must reconcile current `main` against the goal, plan, spec, adopted audit
sources, receipts, tracker state, docs, Linear field state, review coverage,
and closeout packet requirements. Its output must be one of these:

- a single bounded implementation slice with required gates and owner/blocker
  decisions
- a current blocker with owner-visible evidence
- a Judge/PM-ready packet only if every required lane is proven current

Non-claims:

- This tracker does not prove root-hygiene evidence, Judge/PM readiness, Linear
  field-text currency, PR merge readiness, release readiness, or parent goal
  completion.
- Historical PR lanes do not become active work unless fresh current-main
  evidence reopens them.

## Outstanding Work

Current next slice:

- Run `PU-055 current-main closeout evidence matrix` before feature work.

The matrix must classify each remaining lane below as `complete`, `blocked`,
`not applicable`, or `next implementation slice` with evidence refs:

- Prove review-state, external-state, and root-hygiene closeout surfaces from
  current evidence.
- Complete documentation accuracy checks.
- Resolve or owner-accept Linear field-text currency for JSC-363.
- Complete historical review-coverage backfill.
- Produce PU-015 Judge/PM audit packet.
- Run final requirement-by-requirement completion audit.

## History Boundary

Merged PR lanes through PR #383 remain provenance. They are not active route
lanes and must not be expanded in the active board unless a fresh current-main
regression reopens them.

Receipt history remains append-only. New receipts should be compact
claim/evidence/blocker records, not narrative diary entries.

## Resume Gate

Feature implementation remains stopped until all of these are true:

- PR #404 is merged into local `main` and `origin/main`, both synced at
  `68c8019515641f4fe2ff8ada917d4f2b1a170b1e`.
- Live GitHub reports zero open PRs for `jscraik/coding-harness` at this
  refresh point.
- Linear JSC-363 has repo-truth comment
  `81cfdd41-ff0e-4df1-b884-c01789e30a50`, but field-text currency remains a
  separate unclaimed lane.
- `goal.md`, `state.yaml`, `notes/execution-tracker.md`,
  `.harness/active-artifacts.md`, the tracker board, and `receipts.jsonl`
  validate together after the merge pull-back.
- The remaining closeout/backlog audit records the exact next bounded slice or
  blocker.

## Linear Update Payload

Use this payload only after Linear access is available or an owner explicitly
approves posting the blocker classification for JSC-363:

```md
Refreshed JSC-363 current-main route truth after PR #404 merge and recorded
that the remaining closeout/backlog audit is now active.

Current truth:

- Active route lane: remaining closeout/backlog audit from current main.
- Latest merged route: PR #404.
- Local main head: 68c8019515641f4fe2ff8ada917d4f2b1a170b1e.
- Origin main head: 68c8019515641f4fe2ff8ada917d4f2b1a170b1e.
- Repo-owned required checks for PR #404 passed before merge.
- Live GitHub reports zero open PRs at this refresh point.
- PU-013 runtime cockpit integration proof is merged and pulled back to local `main`.
- PR #404 remains separate from runtime, CI, review, Linear, and parent goal completion claims.
- No production code patch was required; current main already projects Codex runtime evidence into `runtime-card` and consumes it narrowly through `harness next`.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.
- Linear JSC-363 has repo-truth comment `81cfdd41-ff0e-4df1-b884-c01789e30a50`; field-text currency remains unclaimed until a fresh Linear fetch or owner classification is recorded.

Restart rule:
The next selected slice is `PU-055 current-main closeout evidence matrix`. It
starts only after this post-PR404 tracker refresh validates from current main,
and it must state the exact next bounded implementation slice or blocker before
any feature work resumes.
```
