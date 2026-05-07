# ADR-005

## Title

Operational Learning Is The Moat

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

The defensible moat is operational learning encoded into portable executable
contracts, decision packets, fixtures, gates, and workflow proof.

Moat claims require evidence. A system is moat-critical only if it improves
review trust, execution determinism, adoption portability, agent cognition, or
learned-failure conversion.

## Context

The repo contains sophisticated governance, command, skill, CI, memory, and
review systems. Technical sophistication alone is easy to overvalue. The parts
that are hard to copy are the accumulated failure cases turned into reliable
operational contracts.

## Why This Decision Exists

Competitors can copy CLI commands, docs, and generic agent language. They will
struggle more with a tested corpus of real PR failure modes, review evidence
loops, required-check ownership rules, scaffold migrations, and downstream
skill behavior fixtures.

This decision prevents the project from treating complexity as defensibility.

## Alternatives Considered

- Moat is command breadth: rejected because commands are easy to copy and can
  increase cognition cost.
- Moat is governance depth: rejected unless governance is executable and
  measured.
- Moat is integrations: rejected because optional integrations are weak without
  workflow proof.
- Moat is agent-native positioning: rejected because language is not operational
  reliability.

## Accepted Tradeoffs

- Strategic work must be more measurable.
- Some impressive surfaces should be simplified or deleted if they do not prove
  workflow value.
- Fixtures, telemetry, and eval artifacts become first-class architecture.

## Anti-Drift Constraints

- Do not call a system moat-critical without a proof path.
- Do not preserve complexity because it looks sophisticated.
- Do not add integrations unless they strengthen the PR loop or learned-failure
  loop.
- No Linear parent issue or migration milestone should close without the related
  eval artifact when an eval path is defined.
- Telemetry and evals must measure operational outcomes, not only artifact
  existence.

## Safe Revisit Conditions

Revisit if adoption evidence shows a different compounding advantage, such as a
distribution channel, ecosystem network effect, or external dataset that becomes
more defensible than operational workflow reliability.

## Related Systems

- `src/lib/decision/harness-decision.ts`
- `harness.contract.json`
- gate result schemas
- review-gate
- CI required-check parity
- packaged skill fixtures
- `.harness/evals/**`
- `.harness/strategy/coding-harness-strategy.md`

## Evidence

Facts:

- `.harness/features/coding-harness-intent.md` identifies the probable moat as
  operational scar tissue encoded as deterministic workflow contracts.
- `.harness/review/coding-harness-architecture-review.md` says the moat is real
  only if measured through contracts, gates, fixtures, and decisions.
- `.harness/triage/coding-harness-triage.md` separates moat-critical systems
  from fake sophistication signals.
- `.harness/strategy/coding-harness-strategy.md` explicitly rejects command
  count, governance prose, and optional plugin breadth as moat claims.

Interpretation:

- The architecture should optimize for proof-backed operational reliability,
  not a larger conceptual platform.

Assumptions:

- Real agent workflow failures will continue to repeat often enough that
  encoding them into contracts compounds.
