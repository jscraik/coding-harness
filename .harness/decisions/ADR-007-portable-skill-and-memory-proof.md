# ADR-007

## Title

Portable Skill And Memory Surfaces Require Proof

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

The packaged `coding-harness` skill and repo memory/context surfaces must be
treated as trust-bearing product APIs.

Skill validity requires behavior proof in downstream-like fixtures, not only
string or reference checks. Memory validity requires provenance, freshness, and
clear ownership, or the surface must be marked fixture-only or removed from
required workflows.

## Context

The packaged skill is how the harness travels into other repositories. Memory
and Project Brain surfaces are how future agents inherit operational context.
Both are high-trust surfaces; both become damaging if they pass validation while
lying about behavior or context.

## Why This Decision Exists

A downstream skill that validates but cannot guide installation/update behavior
is worse than no skill because it creates false confidence. A memory file with
placeholder content in a memory-first repo teaches agents that governed context
may be symbolic.

This decision prevents agent-facing trust surfaces from becoming ceremonial.

## Alternatives Considered

- Keep lexical skill validation as sufficient: rejected because command names
  can be current while workflow behavior is broken.
- Keep placeholder memory as harmless scaffold: rejected because required
  memory surfaces are interpreted as operational truth.
- Expand memory systems before ownership is clear: rejected because it increases
  ambiguity.

## Accepted Tradeoffs

- Skill validation becomes slower and fixture-heavy.
- Memory surfaces may be deleted, narrowed, or marked fixture-only even if that
  reduces apparent capability.
- The repo accepts less agent-context breadth in exchange for higher trust.

## Anti-Drift Constraints

- Do not claim packaged skill readiness without install/update/action-sync
  fixture coverage.
- Do not treat string-level validation as semantic assurance.
- Do not require memory validation against placeholder or unowned data.
- Do not add new memory/context surfaces without provenance, freshness policy,
  and owner.
- Do not expand plugin/tool references as product value unless they are
  behavior-tested in the skill path.

## Safe Revisit Conditions

Revisit if a different validation method proves downstream skill behavior and
memory trust with less fixture cost, or if memory surfaces are removed from all
agent routing and no longer carry operational authority.

## Related Systems

- `.agents/skills/coding-harness/**`
- `scripts/validate-packaged-skill.cjs`
- `.agents/skills/coding-harness/scripts/validate_reference_contracts.py`
- `memory.json`
- `.harness/memory/**`
- Project Brain surfaces
- `.harness/refactors/packaged-skill-behavior-assurance.md`
- `.harness/refactors/governance-contract-memory-simplification.md`

## Evidence

Facts:

- `.harness/features/coding-harness-intent.md` identifies the downstream skill
  shape as core and flags placeholder `memory.json` as a drift signal.
- `.harness/review/coding-harness-architecture-review.md` says skill validation
  is useful but shallow when it is only lexical.
- `.harness/triage/coding-harness-triage.md` recommends packaged skill behavior
  tests and memory surface ownership.
- `.harness/strategy/coding-harness-strategy.md` says memory/context surfaces
  must be current, provenance-aware, and meaningful.
- `.harness/refactors/packaged-skill-behavior-assurance.md` and
  `.harness/refactors/governance-contract-memory-simplification.md` define eval
  paths for these trust surfaces.

Interpretation:

- The skill and memory systems are adoption and cognition surfaces, not internal
  implementation details.

Assumptions:

- Future agents will use these surfaces as authoritative unless the repo marks
  them otherwise.
