# Current-Session Steering Admission

## Table of Contents

- [Feedback Signal](#feedback-signal)
- [Root Operational Failure](#root-operational-failure)
- [Failure Category](#failure-category)
- [Searched Surfaces](#searched-surfaces)
- [Durable System Improvement](#durable-system-improvement)
- [Executable Guard](#executable-guard)
- [Forbidden Recurrence Behavior](#forbidden-recurrence-behavior)
- [Validation](#validation)
- [Review Condition](#review-condition)

## Feedback Signal

Jamie challenged the audit loop after the answer classified requested
implementation as gap tracking: "who decided that as i asked for full
implementation" and then asked what other decisions were made to not fully
implement code as instructed.

This current-session steering admission record names the feedback class,
inferred principle, searched surfaces, durable destination, and forbidden
recurrence behavior before ordinary feature work continues.

## Root Operational Failure

The audit workflow allowed a full-implementation request to be narrowed into a
smallest independently mergeable slice without a deterministic tripwire that
forced the audit to say "unfinished full-implementation scope." The repo had
strong repeated-steering rules, but the active audit path could still normalize
unimplemented code work as advisory next work.

## Failure Category

- Hidden assumptions: "smallest mergeable slice" was treated as an acceptable
  execution boundary even after the user asked for full implementation.
- Weak validation: the steering guard did not check that a known S001 downscope
  was explicitly reflected in the audit.
- Unclear authority boundaries: the implementation boundary was chosen from
  plan state rather than from explicit user acceptance of reduced scope.

## Searched Surfaces

- .harness/active-artifacts.md
- docs/goals/jsc-331-goal-governed-evidence-led-implementation/state.yaml
- .harness/research/audits/2026-05-21-plan-and-research-code-tree-gap-audit.md
- .harness/plan/2026-05-18-agent-testing-gates-harness-assurance-plan.md
- scripts/check-steering-feedback-contract.cjs
- package.json

## Durable System Improvement

The durable destination is the existing docs:steering:guard validator,
implemented in scripts/check-steering-feedback-contract.cjs and already wired
into pnpm check, plus the implemented code surfaces recorded in the audit.

The guard detects the live downscope signal in
docs/goals/jsc-331-goal-governed-evidence-led-implementation/state.yaml
("S001 only" plus the independently mergeable slice policy) and requires the
audit to preserve a scope-correction section, the unfinished
full-implementation classification, the S001 downscope row, the Implemented
Status section, and the Full-Implementation Slices heading.

The guard also rejects Current Gap Register, Pending Closeout Validation, and
Recommended Next Slices headings in the audit so the artifact cannot pass while
presenting owner-requested implementation as advisory work.

## Executable Guard

Run pnpm run docs:steering:guard.

The guard fails if the audit reverts to advisory Recommended Next Slices,
Current Gap Register, or Pending Closeout Validation language while the goal
state still records the S001 downscope.

## Forbidden Recurrence Behavior

When a user asks for full implementation, the agent must not silently translate
that into gap tracking, advisory-only work, or a smallest-slice boundary. If the
repo evidence shows prior scope narrowing, the audit or closeout must classify
that history as unfinished full-implementation scope, then record the implemented
surfaces and concrete validation outcomes before closeout.

## Validation

Command: pnpm run docs:steering:guard -> pass

Command: pnpm vitest run src/commands/pr-closeout.test.ts
src/lib/pr-closeout.test.ts src/lib/harness-artifact-routine.test.ts
src/commands/artifact-routine.test.ts
src/lib/runtime/runtime-evidence-contract.test.ts
src/lib/contract/harness-run.test.ts
src/lib/issue-loop/artifact-spine.test.ts
src/lib/runtime/command-runtime-budget.test.ts
src/commands/runtime-budget.test.ts
src/lib/init/project-brain-templates.test.ts -> pass

## Review Condition

This admission can be deleted only when the guard is replaced by a broader
full-implementation scope validator that proves the same recurrence cannot pass
silently.
