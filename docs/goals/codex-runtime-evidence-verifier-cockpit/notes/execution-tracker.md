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

| Field               | Current Truth                                                      |
| ------------------- | ------------------------------------------------------------------ |
| Parent issue        | JSC-363                                                            |
| Canonical goal      | `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`       |
| Current branch      | `codex/jsc-363-post-pr393-tracker-refresh`                         |
| Local main head     | `fbf3c215608f25ede94a066e2003b4c5e6188189`                         |
| Origin main head    | `fbf3c215608f25ede94a066e2003b4c5e6188189`                         |
| Main baseline       | `fbf3c215608f25ede94a066e2003b4c5e6188189`                         |
| Active route count  | 1                                                                  |
| Active route        | PR #396 conflict repair and remote truth refresh                   |
| Last closed route   | PR #394 merged                                                     |
| Current route       | PR #396 draft repair                                               |
| Current slice       | Push repair, trigger CodeRabbit again, refresh CI and review truth |
| Feature work status | No next feature slice started                                      |

## Active Route

PR #396 is the active draft repair lane for
`codex/jsc-363-post-pr393-tracker-refresh`. GitHub reported the PR
`DIRTY` with failing `pr-pipeline` and `linear-gate` checks before this
repair. The branch has merged `origin/main` at
`b8ec50057338f3d7bea0973330d830c93bccee51`, preserving current-main route
truth and hook/environment check repairs. This route does not claim remote push,
fresh CI, CodeRabbit freshness, review-thread resolution, merge readiness,
Linear field-text currency, root-hygiene proof, documentation accuracy,
Judge/PM readiness, release readiness, or parent-goal completion.

Current evidence:

- Local `main` and `origin/main` are synced at
  `fbf3c215608f25ede94a066e2003b4c5e6188189`.
- Live GitHub reports PR #396 open, draft, and `DIRTY` at pre-repair remote
  head `de0ba15f93998fc2adc4cf8fe17a7e97c0f53cfb`; visible failing lanes are
  `pr-pipeline` and `ci/circleci: linear-gate`. The external
  `security/snyk (jscraik)` GitHub App quota/error lane remains owner-waived
  only for that external app status.
- Local repair head
  `b8ec50057338f3d7bea0973330d830c93bccee51` merges current
  `origin/main` into the PR #396 branch.
- Next safe action: push the repair, trigger CodeRabbit again with
  `@coderabbitai review this pr`, refresh `pr-pipeline` and `linear-gate`,
  fix only current-head failures, then merge/pull back and refresh this tracker.
- Live GitHub reports PR #394 merged at `2026-06-09T12:09:12Z` from submitted
  head `8b98cc6299d566ccf3b472781ee6def606c9ea79` as squash merge commit
  `9014b416f170ef6069416aa2d356845232cf2de1`; repo-owned CircleCI,
  aggregate `pr-pipeline`, aggregate `security-scan`, Socket, CodeRabbit,
  and Snyk status passed before merge.
- Linear JSC-363 fetch returned status `In Review`, Phase 1 title/description
  text, and PR #394 attachment; comment
  `81cfdd41-ff0e-4df1-b884-c01789e30a50` records the current repo-truth
  classification without claiming parent-goal completion.
- Live GitHub reports PR #393 merged at `2026-06-09T11:29:52Z` from submitted
  head `e1adee25ab692d3a554f1ae318b816762c3d045c` as squash merge commit
  `566a0a78286f5a1999eee4c332256475d4f19508`; repo-owned CircleCI,
  aggregate `pr-pipeline`, aggregate `security-scan`, Socket, CodeRabbit
  status, and review-thread checks passed or had no unresolved threads.
- Live GitHub reports PR #392 merged at `2026-06-09T11:10:16Z` from submitted
  head `d9bd5c42c25a315dc4e112b546003402422fbdae`; repo-owned CircleCI,
  aggregate `pr-pipeline`, aggregate `security-scan`, Socket, CodeRabbit
  status, and review-thread checks passed or had no unresolved threads. The
  external Snyk GitHub App private-test quota failure remains owner-waived for
  that external lane only.
- Live GitHub reports PR #391 merged at `2026-06-09T10:44:15Z` from submitted
  head `624bde7f10d7caf4f3b53a786da9b940bced9237`; visible PR checks passed
  before merge, including CodeRabbit, repo-owned CircleCI, Socket, aggregate
  `pr-pipeline`, aggregate `security-scan`, and Snyk status.
- Pre-patch command probe on clean current main returned a false
  `worktree_state_blocked` result from `node --import tsx src/cli.ts next --json`.
- The local patch keeps empty status output as a valid clean signal only for
  `git status --short --untracked-files=all`; other git metadata commands keep
  their previous empty-output handling.
- `pnpm vitest run src/commands/next.test.ts`, `pnpm check`,
  `pnpm lint -- src/commands/next-runner-inputs.ts src/commands/next.test.ts`,
  `pnpm typecheck`, `pnpm run quality:docstrings`,
  `pnpm run quality:size`, `pnpm run test:related`, and
  `bash scripts/validate-codestyle.sh --fast` passed locally.
- `pnpm test:deep` reached the E2E tail and stopped because GitHub and Linear
  credentials were not visible in the process environment and
  `<REDACTED_HOME_PATH>/.codex/.env` is a FIFO in this sandbox.
- Local validation lanes were rerun sequentially after an accidental concurrent
  broad-gate run produced invalid artifact/temp contention failures; the
  sequential `pnpm check` pass is the valid local broad-gate evidence.
- The Linear field-text decision remains outstanding and blocked until a usable
  Linear MCP/tool/token path exists or the owner classifies stale Linear fields
  as historical while repo tracker truth remains canonical.
- PR #390 merged the post-PR389 route truth refresh at
  `8003f0f84c07f80e93400d4c8f46378d83398142`.
- Local `main` and `origin/main` were previously synced at
  `2b1b20cbaab259041b53e53fcabfa24a248528a2` after PR #389 merge pullback.
- Live GitHub reports PR #389 merged at 2026-06-09T08:54:35Z from submitted
  head `edae037da4bc46457f2412bb0a1506fe8d689abe` as squash merge commit
  `2b1b20cbaab259041b53e53fcabfa24a248528a2`.
- PR #389 repo-owned required checks passed on the submitted head, CodeRabbit
  passed, review threads were resolved, and post-merge route-truth refresh
  landed through PR #390.
- Local `main` and `origin/main` were previously synced at
  `5452ce126acabdd5e921c6bed59e23d70dbe4b79` after PR #385 merge pullback.
- Live GitHub reports PR #385 merged at 2026-06-09T04:00:10Z from submitted
  head `b6951de3a5d8627c80b78cc911c10d526dd4e24b` as squash merge commit
  `5452ce126acabdd5e921c6bed59e23d70dbe4b79`.
- PR #385 repo-owned required checks passed on the submitted head, CodeRabbit
  passed, review-thread refresh returned zero unresolved threads, and post-merge
  audit-freshness, goal-board, and tracker-board validators passed on current main.
- Local `main` and `origin/main` were previously synced at
  `96846c31b7d3b1bade77b1145543ab1c92c797ae` after PR #384 merge pullback.
- Live GitHub reports PR #384 merged at 2026-06-09T03:05:01Z from submitted
  head `19b193cd4d628f3cd50c215976890ca743e259dd` as squash merge commit
  `96846c31b7d3b1bade77b1145543ab1c92c797ae`.
- PR #384 repo-owned required checks passed on the submitted head, CodeRabbit
  passed, review-thread refresh returned zero unresolved threads, and post-merge
  audit-freshness, goal-board, and tracker-board validators passed on current main.
- PR #383 remains merged validator-repair provenance from submitted head
  `777b3fd38b64b71edf6a3e5286596cec087e6ed5` as squash merge commit
  `b0fadd87c023cfeaa474bc6bfb5e7d0cf5cdf174`.
- Live GitHub reports PR #382 merged at 2026-06-09T01:58:34Z from submitted
  head `784070cb93a8fe0204d05bfb909608711128c0d0` as squash merge commit
  `b6f31c3f4027eee331fc98579c24eb560fb67d22`.
- PR #382 required contexts passed only after the original failed CircleCI
  workflow was rerun from failed jobs, which emitted the required
  `ci/circleci: linear-gate` and `ci/circleci: risk-policy-gate` contexts.
- Live GitHub reports PR #381 merged at 2026-06-09T01:25:32Z from submitted
  head `f0e115b744b0bbc32268343ed3d6d1efe679cf40` as squash merge commit
  `14918c8d20df6da29f3b2531820da24405e727d2`.
- PR #381 repo-owned CircleCI lanes, aggregate `pr-pipeline`, CodeRabbit, and
  review-thread refresh passed before merge. The external Snyk GitHub App
  status remained owner-waived for the quota/status lane only.
- PR #381 review-thread refresh returned zero unresolved threads before merge.
- PR #380 repo-owned CircleCI lanes, aggregate `pr-pipeline`, CodeRabbit
  status, Socket, and CircleCI Snyk dependency scan passed before merge after a
  body-only `pr-template` repair and failed-job rerun.
- PR #380 review-thread refresh returned zero unresolved threads before merge.
- Live GitHub reports PR #379 merged from submitted head
  `ac6d883a4568e048db47dad8f6106b5c266f3f73` as squash merge commit
  `0d25c6ac410c4d4f1d0a5c5231ce835e8ed1f533`.
- PR #379 repo-owned CircleCI lanes, aggregate `pr-pipeline`, CodeRabbit
  status, Socket, and CircleCI Snyk dependency scan passed before merge.
- PR #379 review-thread refresh returned zero unresolved threads before merge.
- The external Snyk GitHub App quota/status lane remains owner-waived for that
  external lane only; it is not external Snyk success and not a security waiver
  for repo-owned gates.
- PR #378 is merged and local `main` was previously synced at
  `28b0bf30091689559afad2e3240f1f849122cf48` after PR #378 merge pullback.
- Live GitHub reports PR #378 merged at 2026-06-08T23:33:58Z from submitted
  head `9b003db2bec03f0638e8fbd4d296c8bc38816167` as squash merge commit
  `28b0bf30091689559afad2e3240f1f849122cf48`.
- PR #378 repo-owned CircleCI lanes, aggregate `pr-pipeline`, CodeRabbit
  status, Socket, and CircleCI Snyk dependency scan passed before merge.
- PR #378 review-thread refresh returned zero unresolved non-outdated threads
  before merge.
- The external Snyk GitHub App quota/status lane remains owner-waived for that
  external lane only; it is not external Snyk success and not a security waiver
  for repo-owned gates.
- Live GitHub reports PR #374 merged from submitted head
  `ca7bc92aeeeb5fa357732fbad8f49f62f54abc2b`.
- The PR body was repaired after the local source-checkout `pr-template-gate`
  reproduced eight findings and then passed with zero findings against the
  repaired body artifact.
- CodeRabbit was manually triggered with `@coderabbitai review this pr` at
  https://github.com/jscraik/coding-harness/pull/374#issuecomment-4652005383.
- PR #374 repo-owned CircleCI lanes, aggregate `pr-pipeline`, CodeRabbit
  status, Socket, and CircleCI Snyk dependency scan passed before merge.
- R419 records the PR #375 CodeRabbit review-fix commit and sibling-pattern
  sweep. R420 and R421 record PR #375 merge pullback and current-main route refresh validation. R422 records PR #376 merge pullback and current-main route refresh. R423 records post-PR376 tracker validation. R424 records PR #377 merge pullback. R426 records PR #378 merge pullback.
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
   - Pass criteria: Goal state, board, visual tracker, audit freshness, and
     receipt syntax agree on current `main`.

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

The selected active slice is the `harness next` clean-worktree-state repair.
It is local-validation complete except for the credential-bound E2E tail and is
open as PR #391.

Current slice boundary:

- Project area: `src/commands/next-runner-inputs.ts` and
  `src/commands/next.test.ts`.
- Objective: preserve empty clean `git status --short --untracked-files=all`
  output as explicit clean-state evidence so `harness next` does not block a
  clean checkout as dirty.
- Output: code patch, regression test, compact receipt, synchronized
  goal/state/tracker/Kanban update, one PR, PR triage, merge, and pullback.
- Boundary: this slice must not make `harness next` execute actions, act as
  merge authority, reopen runtime-card evidence storage, or claim Linear field
  text.
- Current blocker: exact `pnpm test:deep` completion is blocked at the E2E tail
  because GitHub and Linear credentials are not visible in the process
  environment and `<REDACTED_HOME_PATH>/.codex/.env` is
  `blocked_env_fifo_timeout` in this sandbox. Focused tests and
  broad local `pnpm check` pass.

Non-claims:

- This slice does not produce root-hygiene evidence, Judge/PM readiness, Linear
  field-text currency, PR merge readiness, or parent goal completion.
- No broader feature lane is active during this repair route.

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
