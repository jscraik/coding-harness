# Governance Invariants

## Table Of Contents

- [Governance Purpose](#governance-purpose)
- [Admission Rules](#admission-rules)
- [Compression Rules](#compression-rules)
- [Trust Rules](#trust-rules)
- [Evidence Basis](#evidence-basis)

## Governance Purpose

- Proven: governance exists to reduce ambiguity, review rework, and safety risk.
- Strategic assumption: governance is useful only when it is cheaper than the
  failures it prevents.
- Operating principle: governance cannot outrank execution reality.
- Operating principle: process complexity is architectural debt until proven
  otherwise.

## Admission Rules

- New governance requires repeated-failure or safety reason.
- New governance requires canonical owner.
- New governance requires enforcement path or generated projection.
- New governance requires validation command.
- New governance requires deletion or revisit condition.

## Compression Rules

- Delete duplicated policy prose or generate it from a canonical source.
- Mark reference-only docs explicitly.
- Do not add instructions when a deterministic check is feasible.
- Do not make PR templates require symbolic or placeholder evidence.
- Keep active governance work small enough to execute.

## Trust Rules

- Required governance surfaces must not lie.
- Memory/context surfaces in governance paths need provenance and freshness.
- Required-check ownership must remain explicit and validated.
- Review gates must remain independent; agents cannot self-approve.

## Evidence Basis

- ADR-003, ADR-004, ADR-007.
- `.harness/refactors/governance-contract-memory-simplification.md`.
- `.harness/strategy/coding-harness-strategy.md`.
