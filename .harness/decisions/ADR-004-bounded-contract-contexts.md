# ADR-004

## Title

Bounded Contract Contexts With A Published Aggregate

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

`harness.contract.json` remains the published aggregate contract for installed
repositories, but internal contract ownership must be split by bounded context.

Contract areas such as CI ownership, command surface, review gate, memory,
Project Brain, docs gate, init/update scaffolding, and release readiness must
have clear owners, validation paths, and compatibility rules.

## Context

The contract is a central stable interface. It is also broad enough to become a
policy junk drawer if every governance concern is added directly to one
aggregate without context boundaries.

## Why This Decision Exists

The published aggregate gives downstream repos a single contract. Internal
bounded contexts keep unrelated policy changes from amplifying through the
entire schema and forcing future agents to understand everything before editing
one concern.

This decision prevents contract centrality from becoming contract sprawl.

## Alternatives Considered

- Keep one monolithic contract/type surface indefinitely: rejected because it
  raises local reasoning cost and change amplification.
- Split the published contract into many repo files immediately: rejected
  because downstream compatibility and adoption depend on a stable aggregate.
- Move policy out of the contract into docs: rejected because docs are weaker
  enforcement surfaces.

## Accepted Tradeoffs

- Internal composition logic adds some build/validation complexity.
- Backward compatibility must be preserved while internals are split.
- Contract ownership becomes more explicit and therefore less casual.

## Anti-Drift Constraints

- Do not add unrelated policy directly to the aggregate without bounded-context
  ownership.
- Do not break the published aggregate shape without a migration ADR and
  downstream compatibility proof.
- Do not let context fragments become hidden parallel contracts.
- Each contract area must map to validation or generated projection.

## Safe Revisit Conditions

Revisit if downstream repos no longer need a single aggregate contract, or if
composition overhead exceeds the change-amplification cost it removes.

## Related Systems

- `harness.contract.json`
- `src/lib/contract/types-core.ts`
- contract validators
- docs-gate
- policy-gate
- init/update scaffold generation
- `.harness/refactors/governance-contract-memory-simplification.md`

## Evidence

Facts:

- `.harness/features/coding-harness-intent.md` identifies the contract schema as
  a central stable interface.
- `.harness/review/coding-harness-architecture-review.md` flags contract/type
  breadth as a risk and recommends bounded context ownership.
- `.harness/triage/coding-harness-triage.md` recommends a Contract Bounded
  Contexts ADR.
- `.harness/strategy/coding-harness-strategy.md` says the aggregate should be
  preserved while internal contract organization is safe to rewrite.

Interpretation:

- The contract is moat-critical when it compresses operating agreements. It
  weakens the moat when it becomes an undifferentiated policy container.

Assumptions:

- Existing downstream repos and generated artifacts expect the aggregate
  contract shape.
