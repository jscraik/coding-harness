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

| Field               | Current Truth                                                                          |
| ------------------- | -------------------------------------------------------------------------------------- |
| Parent issue        | JSC-363                                                                                |
| Canonical goal      | `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`                           |
| Current branch      | `main`                                                                                 |
| Local head          | `b7b5d9f48fb9369c29a4cd9902acde88285bfb22`                                             |
| Remote main head    | `b7b5d9f48fb9369c29a4cd9902acde88285bfb22`                                             |
| Main baseline       | `b7b5d9f48fb9369c29a4cd9902acde88285bfb22`                                             |
| Active route count  | 0                                                                                      |
| Active route        | None                                                                                   |
| Last closed route   | PR #374 merged                                                                         |
| Current slice       | Backlog reconciliation                                                                 |
| Feature work status | Stopped until this post-PR374 tracker validates and the next bounded slice is selected |

## Active Route

There is no active PR route. PR #374 merged the delivery-truth consumption
projection from branch `codex/jsc-363-delivery-truth-consumption` into
`main` at squash commit `b7b5d9f48fb9369c29a4cd9902acde88285bfb22`.
This closes the PR lane only; it does not claim Linear field-text currency,
root-hygiene proof, documentation accuracy, Judge/PM readiness, or parent-goal
completion.

Current evidence:

- Local `main` and `origin/main` are synced at
  `b7b5d9f48fb9369c29a4cd9902acde88285bfb22` after PR #374 merge pullback.
- Live GitHub reports PR #374 merged from submitted head
  `ca7bc92aeeeb5fa357732fbad8f49f62f54abc2b`.
- The PR body was repaired after the local source-checkout `pr-template-gate`
  reproduced eight findings and then passed with zero findings against the
  repaired body artifact.
- CodeRabbit was manually triggered with `@coderabbitai review this pr` at
  https://github.com/jscraik/coding-harness/pull/374#issuecomment-4652005383.
- PR #374 repo-owned CircleCI lanes, aggregate `pr-pipeline`, CodeRabbit
  status, Socket, and CircleCI Snyk dependency scan passed before merge.
- PR #374 review-thread refresh returned zero unresolved threads before merge.
- The external Snyk GitHub App quota/status lane remains owner-waived for that
  external lane only; it is not external Snyk success and not a security waiver
  for repo-owned gates.
- Live GitHub reported PR #373 merged at 2026-06-08T16:48:42Z from submitted
  head `2e8d94785edd2c10ab97a175633e341ef9fa2c49` as merge commit
  `37aec5fb97a8358f766166330affbced6bd31c5a`.
- Live GitHub reports PR #372 merged at 2026-06-08T16:21:19Z from submitted
  head `ae0975afbde9acbf0fd1a59f30476fff9a044886` as merge commit
  `3d91248269736b36a8e3e203683de9310d107d14`.
- PR #372 repo-owned CircleCI lanes, aggregate `pr-pipeline`, CodeRabbit
  status, live PR body gate, and unresolved-review-thread refresh were green or
  empty before merge.
- Live GitHub reports PR #371 merged at 2026-06-08T15:39:17Z from submitted
  head `a77a7f0ec3ccf2950c75a7b10b56067e32648e02`.
- PR #371 repo-owned CircleCI lanes, aggregate `pr-pipeline`, CodeRabbit
  status, and unresolved-review-thread refresh were green or empty before
  merge.
- PR #370 merged PU-013 proof-route provenance at
  `83d7b6dab5cda761889d1708a304aa87edc2b9fa`.
- PR #369 merged into `main` at
  `1d0c3baaa76d1de68c633b086a5dcf07472ddbef`.
- PR #369 repo-owned CircleCI lanes passed, including `pr-template`,
  `linear-gate`, `risk-policy-gate`, `check`, `test`, `lint`,
  `typecheck`, `docs-gate`, and aggregate `pr-pipeline`.
- Linear JSC-363 has pre-PR372 post-merge route-truth comment
  `34a50024-24be-4853-af6e-3219cbc0d845`; its title still carries older
  Phase 1 wording, so field-text currency and post-PR374 tracker currency remain
  unclaimed.

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
   - Command: `git commit -m "docs(goal): refresh post-pr374 tracker"`
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

Delivery-truth consumption projection is delivered on current `main`.

Current implementation boundary:

- Production source: `src/lib/pr-closeout/state-packet-delivery-truth.ts` and
  the existing `src/lib/pr-closeout/state-packets.ts` evidence projection.
- Focused proof: `src/lib/pr-closeout/state-packets.test.ts` plus
  `src/lib/delivery-truth/judge-pm-audit.test.ts`.
- Current delivered behavior: final delivery-truth claim families are emitted as
  pass, blocked, or unknown verdicts instead of being silently absent.
- Local validation evidence: focused delivery-truth tests, related tests,
  codestyle fast, docs-gate, goal-board validators, audit-freshness, and
  `pnpm test:deep` local/deep lanes passed until the E2E tail required GitHub
  and Linear credentials. `<REDACTED_HOME_PATH>/.codex/.env` is a FIFO in this
  sandbox, so direct read/source is a credential-surface blocker, not a safe
  fallback.
- Local simplify, improve-codebase-architecture, sy-review, and testing lenses
  are recorded at
  `artifacts/reviews/delivery-truth-consumption-skill-lenses.md`. Independent
  reviewer subagents remain blocked in this runtime because no `spawn_agent`
  tool is exposed.
- Local code and review-artifact commit
  `d011cd5555bfc90fe1d4e24d5f5fad4cd7bec702` records the delivery-truth
  projection patch before PR handoff. Follow-up commit
  `ca7bc92aeeeb5fa357732fbad8f49f62f54abc2b` blocks unverifiable CircleCI
  telemetry before the PR #374 merge.

Non-claims:

- This slice does not produce root-hygiene evidence, Judge/PM readiness, Linear
  field-text currency, or parent goal completion.
- No PR lane is active after PR #374 merge pullback.

## Outstanding Work

- Prove review-state, external-state, and root-hygiene closeout surfaces from
  current evidence.
- Complete documentation accuracy checks.
- Resolve or owner-accept Linear field-text currency for JSC-363.
- Complete historical review-coverage backfill.
- Produce PU-015 Judge/PM audit packet.
- Run final requirement-by-requirement completion audit.

## History Boundary

Merged PR lanes through PR #374 remain provenance. They are not active route
lanes and must not be expanded in the active board unless a fresh current-main
regression reopens them.

Receipt history remains append-only. New receipts should be compact
claim/evidence/blocker records, not narrative diary entries.

## Resume Gate

Feature implementation remains stopped until all of these are true:

- Delivery-truth consumption projection is merged through PR #374 and the
  post-PR374 tracker refresh is validated against local `main`.
- Linear JSC-363 has compact post-merge route-truth comment
  `34a50024-24be-4853-af6e-3219cbc0d845`.
- `goal.md`, `state.yaml`, `notes/execution-tracker.md`,
  `.harness/active-artifacts.md`, the tracker board, and `receipts.jsonl`
  validate together after the merge pull-back.

## Linear Update Payload

Use this payload for the JSC-363 Linear progress update:

```md
Refreshed JSC-363 current-main route truth and PU-013 merged proof.

Current truth:

- Active route lane: none.
- Latest merged route: PR #374.
- Local main head: b7b5d9f48fb9369c29a4cd9902acde88285bfb22.
- Origin main head: b7b5d9f48fb9369c29a4cd9902acde88285bfb22.
- Repo-owned CircleCI lanes for PR #374 passed before merge.
- PU-013 runtime cockpit integration proof is merged and pulled back to local `main`.
- PR #374 remains separate from runtime, CI, review, Linear, and parent goal completion claims.
- No production code patch was required; current main already projects Codex runtime evidence into `runtime-card` and consumes it narrowly through `harness next`.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.
- Linear JSC-363 was refreshed with post-merge route-truth comment `34a50024-24be-4853-af6e-3219cbc0d845`; field-text currency remains unclaimed because the issue title still says Phase 1.

Restart rule:
No next slice starts until the board/state/receipt validators pass on the post-PR374 current-main tracker and one bounded backlog item is selected.
```
