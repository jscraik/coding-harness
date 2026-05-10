# Execution Invariants

## Table Of Contents

- [Validation](#validation)
- [Migration Safety](#migration-safety)
- [Eval Closure](#eval-closure)
- [Rollback](#rollback)
- [Evidence Basis](#evidence-basis)

## Validation

- Proven: work is not complete until the relevant execution path has observable
  evidence.
- Proven: repo wrappers and gates are preferred over ad hoc equivalents.
- Operating principle: exact command outcomes outrank inferred correctness.
- Operating principle: if the exact runtime path cannot run, record the blocker
  and do not claim behavior is verified.

## Migration Safety

- Migrations must be staged, reversible, and bounded by characterization.
- Compatibility paths are temporary and require owner, validation, and sunset
  rule.
- Do not create a new abstraction before identifying what old abstraction will
  be deleted or decommissioned.
- Extract by lifecycle and policy boundary before technical tidiness.

## Eval Closure

- Moat-critical migrations require eval artifacts before closure.
- Eval proof must measure operational improvement, not artifact existence alone.
- No Linear parent issue or milestone closes as complete when its defined eval
  artifact is missing.
- Behavior fixtures are required for downstream skill readiness.

## Rollback

- High-risk execution requires rollback conditions before implementation.
- Rollback state must be explainable from repo artifacts.
- Stop migration if validation cannot distinguish implementation failure from
  contract, docs, memory, or environment failure.

## Evidence Basis

- ADR-005, ADR-006, ADR-007.
- `.harness/refactors/*.md`.
- `.harness/triage/coding-harness-triage.md`.
