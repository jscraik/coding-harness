---
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - automation-maintainer
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - automation-authority-change
  - runbook-change
  - recurring-workflow-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/automations/README.md
  - docs/lifecycle/feedback-loop.md
  - docs/domain/claim-authority.md
---

# Automation authority guardrail

## Table of Contents

- [Default Stance](#default-stance)
- [Allowed Exceptions](#allowed-exceptions)
- [Proof Obligations](#proof-obligations)
- [Validation](#validation)
- [Review Checklist](#review-checklist)

## Default Stance

Automation is allowed to observe, report, and follow a runbook. It may mutate
external systems only when the runbook, current user instruction, and tool
permission model all allow that action.

## Allowed Exceptions

- A read-only automation may run from a minimal prompt when it links to the
  reviewed runbook.
- A missing automation API may fall back to repo-owned automation files only
  after exact identity and path are known.
- A heartbeat may keep running only while its stop condition is false.

## Proof Obligations

| Action | Evidence needed |
| --- | --- |
| Wake-up continues | Stable automation ID, current cursor, next action |
| Status comment | Source evidence, lane classification, no hidden mutation |
| External mutation | Current authority, target identity, dry-run or approval when required |
| Pause/delete | Stop condition evidence and exact automation identity |
| Feedback promotion | Failure class, durable destination, validation command |

## Validation

Use exact commands and outcomes in automation closeout. Minimum lanes:

- Command: `pnpm docs:lifecycle` -> required after runbook metadata,
  authority, ownership, or lifecycle changes.
- Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json`
  -> required when automation authority, docs-gate, or governed documentation
  behavior changes.
- Command: `pnpm test:related` -> required when implementation or validator
  code changes.
- Command: `git diff --check` -> required before handoff.

If a command is blocked, record the blocker, owner, and nearest meaningful
fallback. Do not replace command evidence with a prose assertion.

## Review Checklist

- Does the automation have a stable identity and cursor?
- Does it name the source that decides next action?
- Does any mutation have current authority?
- Does the runbook define stop, pause, or deletion behavior?
