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

| Field               | Current Truth                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent issue        | JSC-363                                                                                                                                                                 |
| Canonical goal      | `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`                                                                                                            |
| Current branch      | `codex/jsc-363-post-pr421-tracker-refresh`                                                                                                                             |
| Local main head     | `fd0c25682f1d9cac4e2fd16c4db4ff5cd03be931`                                                                                                                              |
| Origin main head    | `fd0c25682f1d9cac4e2fd16c4db4ff5cd03be931`                                                                                                                              |
| Main baseline       | `fd0c25682f1d9cac4e2fd16c4db4ff5cd03be931`                                                                                                                              |
| Active route count  | 1                                                                                                                                                                       |
| Active route        | PU-015 live Judge/PM audit packet                                                                                                                                       |
| Last closed route   | PR #421 merged                                                                                                                                                          |
| Current route       | PU-015 live Judge/PM packet reviewer and final-audit disposition                                                                                                        |
| Current slice       | PU-015 blocked packet evidence and closeout proof                                                                                                                       |
| Feature work status | No active implementation lane after PR #421 merge/pullback; reviewers still missing; packet validation surface remains explicitly stale/blocked |

## Active Route

PR #421 is merged and local `main` plus `origin/main` are synced at
`fd0c25682f1d9cac4e2fd16c4db4ff5cd03be931`. PR #413 carried the PU-015
Judge/PM guardrails, PR #414 and PR #415 carried tracker refreshes, and PR #416
carried the packet validation-staleness, validation-reference, route-freshness,
receipt-freshness, and receipt-ledger-change repair. PR #417 through PR #419
carried tracker/review-thread repair provenance, and PR #421 carried the
source-checkout command replay guardrail. The first live PU-015 packet now
exists and is blocked on missing independent reviewer artifacts. PU-056 remains
closed on current main: runtime-card projects `issueKey: "JSC-363"` with the
JSC-363 active spec and plan from the wide Current Active Route row. This
tracker records PR #421 as merged guardrail provenance only; it does not claim
Linear field-text currency, final documentation accuracy beyond current
validators, Judge/PM readiness, release readiness, or parent-goal completion.

Current evidence:

- Live GitHub reported PR #410 merged at `2026-06-11T18:24:41Z` from submitted
  head `2067365c6149ebdf96aa181377ca5c151536c216` as merge commit
  `41ac068ae7c9e9425681a5d42358eaf120f24c04`; repo-owned CircleCI, aggregate
  `pr-pipeline`, aggregate `security-scan`, Socket, and CodeRabbit passed,
  and review-thread checks resolved before merge. The external
  `security/snyk (jscraik)` GitHub App quota/error lane remains owner-waived
  only for that external app status.
- Live GitHub reported PR #411 merged at `2026-06-11T20:41:25Z` from submitted
  head `dc2d19bfc14d32621eed5b082565168ab177a631` as merge commit
  `aa020ee7deaef4974ee8c78761192e818416e906`; it carried the post-PR410
  tracker refresh only and is not PU-015 implementation evidence.
- Live GitHub reported PR #412 merged at `2026-06-12T00:24:41Z` from submitted
  head `a81d783aeef3f05d6e3668a4e33ed4e216e6a756` as merge commit
  `7e0dde9c0408388fc228e8c2afe049593f1b0b71`; it carried the post-PR411
  tracker refresh only and is not PU-015 implementation evidence.
- Live GitHub reported PR #413 merged at `2026-06-12T04:22:45Z` from submitted
  head `92ade70b083c14a9a7596f3b1904b6bec6c57e3d` as merge commit
  `d3b6dd661ac86395f7b45d2c8a39526b14583d35`; repo-owned CircleCI contexts,
  aggregate `pr-pipeline`, aggregate `security-scan`, Socket, and CodeRabbit
  passed. The external `security/snyk (jscraik)` GitHub App quota lane remains
  owner-waived only for that quota failure.
- Live GitHub reported PR #415 merged at `2026-06-12T05:41:54Z` from submitted
  head `96b1ebc07093667dcf59f29001250390ce275819` as merge commit
  `29dd0f0465cadcbedbaeb16f06ac0f4607177fa2`; repo-owned CircleCI contexts,
  aggregate `pr-pipeline`, aggregate `security-scan`, Socket, CodeRabbit,
  and review-thread lanes passed or resolved before merge. The external
  `security/snyk (jscraik)` GitHub App quota lane remains owner-waived only
  for that quota failure.
- Live PU-015 packet:
  `docs/goals/codex-runtime-evidence-verifier-cockpit/notes/2026-06-12-pu015-live-judge-pm-audit-packet.json`
  reports `status: blocked`, `blockerCode: missing_reviewer_artifact`, and
  blocker ref `review-state:adversarial-reviewer`.
- Runtime-card on pulled current main returned `issueKey: "JSC-363"` with the
  active JSC-363 spec and plan.
- `harness next --json` on the clean pulled checkout returned a pass status and
  the next safe local command `harness check --json`.
- Earlier Linear JSC-363 evidence recorded status `In Review`, Phase 1
  title/description text, and repo-truth comment
  `81cfdd41-ff0e-4df1-b884-c01789e30a50`. This tracker refresh does not claim a
  fresh Linear fetch, Linear field-text currency, or parent-goal completion.
- Next safe action: generate the live Judge/PM audit packet from pulled
  current-main route truth with current runtime-card refs, delivery-truth
  verdicts, review-state, external-state, Linear state or blocker, validation
  receipts, root hygiene, unresolved-risk classification, and issueAuthorityMap
  proof.
- PR #416 merged at `2026-06-12T08:34:40Z` from submitted head
  `650969a4217b335a1dfb9184e18cae6f83e7dd3b` as squash merge
  `f262c6c4c6646ada3821cdc3a0e9a7300b871746`. Historical PR details
  remain in `receipts.jsonl`; they are not active restart instructions.
- PR #417 merged at `2026-06-12T09:32:37Z` from submitted head
  `b073a2583299e5a84ce8ed8f88562a9a32577466` as squash merge
  `c44235a1cc564b435db7d73caaaf781dfd03acf3`. Historical PR details
  remain in `receipts.jsonl`; they are not active restart instructions.
- PR #418 merged at `2026-06-12T10:52:22Z` from submitted head
  `491cbcc30b645357994943195e143cc0da53631f` as squash merge
  `57f94562de64c03fd80c244276b31d95edd2b3ca`. Historical PR details
  remain in `receipts.jsonl`; they are not active restart instructions.
- PR #419 merged at `2026-06-12T11:32:21Z` from submitted head
  `9c7e780783e809345f1f57c679772852aa093b77` as squash merge
  `125b31b45170fb3f07e77b365c01eff41262c2d4`. Historical PR details
  remain in `receipts.jsonl`; they are not active restart instructions.
- PR #421 merged at `2026-06-12T12:56:26Z` from submitted head
  `02c03b17503f0355367f8c3460ff0f8ac00a7be5` as squash merge
  `fd0c25682f1d9cac4e2fd16c4db4ff5cd03be931`. Historical PR details
  remain in `receipts.jsonl`; they are not active restart instructions.

## Active Slice

Selected active slice after PR #417 landed and local `main` was pulled:
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

Reason: PU-056, PR #413, PR #414, and PR #415 are merged and pulled back, and
the live packet exists. Runtime-card current-main proof shows
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
  `fd0c25682f1d9cac4e2fd16c4db4ff5cd03be931` or a later pulled main commit.
- Runtime-card on pulled current main returns `issueKey: "JSC-363"` with the
  JSC-363 active spec and plan.
- Linear JSC-363 field-text currency is refreshed, owner-classified as not
  required, or recorded as an explicit blocker.
- `goal.md`, `state.yaml`, `notes/execution-tracker.md`,
  `.harness/active-artifacts.md`, the tracker board, and `receipts.jsonl`
  validate together after the post-PR421 refresh and PU-015 packet blocker repair.
- The Judge/PM packet records claim support, unsupported claims, stale evidence,
  and remaining risks without claiming parent-goal completion by itself.

## Linear Update Payload

Use this payload only after Linear access is available or an owner explicitly
approves posting the blocker classification for JSC-363:

```md
Refreshed JSC-363 current-main route truth after PR #421 merge and PU-015 packet blocker repair.

Current truth:

- Active route lane: PU-015 Judge/PM audit packet blocked-readiness proof after PR #421 pullback.
- Latest merged route: PR #421.
- Local main head: `fd0c25682f1d9cac4e2fd16c4db4ff5cd03be931`.
- Origin main head: `fd0c25682f1d9cac4e2fd16c4db4ff5cd03be931`.
- Current GitHub check rollup showed repo-owned required checks for PR #421 pass before merge.
- Runtime-card current-main output returns issueKey JSC-363 with the JSC-363 active spec and plan.
- PU-013 runtime cockpit integration proof is merged and pulled back to local `main`.
- PR #413 is merged PU-015 guardrail evidence, PR #414/PR #415 are merged tracker evidence, PR #416 is merged packet-route repair evidence, PR #417/PR #418/PR #419 are merged tracker/review-thread repair evidence, and PR #421 is merged source-checkout command replay guardrail evidence. The live packet exists and is blocked on missing independent reviewer artifacts; all remain separate from Linear field-text currency, Judge/PM readiness, and parent goal completion claims.
- PU-056 deterministic guard coverage is merged and pulled back.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.
- Linear JSC-363 has repo-truth comment `81cfdd41-ff0e-4df1-b884-c01789e30a50`; field-text currency remains unclaimed until a fresh Linear fetch or owner classification is recorded.

Restart rule:
The next selected slice is `PU-015 reviewer artifact and final audit disposition`. It starts only
from pulled current-main route truth and the blocked packet artifact.
```
