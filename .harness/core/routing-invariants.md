# Routing Invariants

## Table Of Contents

- [Routing Rules](#routing-rules)
- [Command Truth](#command-truth)
- [Skill And Plugin Routing](#skill-and-plugin-routing)
- [Evidence Basis](#evidence-basis)

## Routing Rules

- Proven: routing must be deterministic, explainable, and inspectable from repo
  artifacts.
- Proven: `harness next --json` is the primary agent-facing routing surface.
- Operating principle: execution ambiguity is architecture drift.
- Operating principle: route through the smallest command that produces
  observable evidence.
- Operating principle: routing layers must reduce decision cost; otherwise delete
  or collapse them.

## Command Truth

- CLI dispatch, registry, capabilities, help, README, docs, packaged skill, and
  gates must not disagree.
- Every command has a tier: cockpit, domain, plumbing, or legacy.
- Legacy aliases require owner, validation, and sunset condition.
- Documented commands without dispatch are drift until intentionally deprecated.
- Command breadth is not product strength.

## Skill And Plugin Routing

- The packaged `coding-harness` skill is a product API.
- Skill references must resolve against real commands and downstream-like
  behavior fixtures.
- Optional tools and plugins are not core unless they strengthen the PR loop or
  learned-failure loop.
- String-level skill validation is not semantic assurance.
- Hidden skill/plugin paths are forbidden because agents cannot reason locally
  about them.

## Evidence Basis

- ADR-001, ADR-002, ADR-007.
- `.harness/refactors/command-cockpit-truth-reconciliation.md`.
- `.harness/refactors/packaged-skill-behavior-assurance.md`.
