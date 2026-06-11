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
| Current branch      | `codex/jsc-363-pu056-runtime-card-active-route-key`          |
| Local main head     | `c3d476541351ccd08fb832d08ba9749a9f203e4c`                   |
| Origin main head    | `c3d476541351ccd08fb832d08ba9749a9f203e4c`                   |
| Main baseline       | `c3d476541351ccd08fb832d08ba9749a9f203e4c`                   |
| Active route count  | 1                                                            |
| Active route        | PU-056 active-route runtime-card selection guard              |
| Last closed route   | PR #409 merged                                               |
| Current route       | PU-056 runtime-card route-key guard                          |
| Current slice       | PU-056 active-route runtime-card selection guard in progress |
| Feature work status | Narrow guard implementation active                           |

## Active Route

PR #409 is merged and local `main` plus `origin/main` are synced at
`c3d476541351ccd08fb832d08ba9749a9f203e4c`. PU-055 has run enough current-main
evidence to classify the remaining lanes, and PU-056 is now the active bounded
slice. This tracker does not claim Linear field-text currency, final
documentation accuracy beyond current validators, Judge/PM readiness, release
readiness, or parent-goal completion.

Current evidence:

- Local `main` and `origin/main` were synced at
  `c3d476541351ccd08fb832d08ba9749a9f203e4c` after PR #409 was merged and
  pulled back.
- Live GitHub reported PR #409 merged at `2026-06-11T16:36:45Z` from submitted
  head `c5f4095bcd2484668acfa0195fdddf9e6cb2517e` as merge commit
  `c3d476541351ccd08fb832d08ba9749a9f203e4c`; the current GitHub check rollup
  shows repo-owned CircleCI, aggregate `pr-pipeline`, aggregate
  `security-scan`, Socket, and CodeRabbit passing, and review-thread checks
  resolved or non-blocking. The external
  `security/snyk (jscraik)` GitHub App quota/error lane remains owner-waived
  only for that external app status.
- Live GitHub reported zero open pull requests at this pullback refresh point.
- Local cleanup removed obsolete auxiliary worktrees and stale local/remote
  `codex/*` branches; only `main` and `origin/main` remain.
- Earlier Linear JSC-363 evidence recorded status `In Review`, Phase 1
  title/description text, and repo-truth comment
  `81cfdd41-ff0e-4df1-b884-c01789e30a50`. This tracker refresh does not claim a
  fresh Linear fetch, Linear field-text currency, or parent-goal completion.
- Next safe action: complete, review, merge, and pull back
  `PU-056 active-route runtime-card selection guard`.
- Historical PR details remain in `receipts.jsonl`; they are not active restart
  instructions.

## Active Slice

Active slice: `PU-056 active-route runtime-card selection guard`.

PU-055 completed the route-decision matrix and found active-route selection
drift. PU-056 adds the smallest deterministic guard so runtime-card derives the
Linear key from the active route row when the Current Active Route table has a
Route column before Linear Key.

Current PU-056 local proof:

- `pnpm vitest run src/commands/runtime-card.test.ts --reporter dot` -> pass,
  1 file / 33 tests.
- `node --import tsx src/cli.ts runtime-card --json --repo . | jq '{issueKey,
  activeSpec:.artifacts.activeSpec, activePlan:.artifacts.activePlan}'` ->
  pass, `issueKey: "JSC-363"` with the JSC-363 active spec and plan.

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

PU-055 current-main closeout evidence matrix:

| Lane | PU-055 Classification | Evidence Ref | Next Action |
| --- | --- | --- | --- |
| Review-state, external-state, and root-hygiene closeout surfaces | complete for current focused code/test proof | `pnpm vitest run src/lib/review-state/review-state.test.ts src/lib/review-state/review-lifecycle.test.ts src/lib/external-state/external-state.test.ts src/lib/root-hygiene/root-hygiene.test.ts src/lib/pr-closeout/state-packets.test.ts src/lib/pr-closeout/lifecycle-snapshot.test.ts src/commands/pr-closeout.test.ts src/lib/delivery-truth/delivery-truth-composition.test.ts src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts src/lib/delivery-truth/goal-completion-audit-receipt.test.ts src/lib/delivery-truth/judge-pm-audit.test.ts src/commands/runtime-card.test.ts src/commands/next.test.ts --reporter dot` -> 13 files / 311 tests passed | Do not reopen unless a fresh current-main regression appears. |
| Documentation accuracy checks | partial; current validators pass | board validator, audit-freshness validator, Kanban script parser, docs-gate, and docs-lint for this tracker branch | Keep docs accuracy unclaimed beyond current validators until final Judge/PM audit. |
| Linear field-text currency for JSC-363 | blocked owner/external lane | repo-truth comment `81cfdd41-ff0e-4df1-b884-c01789e30a50`; no fresh Linear field-text fetch/edit proof in current checkout | Owner must accept stale field text or provide/update live Linear field proof before final closeout. |
| Historical review-coverage backfill | complete for board contract | `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit` returned `goal-review-coverage-backfill/v1` pass | Keep validator in final completion audit. |
| PU-015 Judge/PM audit packet | next implementation slice after active-route guard | `src/lib/delivery-truth/judge-pm-audit.test.ts` passes, but no live final audit packet is produced for this goal | Produce the live packet only after PU-056 removes the active-route/runtime-card mismatch. |
| Final requirement-by-requirement completion audit | blocked by PU-056, Linear disposition, and Judge/PM packet | goal.md completion contract still requires PU/GAP/SPG reconciliation and Judge/PM packet | Do not claim parent completion. |

Selected next slice: `PU-056 active-route runtime-card selection guard`.

Reason: `node --import tsx src/cli.ts runtime-card --json --repo .` selected
JSC-395 from `.harness/active-artifacts.md` because the Current Active Route
table had two rows. The next slice must keep the active route surface thin and
enforce that runtime-card uses the JSC-363 active route before Judge/PM packet
work resumes.

## History Boundary

Merged PR lanes through PR #383 remain provenance. They are not active route
lanes and must not be expanded in the active board unless a fresh current-main
regression reopens them.

Receipt history remains append-only. New receipts should be compact
claim/evidence/blocker records, not narrative diary entries.

## Resume Gate

Judge/PM packet work remains stopped until all of these are true:

- PR #409 is merged into local `main` and `origin/main`, both synced at
  `c3d476541351ccd08fb832d08ba9749a9f203e4c`.
- PU-056 is validated, opened as a PR, merged, and pulled back to local
  `main`.
- Runtime-card on pulled current main returns `issueKey: "JSC-363"` with the
  JSC-363 active spec and plan.
- Linear JSC-363 has repo-truth comment
  `81cfdd41-ff0e-4df1-b884-c01789e30a50`, but field-text currency remains a
  separate unclaimed lane.
- `goal.md`, `state.yaml`, `notes/execution-tracker.md`,
  `.harness/active-artifacts.md`, the tracker board, and `receipts.jsonl`
  validate together after the merge pull-back.
- The post-PU-056 closeout audit records the exact next bounded slice or
  blocker.

## Linear Update Payload

Use this payload only after Linear access is available or an owner explicitly
approves posting the blocker classification for JSC-363:

```md
Refreshed JSC-363 current-main route truth after PR #409 merge and started
PU-056 active-route runtime-card selection guard.

Current truth:

- Active route lane: PU-056 active-route runtime-card selection guard.
- Latest merged route: PR #409.
- Local main head: c3d476541351ccd08fb832d08ba9749a9f203e4c.
- Origin main head: c3d476541351ccd08fb832d08ba9749a9f203e4c.
- Current GitHub check rollup shows repo-owned required checks for PR #409 pass.
- PU-056 branch: codex/jsc-363-pu056-runtime-card-active-route-key.
- PU-013 runtime cockpit integration proof is merged and pulled back to local `main`.
- PR #409 remains separate from runtime, CI, review, Linear, and parent goal completion claims.
- PU-056 now adds deterministic guard coverage so runtime-card derives JSC-363 from the wide active-route row.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.
- Linear JSC-363 has repo-truth comment `81cfdd41-ff0e-4df1-b884-c01789e30a50`; field-text currency remains unclaimed until a fresh Linear fetch or owner classification is recorded.

Restart rule:
The next selected slice is `PU-056 active-route runtime-card selection guard`.
It starts only after this PU-055 tracker repair validates, merges, and local
main is pulled back.
```
