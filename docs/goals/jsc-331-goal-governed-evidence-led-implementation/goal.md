# JSC-331 Goal-Governed Evidence-Led Implementation

## Objective

Prepare and, only after explicit owner kickoff, run a governed evidence-led
implementation loop for Coding Harness using the 2026-05-20 audit as the
source of truth.

The loop must reduce false-success risk, stale-state risk, missing-evidence
risk, and repeated human steering by turning each accepted audit gap into a
small, independently verifiable slice.

## Activation Boundary

This board is ready for kickoff, but Worker implementation is not authorized
until Jamie explicitly starts the goal.

Activation phrase:

```text
KICK OFF GOAL-GOVERNED IMPLEMENTATION
```

Kickoff prompt convention:

```text
/goal Follow docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md
```

`/goal Follow docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md`
is a prompt convention. Codex must read this file, `state.yaml`, and
`receipts.jsonl` before acting.

## Source Artifacts

- Primary audit:
  `.harness/research/audits/2026-05-20-evidence-led-codebase-gap-audit.md`
- Active artifact index:
  `.harness/active-artifacts.md`
- Implementation notes:
  `.harness/implementation-notes/2026-05-21-coding-harness-goal-governed-evidence-led-implementation-notes.html`
- Linear tracker: JSC-331
- Related context: JSC-308, prior JSC-331 artifact-handling board

## Operating Modes

- `prompt_review`: review or tighten the goal prompt only.
- `governor_bootstrap`: reconcile native goal state, board state, audit
  state, git state, validation state, and Linear state.
- `slice_execution`: implement only the approved active slice.
- `review_stack`: run and normalize the mandatory review stack.
- `review_recovery`: fix valid review findings or record a defer/reject
  decision.
- `pr_closeout`: stage, commit, push, and open/update PR only after the
  slice lifecycle allows it.
- `green_sweep`: monitor PR/CI/review state after PR creation.
- `merge_recovery`: resolve mergeability, conflicts, stale checks, or
  escalation.

Default mode is `prompt_review` until the activation phrase is present.

## Required First Continuation

The first continuation after kickoff is a read-only Scout step.

It must:

1. read `goal.md`, `state.yaml`, and `receipts.jsonl` first
2. inspect native Codex goal state
3. reconcile the paused native goal recorded in `state.yaml`
4. inspect the primary audit and active artifact index
5. inspect git branch and dirty worktree state
6. inspect Linear JSC-331 state
7. draft exactly one first slice manifest
8. draft a rollback contract
9. update implementation notes only when authorized by the active task
10. stop before Worker implementation

If board health or verification freshness is unclear, route to
`verification recovery`. No Worker work may start before board health is
clear.

## Completion Contract

### Outcome

Coding Harness has one or more merged, independently verifiable slices that
reduce audit-backed governance gaps without increasing architecture drift,
stale-state risk, false-success risk, or review-loop churn.

### Verification Surface

- repo-visible goal board
- `receipts.jsonl`
- implementation notes
- slice manifests
- rollback contracts
- validation command evidence
- review artifacts
- PR state
- CI state
- CodeRabbit and Codex review state
- Linear state
- runtime traces or evidence bundles where relevant

### Constraints

- Keep exactly one active task unless Jamie explicitly authorizes parallel
  Workers with disjoint `allowed_files`.
- Do not start Worker implementation before governor reconciliation.
- Do not mutate git, GitHub, Linear, CircleCI, CodeRabbit, or automations
  except where the active task explicitly authorizes it.
- Do not treat CI alone as proof.
- Do not treat chat summaries as evidence.
- Do not treat documentation-only changes as runtime enforcement.
- Preserve unrelated dirty worktree files.
- Treat missing named skills as `blocked_review_stack_incomplete`.

### Boundaries

- The governor may inspect and propose slices after activation.
- The governor may write goal-board receipts and implementation notes only
  when the active task allows those files.
- Worker implementation may touch only files declared in the active slice.
- Git staging, commit, push, PR creation, and merge require explicit lifecycle
  authority from the board and owner.
- Merge requires explicit human approval unless a separate merge-authority
  contract exists.
- When Jamie delegates unattended closeout authority, the governor may choose
  the safest S001 git lifecycle path without another prompt if the board names
  an active closeout task and all guardrails pass. This includes creating a
  fresh S001 branch from the current target base when the current branch already
  contains replay-module commits, so replay work remains a separate slice.
- Unattended authority never permits staging replay files, staging unrelated
  dirty worktree files, activating the replay-module slice, merging a PR, or
  treating failed or missing guardrails as acceptable risk.
- During unattended PR closeout, classify every red or pending remote check
  before editing files. If the only blocker is a pre-existing governance-health
  failure outside the active slice allowed files, do not broaden the active
  slice or patch the blocker into the S001 PR by default. Record a blocker
  receipt, keep S001 draft/open, and use a separately declared governance-health
  slice before touching `harness.contract.json` or related required-check
  metadata.
- If a remote failure is plausibly introduced by the S001 runtime-evidence
  change, the governor may inspect and fix only files already allowed by the
  active S001 task. If provenance is unclear, stop in verification recovery
  rather than guessing.

### Iteration Policy

Choose the smallest independently reviewable slice, validate immediately, run
the mandatory review stack, fix valid in-scope findings, defer unrelated
findings with explicit reasons, and stop on repeated failure or unclear blast
radius.

### Blocked Stop Condition

Stop and ask for owner or governor direction when runtime truth is stale,
native goal state and board state conflict, validation is unreliable, review
stack evidence is incomplete, merge authority is missing, deterministic
verification cannot be produced, or unrelated dirty worktree changes
contaminate the slice.

## Slice Lifecycle

Every slice must follow this lifecycle:

1. GOVERN
2. IMPLEMENT
3. VALIDATE
4. SIMPLIFY
5. UNSLOPIFY
6. ARCHITECTURE REVIEW
7. TEST
8. CODEX REVIEW
9. FIX REVIEW FINDINGS
10. UPDATE IMPLEMENTATION NOTES
11. GIT ADD/COMMIT
12. OPEN/UPDATE PR
13. WAIT FOR GREEN
14. MERGE OR ESCALATE
15. ONLY THEN CONTINUE

No skipping. Blocked steps must record blocker class, exact blocker, evidence,
fallback attempted, governor decision, and next owner.

## Mandatory Review Stack

After every implementation slice, run or explicitly block the review stack:

- `$simplify`
- `$unslopify`
- `$improve-codebase-architecture`
- `$testing`
- `$codex-review`

Each review phase must produce an artifact under:

```text
.harness/implementation-notes/reviews/{slice-id}/{reviewer}.md
```

Chat text alone is not review completion evidence.

## Linear Sync

Linear JSC-331 is the tracker for this board. Keep it in `Todo` until owner
kickoff. On kickoff, the governor may move it only when the active task and
owner authority allow tracker mutation.

Tracker comments must link:

- goal board path
- kickoff prompt convention
- primary audit path
- implementation notes path
- current status and next safe action

## Exit Criteria

- Final Judge or PM receipt records `decision: complete`.
- Required validation evidence is fresh.
- Mandatory review stack is complete or explicitly blocked with evidence.
- PR, CI, review, and Linear states are reconciled.
- Merge decision is recorded with authority and rollback path.
- Native goal completion is requested only after board completion evidence
  exists.
