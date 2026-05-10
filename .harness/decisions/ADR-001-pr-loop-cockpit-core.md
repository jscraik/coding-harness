# ADR-001

## Title

PR Loop Cockpit Is The Core Product

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

Coding Harness is a portable control plane for the agent-authored PR loop.

The irreducible product surface is:

1. `harness init` installs the repo contract.
2. `harness next --json` tells agents what to do next, with risk and evidence.
3. `harness verify` and repo wrappers prove the work.
4. `harness review-gate` proves current-head PR readiness.
5. The learning loop turns repeated failures into contracts, fixtures, gates, or
   compressed memory.

Other commands are domain, plumbing, migration, or legacy surfaces unless they
directly improve this loop.

## Context

The repository contains a broad command surface, layered governance docs, CI
contracts, review gates, packaged skills, Project Brain surfaces, and local
memory workflows. The architecture is coherent only if these systems serve one
small repeated workflow: make agent PRs easier to trust and merge.

## Why This Decision Exists

The project fails if it becomes a general agent governance platform. The real
pain is narrower: agent PRs create review drag because humans cannot quickly
see risk, evidence, readiness, and required next actions.

This decision prevents future agents from expanding the harness by adding
adjacent governance features that do not reduce PR-loop ambiguity.

## Alternatives Considered

- General AI development platform: rejected because it would make the install
  feel like importing an operating system.
- Broad command toolkit: rejected because command count is not adoption value.
- Documentation-led governance: rejected because agents need executable state,
  not more prose.

## Accepted Tradeoffs

- Some useful capabilities remain secondary until they strengthen the PR loop.
- The architecture becomes opinionated about Codex-first agent workflows.
- Generic extensibility is intentionally reduced in favor of a small trusted
  cockpit.

## Anti-Drift Constraints

- Do not promote a command to core without showing how it improves init, next,
  verify, review readiness, or learned-failure promotion.
- Do not use product breadth as evidence of product maturity.
- Do not add cockpit UI, command aliases, or docs that bypass `next --json` as
  the agent-facing routing source.
- New workflows must declare their effect on PR lead time, review rework,
  safety, or agent ambiguity.

## Safe Revisit Conditions

Revisit this ADR only if live adoption evidence shows that teams primarily use
Coding Harness for a different repeated workflow, and that workflow has stronger
measured pull than agent-authored PR readiness.

## Related Systems

- `harness init`
- `harness next --json`
- `harness verify`
- `harness review-gate`
- `src/lib/decision/harness-decision.ts`
- `harness.contract.json`
- `.agents/skills/coding-harness/**`
- `.harness/strategy/coding-harness-strategy.md`
- `.harness/triage/coding-harness-triage.md`

## Evidence

Facts:

- `.harness/strategy/coding-harness-strategy.md` defines the system as a
  portable governance and execution contract for agentic PR workflows.
- `.harness/features/coding-harness-intent.md` identifies the repeatable PR loop
  as the strategic direction and warns against governance expansion.
- `.harness/triage/coding-harness-triage.md` rejects work outside a small set of
  execution-pressure initiatives unless it fixes a defect.

Interpretation:

- The harness is coherent when it compresses PR execution state. It becomes
  incoherent when broad governance surface area is treated as product progress.

Assumptions:

- Agent-authored PR reliability remains the most valuable problem this repo can
  solve.
