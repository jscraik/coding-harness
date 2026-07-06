---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: boundary-unknown-cross-language-steering-admission
artifact_type: implementation-note
canonical_slug: boundary-unknown-cross-language-steering-admission
title: Boundary Unknown Cross-Language Steering Admission
harness_stage: implementation-notes
status: active
date: 2026-07-06
origin: user steering about cross-language boundary guard enforcement
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: scripts/check-boundary-unknown-guards.mjs
owner: coding-harness-maintainers
created: 2026-07-06
last_reviewed: 2026-07-06
review_cadence: event-driven
validated_by:
  - pnpm run docs:steering:guard
  - node scripts/check-boundary-unknown-guards.mjs
depends_on:
  - docs/solutions/integration-issues/2026-05-17-steering-feedback-admission.md
---

# Current-Session Steering Admission

## Feedback Signal

Jamie corrected a narrow TypeScript-only implementation path after the source guidance already required a harness-level guardrail family. This is a current-session steering admission record: not permitted to proceed with ordinary implementation until the repeated behavior is admitted into repo evidence.

## Root Operational Failure

The root operational failure was retrieval and workflow ordering: repo memory already required steering admission before resuming, but that rule was applied only after Jamie restated it. The execution strategy also skipped a first-step language-surface inventory before choosing the validator backend.

## Failure Category

- retrieval failure
- poor workflow design
- missing decomposition
- hidden assumptions
- insufficient deterministic enforcement
- architecture drift

## Searched Surfaces

- AGENTS.md
- CODESTYLE.md
- codestyle/08-typescript.md
- src/templates/codestyle/08-typescript.md
- scripts/check-types-policy.mjs
- package.json docs:steering:guard
- scripts/check-steering-feedback-contract.cjs
- docs/solutions/integration-issues/2026-05-17-steering-feedback-admission.md
- .harness/memory/LEARNINGS.md
- current repo language inventory from git tracked extension counts

## Durable System Improvement

This correction is promoted to a durable implementation note, a memory update, and a cross-language boundary-no-late-unknown validator. The durable destination is a guard script plus codestyle documentation, so future agents get a deterministic failure instead of relying on conversational memory.

## Executable Guard

The steering admission guard is pnpm run docs:steering:guard. The feature guard must fail new generic late-boundary helpers with an agent-instructive message telling the agent to fix the upstream parser, schema, API adapter, DTO, config loader, CLI parser, storage decoder, migration importer, or test fixture boundary first.

## Forbidden Recurrence Behavior

Do not convert broad architectural feedback into a single-language canary until a language-surface inventory proves the scope is single-language. Do not resume ordinary implementation after Jamie says steering should have been automatic; first create or update the current-session steering admission record and run the focused guard.

## Validation

Command: pnpm run docs:steering:guard -> pass.

## Review Condition

Review this admission when boundary-no-late-unknown is promoted into a typed agent-architecture-lint contract with per-language adapters and generated downstream scaffolding.
