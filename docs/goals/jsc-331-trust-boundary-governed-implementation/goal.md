# JSC-331 Trust Boundary Governed Implementation

## Table of Contents
- [Objective](#objective)
- [Activation Boundary](#activation-boundary)
- [Source Artifacts](#source-artifacts)
- [Runtime Truth Order](#runtime-truth-order)
- [Evidence Proof Rules](#evidence-proof-rules)
- [Governed Lanes](#governed-lanes)
- [Slice Lifecycle](#slice-lifecycle)
- [Mandatory Review Stack](#mandatory-review-stack)
- [Slice Map](#slice-map)
- [Slice Acceptance Criteria](#slice-acceptance-criteria)
- [Implementation Notes](#implementation-notes)
- [Git Triage Lane](#git-triage-lane)
- [Completion Contract](#completion-contract)
- [Stop Conditions](#stop-conditions)
- [Continuation Prompt](#continuation-prompt)

## Objective

Govern and execute the JSC-331 Trust Boundary P0 implementation from the
May 23 plan and master spec until the local implementation is operational,
validated, reviewed, documented, and ready for merge handoff.

The goal is not a one-pass patch. The goal is a runtime-truth-first execution
system that reduces stale-state risk, false-success risk, review-loop churn,
and human steering cost while strengthening deterministic enforcement.

## Activation Boundary

This board authorizes governed execution setup. Worker implementation must not
start until the active governor task proves board health, git state, source
artifact freshness, Linear state, and validation entrypoints.

Kickoff prompt convention:

    /goal Follow docs/goals/jsc-331-trust-boundary-governed-implementation/goal.md

The /goal Follow prompt is a prompt convention. Codex must read this file,
state.yaml, and receipts.jsonl before acting.

## Source Artifacts

- Plan:
  .harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md
- Master spec:
  .harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md
- Implementation notes:
  .harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html
- Linear tracker: JSC-331
- Live Linear confirmation comment:
  ac992e03-6f58-457d-8c45-a45b7102294e

Older JSC-331 boards are historical evidence only. They are not source
authority for this goal because they target earlier May 18 and May 20 work.

## Runtime Truth Order

When runtime truth contradicts docs, specs, plan assumptions, review
assumptions, or memory, the governor must:

1. trust runtime truth
2. stop unsafe progression
3. document the contradiction in implementation notes
4. classify severity as blocker, high, medium, low, or informational
5. propose the safest correction path
6. update receipts.jsonl before continuing

## Evidence Proof Rules

The goal exists to prevent false success. Treat every proof claim as untrusted
until a current artifact, command, or external state check proves it.

- Validator scripts are implementation deliverables until their own focused
  tests and real-input runs pass. Their presence in a plan, spec, or notes file
  is not proof.
- A validator result is portable merge evidence only when the source artifact
  and referenced artifacts are tracked, intentionally promoted, or explicitly
  classified as local-only evidence in receipts.jsonl.
- Ignored or untracked artifacts may support local discovery, but they cannot
  support merge readiness unless the governor records why local-only evidence is
  acceptable for the slice and what later gate must replace it.
- Audit reports must not be validated against stale paths. If an audit artifact
  references paths that do not exist in the current checkout, repair the
  references or classify the audit as stale before treating the validator result
  as meaningful.
- Script-backed validators must write exactly one machine-readable JSON object
  to stdout when their contract says so. Human-readable status belongs in
  receipts, implementation notes, or review artifacts, not mixed into validator
  stdout.
- When a proof depends on staged or tracked status, the receipt must say so.
  Passing against an implementation target that has not been staged is not
  sufficient evidence for handoff.
- Mailbox-only reviewer text, chat summaries, and agent status notifications
  are not review proof. Required review proof is a non-empty artifact with a
  completion or blocker status.

## Governed Lanes

The workflow has four separate lanes:

- Governor lane: sequencing, blast-radius control, runtime safety, convergence,
  escalation, stopping conditions, implementation priority, and architecture
  coherence.
- Implementation lane: bounded Worker slices that touch only declared files and
  leave the repository buildable.
- Review and validation lane: deterministic validation plus architecture,
  simplification, dead-code, terminology, testing, docs, and code-review checks.
- Merge and remediation lane: PR, CI, CodeRabbit, GitHub, CircleCI, branch
  drift, mergeability, and Linear-state convergence.

## Slice Lifecycle

Every implementation slice must execute this lifecycle exactly:

1. GOVERN
2. IMPLEMENT
3. VALIDATE
4. ARCHITECTURE REVIEW
5. SIMPLIFY
6. UNSLOPIFY
7. UBIQUITOUS LANGUAGE REVIEW
8. TEST
9. DOCS UPDATE
10. CODE REVIEW
11. IMPLEMENTATION NOTES UPDATE
12. GIT TRIAGE HANDOFF
13. CONTINUE ONLY AFTER SAFE STATE CONFIRMED

No unresolved blocker may progress to the next slice. Blocked lifecycle steps
must record blocker class, exact failure text, fallback attempted, governor
decision, and next owner.

## Mandatory Review Stack

Each slice must run or explicitly block the review stack:

- improve-codebase-architecture
- simplify
- language cleanup
- ubiquitous-language
- testing
- docs-expert
- code review appropriate to the touched surface

Findings must be normalized to:

- blocker
- high
- medium
- low
- informational

The governor may fix immediately, defer safely, reject, or escalate. Deferral
requires a receipt with reason, owner, and verification impact.

Reviewer execution must be artifact-first:

- Each requested reviewer writes one report under artifacts/reviews/.
- Each report ends with a single WROTE line naming the artifact path, or a
  blocker status with exact failure text and coordinator next step.
- The coordinator verifies every expected artifact exists and is non-empty
  before using it as evidence.
- Missing artifacts get one artifact-only retry. If the retry still fails, the
  receipt records a coverage gap instead of treating mailbox text as proof.

## Slice Map

Planned implementation slices:

- PU-000: Evidence and Seam Discovery Gate.
- PU-001: Strict Adopted-Evidence Validation.
- PU-002: Runtime Evidence Merge Precedence.
- PU-003: Runtime-Card Linear Issue-Key Normalization.
- PU-004: Audit Reference Report.
- PU-005: Reviewer Coverage Receipt.
- PU-006: Trust Boundary P0 Integration and Handoff.

Each slice is independently verifiable and may be merged independently only
after its lifecycle, review stack, implementation notes, and git triage handoff
are complete.

## Slice Acceptance Criteria

### PU-000: Evidence and Seam Discovery Gate

- Select the narrow implementation seam for each P0 slice.
- Reject broader public CLI or abstraction work unless source evidence proves it
  is required.
- Record selected seams, rejected seams, validation commands, and remaining
  unknowns in receipts.jsonl.

### PU-001: Strict Adopted-Evidence Validation

- Adopted evidence fails closed when declared validation is missing, stale,
  non-runnable, or failing.
- Non-adopted evidence keeps its documented status vocabulary.
- Focused tests cover passing, missing, stale, and failed validation command
  paths before the slice can close.

### PU-002: Runtime Evidence Merge Precedence

- Runtime evidence merge logic preserves blocked, stale, or worse evidence over
  optimistic duplicate provenance for the same source identity.
- Tests prove worse-evidence precedence without changing runtime-card/v1 into
  executable authority.

### PU-003: Runtime-Card Linear Issue-Key Normalization

- Issue matching is case-insensitive for comparison.
- Display values from CLI input, branch-derived issue keys, active artifacts,
  imported Linear evidence, and live Linear provider results are preserved.
- Real-network Linear behavior remains unclaimed unless that path is explicitly
  exercised.

### PU-004: Audit Reference Report

- scripts/validate-audit-references.cjs is an implementation target, not
  current proof, until focused tests and the real May 22 audit run pass.
- The validator emits audit-reference-report/v1 as exactly one JSON object on
  stdout, exits 0 only for pass, exits 1 for blocked, missing, or partial
  reference evidence, and exits 2 for usage errors.
- The validator checks real, allowed, tracked, ignored, untracked, missing, and
  blocked references.
- The May 22 audit input is currently local evidence unless it is promoted from
  ignored status. The governor must either promote the source artifact or record
  a local-only evidence classification before closing PU-004.
- If the audit references stale paths, repair the artifact to current tracked
  paths or classify the audit as stale before counting the validator run.
- If the validator only passes after the validator script itself is staged or
  tracked, the receipt must state that dependency and git triage must confirm
  the staged-file boundary.

### PU-005: Reviewer Coverage Receipt

- scripts/validate-reviewer-coverage.cjs is an implementation target, not
  current proof, until focused tests and a real reviewer-manifest run pass.
- Mailbox-only reviewer text is non-proof.
- The validator must verify every required reviewer artifact exists, is
  non-empty, and carries a completion or blocker status.
- Missing artifacts after retry are partial or blocked, never pass.

### PU-006: Trust Boundary P0 Integration and Handoff

- Receipts, state.yaml, implementation notes, plan, and spec agree on completed
  slices, open blockers, local-only evidence, and remote-readiness status.
- Local validation, review artifacts, git triage, Linear traceability, PR/CI
  state, CodeRabbit state, and Judge or PM audit are all current before the goal
  can be marked complete.
- Remote readiness remains blocked until branch publish, open PR, required
  checks, review state, mergeability, and Linear state are verified.

## Implementation Notes

The required notes file is:

    .harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html

Update it continuously. It must include decisions, tradeoffs, runtime
discoveries, validation evidence, risks, review outcomes, and git triage
handoffs. Do not batch all updates at the end.

## Git Triage Lane

After every validated slice, hand off to a subagent-managed git triage lane.
The triage lane owns PR monitoring, CI monitoring, mergeability, review-state
tracking, stale-state detection, branch-drift detection, valid review-comment
remediation, merge-conflict remediation, and green-state convergence.

Green CI alone is not merge safety. Merge readiness requires current PR state,
CI state, review blocker state, branch state, Linear state, and no stale-state
contradictions.

## Completion Contract

### Outcome

JSC-331 Trust Boundary P0 is implemented through validated, reviewed,
independently safe slices that strengthen runtime truth, deterministic
enforcement, architecture coherence, and operational traceability.

### Verification Surface

- goal.md
- state.yaml
- receipts.jsonl
- implementation notes HTML
- plan and spec artifact validators
- exact behavior tests
- script-level validator outputs
- tracked or explicitly classified source artifacts
- review artifacts
- git status and staged-file evidence
- PR, CI, CodeRabbit, GitHub, CircleCI, and Linear state after PR creation

### Constraints

- Exactly one active task unless Jamie explicitly authorizes parallel Workers
  with disjoint `allowed_files`.
- Worker implementation may touch only active-slice files.
- No speculative refactors or placeholder scaffolding.
- No Linear, GitHub, CI, CodeRabbit, automation, staging, commit, push, PR, or
  merge mutation unless the active task authorizes it.
- No treating chat summaries, mailbox-only status, docs-only claims, or green
  CI alone as proof.
- Preserve unrelated dirty worktree files.
- Do not stage unrelated dirty worktree files as part of JSC-331.

### Boundaries

- Governor and Scout tasks are read-only unless their `allowed_files` permit
  board or notes updates.
- Implementation Workers must include `allowed_files`, `verify`, and
  `stop_if`.
- Further Linear mutation requires implementation evidence and explicit user
  instruction.
- Merge requires explicit human authority unless a later board update grants a
  narrow merge policy.
- If sandbox or git-index lock restrictions block staging, record the exact
  failure and retry only within the allowed file scope.

### Iteration Policy

Choose the smallest operationally complete slice, validate immediately, run the
mandatory review stack, fix valid in-scope findings, update implementation
notes, hand off git triage, and continue only after safe state is confirmed.

### Blocked Stop Condition

Stop on stale runtime truth, native/board mismatch, unclear blast radius,
unreliable validation, incomplete review stack, unresolved blockers, merge
safety uncertainty, repeated retry without progress, or dirty-worktree
contamination.

## Stop Conditions

Stop immediately if:

- runtime safety cannot be verified
- merge safety is unclear
- architecture drift increases
- stale validation exists
- deterministic verification fails
- unresolved blockers remain
- blast radius becomes unclear
- governance state becomes ambiguous
- implementation requires a deferred placeholder not explicitly approved

## Continuation Prompt

    /goal Follow docs/goals/jsc-331-trust-boundary-governed-implementation/goal.md
