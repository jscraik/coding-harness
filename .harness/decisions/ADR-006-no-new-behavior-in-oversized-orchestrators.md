# ADR-006

## Title

No New Behavior In Oversized Orchestrators

## Status

accepted

## Table Of Contents

- [Decision](#decision)
- [Context](#context)
- [Why This Decision Exists](#why-this-decision-exists)
- [Alternatives Considered](#alternatives-considered)
- [Accepted Tradeoffs](#accepted-tradeoffs)
- [Anti-Drift Constraints](#anti-drift-constraints)
- [Safe Revisit Conditions](#safe-revisit-conditions)
- [Related Systems](#related-systems)
- [Evidence](#evidence)

## Decision

Large orchestrator files are extraction targets, not default homes for new
behavior.

New CI migration behavior must not be added to `ci-migrate-core.ts` unless it is
part of a staged extraction. Shell wrappers such as `verify-work.sh` should
remain stable entrypoints while policy, gate graphs, and validation semantics
move toward typed, testable internals.

## Context

Some existing orchestrators are valuable tracer bullets that accumulated real
workflow knowledge. Their current size now creates local reasoning failures,
regression risk, and future-agent hesitation.

## Why This Decision Exists

The harness cannot be a trust system while key behavior lives in files too large
for local reasoning. Future agents will either avoid touching these files or add
more conditional behavior to them because that appears to be the established
pattern.

This decision prevents working tracer bullets from becoming permanent god
orchestrators.

## Alternatives Considered

- Leave large files alone because tests pass: rejected because passing tests do
  not remove change amplification.
- Rewrite the orchestrators from scratch: rejected because the behavior is
  valuable and migration risk is high.
- Extract by technical layer only: rejected because lifecycle and policy
  boundaries are clearer than arbitrary utility splits.

## Accepted Tradeoffs

- Extraction takes longer than local edits.
- Compatibility adapters may exist temporarily during strangler migration.
- Some duplication is acceptable during characterization, but not after
  decommission gates pass.

## Anti-Drift Constraints

- No new feature behavior in `ci-migrate-core.ts` without an extraction issue.
- Extracted modules must not import the old core as a hidden dependency.
- Compatibility paths require owner, validation, and sunset condition.
- Shell entrypoints may remain stable, but policy engines must not keep growing
  inside shell scripts.
- Closure requires characterization and eval proof, not just smaller files.

## Safe Revisit Conditions

Revisit if extraction measurably increases defect rate, validation cost, or
agent ambiguity more than it reduces module size and local reasoning burden.

## Related Systems

- `src/commands/ci-migrate-core.ts`
- `src/commands/ci-migrate.test.ts`
- `scripts/verify-work.sh`
- CI migration commands
- validation orchestration
- `.harness/refactors/ci-migration-boundary-recovery.md`
- `.harness/refactors/validation-orchestration-typed-gate-specs.md`

## Evidence

Facts:

- `.harness/features/coding-harness-intent.md` identifies `ci-migrate-core.ts`
  and `ci-migrate.test.ts` as major complexity signals.
- `.harness/review/coding-harness-architecture-review.md` classifies CI
  migration concentration as a god-orchestrator risk.
- `.harness/triage/coding-harness-triage.md` ranks CI migration decomposition as
  a high-risk/high-leverage refactor program.
- `.harness/refactors/ci-migration-boundary-recovery.md` defines a staged
  strangler migration.
- `.harness/refactors/validation-orchestration-typed-gate-specs.md` defines the
  typed-gate path for shell-heavy validation orchestration.

Interpretation:

- The problem is not that orchestration exists. The problem is that too much
  policy, provider behavior, reporting, and state transition logic has converged
  into a few hard-to-edit files.

Assumptions:

- Current behavior is valuable enough to preserve through characterization
  rather than replace wholesale.
