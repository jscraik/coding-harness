---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: env-fifo-op-run-steering-admission
artifact_type: implementation-note
canonical_slug: env-fifo-op-run-steering-admission
title: Env FIFO Op Run Steering Admission
harness_stage: implementation-notes
status: active
date: 2026-06-20
origin: user steering about FIFO env recovery and repeated closeout blockers
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: scripts/check-steering-feedback-contract.cjs
owner: coding-harness-maintainers
created: 2026-06-20
last_reviewed: 2026-06-20
review_cadence: event-driven
validated_by:
  - pnpm run docs:steering:guard
depends_on:
  - docs/solutions/integration-issues/2026-05-19-env-backed-validation-admission.md
---

# Current-Session Steering Admission

## Feedback Signal

A repeated closeout failure showed that the agent treated `~/.codex/.env`
being a FIFO as credential-blocker evidence even though repository steering
already says FIFO is normal and the required recovery path is
`op run --env-file ~/.codex/.env -- <command>`.

## Root Operational Failure

The steering-feedback guard checked for the presence of env-backed validation
language, but it did not require the stronger invariant that FIFO closeout
blockers include an attempted `op run --env-file` rerun. That allowed a
summary-only blocker claim to pass through normal operator reasoning.

## Failure Category

- weak validation
- retrieval failure
- hidden assumptions
- lack of verification
- missing guardrails

## Searched Surfaces

- `AGENTS.md`
- `.harness/memory/LEARNINGS.md`
- `docs/agents/04-validation.md`
- `docs/agents/07b-agent-governance.md`
- `docs/solutions/integration-issues/2026-05-19-env-backed-validation-admission.md`
- `scripts/check-steering-feedback-contract.cjs`

## Durable System Improvement

Durable destination: validation rule plus solution record. The executable guard
in `scripts/check-steering-feedback-contract.cjs` now requires the env-backed
validation admission to preserve the FIFO-as-normal `op run --env-file` rule and
to state that FIFO blocker closeout requires attempted rerun evidence. The
solution record now names `op run --env-file ~/.codex/.env -- <command>` as the
canonical FIFO command shape.

## Executable Guard

`pnpm run docs:steering:guard` must fail if the env-backed validation admission
loses the invariant that FIFO metadata is not itself a blocker and that FIFO
credential closeout must include an `op run --env-file ~/.codex/.env --`
attempted rerun outcome.

## Forbidden Recurrence Behavior

Do not report a credentialed validation lane as blocked because
`~/.codex/.env` is a FIFO. FIFO is expected in this repository. A blocked claim
is valid only after the exact command has been attempted through
`op run --env-file ~/.codex/.env -- <command>` or after a repo-owned
FIFO-aware loader reports a concrete failure.

## Validation

Command: pnpm run docs:steering:guard -> pass (steering-feedback-contract: pass)

## Review Condition

This admission can be retired only when credentialed validation routes FIFO env surfaces through `op run --env-file ~/.codex/.env -- <command>` before any closeout blocker can be emitted.
