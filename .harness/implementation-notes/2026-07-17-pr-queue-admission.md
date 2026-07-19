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

`scripts/pr-queue-admission.sh` now reads every open PR, required check results,
and paginated GraphQL review-thread state in one read-only snapshot. It emits
`pr-queue-admission/v1`, classifies the next action as failing, pending,
unavailable, review-blocked, merge-blocked, draft-authorization-blocked, or
ready, and supports `--require-ready` for a mutation boundary. An empty queue
is an admitted clean surface. A failed review-thread read is blocked rather
than treated as zero threads, and a clean draft remains blocked until ready
authorization. The optional `--require-review-artifact` flag adds a stricter
provider-evidence boundary: substantive CodeRabbit or Codex review output is
`observed`, a provider rate-limit response is `rate_limited`, action-only
signals are `action_only`, and absent provider output is `missing`. The default
solo-maintainer path remains permissive and reports those statuses without
blocking. The package command
`pnpm run pr:queue -- --json --require-ready` provides a repeatable pre-PR and
pre-merge gate without claiming acceptance, release, or merge authority.

## Validation and behavior change

The focused fixtures cover an empty queue, a blocked PR with failing checks,
unresolved review threads, requested changes, and a dirty merge state, plus a
clean draft, provider rate-limit and missing-artifact signals, substantive
provider evidence, required-review decisions, and valid check rows returned
with a non-zero `gh pr checks` status. The assertions require the failing-check,
review-artifact, required-review, and draft-authorization stops to win
deterministically while the default solo path remains permissive.

Command: `pnpm vitest run src/commands/pr-queue-admission-script.test.ts --reporter=dot` -> pass (8 tests).
Command: `op run --env-file ~/.codex/.env -- pnpm run pr:queue -- --json --require-ready` -> fail (current hosted queue is blocked by 7 unresolved review threads on PR #483; required checks were observed with zero failures and provider signals were `coderabbit=rate_limited`, `codex=action_only`).
Command: `pnpm test:deep` -> blocked (427 artifact test files and 6,322 tests passed before E2E environment validation stopped on `blocked_env_fifo_timeout`: `~/.codex/.env` is a FIFO/no-writer surface in this session; credentials were not read or printed).

The guard proves current queue classification and prevents a new mutation when
an open queue is blocked. Provider statuses are evidence classifications, not
green-check aliases: a passing review check alone does not satisfy the opt-in
requirement, and a rate-limit response remains visible as unavailable provider
evidence. The guard does not prove hosted checks, independent review,
acceptance, release, or merge readiness for a specific future PR; those remain
separate closeout lanes.

## 2026-07-18 provider-review follow-up

The current-head Codex review found two deterministic gaps in the optional
provider-artifact gate: comments and reviews were capped at their first 100
items, and a rate-limit notice could win over a later substantive review. The
queue validator now paginates the comments and reviews connections separately,
merges their pages before classification, and gives substantive evidence
precedence over rate-limit and action-only signals. The default solo-maintainer
path remains permissive; only the explicit artifact requirement uses this
stricter evidence lane.

Command: `pnpm vitest run src/commands/pr-queue-admission-script.test.ts --reporter=dot` -> pass (10 tests, including rate-limit precedence and multi-page provider fixtures).
