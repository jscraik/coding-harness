---
doc_schema: coding-harness-doc/v1
doc_type: lifecycle
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - coding-harness-maintainer
  - automation-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - feedback-loop-change
  - repeated-steering-change
  - automation-runbook-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/lifecycle/issue-to-main.md
  - docs/automations/README.md
  - docs/guardrails/delivery-truth.md
---

# Feedback loop

## Table of Contents

- [Purpose](#purpose)
- [Inputs](#inputs)
- [Durable Destinations](#durable-destinations)
- [Admission Test](#admission-test)
- [Review Checklist](#review-checklist)

## Purpose

The feedback loop turns repeated correction into durable system behavior. It is
not a memory dump. It exists to reduce future review and rework cost.

## Inputs

Feedback may come from user steering, failed validation, pre-commit hooks,
Codex review, CodeRabbit, human review, CI, Linear, post-merge drift, or
automation wake-ups.

## Durable Destinations

| Feedback class | Destination |
| --- | --- |
| Repeated steering | AGENTS, glossary, guardrail, validator, skill, Project Brain, or tracked exception |
| Validation ambiguity | Validation doc, gate, fixture, or command output contract |
| Review pattern | Guardrail, reviewer role instruction, test fixture, or imported learning |
| Automation drift | Runbook source rule, cursor, stop condition, or deletion rule |
| Claim overreach | Claim authority, truth lanes, PR template, or closeout validator |
| Downstream setup risk | Template, packaged skill, init or upgrade regression test |

## Admission Test

A feedback item should be admitted when the same judgment is needed twice, a
failure can recur across slices, or a review comment reveals a reusable rule.
If the item is one-off implementation context, keep it in the PR, plan, or
implementation note instead.

## Review Checklist

- Did repeated feedback become a durable destination?
- Is the destination narrow enough to avoid policy sprawl?
- Was a validation command run for the destination?
- Are intentionally deferred follow-ups named?
