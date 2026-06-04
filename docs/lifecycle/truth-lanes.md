---
doc_schema: coding-harness-doc/v1
doc_type: lifecycle
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - coding-harness-maintainer
  - docs-reviewer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - truth-lane-change
  - pr-closeout-change
  - merge-readiness-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/lifecycle/issue-to-main.md
  - docs/domain/claim-authority.md
  - docs/guardrails/delivery-truth.md
---

# Truth lanes

## Table of Contents

- [Purpose](#purpose)
- [Lane Model](#lane-model)
- [Lane Handoff](#lane-handoff)
- [Blocked Or Unobserved Lanes](#blocked-or-unobserved-lanes)
- [Review Checklist](#review-checklist)

## Purpose

Truth lanes keep lifecycle claims from collapsing into one status line. Use this
document when reporting progress, building PR closeout evidence, writing
automation runbooks, or reviewing merge readiness.

## Lane Model

| Lane | Question it answers | Current evidence |
| --- | --- | --- |
| Scope | What are we trying to satisfy? | Linear issue, spec, plan |
| Local code | What changed in this checkout? | Git diff, changed files |
| Local validation | What did this checkout prove? | Exact command outcomes |
| PR | What is open for review? | Current GitHub PR metadata |
| CI | What did remote checks prove? | Required provider evidence |
| Review | What feedback remains? | Review threads and artifacts |
| Tracker | What does the issue tracker say? | Linear state and acceptance trace |
| Artifacts | What durable evidence exists? | Receipts, runtime cards, evals, reports |
| Merge readiness | Can this head merge now? | Branch protection and policy composition |
| Main sync | Is local main current after merge? | Checkout and pull evidence |
| Learning | What should future agents not repeat? | Guardrails, validators, Project Brain, glossary, skills |

## Lane Handoff

A lane may feed another lane, but it does not prove it automatically. Local
validation can feed a PR body. Review resolution can feed merge readiness.
Merge readiness can feed main sync. Each handoff still needs current evidence
from the receiving lane.

## Blocked Or Unobserved Lanes

Use blocked when the lane was checked and a named condition prevents progress.
Use unobserved when the lane was not checked in the current closeout window.
Use not applicable only when the workflow explicitly does not require the lane.

## Review Checklist

- Is the status split by lane instead of compressed into a single green/red?
- Does each lane name current evidence or a blocker?
- Are stale summaries marked as supporting context?
- Is post-merge main sync separated from merge readiness?
