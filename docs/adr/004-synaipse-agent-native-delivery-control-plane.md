---
doc_schema: coding-harness-doc/v1
doc_type: architecture
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - coding-harness-maintainer
  - codex-agent
  - reviewer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-07-11
last_reviewed: 2026-07-11
review_cadence: on-change
maintenance_trigger:
  - codex-synaipse-ownership-change
  - lifecycle-architecture-change
  - public-control-plane-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - docs/roadmap/north-star.md
last_validated: 2026-07-11
---

# ADR 004: SynAIpse Agent-Native Delivery Control Plane

## Status

Accepted

## Context

Coding Harness contains strong delivery, evidence, review, and feedback
capabilities, but agents face overlapping entrypoints, packets, diagnostics,
provider ownership, and historical context. Some command metadata also labels
invocations as safe reads even when reachable modes write state. Broadening the
harness without a runtime ownership boundary would duplicate Codex and increase
Jamie's decision burden.

## Decision

SynAIpse is the Jamie-specific delivery control plane around Codex.

- Codex owns execution, tools, git/filesystem operations, sessions, sandbox
  controls, permissions, memory, plugins, skills, MCP, and native review.
- SynAIpse owns Jamie Core, the seven-stage delivery lifecycle, current-SHA
  evidence admission, provider ownership, the Vital Decision Gate, project
  adoption, and measured improvement.
- Target repositories retain non-overridable domain, privacy, raw-source,
  durable-knowledge, CODESTYLE, validation, and rollback authority.
- `harness next --json` becomes the sole routine agent entrypoint.
- Exact invocations declare read, artifact, repository, git, and external
  effects.
- State, transition, improvement, adoption, security, and sign-off use the
  canonical SynAIpse v1 contracts.
- Jamie Brain's existing project registry owns project identity; a governed
  context catalog describes private context; SynAIpse selects refs; Codex
  retrieves selected sources; Admit freezes a task-context snapshot.
- Product repositories and CI use logical IDs and remain independent of private
  Jamie Brain paths and content.
- Every canonical project's repository-owned developer documentation is
  GitBook-compatible unless an explicit non-public exception is accepted.
  GitBook is a public-safe projection and cannot ingest Jamie Brain project
  context, private plans, task snapshots, raw sources, secrets, or local paths.
- Migration is additive and canary-led before compatibility retirement.

Detailed requirements live in the
[SynAIpse v1 specification](../specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md).

## Consequences

### Positive

- Jamie is reserved for Vital Decisions while Codex handles ordinary work.
- Agents receive one next action with truthful effects and evidence.
- Codex and target-repository authority remain explicit.
- Provider overlap, packet sprawl, and historical context gain retirement paths.
- Portfolio rollout becomes capability-based and measurable.
- Private context stays shared, visible, and editable in Jamie Brain without becoming
  a hidden build dependency or a second repository truth store.

### Negative

- Public and packaged compatibility requires temporary adapters.
- Every canonical project needs an adoption or explicit non-adoption record.
- Provider consolidation and command retirement require live canaries and
  independent review, so simplification cannot be a single rewrite.
- Current and target architecture coexist during migration and must be labelled
  precisely.

## Alternatives Considered

1. **Keep the current command and packet taxonomy.** Rejected because internal
   consistency does not remove agent choice, hidden effects, or context cost.
2. **Make SynAIpse a separate execution runtime.** Rejected because it would
   duplicate Codex ownership and couple the product to unstable internals.
3. **Install the full harness into every project.** Rejected because target
   repositories need the smallest admitted capability set, not copied ceremony.
4. **Rewrite and delete legacy surfaces immediately.** Rejected because public
   callers, packages, providers, and durable evidence require migration proof.
5. **Create a standalone context registry service.** Rejected because Jamie
   Brain already owns project identity and cards; an additive catalog and
   read-only resolver are smaller and reversible.

## References

- [Root architecture](../../ARCHITECTURE.md)
- [SynAIpse v1 specification](../specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md)
- [SynAIpse v1 implementation plan](../plans/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-plan.md)
- [Runtime-aware control plane](../architecture/runtime-aware-harness-control-plane.md)
