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
| Current branch | `codex/jsc-363-post-pr366-tracker-refresh` |
| Local head | `c880476ab43c0d1063fdcd0eff9d225480e0f7dc` |
| Remote PR head | `c880476ab43c0d1063fdcd0eff9d225480e0f7dc` |
| Main baseline | `e5797549647adab10d35472da9afac574fa0c3cf` |
| Active route count | 1 |
| Active route | PR #367 |
| Queued implementation slice | PU-013 runtime cockpit integration proof |
| Feature work status | Paused |

## Active Route

PR #367 is the only active route lane.

Current evidence:

- Live GitHub PR #367 is open and targets `main`.
- Live GitHub PR #367 remote head is
  `c880476ab43c0d1063fdcd0eff9d225480e0f7dc`.
- Local branch head matches the remote PR head after the validation-lock test
  repair push.
- Live PR #367 aggregate `pr-pipeline` and repo-owned CircleCI lanes pass on
  head `c880476ab43c0d1063fdcd0eff9d225480e0f7dc`.
- Live review-thread refresh still reports unresolved CodeRabbit threads that
  must be fixed before the route can close.
- The external Snyk GitHub App quota/status lane remains owner-waived for that
  external lane only; it is not external Snyk success and not a security waiver
  for repo-owned gates.

Next action:

1. Validate this tracker reset locally.
   - Command: `pnpm run validation:locks && pnpm test:ci`
   - Pass criteria: Lock check passes before the CI-equivalent test lane starts;
     all tests pass.
   - Owner fallback: If validation fails, notify Jamie and do not proceed to commit/push.

2. Commit the tracker reset.
   - Command: `git add docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl .harness/active-artifacts.md .harness/implementation-notes/goal-kanban-board.html`
   - Command: `git commit -m "Reset JSC-363 thin tracker after PR #366"`
   - Pass criteria: Commit succeeds with exit code 0, pre-commit hooks pass,
     commit SHA is generated, and working tree is clean after commit.
   - Owner fallback: If pre-commit hooks fail, fix the underlying issue and do
     not bypass hooks with `--no-verify`.

3. Push `codex/jsc-363-post-pr366-tracker-refresh` without bypassing hooks.
   - Command: `git push origin codex/jsc-363-post-pr366-tracker-refresh`
   - Pass criteria: Push succeeds, remote branch updated to local head.
   - Owner fallback: If push fails, notify Jamie and diagnose network/auth/hook blocker.

4. Trigger CodeRabbit manually on PR #367 if the fresh push does not request a
   new review automatically.
   - Command: Use GitHub UI to request review from CodeRabbit, or verify automatic trigger.
   - Pass criteria: CodeRabbit review status shows "pending" or "in progress".
   - Owner fallback: If CodeRabbit unavailable, notify Jamie and accept manual review-only path.

5. Refresh PR #367 `pr-template`, `pr-pipeline`, review-thread, and
   mergeability truth.
   - Command: `gh pr view 367 --json state,statusCheckRollup,reviewDecision,mergeable`
   - Command:

     ```bash
     gh api graphql -f owner=jscraik -f name=coding-harness -F number=367 -f query='query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved isOutdated}}}}}' | jq '.data.repository.pullRequest.reviewThreads.nodes | map(select(.isResolved == false and .isOutdated == false)) | length'
     ```

   - Pass criteria: Fresh CI status retrieved from `statusCheckRollup`,
     mergeability known from `mergeable`, review decision known from
     `reviewDecision`, and unresolved review-thread count retrieved from the
     GraphQL review-thread surface.
   - Owner fallback: If `gh` unavailable, use GitHub web UI to check PR status,
     CI checks, review decision, mergeability state, and unresolved review
     threads manually, then record findings in a receipt.

6. Merge PR #367 only after required repo-owned lanes are green/resolved or a
   precise owner-accepted blocker is recorded.
   - Command: `gh pr merge 367 --squash` (or web UI merge).
   - Pass criteria: PR merged, main branch advanced, merge commit SHA known.
   - Owner fallback: If blocked, record blocker in receipt and notify Jamie before halting feature work.

7. Checkout `main`, pull latest `origin/main`, and record the post-merge
   receipt before PU-013 starts.
   - Command: `git checkout main && git pull origin main`
   - Pass criteria: Local main matches origin/main, clean working tree.
   - Owner fallback: If pull fails, diagnose conflict/network issue and notify Jamie.

## Queued Slice

PU-013 runtime cockpit integration proof is queued, not active.

PU-013 may start only after PR #367 is closed by merge or explicitly blocked,
local `main` is refreshed, and the goal board/state/receipt surfaces validate
from the resulting current main.

## Outstanding Work

- Close PR #367 route lane through push, fresh CI, review-thread refresh,
  merge, and main pull-back.
- Start PU-013 with bounded intent, Project Brain inputs, plan/spec/audit
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

Merged PR lanes through PR #366 remain provenance. They are not active route
lanes and must not be expanded in the active board unless a fresh current-main
regression reopens them.

Receipt history remains append-only. New receipts should be compact
claim/evidence/blocker records, not narrative diary entries.

## Resume Gate

Feature implementation remains stopped until all of these are true:

- PR #367 branch push completes without bypassing hooks.
- Fresh remote PR #367 repo-owned checks are known.
- Review-thread truth is refreshed and unresolved actionable threads are fixed,
  resolved, or owner-accepted with evidence.
- PR #367 is merged and pulled to local main, or an owner-visible blocker is
  recorded.
- `goal.md`, `state.yaml`, `notes/execution-tracker.md`,
  `.harness/active-artifacts.md`, the tracker board, and `receipts.jsonl`
  validate together.

## Linear Update Payload

Use this payload for the JSC-363 Linear progress update:

```md
Tightened JSC-363 execution control before restarting the goal.

Current truth:
- Active route lane: PR #367 only.
- Local branch head: c880476ab43c0d1063fdcd0eff9d225480e0f7dc.
- Remote PR #367 head: c880476ab43c0d1063fdcd0eff9d225480e0f7dc.
- Remote PR #367 repo-owned CI lanes pass at the pushed head; unresolved CodeRabbit review threads remain the active route blocker.
- PU-013 runtime cockpit integration proof is queued, not active.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.

Restart rule:
No feature work resumes until PR #367 review threads are fixed or owner-accepted, the route is merged or explicitly blocked, local main is pulled, and the compact goal tracker validates.
```
