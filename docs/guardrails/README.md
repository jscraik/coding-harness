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
  - guardrail-change
  - review-standard-change
  - lifecycle-governance-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/domain/context-map.md
  - docs/lifecycle/issue-to-main.md
  - docs/architecture/documentation-layers.md
---

# Guardrails

## Table of Contents

- [Purpose](#purpose)
- [Use](#use)
- [Guardrail pages](#guardrail-pages)
- [Authoring contract](#authoring-contract)
- [Review rule](#review-rule)

## Purpose

Guardrails are durable review standards for recurring risk domains. They define
default stance, exceptions, proof obligations, validation, and review questions.
They do not replace SOPs, specs, plans, or generated evidence.

## Use

Open one guardrail when the changed surface touches that risk. Do not load the
whole guardrail folder unless the task is documentation architecture or review
taxonomy work.

## Guardrail pages

| Guardrail | Use when |
| --- | --- |
| [Delivery truth](./delivery-truth.md) | A change affects completion, closeout, PR readiness, tracker state, or merge claims. |
| [External state](./external-state.md) | A change reads, reports, or depends on GitHub, CI, CodeRabbit, Semgrep Cloud, or Linear state. |
| [Generated artifacts](./generated-artifacts.md) | A change creates, validates, promotes, or references generated context, evidence, diagrams, snapshots, receipts, or reports. |
| [Review state](./review-state.md) | A change affects Codex review, CodeRabbit, human review, review artifacts, or unresolved-thread claims. |
| [Runtime evidence](./runtime-evidence.md) | A change creates, validates, consumes, or cites runtime cards, evidence receipts, browser evidence, replay packets, or eval artifacts. |
| [Automation authority](./automation-authority.md) | A change lets recurring automation observe, report, mutate, pause, delete, or promote feedback. |
| [Package and scaffold release](./package-and-scaffold-release.md) | A change affects npm package contracts, harness init scaffolds, packaged skills, generated templates, or release impact. |

## Authoring contract

Every guardrail must include:

- default stance
- allowed exceptions
- proof obligations
- validation
- review checklist
- relationship to source-of-truth docs or artifacts

## Review rule

If review feedback repeats for the same risk class, update the matching
guardrail, validator, skill, Project Brain surface, or tracked exception before
claiming the feedback loop was absorbed.
