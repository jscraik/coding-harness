# PU-012 Current-Main Producer Proof Intent

## Table of Contents

- [Intent Status](#intent-status)
- [Purpose](#purpose)
- [Plan And Spec Trace](#plan-and-spec-trace)
- [Current-Main Reconciliation](#current-main-reconciliation)
- [Bridge Boundary Decision](#bridge-boundary-decision)
- [Implementation Scope](#implementation-scope)
- [Out Of Scope](#out-of-scope)
- [Acceptance Checks](#acceptance-checks)
- [Validation Plan](#validation-plan)
- [Review And Slice Completion Gate](#review-and-slice-completion-gate)
- [Rollback](#rollback)
- [Non-Claims](#non-claims)

## Intent Status

Status: `draft_requires_review_before_source_edits`

This artifact is the required PU-012 intent and reconciliation gate. It does not
authorize runtime source edits until the intent is reviewed and the review
result is recorded in the goal receipts.

## Purpose

PU-012 must prove the current-main producer bridge for
`codex-runtime-evidence/v1` without scraping final assistant prose, relying on
stale summaries, or inferring unavailable Codex facts from adjacent fields.

The immediate task is reconciliation first: determine whether current `main`
already contains sufficient producer bridge behavior and tests, then make only
the focused repair needed to satisfy the plan and spec.

## Plan And Spec Trace

Plan unit: PU-012 Codex Runtime Evidence Producer Bridge in
`.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md`.

Spec traces:

- SA-009: approved Codex producer bridge.
- `codex-runtime-evidence/v1` must preserve source provenance and unknown
  classifications instead of flattening unavailable runtime facts.
- The spec explicitly does not prove that Codex currently emits
  `codex-runtime-evidence/v1`; the Harness implementation must keep that
  distinction visible.

## Current-Main Reconciliation

Current `main` evidence already present in this checkout:

- `src/lib/runtime/codex-runtime-evidence-producer.ts` exposes a
  Harness-owned producer boundary:
  `buildCodexRuntimeEvidenceFromProducerInput`.
- The producer accepts explicit wrapper/import facts for thread, turn, client
  user-message, trace, goal, model, permissions, environment, MCP servers,
  receipts, validation results, external state, review state, and stale-state
  classifications.
- The producer validates pinned and observed Codex source snapshots before
  packet admission through `validateCodexRuntimeSourceSnapshot`.
- Missing runtime facts are downgraded to explicit unknown blocker classes such
  as `producer_input_missing_trace_context`,
  `producer_input_missing_permission_profile`,
  `producer_input_missing_environment_scope`,
  `producer_input_missing_external_state`, and
  `producer_input_missing_review_state`.
- Write-capable permission profiles are downgraded to `unknown` when writable
  roots are unavailable.
- `src/lib/runtime/codex-runtime-evidence-producer.test.ts` covers explicit
  wrapper facts, unknown defaults, runtime-evidence-bundle adapter
  compatibility, invalid packet rejection, stale source evidence rejection, and
  write-capable permission downgrades.
- Historical goal state records PU-012 evidence in R038 through R042, but those
  receipts are not enough for a current-main done claim unless current-head
  validation still passes and any drift is reconciled.
- Unit fixtures alone are not enough for a current-main proof. The PU-012 proof
  must also record live checkout evidence for the selected wrapper boundary:
  current `HEAD`, current `origin/main`, and the blob hashes for the runtime
  producer, source-provenance validator, and runtime adapter files used by the
  proof.

Open reconciliation risk:

- The current producer tests prove a Harness-owned wrapper boundary, not live
  Codex Desktop extraction.
- The current producer validates the supplied `sourceSnapshot` before packet
  admission. It does not independently cross-bind the caller-provided
  `sourceProvenance` payload to that snapshot, so this slice must not claim
  checksum-backed provenance binding unless a focused repair adds that behavior.
- The plan allows this bridge boundary, but the final goal still needs later
  runtime-card projection, delivery-truth consumption, Linear currentness, and
  Judge/PM audit proof.

## Bridge Boundary Decision

Selected boundary for this slice:

`Harness-owned wrapper/import producer under src/lib/runtime/**`

Rationale:

- It is explicitly allowed by PU-012.
- It avoids mutating `/Users/jamiecraik/dev/codex`.
- It keeps Coding Harness responsible for packet admission and validation.
- It can represent unavailable Codex facts as unknown blocker classes rather
  than synthesizing them from final prose, stale summaries, PR state, CI state,
  review state, or Linear state.

Rejected boundaries for this slice:

- TypeScript SDK producer: rejected for this slice because no current approved
  Codex-side mutation or SDK emission contract is present.
- Python SDK producer: rejected for this slice for the same reason.
- App-server protocol producer: rejected for this slice unless a separate
  Codex-side ADR/spec approves mutation and validation.
- Analytics export: rejected for this slice because analytics-derived facts
  must not become permission, PR, review, CI, or Linear truth without explicit
  receipts.

## Implementation Scope

The slice may:

- Run current-head validation for `src/lib/runtime/codex-runtime-evidence-*.ts`
  and the runtime adapter tests.
- Repair only focused current-main drift in `src/lib/runtime/**` if validation
  or review proves the producer bridge no longer satisfies PU-012.
- Add or refine focused tests if a current-main proof gap is found.
- Update goal receipts, state, and board entries with the exact proof and
  non-claims.

## Out Of Scope

This slice must not:

- Mutate `/Users/jamiecraik/dev/codex`.
- Infer permission, PR, CI, review, Linear, or external-state truth from SDK
  events that do not contain those facts.
- Persist prompts, secrets, credentials, bulky transcripts, or final assistant
  prose as runtime truth.
- Claim runtime-card cockpit projection, delivery-truth consumption,
  Judge/PM readiness, Linear field-text currency, or parent goal completion.
- Start a stacked implementation PR unless Jamie records a named exception.

## Acceptance Checks

PU-012 can be treated as current-main reconciled only when evidence proves:

- The selected Harness wrapper/import producer can build and admit a valid
  `codex-runtime-evidence/v1` packet from explicit observable facts.
- Current-main proof combines fixture tests with live checkout evidence for the
  selected wrapper boundary files, so a green fixture path cannot hide drift in
  the actual files being claimed.
- Source-snapshot admission is validated through commit SHA or checksum-backed
  fallback before packet admission. Caller-provided `sourceProvenance` is
  preserved as packet provenance but is not independently claim-supporting
  unless a focused repair explicitly cross-binds it to the validated snapshot.
- Missing Codex runtime facts remain explicit unknown/blocker classifications.
- Write-capable permission claims without writable-root evidence are downgraded.
- The packet can still feed `runtime-evidence-bundle/v1` through the existing
  adapter without flattening Codex provenance.
- Final assistant prose, stale summaries, raw prompts, secrets, credentials, and
  bulky transcripts are not accepted as runtime truth.

## Validation Plan

Required before a PU-012 done claim:

- Command: `pnpm vitest run src/lib/runtime/codex-runtime-evidence.test.ts src/lib/runtime/runtime-evidence-adapter.test.ts`
- Command: `pnpm vitest run src/lib/runtime/codex-runtime-evidence-producer.test.ts src/lib/runtime/codex-runtime-source-provenance.test.ts`
- Command: `git rev-parse HEAD origin/main`
- Command: `git hash-object src/lib/runtime/codex-runtime-evidence-producer.ts src/lib/runtime/codex-runtime-source-provenance.ts src/lib/runtime/runtime-evidence-adapter.ts`
- Command: `pnpm typecheck`
- Command: `git diff --check`
- Command: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .`
- Command: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit`

Conditional validation:

- Codex-side validation is not applicable unless a separately approved
  Codex-side ADR/spec authorizes mutation.
- Broader `pnpm check` is required before PR handoff if any source behavior is
  changed.

## Review And Slice Completion Gate

Before source edits:

- This intent must be reviewed.
- Any reviewer finding must be fixed or explicitly recorded as blocked with
  evidence before implementation.

Before a done claim:

- Run the required slice lenses: simplify, improve-codebase-architecture,
  sy-review, and testing.
- Record independent reviewer outcomes from adversarial, agent-native, and
  best-practices review.
- Commit the slice, open exactly one PR, run pr-green-sweep until review
  comments, CI failures, merge conflicts, and PR body faults are fixed, then
  merge to `main`, pull `main`, and refresh the goal board, state, and
  receipts.

## Rollback

If a focused repair is required and later proves unsafe, disable the producer
bridge path while preserving `codex-runtime-evidence/v1` schema and adapter
validation.

If no source repair is required, rollback is removal of this intent and its
route receipts before PR merge.

## Non-Claims

This intent does not claim:

- PU-012 is complete.
- Live Codex Desktop emits `codex-runtime-evidence/v1`.
- External Snyk passed.
- Linear field text is current.
- Runtime-card cockpit projection is complete.
- Delivery-truth consumption is complete.
- Judge/PM readiness is achieved.
- JSC-363 parent goal completion is achieved.
