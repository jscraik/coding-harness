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
  - review-state-change
  - coderabbit-workflow-change
  - codex-review-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/lifecycle/truth-lanes.md
  - docs/guardrails/delivery-truth.md
  - docs/agents/12-ai-review-governance.md
---

# Review state guardrail

## Table of Contents

- [Default Stance](#default-stance)
- [Allowed Exceptions](#allowed-exceptions)
- [Proof Obligations](#proof-obligations)
- [Validation](#validation)
- [Review Checklist](#review-checklist)

## Default Stance

Review state is independent from local validation and CI. A coding agent cannot
self-approve. Codex review, CodeRabbit, and human review must be classified as
separate sources unless a current repo contract composes them.

## Allowed Exceptions

- A pre-PR self-check may be reported as local review only.
- A missing independent reviewer may block the review lane without blocking the
  local implementation lane.
- A review artifact can support review state only when it is current, scoped,
  non-empty, and independently produced when independence is required.

## Proof Obligations

| Claim | Evidence needed |
| --- | --- |
| Codex review complete | Reviewer identity, scope, artifact or thread, findings status |
| CodeRabbit reviewed | Current CodeRabbit status, findings, threads, or explicit unavailable reason |
| Human review resolved | Current PR thread or approval evidence |
| Review feedback absorbed | Changed files plus durable feedback destination when pattern-bearing |
| Review lane blocked | Missing reviewer, unresolved thread, stale artifact, or unavailable tool reason |

## Validation

Use PR review queries, review artifacts, CodeRabbit outputs, or the narrow
harness review-state command when available. Do not treat mailbox status text as
artifact completion when artifact-first review was required.

## Review Checklist

- Is independent review separated from self-check?
- Are unresolved threads and pending findings named?
- Did pattern-bearing review feedback become a durable destination?
- Does review state avoid claiming CI, tracker, or merge readiness?
