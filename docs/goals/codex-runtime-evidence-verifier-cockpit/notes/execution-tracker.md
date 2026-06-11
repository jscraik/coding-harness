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
| Local main head     | `fdcd577a77fb660b9b71e058bcbd33fff06c67bf`                      |
| Origin main head    | `fdcd577a77fb660b9b71e058bcbd33fff06c67bf`                      |
| Main baseline       | `fdcd577a77fb660b9b71e058bcbd33fff06c67bf`                      |
| Active route count  | 1                                                               |
| Active route        | PR #402 review repair                                           |
| Last closed route   | PR #401 merged                                                  |
| Current route       | PR #402 post-PR401 route-truth review repair                    |
| Current slice       | Resolve PR #402 review/CI, then audit remaining backlog         |
| Feature work status | No next feature slice started                                   |

## Active Route

PR #402 is the active JSC-363 PR repair route after PR #401 merged and local
`main` was pulled to `fdcd577a77fb660b9b71e058bcbd33fff06c67bf`. This
tracker refresh closes the post-PR400 tracker route and keeps the remaining
closeout/backlog audit queued for after PR #402 merges. It does not claim Linear
field-text currency, root-hygiene proof, documentation accuracy, Judge/PM
readiness, release readiness, or parent-goal completion.

Current evidence:

- Local `main` and `origin/main` were synced at
  `fdcd577a77fb660b9b71e058bcbd33fff06c67bf` before this tracker-refresh
  branch was created.
- Live GitHub reported PR #401 merged at `2026-06-11T04:49:40Z` from submitted
  head `c357007368015a161a3ee51a91b90e6bc83f0999` as squash merge commit
  `fdcd577a77fb660b9b71e058bcbd33fff06c67bf`; repo-owned CircleCI,
  aggregate `pr-pipeline`, aggregate `security-scan`, Socket, CodeRabbit,
  and review-thread checks passed or resolved before merge. The external
  `security/snyk (jscraik)` GitHub App quota/error lane remains owner-waived
  only for that external app status.
- Live GitHub reported zero open pull requests before this tracker-refresh PR
  was opened; PR #402 is the active route for this review repair.
- Earlier Linear JSC-363 evidence recorded status `In Review`, Phase 1
  title/description text, and repo-truth comment
  `81cfdd41-ff0e-4df1-b884-c01789e30a50`. This tracker refresh does not claim a
  fresh Linear fetch, Linear field-text currency, or parent-goal completion.
- Next safe action: run the remaining closeout/backlog audit from current
  `main`, state the next exact implementation slice or blocker, and keep
  feature work paused until the tracker records that route.
- Historical PR details remain in `receipts.jsonl`; they are not active restart
  instructions.

## Active Slice

No implementation slice is active. The selected next lane is the remaining
closeout/backlog audit from current `main`; it must produce either the next
bounded implementation slice or a current blocker before feature work resumes.

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

- Delivery-truth consumption projection is merged through PR #374, PR #375
  tracker review-fix is merged, PR #376 tracker refresh is merged, PR #377
  tracker refresh is merged, PR #378 tracker refresh is merged, PR #379 tracker refresh is merged, PR #380
  tracker refresh is merged, PR #381 Linear blocker tracker route is merged,
  PR #382 tracker refresh is merged, and PR #383 validator repair is merged
  into local `main`.
- Linear JSC-363 has compact post-merge route-truth comment
  `34a50024-24be-4853-af6e-3219cbc0d845`.
- `goal.md`, `state.yaml`, `notes/execution-tracker.md`,
  `.harness/active-artifacts.md`, the tracker board, and `receipts.jsonl`
  validate together after the merge pull-back.

## Linear Update Payload

Use this payload only after Linear access is available or an owner explicitly
approves posting the blocker classification for JSC-363:

```md
Refreshed JSC-363 current-main route truth after PR #393 merge and recorded
the post-PR393 Linear field-text access blocker.

Current truth:

- Active route lane: post-PR393 Linear blocker refresh.
- Latest merged route: PR #393.
- Local main head: 566a0a78286f5a1999eee4c332256475d4f19508.
- Origin main head: 566a0a78286f5a1999eee4c332256475d4f19508.
- Repo-owned required checks for PR #393 passed before merge.
- PU-013 runtime cockpit integration proof is merged and pulled back to local `main`.
- PR #393 remains separate from runtime, CI, review, Linear, and parent goal completion claims.
- No production code patch was required; current main already projects Codex runtime evidence into `runtime-card` and consumes it narrowly through `harness next`.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.
- Linear JSC-363 was refreshed with pre-PR372 post-merge route-truth comment `34a50024-24be-4853-af6e-3219cbc0d845`; post-PR393 field-text currency remains unclaimed because `harness linear prepare --issue JSC-363 --json` and `harness linear triage --dry-run --json` fail without `LINEAR_API_KEY` in this session.

Restart rule:
The next selected slice is the Linear field-text decision. It starts only after
this post-PR384 blocker refresh is merged, main is pulled, validators pass from
current main, and a usable Linear tool/token path or owner classification is
available.
```
