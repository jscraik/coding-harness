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

Mantra:
Thin Surface,
Strong Guardrails,
Durable Memory,
Simplicity / Minimalism,
Self Improvement,
Professional Output.

## Current Control Surface

| Field               | Current Truth                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent issue        | JSC-363                                                                                                                                                                 |
| Canonical goal      | `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`                                                                                                            |
| Current branch      | `main`                                                                                                                                                                  |
| Local main head     | `fe30a9bab5906475bf79f39403c36ef1c9bc9262`                                                                                                                              |
| Origin main head    | `fe30a9bab5906475bf79f39403c36ef1c9bc9262`                                                                                                                              |
| Main baseline       | `fe30a9bab5906475bf79f39403c36ef1c9bc9262`                                                                                                                              |
| Active route count  | 1                                                                                                                                                                       |
| Active route        | PU-015 live Judge/PM audit packet                                                                                                                                       |
| Last closed route   | PR #425 merged                                                                                                                                                          |
| Current route       | PU-015 live Judge/PM packet reviewer and final-audit disposition                                                                                                        |
| Current slice       | PU-015 blocked packet evidence and closeout proof                                                                                                                       |
| Feature work status | No active implementation lane after PR #425 merge/pullback; reviewers still missing; packet validation surface is current at R516 while reviewers are still missing |

## Active Route

The compact current route packet is
`docs/goals/codex-runtime-evidence-verifier-cockpit/current-route.json`.
It records PR #425 as the latest merged provenance at
`fe30a9bab5906475bf79f39403c36ef1c9bc9262`, keeps PU-015 as the active
Judge/PM packet lane, and blocks readiness on missing independent reviewer
artifacts plus unclaimed Linear field-text currency.

Current evidence:

- Live PU-015 packet:
  `docs/goals/codex-runtime-evidence-verifier-cockpit/notes/2026-06-12-pu015-live-judge-pm-audit-packet.json`
  reports `status: blocked`, `blockerCode: missing_reviewer_artifact`, and
  blocker ref `review-state:adversarial-reviewer`.
- Live PU-015 packet narrative:
  [2026-06-12-pu015-live-judge-pm-audit-packet.md](./2026-06-12-pu015-live-judge-pm-audit-packet.md).
- Runtime-card on pulled current main returned `issueKey: "JSC-363"` with the
  active JSC-363 spec and plan.
- `harness next --json` on the clean pulled checkout returned a pass status and
  the next safe local command `harness check --json`.
- Earlier Linear JSC-363 evidence recorded status `In Review`, Phase 1
  title/description text, and repo-truth comment
  `81cfdd41-ff0e-4df1-b884-c01789e30a50`. This tracker refresh does not claim a
  fresh Linear fetch, Linear field-text currency, or parent-goal completion.
- Historical PR chronology remains in
  `docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl`; it is
  provenance only, not active restart instruction.

Next safe action: collect or explicitly block the missing independent reviewer
artifacts, refresh or owner-classify Linear field text, and rerun the Judge/PM
packet plus final requirement-by-requirement audit from pulled main.
## Active Slice

Selected active slice after PR #425 landed and local `main` was pulled:
`PU-015 live Judge/PM audit packet blocked-readiness proof`.

PU-056 closed the active-route/runtime-card mismatch. PR #413 added guardrails
for receipt-backed reviewer proofs and claimed authority matching. The current
packet proves the gate fails closed, but it does not prove Judge/PM readiness:
reviewer artifacts, Linear field-text disposition, final documentation accuracy,
and final closeout audit remain separate lanes.

Current post-PU-056 proof:

- `node --import tsx src/cli.ts runtime-card --json --repo . | jq '{issueKey,
activeSpec:.artifacts.activeSpec, activePlan:.artifacts.activePlan}'` ->
  pass, `issueKey: "JSC-363"` with the JSC-363 active spec and plan.
- `node --import tsx src/cli.ts next --json` -> pass, clean-worktree handoff
  recommendation with no changed files.

- a single bounded implementation slice with required gates and owner/blocker
  decisions
- a current blocker with owner-visible evidence
- a Judge/PM-ready packet only if every required lane is proven current

Non-claims:

- This tracker does not prove Judge/PM readiness, Linear field-text currency,
  release readiness, or parent goal completion.
- Historical PR lanes do not become active work unless fresh current-main
  evidence reopens them.

## Outstanding Work

PU-055 current-main closeout evidence matrix:

| Lane                                                             | PU-055 Classification                                                   | Evidence Ref                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Next Action                                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Review-state, external-state, and root-hygiene closeout surfaces | complete for current focused code/test proof                            | `pnpm vitest run src/lib/review-state/review-state.test.ts src/lib/review-state/review-lifecycle.test.ts src/lib/external-state/external-state.test.ts src/lib/root-hygiene/root-hygiene.test.ts src/lib/pr-closeout/state-packets.test.ts src/lib/pr-closeout/lifecycle-snapshot.test.ts src/commands/pr-closeout.test.ts src/lib/delivery-truth/delivery-truth-composition.test.ts src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts src/lib/delivery-truth/goal-completion-audit-receipt.test.ts src/lib/delivery-truth/judge-pm-audit.test.ts src/commands/runtime-card.test.ts src/commands/next.test.ts --reporter dot` -> 13 files / 311 tests passed | Do not reopen unless a fresh current-main regression appears.                                       |
| Documentation accuracy checks                                    | partial; current validators pass                                        | board validator, audit-freshness validator, board script parser, docs-gate, and docs-lint for this tracker branch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Keep docs accuracy unclaimed beyond current validators until final Judge/PM audit.                  |
| Linear field-text currency for JSC-363                           | blocked owner/external lane                                             | repo-truth comment `81cfdd41-ff0e-4df1-b884-c01789e30a50`; no fresh Linear field-text fetch/edit proof in current checkout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Owner must accept stale field text or provide/update live Linear field proof before final closeout. |
| Historical review-coverage backfill                              | complete for board contract                                             | `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit` returned `goal-review-coverage-backfill/v1` pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Keep validator in final completion audit.                                                           |
| PU-015 Judge/PM audit packet                                     | generated and blocked                                                   | `docs/goals/codex-runtime-evidence-verifier-cockpit/notes/2026-06-12-pu015-live-judge-pm-audit-packet.json` -> `status: blocked`, `blockerCode: missing_reviewer_artifact`, blocker ref `review-state:adversarial-reviewer`                                                                                                                                                                                                                                                                                                                                                                                                                                               | Collect or explicitly block independent reviewer artifacts, then rerun the packet and final audit.  |
| Final requirement-by-requirement completion audit                | blocked by Linear disposition, Judge/PM packet, and final docs accuracy | goal.md completion contract still requires PU/GAP/SPG reconciliation and Judge/PM packet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Do not claim parent completion.                                                                     |

Selected next slice: `PU-015 reviewer artifact and final audit disposition`.

Reason: PU-056 and PR `#413`, `#414`, `#415`, `#416`, `#417`, `#418`,
`#419`, `#421`, `#422`, and `#423` are merged and pulled back, and the live
packet exists.
Runtime-card current-main proof shows
`issueKey: "JSC-363"` with the active JSC-363 spec and plan, so the next
remaining bounded closeout slice is reviewer artifact and final audit
disposition with Linear field-text disposition kept explicit.

## History Boundary

Merged PR lanes through PR #383 remain provenance. They are not active route
lanes and must not be expanded in the active board unless a fresh current-main
regression reopens them.

Receipt history remains append-only. New receipts should be compact
claim/evidence/blocker records, not narrative diary entries.

## Resume Gate

Judge/PM packet work may start only after local main is pulled back and the
route tracker is current. The packet must stop if any of these are false:

- Local `main` and `origin/main` are synced to
  `fe30a9bab5906475bf79f39403c36ef1c9bc9262` or a later pulled main commit.
- Runtime-card on pulled current main returns `issueKey: "JSC-363"` with the
  JSC-363 active spec and plan.
- Linear JSC-363 field-text currency is refreshed, owner-classified as not
  required, or recorded as an explicit blocker.
- `goal.md`, `state.yaml`, `notes/execution-tracker.md`,
  `.harness/active-artifacts.md`, the tracker board, and `receipts.jsonl`
  validate together after the post-PR424 refresh and PU-015 packet blocker repair.
- The Judge/PM packet records claim support, unsupported claims, stale evidence,
  and remaining risks without claiming parent-goal completion by itself.

## Linear Update Payload

Use this payload only after Linear access is available or an owner explicitly
approves posting the blocker classification for JSC-363:

```md
Refreshed JSC-363 current-main route truth after PR #425 merge and PU-015 packet blocker repair.

Current truth:

- Active route lane: PU-015 Judge/PM audit packet blocked-readiness proof after PR #425 pullback.
- Latest merged route: PR #425.
- Local main head: `fe30a9bab5906475bf79f39403c36ef1c9bc9262`.
- Origin main head: `fe30a9bab5906475bf79f39403c36ef1c9bc9262`.
- Current GitHub check rollup showed PR #425 required contexts pass before merge: CodeRabbit, Socket Security: Pull Request Alerts, pr-pipeline, and security-scan. The external security/snyk GitHub App quota failure remains an owner-waived non-required lane only.
- Runtime-card current-main output returns issueKey JSC-363 with the JSC-363 active spec and plan.
- PU-013 runtime cockpit integration proof is merged and pulled back to local `main`.
- PR #413 is merged PU-015 guardrail evidence, PR #414/PR #415 are merged tracker evidence, PR #416 is merged packet-route repair evidence, PR #417/PR #418/PR #419 are merged tracker/review-thread repair evidence, PR #421 is merged source-checkout command replay guardrail evidence, PR #422 is merged canonical route-surface repair evidence, PR #423 is merged post-PR422 route-truth provenance, PR #424 is merged post-PR423 packet tracker evidence, and PR #425 is merged advisory-loop guardrail and route-anchor cleanup provenance. The live packet exists and is blocked on missing independent reviewer artifacts; all remain separate from Linear field-text currency, Judge/PM readiness, and parent goal completion claims.
- PU-056 deterministic guard coverage is merged and pulled back.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.
- Linear JSC-363 has repo-truth comment `81cfdd41-ff0e-4df1-b884-c01789e30a50`; field-text currency remains unclaimed until a fresh Linear fetch or owner classification is recorded.

Restart rule:
The next selected slice is `PU-015 reviewer artifact and final audit disposition`. It starts only
from pulled current-main route truth and the blocked packet artifact.
```
