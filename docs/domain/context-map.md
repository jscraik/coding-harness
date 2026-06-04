---
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - human-operator
  - codex-agent
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - domain-language-change
  - truth-lane-change
  - lifecycle-governance-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - UBIQUITOUS_LANGUAGE.md
  - docs/lifecycle/issue-to-main.md
  - .harness/README.md
---

# Domain context map

## Table of Contents

- [Purpose](#purpose)
- [Core domain](#core-domain)
- [Bounded contexts](#bounded-contexts)
- [Context relationships](#context-relationships)
- [Agent loading rule](#agent-loading-rule)

## Purpose

This document names the bounded contexts inside the synAIpse issue-to-main
lifecycle. Use it to keep domain language, source-of-truth artifacts, and claim
authority separated before changing docs, gates, skills, or lifecycle behavior.

## Core domain

synAIpse is the AI Delivery Harness for evidence-backed agentic software
delivery: moving a Linear issue to main through explicit scopes, validation,
review, external-state checks, merge readiness, and post-merge learning without
collapsing those truth lanes into one status.

## Bounded contexts

| Context | Owns | Source of truth | Must not claim |
| --- | --- | --- | --- |
| Intake | Issue key, scope, acceptance intent | Linear issue or admitted work artifact | Implementation is complete |
| Specification | Requirements, acceptance criteria, exclusions | Active spec or approved issue text | Validation has passed |
| Planning | Work slices, risk, rollback, validation plan | Active plan or PR work ledger | Scope is implemented |
| Implementation | Source changes and local behavior | Git worktree and changed files | PR, CI, or review state |
| Local validation | Local command evidence | Exact command outcomes | Remote checks are green |
| Review state | Human, Codex, and CodeRabbit findings | Review artifacts and PR threads | CI or tracker state |
| External state | PR, CI, check, and tracker snapshots | Fresh GitHub, CI, CodeRabbit, Semgrep, Linear evidence | Local behavior correctness |
| Artifact evidence | Receipts, runtime cards, evals, screenshots, reports | Tracked or generated artifacts with source refs | Merge readiness unless a contract allows it |
| Merge readiness | Branch protection and policy composition | Current PR head, checks, reviews, tracker and policy evidence | Post-merge main sync |
| Main sync | Checkout, pull, branch/worktree cleanup | Local git state after merge | Original issue acceptance unless tracker evidence agrees |
| Learning loop | Durable feedback absorption | AGENTS, guardrails, validators, skills, Project Brain, glossary, or tracked exception | One-off implementation behavior |

## Context relationships

- Intake feeds Specification; it does not replace it when scope is ambiguous.
- Specification feeds Planning; it does not prescribe implementation order.
- Planning feeds Implementation; it does not prove the work exists.
- Implementation feeds Local validation; it does not prove remote state.
- Local validation, Review state, External state, Artifact evidence, and
  Tracker evidence feed Merge readiness independently.
- Merge readiness feeds Main sync; a merge still needs checkout and pull proof.
- The Learning loop can receive feedback from any context and must write back to
  the smallest durable surface that prevents repeat work.

## Agent loading rule

Agents should load this context map only when work changes lifecycle language,
truth-lane claim authority, guardrails, runbooks, documentation taxonomy, or
domain terminology. For routine implementation, route through
[issue-to-main lifecycle](../lifecycle/issue-to-main.md) and the single
task-specific SOP.
