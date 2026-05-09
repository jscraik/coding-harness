# Anti-Drift Principles

## Table Of Contents

- [Early Warning Signals](#early-warning-signals)
- [Blocking Signals](#blocking-signals)
- [Corrective Bias](#corrective-bias)
- [Evidence Basis](#evidence-basis)

## Early Warning Signals

- Command docs, help, registry, dispatch, and skill references disagree.
- Prompt or docs growth replaces a possible deterministic check.
- Governance prose repeats across surfaces without generation.
- Context load increases without reliability gain.
- Abstractions multiply without deletion.
- Orchestration becomes harder to explain than the work it coordinates.
- Memory/context surfaces lack provenance, freshness, or ownership.
- Large orchestrators receive new behavior instead of extraction.

## Blocking Signals

- Required governance surfaces contain placeholder evidence.
- A trust-bearing command is documented but cannot dispatch.
- A migration closes without required eval proof.
- A memory/context surface informs routing but cannot reproduce its source.
- New contract fields lack bounded-context owner and validation.
- Packaged skill release lacks downstream-like behavior proof.
- CI ownership changes without required-check parity.

## Corrective Bias

- Prefer deletion before abstraction.
- Prefer generated projection before duplicated prose.
- Prefer fixture proof before claims of portability.
- Prefer typed, testable internals behind stable entrypoints.
- Prefer cockpit compression before command expansion.
- Prefer one canonical source over many reassuring summaries.

## Evidence Basis

- `.harness/features/coding-harness-intent.md` drift signals.
- `.harness/triage/coding-harness-triage.md`.
- ADR-002, ADR-003, ADR-004, ADR-006, ADR-007.
