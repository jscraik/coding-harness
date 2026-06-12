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
| Current branch      | `codex/jsc-363-post-pr412-tracker-refresh`                   |
| Local main head     | `7e0dde9c0408388fc228e8c2afe049593f1b0b71`                   |
| Origin main head    | `7e0dde9c0408388fc228e8c2afe049593f1b0b71`                   |
| Main baseline       | `7e0dde9c0408388fc228e8c2afe049593f1b0b71`                   |
| Active route count  | 1                                                            |
| Active route        | Post-PR412 current-main tracker refresh                      |
| Last closed route   | PR #412 merged                                               |
| Current route       | PU-015 selected from pulled current main                     |
| Current slice       | PU-015 selected, not started                                 |
| Feature work status | Ready after this tracker refresh is accepted or waived       |

## Active Route

PR #412 is merged and local `main` plus `origin/main` are synced at
`7e0dde9c0408388fc228e8c2afe049593f1b0b71`. PR #412 carried the
post-PR411 tracker refresh only, not PU-015 implementation evidence. Live
GitHub reported zero open pull requests before this local tracker-refresh
branch was created. PU-056 is closed on current main:
runtime-card now projects `issueKey: "JSC-363"` with the JSC-363 active spec
and plan from the wide Current Active Route row. This tracker does not claim
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
- Live GitHub reported zero open pull requests before this local tracker-refresh
  branch was created.
- Runtime-card on pulled current main returned `issueKey: "JSC-363"` with the
  active JSC-363 spec and plan.
- `harness next --json` on the clean pulled checkout returned a pass status and
  the next safe local command `harness check --json`.
- Earlier Linear JSC-363 evidence recorded status `In Review`, Phase 1
  title/description text, and repo-truth comment
  `81cfdd41-ff0e-4df1-b884-c01789e30a50`. This tracker refresh does not claim a
  fresh Linear fetch, Linear field-text currency, or parent-goal completion.
- Next safe action: commit the local PU-015 guardrail implementation, open a
  single PR for it, and keep Judge/PM readiness blocked until the PR merges,
  main is pulled back, the live audit packet exists, and Linear field-text
  disposition is refreshed or explicitly blocked.
- Historical PR details remain in `receipts.jsonl`; they are not active restart
  instructions.

## Active Slice

Selected active slice after PR #412 landed and local `main` was pulled:
`PU-015 Judge/PM audit packet`.

PU-056 closed the active-route/runtime-card mismatch. The current local PU-015
patch adds guardrails for receipt-backed reviewer proofs and claimed authority
matching. It does not yet prove Judge/PM readiness: the live packet, reviewer
artifacts, PR review/merge, Linear field-text disposition, and final closeout
audit remain separate lanes.

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
| PU-015 Judge/PM audit packet                                     | selected next slice                                                     | `src/lib/delivery-truth/judge-pm-audit.test.ts` passes, but no live final audit packet is produced for this goal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Produce the live packet from current-main evidence and keep Linear field-text disposition explicit. |
| Final requirement-by-requirement completion audit                | blocked by Linear disposition, Judge/PM packet, and final docs accuracy | goal.md completion contract still requires PU/GAP/SPG reconciliation and Judge/PM packet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Do not claim parent completion.                                                                     |

Selected next slice: `PU-015 Judge/PM audit packet`.

Reason: PU-056 and PR #412 are merged and pulled back, and this refresh has
removed the active PR #412 gate from the restart surface. Runtime-card current-main proof now shows
`issueKey: "JSC-363"` with the active JSC-363 spec and plan, so the next
remaining bounded closeout slice is the live Judge/PM packet with Linear
field-text disposition kept explicit.

## History Boundary

Merged PR lanes through PR #383 remain provenance. They are not active route
lanes and must not be expanded in the active board unless a fresh current-main
regression reopens them.

Receipt history remains append-only. New receipts should be compact
claim/evidence/blocker records, not narrative diary entries.

## Resume Gate

Judge/PM packet work may start only after this post-PR412 tracker refresh is
accepted or explicitly waived. The packet must stop if any of these are false:

- Local `main` and `origin/main` are synced to
  `7e0dde9c0408388fc228e8c2afe049593f1b0b71`.
- Runtime-card on pulled current main returns `issueKey: "JSC-363"` with the
  JSC-363 active spec and plan.
- Linear JSC-363 field-text currency is refreshed, owner-classified as not
  required, or recorded as an explicit blocker.
- `goal.md`, `state.yaml`, `notes/execution-tracker.md`,
  `.harness/active-artifacts.md`, the tracker board, and `receipts.jsonl`
  validate together after the post-PR412 refresh.
- The Judge/PM packet records claim support, unsupported claims, stale evidence,
  and remaining risks without claiming parent-goal completion by itself.

## Linear Update Payload

Use this payload only after Linear access is available or an owner explicitly
approves posting the blocker classification for JSC-363:

```md
Refreshed JSC-363 current-main route truth after PR #412 merge.

Current truth:

- Active route lane: PU-015 Judge/PM audit packet preparation after PR #412 pullback.
- Latest merged route: PR #412.
- Local main head: `7e0dde9c0408388fc228e8c2afe049593f1b0b71`.
- Origin main head: `7e0dde9c0408388fc228e8c2afe049593f1b0b71`.
- Current GitHub check rollup showed repo-owned required checks for PR #412 pass before merge.
- Runtime-card current-main output returns issueKey JSC-363 with the JSC-363 active spec and plan.
- PU-013 runtime cockpit integration proof is merged and pulled back to local `main`.
- PR #412 is merged tracker evidence only and remains separate from Linear field-text currency, Judge/PM readiness, and parent goal completion claims.
- PU-056 deterministic guard coverage is merged and pulled back.
- External Snyk GitHub App quota/status remains an owner waiver for that external lane only.
- Linear JSC-363 has repo-truth comment `81cfdd41-ff0e-4df1-b884-c01789e30a50`; field-text currency remains unclaimed until a fresh Linear fetch or owner classification is recorded.

Restart rule:
The next selected slice is `PU-015 Judge/PM audit packet`. It starts only
after this local post-PR412 tracker refresh is accepted or explicitly waived.
```
