---
date: 2026-05-30
report_type: delivery-lifecycle-audit
status: advisory
repo: coding-harness
branch: codex/jsc-363-intermediary-receipt-coverage
---

# Delivery Lifecycle Audit

## Table of Contents

- [Purpose](#purpose)
- [Evidence Base](#evidence-base)
- [Lifecycle Map](#lifecycle-map)
- [Queues And Waiting States](#queues-and-waiting-states)
- [Ranked Bottlenecks](#ranked-bottlenecks)
- [Cross-Cutting Improvement](#cross-cutting-improvement)
- [Validation](#validation)

## Purpose

Analyze the coding-harness delivery lifecycle for queues, waiting states, handoffs, approvals, and bottlenecks. Rank bottlenecks by likely throughput impact, using current repo evidence rather than assumed process shape.

This audit is advisory. It does not claim live Linear, GitHub, PR, CI, review, or merge readiness unless the cited source itself records a current refresh.

## Evidence Base

- `AGENTS.md` and `CODESTYLE.md` for required workflow, validation, and closeout boundaries.
- `docs/agents/13-linear-production-workflow.md` and `docs/agents/16-linear-production-compact.md` for canonical issue states, queue movement, handoff, close, and blocked overlay rules.
- `docs/agents/04-validation.md` for validation, closeout, verify-work resume, and blocked-recovery policy.
- `docs/agents/12-ai-review-governance.md` for independent review and CodeRabbit authority.
- `docs/agents/08-release-and-change-control.md` for release/change-control gates and post-change validation.
- `.harness/active-artifacts.md` for the current local active route and explicitly unclaimed lifecycle lanes.
- `.harness/README.md` for `.harness/audits/**` artifact classification.
- `git status --short --branch` for current branch/worktree pressure.

## Lifecycle Map

The delivery system has a well-defined control-flow spine:

| Stage | Queue or State | Entry Signal | Exit Signal | Primary Owner |
| --- | --- | --- | --- | --- |
| Intake | Linear `S0 TRIAGE` | issue candidate, bug, policy gap, workflow regression, release follow-up | scoped issue with clear next action | operator or triage agent |
| Ready queue | Linear `S1 READY` | triage promotion within lane and cycle guards | `harness linear claim` plus branch | assignee or implementation agent |
| Active work | Linear `S2 IN_PROGRESS` | claimed issue and branch | DoD pre-review checks plus PR/evidence handoff | implementation agent |
| Review queue | Linear `S3 IN_REVIEW` | `harness linear handoff` with PR and evidence | merge with required checks, or return to active work | reviewer, CI, PR owner |
| Closeout | Linear `S4 DONE` | merged PR and required checks | branch/worktree cleanup, tracker closure, retained evidence | operator or closeout agent |
| Failure lane | Linear `S5 FAIL` | unrecoverable validation, policy, or system error | explicit remediation and re-entry through triage/ready | owner assigned by failure packet |

The lifecycle also has important non-state overlays:

- `Blocked` is a label overlay on `READY`, `IN_PROGRESS`, or `IN_REVIEW`, not a canonical state.
- PR, merge, branch/worktree, Linear, next-lane routing, and continuation state must be classified separately before closeout.
- Local validation, remote CI, review threads, tracker truth, merge readiness, Judge/PM readiness, and goal completion are separate truth lanes.

## Queues And Waiting States

| Queue Or Wait | Work Entering | Work Leaving | Current Growth Signal | Risk |
| --- | --- | --- | --- | --- |
| Linear triage | bugs, features, policy gaps, workflow regressions, release follow-ups | scoped items promoted to `READY` | many tracked plans/specs exist; active index demotes historical items but still carries broad context | stale or duplicate work can be reactivated without live Linear refresh |
| Ready queue | scoped issues with feasible next action | claimed branch and `IN_PROGRESS` issue | active artifacts list multiple route candidates, but only JSC-363 is current route | agents can spend time selecting the route instead of delivering |
| In-progress implementation | claimed issue, branch, intent artifact, slice plan | PR opened, validation evidence attached | current branch is ahead 18, behind 21, with 84 local changes visible in the checkout | local dirt and branch drift increase review, rebase, and validation delay |
| Validation gate queue | changed code/docs/artifacts requiring proof | passed narrow gate, codestyle, verify-work, or blocked classification | verify-work supports resume, but failures still require artifact reading and rerun from gate boundary | gates become a serial wait when failure ownership is unclear |
| Review queue | PR plus evidence, CodeRabbit, Codex review, optional swarm artifacts | resolved threads, independent review signal, all required checks | active artifacts record PR stack refreshes but leave reviewDecision, review-thread truth, and merge execution unclaimed | green checks can wait behind review-state or stale-stack confirmation |
| External truth refresh | PR/CI/review/Linear/merge claims needing current proof | current snapshot or explicit blocked reason | active route repeatedly requires refresh of PR #315/#316 reviewDecision, review threads, stack readiness, Linear scope, and mergeability | repeated manual refresh consumes high attention and slows closeout |
| Judge/PM readiness | goal-level completion claims after slices | final audit packet or blocked state | JSC-363 explicitly keeps Judge/PM readiness and final goal completion unclaimed | slices can pile up as locally complete but not accepted |
| Cleanup and handoff | merged/closed PR, final branch/worktree state, continuation state | branch/worktree cleaned or retained with owner/reason | branch is both ahead and behind, and active artifacts recommend isolated clean worktree continuation | residue makes the next slice slower and raises accidental-scope risk |

## Ranked Bottlenecks

### 1. Manual External Truth Reconciliation

Throughput impact: very high.

Work entering:

- PRs that are locally validated but still need current GitHub, CI, CodeRabbit, review-thread, Linear, stack-base, mergeability, and Judge/PM truth.
- JSC-363 stack slices where PR #315/#316 state, Linear scope alignment, and merge readiness must be refreshed before any closeout claim.

Work leaving:

- A closeout-ready packet that separately classifies local validation, remote checks, review threads, tracker state, branch/worktree state, merge readiness, and next-lane routing.
- Or an explicit `waiting` / `blocked` state with owner and unblock action.

Queue growth:

- `.harness/active-artifacts.md` records repeated PR stack refreshes and still leaves reviewDecision, stacked-base merge execution, Linear full-lifecycle scope alignment, Judge/PM readiness, runtime producer emission, delivery-truth consumption, and final goal completion unclaimed.
- Memory and repo guidance both reinforce that stale merged-PR metadata and partial local truth repeatedly created false blockers or overclaim risk.

Cost of delay:

- High operator attention cost: every closeout requires rediscovering which lanes are current versus stale.
- High PR lead-time cost: green local checks do not move work forward until external state is manually refreshed and classified.
- High rework risk: stale review or Linear state can cause the wrong branch, PR body, or tracker transition to be repaired.

Root cause:

- The repo correctly separates truth lanes, but the external refresh step is still distributed across runbooks, PR comments, active-artifact notes, and manual GitHub/Linear checks.
- `pr-closeout/v1`, delivery-truth, review-state, and external-state contracts exist or are planned, but the production path is not yet a single routine closeout rail for all claims.

Improvement opportunity:

- Make `harness pr-closeout` or a sibling delivery-lifecycle command the standard reconciling surface for PR/CI/review/Linear/merge/branch state.
- Emit one compact lifecycle snapshot with per-lane status, freshness, head SHA, blocker class, owner, and next action.
- Persist snapshots as `.harness` or `artifacts/pr-closeout` evidence only when redacted and intentionally promoted.

Next Steps:

1. Define the minimum lifecycle snapshot schema from existing `pr-closeout/v1`, `delivery-truth/v1`, `review-state/v1`, and `external-state-snapshot/v1` fields.
2. Add a narrow source-repo command path or mode that refreshes GitHub review threads, required checks, mergeability, branch drift, and Linear linkage for one PR/Linear key.
3. Teach closeout docs to require that snapshot before any `ready`, `merged`, `Judge/PM-ready`, or `goal-complete` claim.
4. Add fixture-backed tests for stale PR state, unresolved review threads, missing Linear linkage, and mixed-head merge readiness.

### 2. Dirty Root Checkout And Branch Drift As Default Work Surface

Throughput impact: very high.

Work entering:

- New implementation slices, review repairs, audit requests, and PR-stack triage that start from the current checkout.
- Current checkout state: branch `codex/jsc-363-intermediary-receipt-coverage` is ahead 18 and behind 21 with 84 local changes.

Work leaving:

- Clean, branch-scoped patches with validation evidence and PR handoff.
- Or an explicit orientation-only root with implementation moved to an isolated worktree.

Queue growth:

- Active artifacts already recommend the next implementation slice resume in an isolated clean worktree or branch context so unrelated local dirt and open PR triage do not contaminate the slice.
- The current dirty state includes governance docs, scripts, runtime modules, tests, audits, media, and generated-looking artifacts.

Cost of delay:

- High review cost: reviewers must separate task intent from unrelated local work.
- High validation cost: broad gates may fail from unrelated changes or require expensive diff classification before any real progress.
- High merge cost: ahead/behind drift increases rebase, conflict, and stale evidence pressure.

Root cause:

- The root checkout is serving both as orientation surface and active patch surface.
- The lifecycle has a good isolated-worktree recommendation, but it appears as guidance rather than an enforced entry gate for stack repair and fresh slices.

Improvement opportunity:

- Treat dirty/ahead-behind root state as a hard lifecycle fork: orientation in root, implementation in clean worktree.
- Add a pre-slice `harness next` or `prepare-worktree` recommendation that blocks mutating work in a dirty root when changed files exceed a threshold or branch drift is non-zero.

Next Steps:

1. Add a lifecycle checklist item: classify root checkout as `implementation` or `orientation`.
2. Extend `harness next --json` safety metadata to recommend clean worktree creation when root dirt or branch drift exceeds policy.
3. Add a report field to closeout snapshots: `worktreeRole: implementation|orientation|unknown`.
4. For the active JSC-363 route, continue new implementation slices in a clean worktree and leave this checkout as audit/orientation unless explicitly reconciled.

### 3. Review Artifact And Independent Approval Wait

Throughput impact: high.

Work entering:

- PRs and lifecycle slices requiring CodeRabbit, Codex, or role-specific review evidence.
- Swarm or reviewer lanes that are expected to write artifact-first reports.

Work leaving:

- Independent review signal attached to the PR or tracked artifact.
- Resolved or explicitly waived review threads.
- Verified non-empty review artifacts when artifact-first review was requested.

Queue growth:

- The root guidance requires independent review and prohibits coding-agent self-approval.
- The system review log records an earlier case where mailbox summaries existed but expected reviewer artifact files were missing, blocking implementation until artifacts were retargeted to tracked `.harness/review` paths.

Cost of delay:

- Medium-high to high: a PR can be locally correct and CI-green but still wait on missing artifacts, unresolved review threads, or absent CodeRabbit signal.
- Missing artifacts cause repeat review runs and coordinator synthesis work.

Root cause:

- Review completion can be represented in too many places: mailbox text, GitHub review state, CodeRabbit checks, comments, tracked review artifacts, and PR body fields.
- Artifact-first requirements are strong, but the lifecycle still relies on the coordinator to verify expected files and retry missing artifacts.

Improvement opportunity:

- Make reviewer artifact verification a first-class gate with expected artifact list, producer, path, size, and status.
- Feed that gate into the same lifecycle snapshot as PR and CI truth.

Next Steps:

1. Define a reviewer artifact manifest for swarms and high-risk PRs.
2. Add a small validator that fails when an expected review artifact is missing, empty, or stored only in ignored runtime paths.
3. Ensure PR closeout records review-thread truth from GitHub GraphQL `reviewThreads`, not flat comments or check summaries alone.
4. Route missing review artifacts to `waiting_review_artifact` with owner and retry count.

### 4. Validation Gate Serialization And Resume Friction

Throughput impact: high.

Work entering:

- Code, docs, generated artifact, workflow, and governance changes requiring narrow validation, codestyle, `verify-work`, docs-gate, and sometimes deep tests.

Work leaving:

- Passed gate artifacts or a blocked classification with failure class and next action.

Queue growth:

- `verify-work` records run-state and supports resume from failed gates, but only when compatibility keys match and prior gates passed.
- Failure classes require manual reading of `.harness/runs/<run-id>/gates/*` artifacts before repair and resume.

Cost of delay:

- High during broad governance changes: a single failed serial gate can hold all downstream confidence.
- Moderate rework cost when agents rerun broad gates from the start instead of resuming from the first failed boundary.

Root cause:

- The gate model is robust, but failure-to-next-action presentation is not yet the main operator surface.
- Validation proof is spread across command output, run artifacts, docs, and PR body fields.

Improvement opportunity:

- Promote the latest failed gate summary into `harness next --json` and PR closeout snapshots.
- Make `failureClass`, `nextAction`, and `resumeCommand` immediately visible without requiring manual artifact spelunking.

Next Steps:

1. Add a `latestValidationBlocker` section to the next-action or closeout surface.
2. Include `resumeCommand` when compatibility allows resume.
3. Add a regression that a failed `ci-check-alignment` or docs-gate lane emits failure class plus deterministic next action.
4. In handoffs, report the first failed gate only, not a blended list of all downstream unrun gates.

### 5. Intent, Plan, And Goal Coverage Before Implementation

Throughput impact: medium-high.

Work entering:

- New lifecycle slices, especially JSC-363 runtime evidence units and any architecture-adjacent packet or verifier work.

Work leaving:

- Reviewed slice intent, accepted scope, allowed/forbidden files, validation gates, reviewer roles, PR strategy, rollback path, and receipt mapping.

Queue growth:

- JSC-363 requires reviewed intent before implementation, per-slice receipts, and historical review-coverage backfill or ratification before Judge/PM closeout.
- Active artifacts carry multiple historical and current plans/specs, requiring reconciliation before using them as execution input.

Cost of delay:

- Medium-high: intent review slows the first patch but prevents broad rework when a slice crosses lifecycle families.
- The delay becomes harmful when intent artifacts are missing or stale after code already exists.

Root cause:

- The lifecycle intentionally moved planning and review earlier, but there is still no small visible queue showing which slice intents are reviewed, blocked, superseded, or ready.

Improvement opportunity:

- Add an intent queue index for the active goal with `ready`, `blocked`, `superseded`, `implemented`, and `receipt_required` states.

Next Steps:

1. Extend the JSC-363 goal board or `.harness/active-artifacts.md` with a compact per-slice intent status table.
2. Add a validator that refuses slice-done receipts when intent review is missing or stale.
3. Keep broad multi-family patches behind explicit intent review with blast-radius justification.

### 6. Linear Status Mutation And Credential Boundary

Throughput impact: medium.

Work entering:

- Work needing `harness linear claim`, `handoff`, `close`, triage promotion, or GitHub-to-Linear sync.

Work leaving:

- Tracker state updated, PR attached, evidence linked, or blocked with missing credential/permission class.

Queue growth:

- Linear is the system of record, but commands require `LINEAR_API_KEY` or `--token`; docs require loading `~/.codex/.env` before classifying missing credentials.
- Active artifacts explicitly state live Linear refresh for some lanes remains an external action.

Cost of delay:

- Medium: implementation can proceed locally, but handoff and closeout stall when tracker state is stale or credential availability is unclear.

Root cause:

- The auth boundary is correct and safe, but credential discovery is often deferred until closeout.

Improvement opportunity:

- Probe credential availability at lifecycle start and record the result as `linearMutation: available|blocked|not_needed`.

Next Steps:

1. Add Linear credential readiness to `harness next --json` or the slice-start checklist without printing secrets.
2. Record unavailable Linear mutation as a waiting state early, not during final closeout.
3. Keep tracker mutation separate from local code validation in handoff notes.

### 7. Release And Benchmark Readiness Gate

Throughput impact: medium.

Work entering:

- Milestone, release-tagged branch, behavior-changing policy edits, or release packaging work.

Work leaving:

- Current-head `pnpm check`, command contract verification, contradiction cleanup, fresh benchmark evidence, rollback notes, and tag path readiness.

Queue growth:

- Release work has a clear checklist, but benchmark cadence and contradiction cleanup are separate from daily PR closeout.

Cost of delay:

- Medium: release can wait behind evidence gathering even when individual PRs are merged.

Root cause:

- Release readiness is batch-oriented, while the main delivery lifecycle is slice-oriented.

Improvement opportunity:

- Continuously collect release readiness deltas from each PR closeout so the release checklist is mostly pre-filled before tag day.

Next Steps:

1. Add a `releaseReadinessImpact` field to lifecycle snapshots for governed changes.
2. Record benchmark freshness status when release-affecting surfaces change.
3. Keep release blockers visible as a queue separate from implementation PRs.

## Cross-Cutting Improvement

The highest-leverage fix is a single delivery-lifecycle snapshot generated at handoff and closeout. It should not collapse truth lanes; it should make them visible together:

| Lane | Required Fields |
| --- | --- |
| local validation | command, status, evidence ref, verifiedAt |
| PR state | PR number, head SHA, state, draft/ready, mergeable |
| CI state | required checks, status, source, refreshedAt |
| review state | CodeRabbit check, Codex/human reviews, unresolved threads, artifacts |
| Linear state | issue key, status, PR link, evidence link, mutation availability |
| branch/worktree | clean/dirty, ahead/behind, pushed, worktree role |
| continuation | next safe action, waiting owner, blocker, heartbeat/follow-up |
| acceptance | completed acceptance IDs, explicit non-completion, Judge/PM state |

This preserves the repo's core truth-separation rule while reducing the manual cost of reconstructing those lanes for every handoff.

## Validation

- Command: `pwd` -> pass (confirmed repo root: `/Users/jamiecraik/dev/coding-harness`).
- Command: `git status --short --branch` -> pass (current branch observed as ahead 18 and behind 21 with 84 local changes; this audit did not revert or modify unrelated work).
- Command: `rg` and `sed` over lifecycle docs, active artifacts, memory, and existing audit reports -> pass (evidence gathered for report).
- Command: `bash scripts/codex-preflight.sh --mode optional` -> pass before this turn per session context.
- Broader repo validation -> not run (advisory report only; no executable code, governed workflow contract, or validation behavior changed).

