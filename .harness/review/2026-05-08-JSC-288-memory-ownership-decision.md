---
schema_version: 1
artifact_id: jsc-288-memory-ownership-decision
artifact_type: he-code-review-decision
canonical_slug: jsc-288-memory-ownership-decision
title: JSC-288 Memory Ownership Decision
harness_stage: he-code-review
status: accepted
date: 2026-05-08
traceability_required: true
origin: .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
linear_issue: JSC-288
linear_milestone: Governance Trust Repair Slice
linear_status: Triage
implementation_unit: IU-288-002
---

# JSC-288 Memory Ownership Decision

## Table Of Contents

- [Decision](#decision)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Scope](#scope)
- [Memory Ownership Table](#memory-ownership-table)
- [Replacement Trust Path](#replacement-trust-path)
- [Freshness And Provenance Rule](#freshness-and-provenance-rule)
- [PR Template Consequence](#pr-template-consequence)
- [Validation Notes](#validation-notes)
- [Evidence](#evidence)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)

## Decision

Accepted recommendation:

Replace the PR-template `memory.json` proof with Project Brain,
`.harness/memory/LEARNINGS.md`, and north-star learning-loop evidence that proves
current operational memory rather than bootstrap placeholder shape.

`memory.json` must not remain required PR evidence unless a future decision gives
it provenance, freshness, ownership, and placeholder rejection.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-288` |
| Linear project | `coding-harness` |
| Linear milestone | `Governance Trust Repair Slice` |
| Plan unit | `IU-288-002` |
| Scope | Decide memory ownership and replacement trust path only. |
| Out of scope | PR-template edits, validator edits, contract edits, runtime behavior changes, and packaged skill edits. |
| Human review | Accepted recommendation: replace PR-template `memory.json` proof with Project Brain, `.harness/memory/LEARNINGS.md`, and learning-loop evidence. |

## Scope

This artifact completes the decision/design part of `IU-288-002`.

It records memory ownership and the replacement trust path. It does not edit
`.github/PULL_REQUEST_TEMPLATE.md`, `memory.json`, validators, source code,
contract schema, governed docs, or packaged skill content.

## Memory Ownership Table

| Surface | Classification | Owner | Required status | Freshness signal | Disposition |
| --- | --- | --- | --- | --- | --- |
| `memory.json` | `fixture_or_sample` until proven otherwise | none accepted | Remove from required PR evidence | Placeholder values such as `replace-with-repo-name`, `bootstrap/init`, and `2026-01-01` prove it is not current operational memory | Demote from required trust path in `IU-288-004`; keep unchanged unless a later owner adopts it with validation. |
| `.harness/memory/LEARNINGS.md` | `canonical_human_guidance` | memory-governance | Required repo-local memory surface | Append-only frontmatter, current tracked entry, and AGENTS session/closeout contract | Keep as durable repo-specific learned-fixes memory. |
| `.harness/knowledge/**` | mixed `canonical_human_guidance` and Project Brain state | Project Brain/governance | Required when Project Brain extension is enabled | `.harness/knowledge/INDEX.md`, domain rule IDs, owner/freshness metadata where present | Keep as Project Brain operational memory; do not treat path existence alone as proof of quality. |
| `.harness/review-log.md` | `canonical_human_guidance` | governance/review | Required Project Brain review evidence | dated review entries | Keep as review ledger evidence; add staleness enforcement only if a later gate is introduced. |
| `.harness/learnings/coderabbit.local.json` | imported operational evidence when present | learning-loop owner | Conditional required evidence for PRs with matched changed files | generated/imported learning artifact consumed by `harness learnings gate`, `harness review-context`, and `harness north-star-feedback` | Use as current learning-loop proof when present; mark `n.a.` with reason when absent. |

## Replacement Trust Path

Required PR memory evidence should prove the current learning loop, not the
existence of bootstrap-shaped JSON.

The replacement path for `IU-288-004` is:

1. Require `.harness/memory/LEARNINGS.md` as the durable repo-specific memory
   surface.
2. Require Project Brain evidence when Project Brain is relevant to the changed
   files or governance surface.
3. Require north-star learning-loop evidence for changed files that can be
   matched against imported CodeRabbit learning evidence:
   `harness learnings gate`, `harness review-context`, and
   `harness north-star-feedback`.
4. Allow explicit `n.a.` only when the imported learning artifact is absent or
   the change is outside learning-loop scope, with the reason recorded in PR
   evidence.

## Freshness And Provenance Rule

Retained required memory evidence must answer four questions:

- What surface is the source of truth?
- Who owns it?
- What proves it is current enough for this change?
- What command, review artifact, or explicit `n.a.` reason proves the surface
  was considered during closeout?

Shape-only JSON checks do not satisfy this rule.

## PR Template Consequence

`IU-288-004` should replace the PR-template `memory.json` command with evidence
that references:

- tracked `.harness/memory/LEARNINGS.md` presence or explicit repo-memory
  exception;
- Project Brain relevance when governance or memory surfaces are touched;
- the existing north-star learning-loop command trio or explicit `n.a.` reason.

The exact PR-template wording is not changed in this unit.

## Validation Notes

This unit is decision-only. Required validation is limited to artifact checks
and no-behavior-change proof.

Implementation validation for `IU-288-004` must prove placeholder `memory.json`
can no longer satisfy required PR evidence.

## Evidence

Facts:

- `.github/PULL_REQUEST_TEMPLATE.md` currently requires a `memory.json` shape
  check in required local gates and testing evidence.
- `memory.json` contains bootstrap placeholder content rather than current
  operational memory.
- `.harness/memory/LEARNINGS.md` exists, is tracked, and declares itself as the
  repo-specific append-only agent knowledge base.
- `AGENTS.md` requires `.harness/memory/LEARNINGS.md`, Project Brain, and
  north-star learning-loop closeout when changed files match imported
  CodeRabbit learning evidence.
- `docs/agents/04-validation.md` defines the learning-loop commands and allows
  explicit `n.a.` when no local learning artifact exists.
- `ADR-007` rejects placeholder memory as harmless scaffold when memory surfaces
  carry operational authority.

Interpretation:

- Current PR memory proof is symbolic and can create false trust.
- The safer required evidence is the active memory and learning-loop system
  already named by repo governance.

Assumption:

- `memory.json` may remain as fixture or historical scaffold unless a future
  owner gives it executable freshness and provenance validation.

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Status | Evidence |
| --- | --- | --- | --- |
| `JSC-288` | `SA-288-002` | Accepted | Memory surfaces are classified with owner, required status, freshness signal, and disposition. |
| `JSC-288` | `SA-288-003` | Decision accepted, implementation pending | Placeholder `memory.json` will be removed from required PR evidence in `IU-288-004`. |
| `JSC-288` | `SA-288-010` | Partially accepted | Required memory surfaces remain canonical human guidance or conditional executable learning-loop evidence. |
