# ADR-002

## Title

Command Truth And Surface Budget

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

Command truth must be reconciled across CLI dispatch, command registry,
capability metadata, help output, README examples, docs, packaged skill
references, and validation gates.

The command surface must be tiered:

- cockpit: minimal commands that drive the PR loop
- domain: commands supporting a bounded workflow
- plumbing: implementation/support commands
- legacy: compatibility commands with owner and sunset rule

New command families require an admission reason, owner, validation path,
documentation projection, and removal condition for any compatibility alias.

## Context

The repository has a large command inventory and documented command examples.
Prior gates reported README-documented commands missing dispatch support. This
creates direct agent ambiguity: the repo tells agents to run commands that may
not exist or may resolve through a different path than documented.

## Why This Decision Exists

For an agent-native control plane, command truth is product truth. If docs,
registry, help output, and dispatch disagree, future agents cannot reason
locally and will either over-read the repo or improvise unsafe paths.

This decision prevents command surface growth from turning discoverability into
a memory test.

## Alternatives Considered

- Keep command truth in README examples: rejected because docs drift faster than
  dispatch.
- Keep command truth only in TypeScript registry files: rejected because agents
  need projected, human-readable command surfaces too.
- Allow unlimited aliases for ergonomics: rejected because aliases multiply
  support and validation cost.

## Accepted Tradeoffs

- Command creation becomes slower.
- Some convenience aliases should be deleted or demoted.
- Generated docs and validation gates become required command infrastructure.

## Anti-Drift Constraints

- No documented command may lack a dispatch path unless explicitly marked as
  planned or deprecated.
- No command may be added without a tier.
- Legacy aliases must have owners and sunset conditions.
- README, help, registry, capability metadata, and packaged skill references
  must fail validation when they disagree.
- Command count is not evidence of product strength.

## Safe Revisit Conditions

Revisit this ADR if command usage telemetry proves that a broader visible
surface improves task success without increasing support burden, drift warnings,
or agent context cost.

## Related Systems

- `src/lib/cli/command-registry.ts`
- `src/lib/cli/registry/command-capabilities.ts`
- `src/commands/**`
- `README.md`
- `.agents/skills/coding-harness/**`
- `.harness/refactors/command-cockpit-truth-reconciliation.md`

## Evidence

Facts:

- `.harness/features/coding-harness-intent.md` identifies command
  discoverability as a product requirement and cites command registry and
  capability metadata as stable interfaces.
- `.harness/review/coding-harness-architecture-review.md` identifies command
  surface growth and command/docs drift as agent-native risks.
- `.harness/triage/coding-harness-triage.md` recommends a Command Surface Budget
  ADR and classifies command truth reconciliation as high leverage.
- `.harness/refactors/command-cockpit-truth-reconciliation.md` defines the
  migration path for reconciling command truth.

Interpretation:

- Command drift damages the core moat because the harness claims to make agent
  execution deterministic.

Assumptions:

- The harness will keep a CLI-first execution model.
