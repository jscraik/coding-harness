---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: pr-queue-admission
artifact_type: implementation-note
canonical_slug: pr-queue-admission
title: PR Queue Admission and Closeout
harness_stage: implementation-notes
status: active
date: 2026-07-17
origin: repeated PR repair steering
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: scripts/pr-queue-admission.sh
owner: coding-harness-maintainers
created: 2026-07-17
last_reviewed: 2026-07-17
review_cadence: event-driven
validated_by:
  - pnpm vitest run src/commands/pr-queue-admission-script.test.ts # expected outcome: pass
  - pnpm run pr:queue -- --json --require-ready # expected outcome: pass when queue is empty or ready
depends_on:
  - pr-triage-snapshot/v1
---

# PR queue admission and closeout

## Feedback signal

Repeated steering was required to reconcile late PR template failures,
generated-artifact drift, unresolved review threads, stale check summaries, and
the distinction between local proof and hosted readiness. The current harness
had a single-PR snapshot but no queue-level admission step, so each new lane
could reach PR creation before the whole queue and the current review surface
were classified.

## Root failure and category

The root failure was a missing deterministic workflow boundary: feature-level
validation was strong, while queue-level state and hosted closeout were left to
operator memory. This is poor workflow design with weak observability, stale
state risk, and insufficient deterministic enforcement.

## Durable correction

`scripts/pr-queue-admission.sh` now reads every open PR, current check results,
and GraphQL review-thread resolution state in one read-only snapshot. It emits
`pr-queue-admission/v1`, classifies the next action as failing, pending,
unavailable, review-blocked, merge-blocked, draft-authorization-blocked, or
ready, and supports
`--require-ready` for a mutation boundary. An empty queue is an admitted clean
surface. A failed review-thread read is blocked rather than treated as zero
threads, and a clean draft remains blocked until ready authorization. The
package command `pnpm run pr:queue -- --json --require-ready`
provides a repeatable pre-PR and pre-merge gate without claiming acceptance,
release, or merge authority.

## Validation and behavior change

The focused fixture covers an empty queue, a blocked PR with failing checks,
unresolved review threads, requested changes, and a dirty merge state, plus a
clean draft; the assertions require the failing-check action and draft
authorization stop to win deterministically.

Command: `pnpm vitest run src/commands/pr-queue-admission-script.test.ts --reporter=dot` -> pass (3 tests).
Command: `op run --env-file ~/.codex/.env -- pnpm run pr:queue -- --json --require-ready` -> pass (initial empty queue; `overall=empty`).

The guard proves current queue classification and prevents a new mutation when
an open queue is blocked. It does not prove hosted checks, independent review,
acceptance, release, or merge readiness for a specific future PR; those remain
separate closeout lanes.
