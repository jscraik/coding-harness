---
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - docs-reviewer
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - runtime-evidence-change
  - evidence-receipt-change
  - artifact-claim-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/guardrails/generated-artifacts.md
  - docs/domain/claim-authority.md
  - docs/agents/07b-agent-governance.md
---

# Runtime evidence guardrail

## Table of Contents

- [Default Stance](#default-stance)
- [Allowed Exceptions](#allowed-exceptions)
- [Proof Obligations](#proof-obligations)
- [Validation](#validation)
- [Review Checklist](#review-checklist)

## Default Stance

Runtime evidence explains what happened in a run. It is advisory unless a
specific contract grants claim authority for a lane. Runtime cards, evidence
bundles, receipts, screenshots, browser evidence, and replay packets must remain
pointer-based and redacted when made durable.

## Allowed Exceptions

- A runtime artifact may support local behavior only when a validator binds it
  to source refs, freshness, and the relevant claim family.
- A screenshot or browser packet may support visual evidence without proving
  delivery truth, review resolution, or merge readiness.
- Raw transcripts and bulky telemetry stay out of durable docs unless an
  explicit redaction and retention contract exists.

## Proof Obligations

| Artifact | Evidence needed |
| --- | --- |
| Runtime card | Producer, session/run id, source refs, blocker class when blocked |
| Evidence receipt | Claim family, source kind, freshness, head SHA when relevant |
| Browser evidence | Viewport, screenshot/video presence, non-blank or console policy result |
| Replay packet | Seed refs, stale-state classification, content redaction |
| Eval result | Scenario id, fixture identity, pass/fail, first failing assertion |

## Validation

Run the artifact-specific validator or test for the packet family. Use
docs-gate when documentation claims or generated surfaces change.

## Review Checklist

- Does the runtime artifact name producer, source refs, and allowed claim?
- Is private or bulky content kept out of durable docs?
- Is advisory evidence prevented from proving merge readiness?
- Are stale or head-mismatched packets classified before use?
