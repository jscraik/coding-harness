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
  - claim-authority-change
  - truth-lane-change
  - evidence-contract-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/domain/context-map.md
  - docs/lifecycle/truth-lanes.md
  - docs/guardrails/delivery-truth.md
---

# Claim authority

## Table of Contents

- [Purpose](#purpose)
- [Rule](#rule)
- [Authority Matrix](#authority-matrix)
- [Claim Support Test](#claim-support-test)
- [Review Checklist](#review-checklist)

## Purpose

Claim authority defines which source is allowed to support a delivery claim.
Use this document when a doc, artifact, runbook, PR body, gate, receipt, or
review note says work is done, ready, green, reviewed, merged, synced, or
learned.

## Rule

A source may support a claim only when it is current, scoped to the same head or
lane, and named as authoritative for that claim family. Supporting context can
explain a claim, but it must not prove the claim unless this document or a more
specific contract allows it.

## Authority Matrix

| Claim family | Primary authority | Supporting sources | Must not prove |
| --- | --- | --- | --- |
| Scope accepted | Linear issue, accepted spec, or admitted plan | PR body, comments, notes | Code correctness |
| Local behavior | Worktree and exact local command outcomes | Test logs, implementation notes | CI, review, tracker state |
| PR state | Current GitHub PR metadata | PR body, branch refs | Local validation correctness |
| CI state | Current required-check provider evidence | Screenshots, summaries | Review resolution |
| Review state | Current review threads or independent review artifacts | Review summaries | CI or merge readiness |
| Artifact evidence | Tracked artifact with source refs and allowed claim family | Runtime cards, receipts, reports | Merge readiness by default |
| Merge readiness | Current PR head, branch protection, required checks, reviews, policy gates | PR closeout | Post-merge main sync |
| Main sync | Local git checkout and pull evidence after merge | Merge commit, PR state | Original acceptance |
| Learning absorbed | Durable guardrail, validator, skill, Project Brain, glossary, or tracked exception | Chat, review comments | Feature completion |

## Claim Support Test

Before a claim is made, answer:

1. Which truth lane does the claim belong to?
2. Which source is authoritative for that lane?
3. Is the evidence current for the same head, issue, PR, or artifact?
4. Does the source explicitly allow this claim family?
5. What nearby lane remains unobserved, blocked, or not applicable?

If any answer is missing, report the claim as unobserved, blocked, or supporting
context only.

## Review Checklist

- Does each completion phrase name the lane it proves?
- Does any artifact overclaim a lane outside its allowed claim family?
- Are stale summaries separated from current evidence?
- Are unobserved lanes named instead of silently implied?
