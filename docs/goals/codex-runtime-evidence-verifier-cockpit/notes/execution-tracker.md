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

| Field               | Current Truth                                                   |
| ------------------- | --------------------------------------------------------------- |
| Parent issue        | JSC-363                                                         |
| Canonical goal      | `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`    |
| Current branch      | `main` pulled, tracker refresh branch active                    |
| Local main head     | `fd750626ece4d1f3786ef564485dd8c7d2c04230`                      |
| Origin main head    | `fd750626ece4d1f3786ef564485dd8c7d2c04230`                      |
| Main baseline       | `fd750626ece4d1f3786ef564485dd8c7d2c04230`                      |
| Active route count  | 1                                                               |
| Active route        | Remaining closeout/backlog audit                                |
| Last closed route   | PR #402 merged                                                  |
| Current route       | Post-PR402 current-main audit route                              |
| Current slice       | Audit remaining goal/spec/backlog obligations                    |
| Feature work status | No next feature slice started                                   |

## Active Route

PR #402 is merged and local `main` plus `origin/main` are synced at
`fd750626ece4d1f3786ef564485dd8c7d2c04230`. This tracker refresh closes the
post-PR401 route repair and makes the remaining closeout/backlog audit the
active route. It does not claim Linear field-text currency, root-hygiene proof,
documentation accuracy, Judge/PM readiness, release readiness, or parent-goal
completion.

Current evidence:

- Local `main` and `origin/main` were synced at
  `fd750626ece4d1f3786ef564485dd8c7d2c04230` before this tracker-refresh
  branch was created.
- Live GitHub reported PR #402 merged at `2026-06-11T06:46:51Z` from submitted
  head `765769147db3f1ccee704e521475d4a20ab65934` as squash merge commit
  `fd750626ece4d1f3786ef564485dd8c7d2c04230`; repo-owned CircleCI,
  aggregate `pr-pipeline`, aggregate `security-scan`, Socket, CodeRabbit,
  and review-thread checks passed or resolved before merge. The external
  `security/snyk (jscraik)` GitHub App quota/error lane remains owner-waived
  only for that external app status.
- Live GitHub reported zero open pull requests at this pullback refresh point.
- Earlier Linear JSC-363 evidence recorded status `In Review`, Phase 1
  title/description text, and repo-truth comment
  `81cfdd41-ff0e-4df1-b884-c01789e30a50`. This tracker refresh does not claim a
  fresh Linear fetch, Linear field-text currency, or parent-goal completion.
- Next safe action: run the remaining closeout/backlog audit and state the next
  exact implementation slice or blocker.
- Historical PR details remain in `receipts.jsonl`; they are not active restart
  instructions.

## Active Slice

No implementation slice is active. The remaining closeout/backlog audit is the
active route and must produce either the next bounded implementation slice or a
current blocker before feature work resumes.

Non-claims:

- This tracker does not prove root-hygiene evidence, Judge/PM readiness, Linear
  field-text currency, PR merge readiness, release readiness, or parent goal
  completion.
- Historical PR lanes do not become active work unless fresh current-main
  evidence reopens them.

## Outstanding Work

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

- PR #402 is merged into local `main` and `origin/main`, both synced at
  `fd750626ece4d1f3786ef564485dd8c7d2c04230`.
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
Refreshed JSC-363 current-main route truth after PR #402 merge and recorded
that the remaining closeout/backlog audit is now active.

Current truth:

- Active route lane: remaining closeout/backlog audit from current main.
- Latest merged route: PR #402.
- Local main head: fd750626ece4d1f3786ef564485dd8c7d2c04230.
- Origin main head: fd750626ece4d1f3786ef564485dd8c7d2c04230.
- Repo-owned required checks for PR #402 passed before merge.
- Live GitHub reports zero open PRs at this refresh point.
- PU-013 runtime cockpit integration proof is merged and pulled back to local `main`.
- PR #402 remains separate from runtime, CI, review, Linear, and parent goal completion claims.
- No production code patch was required; current main already projects Codex runtime evidence into `runtime-card` and consumes it narrowly through `harness next`.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.
- Linear JSC-363 has repo-truth comment `81cfdd41-ff0e-4df1-b884-c01789e30a50`; field-text currency remains unclaimed until a fresh Linear fetch or owner classification is recorded.

Restart rule:
The next selected slice is not chosen yet. It starts only after this post-PR402
tracker refresh is merged or accepted, main is pulled, validators pass from
current main, and the remaining closeout/backlog audit states the exact next
bounded implementation slice or blocker.
```
