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
  - ci-green-sweep-change
  - required-check-change
  - merge-readiness-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/automations/README.md
  - docs/guardrails/external-state.md
  - docs/lifecycle/truth-lanes.md
---

# CI green sweep runbook

## Table of Contents

- [Purpose](#purpose)
- [Machine Identity](#machine-identity)
- [Source Of Truth](#source-of-truth)
- [Workflow](#workflow)
- [Stop Conditions](#stop-conditions)
- [Validation](#validation)

## Purpose

Use this runbook for recurring checks that determine whether a PR is still
waiting on CI, blocked by a required check, or ready for review/merge follow-up.

## Machine Identity

Automation ID: ci-green-sweep.
Cursor: PR number plus current head SHA.
Output lane: external state and merge-readiness support only.

## Source Of Truth

Use current provider evidence in this order:

1. GitHub PR head and required-check list.
2. CircleCI, Semgrep Cloud, CodeRabbit, and GitHub check status.
3. Repo required-check contracts.
4. Prior automation comment only as supporting context.

## Workflow

1. Resolve the target PR and head SHA.
2. Query current required checks.
3. Classify each check as pass, fail, pending, skipped, missing, or unavailable.
4. Separate CI failures from local validation and review state.
5. Report next action: wait, fix current patch, classify pre-existing failure,
   request credentials, or hand off to merge-readiness review.

## Stop Conditions

Stop or pause when the PR is merged, closed, superseded, missing, or no longer
matches the runbook cursor. Delete stale heartbeat automations when the lane is
done.

## Validation

Run the provider query or harness wrapper that proves current check state. For
runbook changes, run pnpm docs:lifecycle and docs-gate.
