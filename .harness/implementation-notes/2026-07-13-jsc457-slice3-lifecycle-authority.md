---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: jsc457-slice3-lifecycle-authority
artifact_type: implementation-note
canonical_slug: jsc457-slice3-lifecycle-authority
title: JSC-457 Slice 3 Lifecycle And Authority
harness_stage: implementation-notes
status: active
date: 2026-07-13
origin: JSC-457 phase-admitted Slice 3 implementation
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: src/lib/synaipse
owner: coding-harness-maintainers
created: 2026-07-13
last_reviewed: 2026-07-13
review_cadence: event-driven
validated_by:
  - pnpm check
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
  - JSC-457
---

# JSC-457 Slice 3 lifecycle and authority

## Scope

This note records the bounded implementation for the `JSC-457` admission. The
slice adds the two versioned contract boundaries named by the issue:

- `synaipse-transition/v1` validates current-SHA binding, stage transitions,
  standing authority, Vital Decision interruption, waivers, and recovery.
- `synaipse-improvement-case/v1` records the observation classification,
  sibling inventory, candidate mechanisms, canary, measurement, disposition,
  owner, and retirement condition.

The implementation is intentionally isolated to the two contract schemas and
their focused tests. It does not reopen Slice 2, change the admission
guardrail worktree, mutate Linear or GitHub, or claim merge readiness.

## Feedback ratchet

Repeated stopping on stale or unauthorised lifecycle work indicated that stage
and authority decisions were being carried as prose rather than as a
schema-bound receipt. The durable correction is a small validator plus a
deterministic decision function. Invalid structure, stale evidence, illegal
stage movement, missing standing authority, Vital Decisions, and expired
waivers now produce explicit blockers and recovery actions. The improvement
case preserves the feedback-loop decision, including `delete` and `block`, so
the loop cannot silently collapse to retain/change-only advice.

The adversarial review also exposed two authority gaps. Recovery from a Vital
Decision now requires an observed `operator-decision:` receipt and operator
ownership; the shared date-time primitive now requires the seconds component
that the JSON Schema date-time format expects. Both rules are covered by
focused negative and positive tests.

The final review also required schema/runtime parity for that Vital Decision
recovery rule; the transition schema now carries the same conditional
operator-owner and operator-decision receipt requirement as the runtime
validator.

## Evidence boundary

Focused tests pass for both contracts, and the canonical aggregate gate passes
when the isolated worktree's mise configuration is supplied through
`MISE_TRUSTED_CONFIG_PATHS` (mise still reports a non-fatal tracking warning
because the sandbox cannot create its state symlink). The patch remains
unstaged and this note records validation evidence only; it does not claim
review convergence, merge readiness, or overall SynAIpse completion.
