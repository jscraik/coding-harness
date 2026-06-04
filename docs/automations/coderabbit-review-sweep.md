---
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - automation-maintainer
  - docs-reviewer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - coderabbit-sweep-change
  - review-state-change
  - pr-review-workflow-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/automations/README.md
  - docs/guardrails/review-state.md
  - docs/agents/12-ai-review-governance.md
---

# CodeRabbit review sweep runbook

## Table of Contents

- [Purpose](#purpose)
- [Machine Identity](#machine-identity)
- [Source Of Truth](#source-of-truth)
- [Workflow](#workflow)
- [Stop Conditions](#stop-conditions)
- [Validation](#validation)

## Purpose

Use this runbook to classify CodeRabbit findings, unresolved review threads,
and review-ready handoff state without treating the coding agent as an
independent approver.

## Machine Identity

Automation ID: coderabbit-review-sweep.
Cursor: PR number plus review provider status.
Output lane: review state only.

## Source Of Truth

Use current PR review evidence in this order:

1. Current CodeRabbit PR status, findings, or threads.
2. Current GitHub review threads and comments.
3. Local review artifacts only when they are scoped and current.
4. Prior summaries only as supporting context.

## Workflow

1. Resolve the target PR.
2. Query current CodeRabbit and GitHub review state.
3. Group findings by actionable fix, invalid finding, already addressed, or
   needs human decision.
4. Keep CodeRabbit, Codex review, and human review separate.
5. Route repeated findings into guardrails, tests, Project Brain, or a tracked
   exception when pattern-bearing.
6. Report review lane status without claiming CI, tracker, or merge readiness.

## Stop Conditions

Stop when all review findings are resolved or explicitly waived, the PR is
closed, the provider is unavailable after credential recovery, or a human
decision is required.

## Validation

Use the current provider query or review-state wrapper. For runbook changes, run
pnpm docs:lifecycle and docs-gate.
