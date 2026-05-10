---
schema_version: 1
artifact_id: jsc-198-flow-ops-closure-evidence-reconciliation-spec
artifact_type: he-spec
canonical_slug: jsc-198-flow-ops-closure-evidence-reconciliation
title: JSC-198 Flow Ops Closure Evidence Reconciliation Spec
harness_stage: he-spec
status: draft
date: 2026-05-09
traceability_required: true
origin: .harness/linear/coding-harness-linear-plan.md
linear_issue: JSC-198
linear_status: Todo
linear_milestone: Control loop hardening and flow telemetry
risk: closure-sensitive
depth: bounded
ui: false
---

# JSC-198 Flow Ops Closure Evidence Reconciliation Spec

## Table Of Contents

- [Mode Decision](#mode-decision)
- [Problem](#problem)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Linear Contract](#linear-contract)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Boundary](#boundary)
- [Baseline](#baseline)
- [Domain Model](#domain-model)
- [Classification Rules](#classification-rules)
- [Lifecycle](#lifecycle)
- [Evidence Precedence And Freshness](#evidence-precedence-and-freshness)
- [Interfaces](#interfaces)
- [Fixture Contract](#fixture-contract)
- [Invariants](#invariants)
- [Failure And Recovery](#failure-and-recovery)
- [Observability](#observability)
- [Validation Plan](#validation-plan)
- [Review Gate](#review-gate)
- [Phase Admission Rules](#phase-admission-rules)
- [Acceptance Matrix](#acceptance-matrix)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [First Slice](#first-slice)
- [Open Questions](#open-questions)
- [Done](#done)
- [he-plan Handoff](#he-plan-handoff)
- [Blackboard Delta](#blackboard-delta)
- [Evidence](#evidence)

## Mode Decision

Spec mode: Linear-backed parent issue with supporting child issues.

Selected slice:

- Type: parent issue.
- Linear issue: `JSC-198`.
- Title: `Flow Ops: Instrument Linear-GitHub-CircleCI lifecycle telemetry and gates`.
- Linear project: `coding-harness`.
- Linear milestone: `Control loop hardening and flow telemetry`.
- Source: `.harness/linear/coding-harness-linear-plan.md`.

Supporting issues:

- `JSC-199`: Sync GitHub PR lifecycle metadata back to Linear issues.
- `JSC-200`: Sync CircleCI pipeline outcomes into Linear flow metrics.
- `JSC-201`: Enforce intake and done gates for HE workflow.

This spec intentionally narrows `JSC-198`. The admitted work is not a broad
telemetry platform. It is the smallest closure-evidence reconciliation slice
that prevents completed or blocked work from leaking into the next planning
cycle.

## Problem

The HE execution loop repeatedly reaches the same operational failure mode:
work finishes or blocks in GitHub, CircleCI, eval artifacts, or local harness
state, but the next Linear Delta Capture Gate still has to infer closure state
from chat memory and manual inspection.

That creates execution drag:

- Completed slices can remain visible as active planning candidates.
- Follow-up PRs can be missed when eval or review evidence lands after the
  main implementation PR.
- CircleCI or GitHub check state can be treated as stale, unclear, or manually
  accepted without a deterministic classification record.
- Linear issue state can drift from repo evidence, causing the next spec to
  reopen old work or route around missing closure proof.

The repository already has the right cognition layers: `.harness/linear`,
`.harness/specs`, `.harness/plan`, `.harness/evals`, PR evidence, and Linear
state. The missing piece is a narrow reconciliation contract that classifies
closure evidence before the next slice is admitted.

## Goals

- Define a deterministic closure evidence model for one HE slice.
- Reconcile four closure inputs: Linear state, GitHub PR state, CircleCI check
  state, and eval artifact presence.
- Produce a small approved next-slice queue that distinguishes complete,
  blocked, stale, and admissible work.
- Fail closed when evidence is missing, stale, contradictory, or unverifiable.
- Keep `JSC-199`, `JSC-200`, and `JSC-201` subordinate to this narrow closure
  evidence slice until the proof works.
- Preserve human approval for closure decisions that would mutate Linear,
  close trackers, mark review threads resolved, or treat blocked evidence as
  accepted.

## Non-Goals

- Do not build a broad telemetry dashboard.
- Do not introduce weekly flow-health reporting in this slice.
- Do not roll out new Linear custom fields unless a later human-approved plan
  explicitly admits them.
- Do not automatically close Linear issues or transition statuses.
- Do not create a webhook system.
- Do not redesign the full HE lifecycle.
- Do not reopen already completed implementation scope from `JSC-282`,
  `JSC-283`, `JSC-288`, `JSC-289`, `JSC-290`, or `JSC-178`.
- Do not treat CircleCI integration as a general metrics ingestion program.
- Do not make `.harness/linear` replace live Linear state; it remains the
  approved local planning snapshot.

## Linear Contract

Workspace/team: `Jscraik` / `JSC`.

Project: `coding-harness`.

Initiative: `Dev Portfolio`.

Milestone: `Control loop hardening and flow telemetry`.

Parent issue: `JSC-198`.

Supporting issues:

- `JSC-199`.
- `JSC-200`.
- `JSC-201`.

Priority: High.

Recommended labels:

- `Reliability`
- `Automation`
- `Drift-Risk`
- `Agent-Native`

Execution route:

- Agent-assisted.
- Human review required before any Linear mutation, status transition,
  automation boundary, or done-gate enforcement change.

## Linear Work Item Contract

`JSC-198` owns the closure-evidence reconciliation parent. It may later route
work into `JSC-199`, `JSC-200`, and `JSC-201`, but the first execution slice
must prove classification before synchronization.

Recommended parent issue title:

- `[coding-harness] Reconcile Flow Ops closure evidence`

Recommended child issue shape, if `he-plan` creates children:

- Inventory closure evidence sources and stale-state failure modes.
- Define deterministic closure queue and eval artifact checks.
- Add focused reconciliation proof for PR, CircleCI, Linear, and eval states.
- Document the human acceptance boundary for done/intake mutations.

Do not split by data source unless the data source can be verified
independently. The architectural unit is closure classification, not telemetry
collection.

## Boundary

In scope:

- `.harness/linear/coding-harness-linear-plan.md`
- `.harness/specs/**`
- `.harness/plan/**`
- `.harness/evals/**`
- `.harness/review/**`
- `.harness/evidence/**` only for compact replay records explicitly referenced
  by a review, eval, plan, or Linear queue artifact.
- GitHub PR metadata and check status for repo PRs referenced by active slices
- CircleCI status as exposed through PR checks or a focused CircleCI lookup
- Linear issues `JSC-198`, `JSC-199`, `JSC-200`, and `JSC-201`
- Prior-slice closure examples referenced by the Linear plan:
  `JSC-282`, `JSC-283`, `JSC-288`, `JSC-289`, `JSC-290`, and `JSC-178`

Out of scope:

- General-purpose telemetry storage.
- Portfolio-wide workflow reporting.
- Linear custom-field migration.
- New GitHub app automation.
- New CircleCI ingestion service.
- Automatic issue closure or PR merge.
- Runtime source changes outside the minimal checker or artifact generator
  admitted by `he-plan`.

## Baseline

Hard evidence from current repo artifacts:

- `.harness/linear/coding-harness-linear-plan.md` classifies `JSC-198` as the
  next spec candidate and `JSC-199`, `JSC-200`, and `JSC-201` as supporting
  issues.
- The same plan records repeated stale closure across `JSC-282`, `JSC-283`,
  `JSC-288`, `JSC-289`, `JSC-290`, and `JSC-178`.
- The plan explicitly narrows the next slice to reconciling PR merge state,
  eval artifact presence, CircleCI check state, and Linear done/intake
  metadata.
- Live Linear state observed during `he-spec` showed `JSC-198` as Todo,
  `JSC-199` as In Progress, and `JSC-200`/`JSC-201` as Todo.
- The current HE loop already requires eval reports and compound learnings
  before closure, but those artifacts are not yet reconciled into a stable
  closure classification record.

Interpretation:

- The repeated drift is no longer theoretical process polish. It is execution
  drag.
- The smallest valuable system is a deterministic closure classifier, not a
  broad metrics platform.
- Closure evidence must be inspectable by future agents before it is allowed to
  mutate Linear or influence the next admitted slice.

## Domain Model

| Term | Meaning | Boundary implication |
| --- | --- | --- |
| Slice | A bounded HE execution unit represented by a spec, plan, PR, eval, and Linear issue. | Closure is assessed per slice, not per broad initiative. |
| Closure evidence record | One normalized record for a slice's Linear, PR, CI, eval, and acceptance evidence. | Must be machine-readable enough for deterministic comparison. |
| Closure queue | Ordered list of slices classified as complete, blocked, stale, or next-admissible. | Must be small and cannot become a backlog dump. |
| Linear state | Live Linear issue status, priority, labels, milestone, parent/child relation, and comments where required. | Linear remains execution state, not architecture cognition. |
| Local planning snapshot | `.harness/linear/coding-harness-linear-plan.md`. | Snapshot records approved routing; it must be refreshed when live state drifts. |
| PR state | GitHub PR open/draft/merged state plus review and check summaries. | PR proof is required before done classification. |
| CircleCI state | Required CircleCI check outcome exposed through PR status or a focused CircleCI query. | Pending, missing, or failing checks block closure. |
| Eval artifact | `.harness/evals/**` report for the slice. | Missing eval proof blocks closure for implementation slices. |
| Human acceptance | Explicit user or reviewer acceptance where the plan requires it. | Cannot be inferred from chat unless recorded in the artifact. |

## Classification Rules

Closure classification must be deterministic.

| Classification | Required evidence | Next action |
| --- | --- | --- |
| `complete_ready_for_human_acceptance` | PR merged or accepted, required checks green, eval artifact present, Linear state consistent or explicitly stale. | Ask for or record human acceptance before closing or moving on. |
| `complete_linear_stale` | Repo/PR/eval evidence proves completion but live Linear still appears active. | Update approved queue; recommend Linear status cleanup. |
| `blocked_missing_eval` | Implementation evidence exists, but required eval artifact is absent or cannot be linted. | Stop closure and route eval-report work. |
| `blocked_failing_check` | PR or required check is failing, pending beyond acceptable freshness, or missing. | Route fix work; do not advance next architecture slice. |
| `blocked_review_gate` | CodeRabbit, Codex, human review, or HE review gate has a blocking finding. | Route fix/review work before closure. |
| `not_started` | Linear exists, but no admissible spec/plan/work evidence exists. | Keep in queue only if selected by `.harness/linear`. |
| `needs_human_triage` | Evidence contradicts itself or requires an ownership decision. | Stop and request human decision. |
| `out_of_scope` | Work is related but not part of the current approved slice. | Exclude from the active queue. |

The classifier must fail closed. Unknown states are not success states.

## Lifecycle

The intended lifecycle is:

1. Refresh the local planning snapshot and live state.
2. Build one closure evidence record per candidate slice.
3. Classify each candidate using the deterministic rules above.
4. Produce a compact `Now`, `Next`, `Later`, and `Do Not Create` queue.
5. Admit at most one next spec candidate.
6. Require human acceptance before any Linear mutation or closure transition.

The first implementation phase must be read-only. It may inventory evidence and
write a review artifact, but it must not mutate Linear, GitHub, CircleCI, or
runtime behavior.

## Evidence Precedence And Freshness

The reconciliation loop must separate source authority from source
availability. A source that is easier to read is not more authoritative.

| Evidence source | Authority | Freshness requirement | Failure behavior |
| --- | --- | --- | --- |
| Live Linear issue state | Execution tracker of record for issue status, parent/child relation, labels, and milestone. | Must be refreshed during the current run and record retrieval time. | If unavailable, stop; do not infer current issue state from `.harness/linear`. |
| `.harness/linear/coding-harness-linear-plan.md` | Approved local routing snapshot and queue policy. | Must be read from the current checkout after live-state refresh starts. | If it contradicts live Linear, classify the issue as stale or `needs_human_triage`; do not silently prefer either source. |
| GitHub PR state | Source of truth for PR open/draft/merged/closed state, review state, and status check rollup. | Must include PR number, head SHA, base branch, and retrieval time. | If PR state cannot be read for a required candidate, stop. If it cannot be read for an optional example, classify that example as `needs_human_triage`. |
| CircleCI status | Closure proof only when tied to the relevant PR/head SHA through the required check rollup or focused CircleCI lookup. | Must match the PR head SHA or merged commit being evaluated. | Missing, stale, pending, or failed required checks block closure. |
| Eval artifact | Source of truth for HE eval completion only when the artifact exists and passes HE artifact validation. | Must be read from the current checkout and linted in the current run. | Missing or invalid eval artifact blocks closure. |
| Human acceptance | Source of truth for approval when a plan requires acceptance before the next unit. | Must be recorded in an artifact, Linear comment, PR review, or explicit current-thread instruction with timestamp. | If required acceptance cannot be evidenced, classify as `needs_human_triage`. |

Freshness is part of correctness. Any reconciliation artifact must include
enough timestamp, commit, PR, and issue metadata for a later agent to understand
whether the record was current when it was produced.

## Interfaces

The first durable interface should be a small JSON-compatible evidence shape.
The exact module name is a plan decision, but the semantics must be preserved.

```ts
export type ClosureClassification =
  | "complete_ready_for_human_acceptance"
  | "complete_linear_stale"
  | "blocked_missing_eval"
  | "blocked_failing_check"
  | "blocked_review_gate"
  | "not_started"
  | "needs_human_triage"
  | "out_of_scope";

export interface ClosureEvidenceRecord {
  linearIssue: string;
  sliceName: string;
  retrievedAt: string;
  repoHeadSha: string;
  linearStatus: string;
  linearMilestone: string | null;
  linearUpdatedAt: string | null;
  planClassification: string | null;
  pullRequests: Array<{
    number: number;
    state: "open" | "draft" | "merged" | "closed";
    headSha: string;
    mergedAt: string | null;
    requiredChecks: Array<{
      name: string;
      conclusion: "success" | "failure" | "pending" | "missing" | "skipped";
      provider: "circleci" | "github-actions" | "semgrep" | "coderabbit" | "other";
      checkedSha: string | null;
    }>;
  }>;
  evalArtifacts: Array<{
    path: string;
    present: boolean;
    lintStatus: "pass" | "fail" | "not_run" | "not_applicable";
  }>;
  humanAcceptance: "recorded" | "required" | "not_required";
  classification: ClosureClassification;
  nextAction: string;
  evidenceSources: string[];
}
```

The interface must not imply automatic mutation. It is a closure evidence
contract, not a synchronization engine.

## Fixture Contract

The first executable proof should use small fixtures before live mutation or
automation. Fixtures must cover the repeated failure modes that caused this
slice to be selected.

Required fixture cases:

| Fixture | Required classification | Why it matters |
| --- | --- | --- |
| Merged PR, green required checks, valid eval, Linear still active | `complete_linear_stale` | Proves merged work does not leak back into the next spec queue. |
| Open or draft follow-up PR with failing required check | `blocked_failing_check` | Models the PR #234-style closure blocker without reopening architecture scope. |
| Implementation evidence exists, eval artifact missing | `blocked_missing_eval` | Prevents closure before `he-eval-report` proof. |
| Live Linear unavailable | Stop before classification | Prevents stale local snapshots from being treated as current truth. |
| PR check SHA does not match evaluated PR head or merge SHA | `needs_human_triage` | Prevents green checks from the wrong commit from closing a slice. |
| Human acceptance required but not evidenced | `needs_human_triage` | Preserves explicit review gates before phase advancement. |
| Related umbrella issue outside selected slice | `out_of_scope` | Prevents broad telemetry or legacy umbrella work from expanding the slice. |

Fixture proof must be deterministic and should not require network access. Live
Linear, GitHub, and CircleCI reads belong in a separate integration or
inventory phase with recorded blockers.

## Invariants

- Linear remains the execution tracker.
- `.harness/linear` remains the approved local routing snapshot.
- No Linear status transition is automatic in this slice.
- Missing PR, CI, eval, or review evidence blocks closure.
- CircleCI state is only closure proof when it is tied to the relevant PR or
  slice.
- Eval artifacts are required for implementation slices before closure.
- Supporting issues `JSC-199`, `JSC-200`, and `JSC-201` stay subordinate until
  closure classification is proven.
- Human acceptance is required before done-gate enforcement mutates external
  state.
- Closure queues must stay small enough to guide the next slice; they must not
  become a second backlog.

## Failure And Recovery

| Failure | Recovery |
| --- | --- |
| Linear cannot be refreshed. | Stop and report the blocker; do not use stale state as current truth. |
| GitHub PR state cannot be read. | Stop for a required candidate; classify optional examples as `needs_human_triage`. |
| CircleCI state is missing from PR checks. | Classify as `blocked_failing_check` or `needs_human_triage` depending on whether the check is required. |
| Eval artifact is missing. | Classify as `blocked_missing_eval` and route `he-eval-report`. |
| Review gate is unresolved. | Classify as `blocked_review_gate` and route the fix/review loop. |
| Linear says active while repo evidence says complete. | Classify as `complete_linear_stale`; recommend Linear cleanup but do not mutate automatically. |
| Evidence sources disagree. | Classify as `needs_human_triage` and preserve exact contradictory evidence. |
| Queue grows beyond the admitted slice. | Trim to `Now`, `Next`, `Later`, and `Do Not Create`; do not create new work from every finding. |

## Observability

Each reconciliation run should record:

- Timestamp and operator.
- Source artifact paths.
- Live Linear issues checked.
- PR numbers checked.
- Required checks observed.
- Eval artifacts checked.
- Classification per slice.
- Exact blocker string for non-success states.
- Recommended next slice.
- Whether human acceptance is required.

The preferred artifact shape is:

- Markdown summary for human review.
- JSON-compatible evidence records for deterministic replay.

The plan may choose the final path, but implementation evidence should be
stored under `.harness/review/**` or `.harness/evidence/**` and referenced from
the next `.harness/linear/coding-harness-linear-plan.md` update.

## Validation Plan

Spec validation:

- `python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py" .harness/specs/2026-05-09-jsc-198-flow-ops-closure-evidence-reconciliation-spec.md`
- `python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py" .harness/specs/2026-05-09-jsc-198-flow-ops-closure-evidence-reconciliation-spec.md`
- `pnpm markdownlint .harness/specs/2026-05-09-jsc-198-flow-ops-closure-evidence-reconciliation-spec.md`

Implementation validation must be phase-specific:

- Inventory phase: markdown lint, identity lint, traceability lint, and proof
  that no runtime source or external state changed.
- Evidence-shape phase: focused fixture tests for closure classifications.
- PR/CI/eval classification phase: tests or recorded fixtures for merged PR,
  draft/open PR, failing CircleCI, missing eval, stale Linear, and human
  acceptance required.
- Any runtime code phase: `pnpm typecheck`, focused tests, and
  `bash scripts/validate-codestyle.sh` unless a concrete blocker is recorded.
- Closure eval: `.harness/evals/coding-harness-jsc-198-flow-ops-closure-evidence-reconciliation-eval.md`.

## Review Gate

Human review is required before:

- Any Linear issue is transitioned or commented on automatically.
- Any new Linear labels or custom fields are introduced.
- CircleCI state becomes authoritative beyond PR check status.
- Done-gate or intake-gate enforcement starts blocking merges.
- The closure classifier is used to skip a previously required review or eval
  step.

## Phase Admission Rules

`he-plan` must keep the migration staged. Each phase is admitted only when the
previous phase has evidence and no blocking review finding.

| Phase | Allowed work | Blocked work | Required proof |
| --- | --- | --- | --- |
| `IU-198-001` | Read-only closure source inventory and stale-state failure map. | Runtime source edits, Linear mutations, GitHub mutations, CircleCI mutations, new labels, custom fields. | Inventory artifact, markdown lint, HE identity lint, HE traceability lint, and diff proof that only harness artifacts changed. |
| `IU-198-002` | Typed or JSON-compatible closure evidence shape plus fixture classifications. | Live external mutations, automation, broad telemetry storage. | Focused fixture tests for all required classifications and pass/fail evidence. |
| `IU-198-003` | Focused live reconciliation proof for Linear, GitHub PR state, CircleCI check state, and eval artifact presence. | Status transitions, issue closure, PR merge, review-thread resolution. | Recorded live-source evidence, failure-mode classifications, and no-mutation proof. |
| `IU-198-004` | Human-reviewed recommendation for intake/done gate enforcement. | Enforcing gates before human acceptance, changing Linear workflow semantics, custom-field rollout. | Review artifact proving which gates should become executable and which remain advisory. |

Any phase that needs to mutate Linear, GitHub, CircleCI, required checks,
branch-protection policy, or public harness command behavior must stop and
require explicit human review before implementation.

## Acceptance Matrix

| ID | Acceptance criterion | Evidence required |
| --- | --- | --- |
| SA-198-001 | The selected slice resolves from `.harness/linear/coding-harness-linear-plan.md` to `JSC-198`. | Spec frontmatter, Linear contract, and plan evidence. |
| SA-198-002 | Supporting issues `JSC-199`, `JSC-200`, and `JSC-201` remain subordinate to closure classification. | Boundary and Linear traceability table. |
| SA-198-003 | The closure evidence model includes Linear, PR, CircleCI, eval, review, and human acceptance evidence. | Domain model and interface contract. |
| SA-198-004 | Missing eval evidence deterministically blocks closure. | Classification rule `blocked_missing_eval` and fixture/test proof in implementation. |
| SA-198-005 | Failing, pending, or missing required checks deterministically block closure. | Classification rule `blocked_failing_check` and PR/check fixture proof. |
| SA-198-006 | Stale Linear state is classified without automatically mutating Linear. | `complete_linear_stale` rule and human review gate. |
| SA-198-007 | Contradictory evidence fails closed to human triage. | `needs_human_triage` rule and recovery contract. |
| SA-198-008 | The next-slice queue remains compressed and does not become a backlog dump. | `Now`, `Next`, `Later`, and `Do Not Create` output requirement. |
| SA-198-009 | The first implementation phase is read-only. | he-plan handoff and phase admission rule. |
| SA-198-010 | Broad telemetry, weekly reporting, custom-field rollout, and automatic Linear closure stay out of scope. | Non-goals and review gate. |
| SA-198-011 | Closure evidence records include source freshness metadata. | Evidence precedence table and interface contract. |
| SA-198-012 | Fixture proof covers stale Linear, failing PR checks, missing eval, unavailable Linear, mismatched check SHA, missing human acceptance, and out-of-scope umbrella work. | Fixture contract and implementation tests. |

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Notes |
| --- | --- | --- |
| JSC-198 | SA-198-001, SA-198-003, SA-198-006, SA-198-007, SA-198-008, SA-198-009, SA-198-010, SA-198-011, SA-198-012 | Parent closure-evidence reconciliation scope. |
| JSC-199 | SA-198-003, SA-198-005, SA-198-006, SA-198-011, SA-198-012 | GitHub PR lifecycle metadata is evidence for closure, not an automation mandate in the first slice. |
| JSC-200 | SA-198-003, SA-198-005, SA-198-011, SA-198-012 | CircleCI state is scoped to PR/check closure evidence. |
| JSC-201 | SA-198-004, SA-198-006, SA-198-007, SA-198-010, SA-198-012 | Intake/done gates are admitted only after classification proof and human review. |

## First Slice

`he-plan` should start with an inventory-only implementation unit.

Allowed:

- Read `.harness/linear/coding-harness-linear-plan.md`.
- Refresh live Linear state for `JSC-198`, `JSC-199`, `JSC-200`, and `JSC-201`.
- Identify relevant recent PR/eval/CI closure examples.
- Produce a closure evidence source inventory and failure-mode map.
- Define the exact evidence record fields and fixture cases required for the
  next phase.

Blocked:

- No Linear mutations.
- No GitHub mutations.
- No CircleCI mutations.
- No runtime source changes.
- No new custom fields, labels, dashboards, or background automation.

Stop conditions:

- Linear cannot be refreshed.
- PR or check state cannot be read for required examples.
- Eval artifacts cannot be distinguished from runtime behavior.
- The inventory needs a human ownership decision.

## Open Questions

- Should the first executable proof live as a repo script, a harness command, or
  a test-only fixture helper?
- Operational check: record whether `JSC-199` is still In Progress during
  live-state refresh, but do not let that status alter the policy that
  supporting issues remain subordinate until classifier proof exists.
- Which human acceptance phrase or artifact is sufficient to mark a slice as
  accepted for planning purposes?

## Done

This spec is done when:

- The artifact identity lint passes.
- The Linear traceability lint passes.
- Markdown lint passes.
- The next stage can generate a phased `he-plan` without re-opening broad
  telemetry scope.
- The first planned implementation unit is read-only and closure-focused.

## he-plan Handoff

`he-plan` should convert this spec into a staged migration with these
constraints:

- `IU-198-001`: inventory-only closure evidence source map.
- `IU-198-002`: deterministic closure evidence record and fixture
  classifications.
- `IU-198-003`: focused PR/CI/eval/Linear reconciliation proof.
- `IU-198-004`: optional done/intake gate recommendation, human-reviewed before
  any external mutation.

Each implementation unit must preserve a small active set and include an eval
artifact before closure. No phase may close or transition Linear issues without
explicit human acceptance.

## Blackboard Delta

```yaml
schema_version: 1
blackboard_delta:
  selected_slice: flow-ops-closure-evidence-reconciliation
  linear_issue: JSC-198
  supporting_issues:
    - JSC-199
    - JSC-200
    - JSC-201
  next_stage: he-plan
  required_first_unit: inventory-only
  mutation_allowed: false
  human_review_required_before_external_state_change: true
```

## Evidence

Hard evidence:

- `.harness/linear/coding-harness-linear-plan.md` marks `JSC-198` as the next
  spec candidate and defines the narrow closure-evidence scope.
- `.harness/linear/coding-harness-linear-plan.md` identifies `JSC-199`,
  `JSC-200`, and `JSC-201` as supporting issues.
- Live Linear state observed during `he-spec` showed `JSC-198` as Todo,
  `JSC-199` as In Progress, and `JSC-200`/`JSC-201` as Todo.
- `.harness/core/execution-invariants.md` requires observable validation and
  eval artifacts before closure.
- `.harness/core/governance-invariants.md` requires governance to reduce
  ambiguity rather than add process.
- `.harness/core/agent-operating-rules.md` requires deterministic execution,
  local reasoning, and small active scopes.

Interpretation:

- The next high-leverage slice is closure evidence reconciliation, not telemetry
  expansion.
- Supporting sync and gate issues should not mutate external state until the
  closure classifier is proven.

Assumption:

- The next `he-plan` will be allowed to refresh live Linear, GitHub, and
  CircleCI state before creating implementation units.
