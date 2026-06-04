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
  - generated-artifact-change
  - evidence-contract-change
  - diagram-context-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/domain/context-map.md
  - .harness/README.md
  - docs/architecture/documentation-layers.md
---

# Generated artifacts guardrail

## Table of Contents

- [Default stance](#default-stance)
- [Allowed exceptions](#allowed-exceptions)
- [Proof obligations](#proof-obligations)
- [Validation](#validation)
- [Review checklist](#review-checklist)

## Default stance

Generated artifacts are supporting evidence unless a validator, manifest, spec,
plan, PR closeout contract, or decision explicitly promotes the artifact for a
claim family. Do not patch generated projections when a canonical source owns
the content.

## Allowed exceptions

- A generated artifact may be tracked as a fixture when a test or validator
  consumes that exact file.
- A generated report may be promoted as review evidence when it is redacted,
  source-bound, and referenced by a PR, spec, plan, or decision.
- A diagram may orient humans and agents without becoming the canonical
  architecture map.

## Proof obligations

Generated artifacts that support claims must declare or be accompanied by:

| Requirement | Purpose |
| --- | --- |
| Producer or command | Shows how the artifact can be refreshed |
| Source refs | Shows what inputs the artifact represents |
| Timestamp or head SHA | Shows freshness and checkout binding |
| Path containment | Prevents leaking local-only or unrelated files |
| Redaction boundary | Prevents secrets, private transcripts, and bulky telemetry from becoming durable docs |
| Allowed claim family | Prevents orientation artifacts from proving delivery truth |

## Validation

Use the narrow validator that owns the artifact family. Examples:

- pnpm docs:lifecycle for governed documentation metadata and distribution
  boundary checks.
- bash scripts/run-harness-gate.sh docs-gate --mode required --json when
  generated or governed documentation surfaces changed.
- The artifact-specific test or validator when runtime cards, evidence
  receipts, browser evidence, review state, or external-state packets change.

## Review checklist

- Is the artifact generated, supporting, historical, or canonical?
- Is the canonical source updated instead of the projection?
- Does the artifact name its producer, inputs, freshness, and allowed claims?
- Is the artifact redacted and repo-contained?
- Does any text imply generated context proves merge readiness, tracker state,
  or review resolution without a claim contract?
