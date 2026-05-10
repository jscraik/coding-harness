# Agent Operating Rules

## Table Of Contents

- [Default Posture](#default-posture)
- [Before Changing Architecture](#before-changing-architecture)
- [While Editing](#while-editing)
- [Before Completion](#before-completion)
- [Evidence Basis](#evidence-basis)

## Default Posture

- Start from the PR-loop cockpit: `init`, `next --json`, `verify`,
  `review-gate`, learned-failure promotion.
- Preserve deterministic execution over broad capability.
- Prefer simplification over expansion.
- Treat hidden coupling as architectural debt.
- Treat execution ambiguity as drift.

## Before Changing Architecture

- Name the repeated failure, review drag, safety issue, or cognition cost.
- Identify the source of truth that owns the behavior.
- Identify what will be deleted, collapsed, generated, or validated.
- Check whether the change belongs in a refactor program, ADR, eval, Linear
  parent issue, or small local fix.
- Do not add governance, routing, commands, memory, or plugin references without
  proof path.

## While Editing

- Keep entrypoints stable unless the task is explicitly a contract migration.
- Keep new behavior out of oversized orchestrators.
- Keep policy out of shell scripts when typed/testable internals are feasible.
- Keep command truth synchronized across projections.
- Keep memory/context surfaces truthful or mark them fixture-only/reference-only.

## Before Completion

- Run the narrowest validation that proves the changed path.
- Run broader repo gates when governance, routing, validation, contract, skill,
  or artifact behavior changed.
- Record exact pass, fail, or blocked outcomes.
- Do not claim readiness when eval proof, fixture proof, or current-head evidence
  is missing.
- If a warning matches an existing refactor/ADR risk, name it instead of hiding
  it.

## Evidence Basis

- ADR-001 through ADR-007.
- `.harness/core/*.md`.
- `.harness/refactors/*.md`.
