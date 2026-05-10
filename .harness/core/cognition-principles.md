# Cognition Principles

## Table Of Contents

- [Primary Rule](#primary-rule)
- [Local Reasoning](#local-reasoning)
- [Context Loading](#context-loading)
- [Abstraction Quality](#abstraction-quality)
- [Evidence Basis](#evidence-basis)

## Primary Rule

Optimize for future agents and humans understanding the next safe action quickly.

## Local Reasoning

- Proven: future-agent success depends on low context cost and explicit routing.
- Operating principle: local reasoning must work before whole-repo reasoning is
  required.
- Operating principle: command output and contracts should explain state without
  requiring long narrative docs.
- Operating principle: if a file requires broad historical context to edit
  safely, it is a refactor candidate.

## Context Loading

- Load cockpit surfaces first.
- Load domain docs only when the routed task needs them.
- Load strategy/review artifacts for architecture decisions, not ordinary
  implementation.
- Treat stale, placeholder, or unowned memory as worse than absent memory.
- Context compression must preserve constraints, not just summarize text.

## Abstraction Quality

- Abstractions must reduce reasoning cost.
- Shallow pass-through layers are debt unless they preserve compatibility during
  a migration.
- Orchestration layers must make sequencing clearer.
- Generated surfaces are acceptable when they reduce drift and remain
  inspectable.
- Complexity that only looks sophisticated weakens cognition.

## Evidence Basis

- ADR-001 through ADR-007.
- `.harness/review/coding-harness-architecture-review.md`.
- `.harness/triage/coding-harness-triage.md`.
