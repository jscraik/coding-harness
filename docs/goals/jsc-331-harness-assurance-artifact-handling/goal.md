# JSC-331 Harness Assurance Artifact Handling Goal

## Objective

Complete the JSC-331 Coding Harness artifact-handling and assurance plan using
`$he-phase-work`, with the mandatory review stack including
`$ubiquitous-language`, durable plan/index updates, focused validation, and no
Linear or git mutation without explicit approval.

## Source Artifacts

- Primary plan:
  `.harness/plan/2026-05-18-agent-testing-gates-harness-assurance-plan.md`
- Active artifact index: `.harness/active-artifacts.md`
- Primary Linear issue: JSC-331
- Related Linear context: JSC-308

## Constraints

- Follow `$goal-governor` before continuation and reconcile native goal state
  with `state.yaml`, this file, and the source plan.
- Follow `$he-phase-work` for phase execution.
- Keep exactly one active task unless Jamie explicitly authorizes parallel
  Workers with disjoint `allowed_files`.
- Do not mutate Linear, heartbeat automation, staging, commit, push, PR,
  merge, or closure without explicit approval.
- Preserve unrelated dirty worktree files.
- Treat Linear write-tool failures as `blocked_linear_write_unsupported`.
- Treat missing mandatory review evidence as
  `blocked_review_stack_incomplete`.

## Exit Criteria

- The source plan and active artifact index route JSC-331 without ambiguity.
- The artifact-handling routine is executable or tracked as a precise remaining
  phase with owner, validation, rollback, and stop condition.
- The mandatory review stack is completed or explicitly blocked with artifact
  evidence.
- Focused validation passes after every implementation/review-fix phase.
- A final Judge or PM receipt records `decision: complete` before native goal
  completion is requested.

## Continuation Prompt

```text
/goal Follow docs/goals/jsc-331-harness-assurance-artifact-handling/goal.md
```

This is a prompt convention. Agents must read this file, `state.yaml`, and the
source plan before acting.
