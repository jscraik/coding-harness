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

| Field | Current Truth |
| --- | --- |
| Parent issue | JSC-363 |
| Canonical goal | `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` |
| Current branch | `main` |
| Local head | `83d7b6dab5cda761889d1708a304aa87edc2b9fa` |
| Remote main head | `83d7b6dab5cda761889d1708a304aa87edc2b9fa` |
| Main baseline | `83d7b6dab5cda761889d1708a304aa87edc2b9fa` |
| Active route count | 0 |
| Active route | none |
| Last closed route | PR #370 merged |
| Current slice | PU-013 runtime cockpit integration proof |
| Feature work status | PU-013 proof route merged and pulled back; next slice not selected |

## Active Route

No PR lane is active after PR #370 merged into current `main` as squash commit
`83d7b6dab5cda761889d1708a304aa87edc2b9fa`. PR #370 was a proof-tracker PR
for PU-013; it does not claim production code changes, Linear field-text
currency, delivery-truth completion, Judge/PM readiness, or parent-goal
completion.

Current evidence:

- Live GitHub reports PR #370 merged at 2026-06-08T14:50:57Z from submitted
  head `31ac06c0094bc611835a862d55ee89db9d29cac7`.
- PR #370 repo-owned CircleCI lanes, aggregate `pr-pipeline`, CodeRabbit
  status, and unresolved-review-thread refresh were green or empty before
  merge.
- PR #369 merged into `main` at
  `1d0c3baaa76d1de68c633b086a5dcf07472ddbef`.
- Local `main` and `origin/main` both point at
  `83d7b6dab5cda761889d1708a304aa87edc2b9fa`.
- PR #369 repo-owned CircleCI lanes passed, including `pr-template`,
  `linear-gate`, `risk-policy-gate`, `check`, `test`, `lint`,
  `typecheck`, `docs-gate`, and aggregate `pr-pipeline`.
- The external Snyk GitHub App quota/status lane remains owner-waived for that
  external lane only; it is not external Snyk success and not a security waiver
  for repo-owned gates.
- Linear JSC-363 has post-merge route-truth comment
  `8ea7f8a4-74f1-458a-aca1-bb072e27864c`; its title still carries older
  Phase 1 wording, so field-text currency remains unclaimed.

Completed route-refresh action:

1. Validated the current-main tracker refresh locally.
   - Command: `jq -c . docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl >/dev/null`
   - Command: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .`
   - Command: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit`
   - Command: `node scripts/validate-goal-kanban-script.cjs .harness/implementation-notes/goal-kanban-board.html`
   - Command: `git diff --check`
   - Pass criteria: Goal state, board, visual tracker, audit freshness, and receipt
     syntax agree on current `main`.

2. Committed the current-main tracker refresh.
   - Command: `git add docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl .harness/active-artifacts.md .harness/implementation-notes/goal-kanban-board.html`
   - Command: `git commit -m "docs(goal): refresh post-pr370 tracker"`
   - Pass criteria: Commit succeeds with exit code 0 and hooks pass.

3. Discussed and bounded PU-013 as a proof-first slice.
   - Scope: verify current-main `runtime-card` and `harness next` behavior first.
   - Boundary: keep work inside `src/lib/runtime/**`, `src/commands/runtime-card*`,
     and `src/commands/next*` unless docs-gate requires synchronized docs.
   - Non-claims: runtime-card remains advisory, does not store evidence, does not
     execute actions, and does not imply PR merge readiness.

4. Proved PU-013 current behavior without production code changes.
   - Command: `node --import tsx src/cli.ts runtime-card --json --repo . --issue JSC-363 --evidence codex-scripts/pu013-codex-runtime-evidence-bundle.json --out codex-scripts/pu013-runtime-card-with-codex.json --evidence-out codex-scripts/pu013-runtime-evidence-out.json`
   - Result: pass; runtime-card projected `codexRuntime.receiptRefs`,
     `validationRefs`, `reviewRefs`, `sessionRefs`, `environmentRefs`,
     `staleStateRefs`, and a visible stale Linear blocker.
   - Command: `node --import tsx src/cli.ts next --json --worktree-role dirty-with-justification --runtime-card codex-scripts/pu013-runtime-card-with-codex.json`
   - Result: blocked as expected; `harness next` surfaced the runtime-card
     blocker and one next safe action without executing work.
   - Command: `node --import tsx src/cli.ts runtime-card --json --repo . --issue JSC-363 --evidence codex-scripts/missing-runtime-evidence.json`
   - Result: fail as expected; missing evidence was not treated as support.
   - Command: `pnpm vitest run src/lib/runtime/*.test.ts src/commands/runtime-card.test.ts src/commands/next*.test.ts`
   - Result: pass; 13 files and 199 tests passed.
   - Command: `pnpm exec tsx src/cli.ts runtime-card --json --repo .`
   - Result: pass; local runtime-card emitted `runtime-card/v1` with no
     Codex-runtime projection when no evidence bundle was supplied.
   - Command: `pnpm exec tsx src/cli.ts next --json --worktree-role dirty-with-justification`
   - Result: pass; `harness next` returned one advisory next action from local
     worktree state.

## Active Slice

PU-013 runtime cockpit integration proof is merged and pulled back to local
`main`.

No production code patch was required because current main already implements
the PU-013 runtime-card projection and `harness next` advisory consumption
contract. The remaining route work is to revalidate the current-main tracker and
select exactly one next bounded backlog item.

## Outstanding Work

- Select one next bounded backlog slice before opening another PR.
- Prove final delivery-truth consumption.
- Prove review-state, external-state, and root-hygiene closeout surfaces from
  current evidence.
- Complete documentation accuracy checks.
- Resolve or owner-accept Linear field-text currency for JSC-363.
- Complete historical review-coverage backfill.
- Produce PU-015 Judge/PM audit packet.
- Run final requirement-by-requirement completion audit.

## History Boundary

Merged PR lanes through PR #370 remain provenance. They are not active route
lanes and must not be expanded in the active board unless a fresh current-main
regression reopens them.

Receipt history remains append-only. New receipts should be compact
claim/evidence/blocker records, not narrative diary entries.

## Resume Gate

Feature implementation remains stopped until all of these are true:

- PU-013 proof tracker update is merged through PR #370 and pulled back to local
  `main`.
- Linear JSC-363 has compact post-merge route-truth comment
  `8ea7f8a4-74f1-458a-aca1-bb072e27864c`.
- `goal.md`, `state.yaml`, `notes/execution-tracker.md`,
  `.harness/active-artifacts.md`, the tracker board, and `receipts.jsonl`
  validate together after the merge pull-back.

## Linear Update Payload

Use this payload for the JSC-363 Linear progress update:

```md
Refreshed JSC-363 current-main route truth and PU-013 merged proof.

Current truth:
- Active route lane: none.
- Latest merged route: PR #370.
- Local main head: 83d7b6dab5cda761889d1708a304aa87edc2b9fa.
- Origin main head: 83d7b6dab5cda761889d1708a304aa87edc2b9fa.
- Repo-owned CircleCI lanes for PR #370 passed before merge.
- PU-013 runtime cockpit integration proof is merged and pulled back to local `main`.
- PR #370 remains separate from runtime, CI, review, Linear, and delivery-truth claims.
- No production code patch was required; current main already projects Codex runtime evidence into `runtime-card` and consumes it narrowly through `harness next`.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.
- Linear JSC-363 was refreshed with post-merge route-truth comment `8ea7f8a4-74f1-458a-aca1-bb072e27864c`; field-text currency remains unclaimed because the issue title still says Phase 1.

Restart rule:
No next slice starts until the board/state/receipt validators pass on the post-PR #370 current-main tracker and one bounded backlog item is selected.
```
