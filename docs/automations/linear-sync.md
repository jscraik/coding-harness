---
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - automation-maintainer
  - release-operator
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - linear-sync-change
  - issue-lifecycle-change
  - tracker-state-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/automations/README.md
  - docs/agents/13-linear-production-workflow.md
  - docs/guardrails/external-state.md
---

# Linear sync runbook

## Table of Contents

- [Purpose](#purpose)
- [Machine Identity](#machine-identity)
- [Source Of Truth](#source-of-truth)
- [Workflow](#workflow)
- [Stop Conditions](#stop-conditions)
- [Validation](#validation)

## Purpose

Use this runbook to keep tracker state aligned with PR and lifecycle evidence
without treating tracker mutation as proof of delivery.

## Machine Identity

Automation ID: linear-sync.
Cursor: Linear issue key plus linked PR when present.
Output lane: tracker state.

## Source Of Truth

Use current evidence in this order:

1. Linear issue state and labels.
2. Current linked PR state and merge status.
3. Current handoff, blocker, or evidence references.
4. Prior comments only as supporting context.

## Workflow

1. Resolve the Linear issue and linked PR.
2. Classify the lifecycle lane: triage, ready, in progress, in review, done,
   fail, blocked, or superseded.
3. Attach or refresh PR/evidence references only when mutation is authorized.
4. Preserve blocked overlay separately from canonical workflow state.
5. Do not close the issue unless acceptance and merge evidence agree.
6. Report tracker state separately from CI, review, and local validation.

## Stop Conditions

Stop when the issue is done, failed, superseded, missing, or awaiting human
decision. Pause mutation when Linear credentials or authority are unavailable.

## Validation

Use dry-run or current Linear query evidence first. For runbook changes, run
pnpm docs:lifecycle and docs-gate.
