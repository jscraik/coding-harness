# PU-047 CNF-001 Message Correlation Intent

## Table of Contents

- [Intent Contract](#intent-contract)
- [Purpose](#purpose)
- [Scope](#scope)
- [Target Modules](#target-modules)
- [Design Intent](#design-intent)
- [Acceptance Criteria](#acceptance-criteria)
- [Validation Plan](#validation-plan)
- [Review Requirement](#review-requirement)
- [Stop Conditions](#stop-conditions)

## Intent Contract

```yaml
intentId: PU-047-CNF-001

objective: Add source-backed user-message correlation to the existing Codex
runtime evidence and steering-queue contracts without claiming delivery truth,
merge readiness, or goal completion.

ownedAcceptanceIds:

- CNF-001

acceptedFollowUpAcceptanceIds:

- CNF-001 delivery-truth and closeout traceability consumption remains an
  accepted follow-up for this slice unless implementation discovers a narrow,
  non-authorizing pass-through that can be validated without widening scope.

claimClasses:

- runtime_orientation
- steering_queue_audit_trail

excludedClaimClasses:

- delivery_truth
- review_state
- external_state
- root_hygiene
- merge_readiness
- judge_pm_readiness
- goal_completion

deepModuleBoundary:

- Runtime evidence owns source-message identity as codex.clientUserMessageId.
- Steering queue owns expected and applied message correlation as
  items[].expectedClientUserMessageId and items[].appliedClientUserMessageId.
- Steering queue builder owns runtime-context stale derivation for
  stale_client_user_message.
- Runtime-card projection may carry advisory message-correlation context only
  when it does not support delivery-truth or merge-readiness claims.

automationPlan:

- Prove source capability before contract edits by identifying a current local
  producer input, normalized session evidence field, fixture source, or explicit
  blocker for clientUserMessageId.
- Add focused missing, stale, and mismatch tests with stable validator codes and
  paths.
- Run focused steering-queue/runtime tests, runtime packet schema validation,
  goal-board validation, and audit-freshness validation.

reviewStatus: reviewed_for_implementation

reviewedBy:

- artifacts/reviews/pu047-planning-intent-review.md
- artifacts/reviews/pu047-agent-native-intent-review.md
- artifacts/reviews/pu047-adversarial-intent-review.md
- artifacts/reviews/pu047-planning-intent-delta-review.md
- artifacts/reviews/pu047-agent-native-intent-delta-review.md
- artifacts/reviews/pu047-adversarial-intent-delta-review.md

```

## Purpose

Resume the Codex Runtime Evidence Verifier Cockpit goal with a bounded
implementation slice for CNF-001: Codex user-message correlation.

This slice makes message correlation a first-class contract field in the
existing runtime evidence and steering-queue deep modules so future closeout
evidence can distinguish the Codex turn from the user message that caused or
applied a steering item.

## Scope

In scope:

- Add a source-capability proof before contract edits. If current local Codex
  evidence cannot expose clientUserMessageId, record an owner-visible blocker
  and stop instead of inventing a synthetic field value.
- Add client user-message and applied user-message correlation fields where
  they belong in existing runtime evidence and steering-queue contracts.
- Update semantic validators so missing, stale, or mismatched message
  correlation is rejected when a steering item claims to be applied.
- Update examples, schemas, and runtime packet schema manifest coverage.
- Add focused tests for accepted correlation, missing applied-message evidence,
  and mismatch or stale conditions.
- Update goal and board evidence after validation.

Out of scope:

- CNF-002 environment-scoped permission evidence.
- CNF-003 risk-tiered mutation authority.
- CNF-004 runtime-card continuity projection beyond the minimum field
  pass-through needed to avoid contract drift.
- CNF-005 prompt/context authority classification.
- CNF-006 steering application receipts beyond the message-correlation fields.
- Linear field rewrites. Current tracker alignment remains attachment-backed.
- Goal completion, Judge/PM readiness, or production verifier wiring claims.

## Target Modules

- src/lib/runtime/codex-runtime-evidence-types.ts
- src/lib/runtime/codex-runtime-evidence-validation.ts
- src/lib/runtime/codex-runtime-evidence-producer.ts
- src/lib/runtime/codex-runtime-evidence-adapter.ts
- src/lib/runtime/runtime-card-codex-runtime.ts
- src/lib/steering-queue/types.ts
- src/lib/steering-queue/builder.ts
- src/lib/steering-queue/constants.ts
- src/lib/steering-queue/validation-item.ts
- src/lib/steering-queue/validation.ts
- src/lib/delivery-truth for classification only; no delivery-truth
  claim-support behavior is owned by this slice unless a separately reviewed
  narrow pass-through is required to avoid contract drift.
- contracts/steering-queue.schema.json
- contracts/examples/steering-queue.example.json
- contracts/runtime-packet-schemas.manifest.json
- Existing focused tests under src/lib/runtime and src/lib/steering-queue

## Design Intent

Use the existing deep-module seams instead of introducing a new command or
sidecar:

- Runtime evidence owns Codex turn and source-message identity.
- Steering queue owns expected and applied steering-message identity.
- \`codex.clientUserMessageId\` is the runtime evidence field.
- \`items[].expectedClientUserMessageId\` is the steering queue expected field.
- \`items[].appliedClientUserMessageId\` is the steering queue applied field.
- \`stale_client_user_message\` is the stale precondition kind when the expected
  steering message does not match the current runtime message.
- Runtime-card projection may surface the correlation only as advisory context;
  it must not convert message correlation into delivery-truth or merge-readiness
  proof.
- Validators must preserve the existing pointer/hash/redaction posture and must
  not require raw message text.

## Acceptance Criteria

- Source capability is classified before contract edits as one of \`available\`,
  \`blocked_unavailable\`, or \`accepted_follow_up\`, with evidence in the receipt
  trail.
- Runtime evidence can carry a non-empty \`clientUserMessageId\` when available.
- A steering queue item can declare the expected client user-message id.
- An applied steering item must include the applied client user-message id.
- If an applied steering item has an expected client user-message id, the
  applied id must match.
- If evaluation input has a current client user-message id and the steering item
  expects a different id, the builder must add a \`stale_client_user_message\`
  precondition.
- Missing or mismatched applied-message correlation creates a semantic validation
  error with a stable code and path.
- Stale message correlation creates a stable semantic validation error or stale
  precondition with a stable code and path.
- Examples and schemas include the new fields.
- Focused tests prove pass, missing, stale, and mismatch cases.
- Goal board and local board tracker remain valid after receipt update.

## Validation Plan

Run focused validation first:

- Source-capability proof by direct inspection of the producer/adapter/fixture
  source used for \`clientUserMessageId\`, or an owner-visible blocker artifact.
- pnpm test src/lib/steering-queue/steering-queue.test.ts
- pnpm test src/lib/runtime/codex-runtime-evidence.test.ts src/lib/runtime/runtime-card-codex-runtime-projection.test.ts
- node scripts/validate-runtime-packet-schemas.cjs
- PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit
- PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .

Goal and board evidence update targets:

- docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml
- docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl
- docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md when scope or
  completion wording changes
- .harness/implementation-notes/goal-kanban-board.html

Widen if production source changed beyond those modules:

- pnpm run test:related
- pnpm typecheck
- bash scripts/validate-codestyle.sh --fast

## Review Requirement

Before implementation, review this intent with:

- planning-specialist-agent
- agent-native-reviewer
- adversarial-reviewer

Before marking the slice done, review the implementation with:

- required skill lenses: improve-codebase-architecture, simplify, \`unslopify\`,
  he-code-review, testing
- independent reviewers: adversarial-reviewer, agent-native-reviewer,
  best-practices-researcher

## Stop Conditions

Stop rather than widening scope if:

- Codex runtime evidence cannot expose a client user-message id from current
  local evidence.
- Existing steering-queue schema semantics make message correlation a breaking
  contract change.
- Validation requires credentials or external writes.
- The slice starts needing permission scope, mutation authority, or producer
  emission work that belongs to later CNF items.
