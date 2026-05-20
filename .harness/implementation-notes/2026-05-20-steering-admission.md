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

Jamie restated that every correction, clarification, repeated instruction, and
recovery hint is high-signal operational telemetry. The immediate feedback class
is current-session steering admission: the agent is not permitted to proceed
with ordinary implementation until the repeated behavior is admitted into the
repo operating system.

The repeated behavior is acknowledging steering in chat, then continuing normal
task work without proving that the environment, workflow, validation layer,
retrieval layer, runtime assumption, or execution strategy changed.

## Root Operational Failure

The root operational failure is that current-session steering admission was
documented in policy but not load-bearing enough at the artifact level. The
repo had prose requiring a current-session steering admission record, but the
guard did not validate admission records as first-class artifacts.

## Failure Category

- weak validation
- missing guardrails
- lack of verification
- poor workflow design
- hidden assumptions
- weak observability

## Searched Surfaces

- AGENTS.md
- CODESTYLE.md
- codestyle/04-docs-config-and-release.md
- codestyle/08-typescript.md
- codestyle/17-testing.md
- docs/solutions/integration-issues/2026-05-17-steering-feedback-admission.md
- .harness/memory/LEARNINGS.md
- scripts/check-steering-feedback-contract.cjs
- package.json docs:steering:guard
- MEMORY.md prior steering-uptake entries

## Durable System Improvement

This admission promotes the correction from conversation to two repo surfaces:

- A durable implementation note that records the feedback class, inferred
  principle, searched surfaces, durable destination, executable guard, forbidden
  recurrence behavior, and validation command.
- A steering guard update that validates current-session steering admission
  records under .harness/implementation-notes, so future records cannot omit the
  proof fields that make the correction operational.

The inferred operating principle is: repeated human steering is a harness
failure until a deterministic repo surface makes the same steering unnecessary
or records a tracked exception with owner and reason.

## Executable Guard

The executable guard is `pnpm run docs:steering:guard`, backed by
`scripts/check-steering-feedback-contract.cjs`.

The guard must now validate steering-admission implementation notes for:

- current-session steering admission language
- feedback signal
- root operational failure
- failure category
- searched surfaces
- durable system improvement
- executable guard
- forbidden recurrence behavior
- validation command and outcome
- review condition

## Forbidden Recurrence Behavior

Do not resume ordinary implementation after repeated steering by saying the
agent will remember. The next action must be a current-session steering
admission record plus a durable destination such as a validator, schema, runtime
check, workflow rule, recovery handler, CI gate, repo artifact, skill
improvement, context-routing improvement, governance rule, or tracked exception.

Do not treat prompt-only fixes as equivalent to deterministic enforcement.

## Validation

Command: `pnpm run docs:steering:guard` -> pass.

## Review Condition

Review this admission when a typed steering-signal/v1 or flywheel-record/v1
contract replaces markdown admission records. Until then, keep this guard
load-bearing so repeated steering cannot be handled only in chat.
