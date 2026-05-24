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

Jamie corrected the agent after it treated ROOT/scaffold recovery as complete
when only the root source-map artifact and generated evidence had landed. The
feedback class is current-session steering admission: repeated clarification
that ROOT was not tidied is high-signal operational telemetry, not an isolated
wording correction.

The inferred principle is that scaffold/source-map restoration and root hygiene
are separate acceptance items. A claim that ROOT is sorted requires evidence of
root-hygiene classification, not merely proof that `ARCHITECTURE.md` and
generated diagram/context artifacts exist.

## Root Operational Failure

The operational failure was claim-vs-evidence drift. The active workflow
accepted a source-map PR as proof of a broader ROOT cleanup goal without first
classifying top-level tracked files, tracked root directories, ignored local
clutter, and generated evidence surfaces.

The environment allowed an ambiguous completion claim because the recovery lane
did not force an explicit decomposition between:

- source-map restoration
- root scaffold validation
- root hygiene/tidying
- generated evidence synchronization
- Judge or PM audit

## Failure Category

- missing decomposition
- hidden assumptions
- lack of verification
- weak validation
- architecture drift
- unclear authority boundaries
- poor workflow design

## Searched Surfaces

- AGENTS.md
- CODESTYLE.md
- codestyle/04-docs-config-and-release.md
- codestyle/19-development-workflow.md
- .harness/memory/LEARNINGS.md
- .harness/implementation-notes/README.md
- scripts/check-steering-feedback-contract.cjs
- .harness/implementation-notes/2026-05-20-steering-admission.md
- .harness/implementation-notes/2026-05-21-full-implementation-downscope-steering-admission.md
- docs/goals/jsc-331-trust-boundary-governed-implementation
- repository root tracked and ignored surfaces from `git ls-files`, `find . -maxdepth 1`, and `git status`

## Durable System Improvement

The durable destination is this implementation note plus the repo-scoped
learning in `.harness/memory/LEARNINGS.md`. The existing executable guard is
`pnpm run docs:steering:guard`, implemented by
`scripts/check-steering-feedback-contract.cjs`, which validates steering
admission records under `.harness/implementation-notes`.

Future ROOT/scaffold closeout must carry a root-hygiene evidence table or
equivalent structured classification that separates:

- canonical root files and directories that intentionally remain at repo root
- tracked generated artifacts that intentionally remain at repo root
- tracked drift candidates to move or archive
- ignored local clutter to clean locally without claiming a repo change
- explicit deferrals with owner, reason, and validation blocker

The guard changes future behavior by making this admission a validated repo
artifact instead of a transient chat correction. If an agent later attempts to
delete or omit this admission, `pnpm run docs:steering:guard` fails until a
replacement typed steering-signal or root-hygiene validator exists.

## Executable Guard

Run `pnpm run docs:steering:guard`.

The guard checks that steering-admission implementation notes preserve the
feedback signal, root operational failure, failure category, searched surfaces,
durable system improvement, executable guard, forbidden recurrence behavior,
validation outcome, and review condition.

## Forbidden Recurrence Behavior

Do not describe ROOT, root scaffold, or project scaffold as sorted when the only
evidence is a source-map artifact, generated diagrams, or PR body cleanup.

Do not collapse root-hygiene work into source-map recovery. Before claiming
ROOT is tidy, produce evidence that the top-level tracked files and directories
were classified, moved or intentionally retained, and validated through the
repo's docs/governance gates.

Do not resume ordinary implementation after this correction by saying the agent
will remember. The correction must remain in a durable destination such as a
validator, schema, runtime check, workflow rule, recovery handler, CI gate, repo
artifact, skill improvement, context-routing improvement, governance rule, or
tracked exception.

## Validation

Command: pnpm run docs:steering:guard -> pass.

## Review Condition

Review this admission when a typed root-hygiene validator or steering-signal/v1
contract exists that can enforce ROOT/scaffold claim-vs-evidence separation
directly. Until then, this admission remains the durable operational proof that
source-map restoration is not root hygiene.
