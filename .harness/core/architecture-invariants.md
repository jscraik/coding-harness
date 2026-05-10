# Architecture Invariants

## Table Of Contents

- [Core Shape](#core-shape)
- [Stable Boundaries](#stable-boundaries)
- [Forbidden Drift](#forbidden-drift)
- [Evidence Basis](#evidence-basis)

## Core Shape

- Proven: Coding Harness is a portable control plane for agent-authored PR
  reliability.
- Proven: The core loop is `init` -> `next --json` -> `verify` ->
  `review-gate` -> learned-failure promotion.
- Proven: `harness.contract.json` is the published aggregate contract.
- Proven: `HarnessDecision`, gate results, command metadata, CI ownership, and
  packaged skill behavior are architectural interfaces, not implementation
  details.
- Strategic assumption: the product remains coherent only while it makes agent
  PRs easier to trust and merge.

## Stable Boundaries

- Keep cockpit commands separate from domain, plumbing, migration, and legacy
  surfaces.
- Keep published contract compatibility while splitting internal ownership by
  bounded context.
- Keep shell entrypoints stable while moving policy and orchestration into typed,
  testable internals.
- Keep downstream skill behavior and memory/context surfaces trust-bearing and
  proof-backed.
- Keep CI ownership explicit: CircleCI for PR governance/security, CodeRabbit
  for independent review, Semgrep Cloud as external security, GitHub Actions for
  release/fallback unless deliberately migrated.

## Forbidden Drift

- No hidden orchestration.
- No command promoted to core without PR-loop impact.
- No new behavior in oversized orchestrators without extraction.
- No contract growth without bounded-context ownership.
- No governance prose without enforcement, generated projection, or
  reference-only status.
- No trust-bearing memory or skill surface without proof.

## Evidence Basis

- ADR-001 through ADR-007.
- `.harness/strategy/coding-harness-strategy.md`.
- `.harness/triage/coding-harness-triage.md`.
- `.harness/features/coding-harness-intent.md`.
