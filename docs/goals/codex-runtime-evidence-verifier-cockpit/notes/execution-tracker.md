# Codex Runtime Evidence Verifier Cockpit Execution Tracker

## Table of Contents

- [Purpose](#purpose)
- [Current Control Surface](#current-control-surface)
- [Active Route](#active-route)
- [Queued Slice](#queued-slice)
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

| Field | Current Truth |
| --- | --- |
| Parent issue | JSC-363 |
| Canonical goal | `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` |
| Current branch | `codex/JSC-363-post-pr369-goal-state-refresh` |
| Local head | `1d0c3baaa76d1de68c633b086a5dcf07472ddbef` |
| Remote main head | `1d0c3baaa76d1de68c633b086a5dcf07472ddbef` |
| Main baseline | `1d0c3baaa76d1de68c633b086a5dcf07472ddbef` |
| Active route count | 0 |
| Active route | none open |
| Last closed route | PR #369 merged |
| Queued implementation slice | PU-013 runtime cockpit integration proof |
| Feature work status | Paused pending PU-013 discussion |

## Active Route

There is no active route lane after the PR #369 pull-back to current `main`.

Current evidence:

- Live GitHub reports no open PRs for `jscraik/coding-harness`.
- PR #369 merged into `main` at
  `1d0c3baaa76d1de68c633b086a5dcf07472ddbef`.
- Local `main` and `origin/main` both point at
  `1d0c3baaa76d1de68c633b086a5dcf07472ddbef`.
- PR #369 repo-owned CircleCI lanes passed, including `pr-template`,
  `linear-gate`, `risk-policy-gate`, `check`, `test`, `lint`,
  `typecheck`, `docs-gate`, and aggregate `pr-pipeline`.
- The external Snyk GitHub App quota/status lane remains owner-waived for that
  external lane only; it is not external Snyk success and not a security waiver
  for repo-owned gates.
- CodeRabbit and Codex review-status contexts were not counted as independent
  review proof because usage and rate-limit comments were present.

Next action:

1. Validate this current-main tracker refresh locally.
   - Command: `jq -c . docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl >/dev/null`
   - Command: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .`
   - Command: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit`
   - Command: `node scripts/validate-goal-kanban-script.cjs .harness/implementation-notes/goal-kanban-board.html`
   - Command: `git diff --check`
   - Pass criteria: Goal state, board, visual tracker, audit freshness, and receipt
     syntax agree on current `main`.

2. Commit the current-main tracker refresh.
   - Command: `git add docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl .harness/active-artifacts.md .harness/implementation-notes/goal-kanban-board.html`
   - Command: `git commit -m "Refresh JSC-363 goal state after PR #369"`
   - Pass criteria: Commit succeeds with exit code 0 and hooks pass.

3. Update Linear JSC-363 with current route truth.
   - Pass criteria: Linear records no active PR route, PR #369 merged, local and
     remote `main` synced, and PU-013 queued for discussion.

4. Discuss PU-013 intent boundary before implementation starts.
   - Pass criteria: PU-013 scope, deep-module placement, validation gates,
     review lenses, and non-claims are agreed before code changes.

## Queued Slice

PU-013 runtime cockpit integration proof is queued, not active.

PU-013 may start only after this current-main tracker refresh validates and
Jamie confirms the PU-013 intent boundary.

## Outstanding Work

- Discuss and start PU-013 with bounded intent, Project Brain inputs, plan/spec/audit
  matrix, and required review lenses.
- Prove final delivery-truth consumption.
- Prove review-state, external-state, and root-hygiene closeout surfaces from
  current evidence.
- Complete documentation accuracy checks.
- Resolve or owner-accept Linear field-text currency for JSC-363.
- Complete historical review-coverage backfill.
- Produce PU-015 Judge/PM audit packet.
- Run final requirement-by-requirement completion audit.

## History Boundary

Merged PR lanes through PR #369 remain provenance. They are not active route
lanes and must not be expanded in the active board unless a fresh current-main
regression reopens them.

Receipt history remains append-only. New receipts should be compact
claim/evidence/blocker records, not narrative diary entries.

## Resume Gate

Feature implementation remains stopped until all of these are true:

- The current-main tracker refresh validates.
- Linear JSC-363 receives a compact current-truth update.
- Jamie confirms the PU-013 intent boundary.
- `goal.md`, `state.yaml`, `notes/execution-tracker.md`,
  `.harness/active-artifacts.md`, the tracker board, and `receipts.jsonl`
  validate together.

## Linear Update Payload

Use this payload for the JSC-363 Linear progress update:

```md
Refreshed JSC-363 current-main route truth before discussing PU-013.

Current truth:
- Active route lane: none.
- Latest merged route: PR #369.
- Local main head: 1d0c3baaa76d1de68c633b086a5dcf07472ddbef.
- Origin main head: 1d0c3baaa76d1de68c633b086a5dcf07472ddbef.
- Repo-owned CircleCI lanes for PR #369 passed before merge.
- PU-013 runtime cockpit integration proof is queued for discussion, not active.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.
- CodeRabbit/Codex review-status contexts are not being treated as independent review proof because usage/rate-limit comments were present.

Restart rule:
No feature work resumes until the compact goal tracker validates and the PU-013 intent boundary is agreed.
```
