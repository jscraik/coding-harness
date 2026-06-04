# PU-052 / CNF-006 Steering Application Receipt Intent

## Intent

Implement the narrow CNF-006 contract slice for steering queue application receipts.

The slice must add a pointer-only receipt that records whether a selected steering queue item was applied, rejected, or blocked against the current Codex runtime identity. The receipt must bind:

- the source steering-queue/v1 packet and selected queue item
- expected versus current thread, turn, client user-message, and head identity
- the runtime-card update reference required for an applied steering item
- stale-precondition results for expired, superseded, mismatched, or blocked application attempts

## Why This Exists

SteeringQueueItem already records application and rejection timestamps, but that state is embedded in the queue packet. It does not independently prove that a particular runtime turn attempted to apply the item, nor does it bind the application decision to a runtime-card update. CNF-006 closes that evidence gap without claiming a live producer exists yet.

## Scope

Allowed implementation scope:

- src/lib/steering-queue/**
- contracts/steering-application-receipt.schema.json
- contracts/examples/steering-application-receipt.example.json
- contracts/runtime-packet-schemas.manifest.json
- scripts/validate-steering-application-receipt.cjs
- src/dev/validate-runtime-packet-schemas-script.test.ts
- architecture and governance documentation required by docs-gate
- goal route-truth files and review artifacts for this slice

## Non-Goals

- Do not wire a live runtime producer.
- Do not mutate runtime cards.
- Do not authorize commands, continuation, merge, release, Linear mutation, or destructive action.
- Do not treat the receipt as delivery-truth, review-state, external-state, root-hygiene, Judge/PM, or merge-readiness proof.
- Do not store raw prompts, raw steering text, transcripts, command output, secrets, tokens, credentials, or bulky telemetry.
- Do not weaken existing steering-queue/v1 validation semantics.

## Proposed Contract

Add steering-application-receipt/v1 with:

- `runtimeStatus`: `not_yet_emitted`
- `evidenceUse`: `orientation`, `audit_trail`, or `governance`
- `queuePacketRef`, `queueItemId`, and `queueItemState`
- `expectedContext` and `currentContext` identities
- application decision fields
- `runtimeCardUpdateRef` required only for applied receipts
- `stalePreconditions` carrying existing steering stale-kind semantics
- `blockers`, `nextAction`, and `blockedBy`

## Architecture Boundary

The deep module boundary remains src/lib/steering-queue/. The application receipt is an additive companion contract to steering-queue/v1, not a replacement for queue evaluation. It may share safe-pointer, timestamp, head-SHA, artifact identity, and stale-precondition validation helpers where that reduces duplication without creating a cross-module dependency.

## Validation Plan

Focused validation:

- MISE_TRUSTED_CONFIG_PATHS=.mise.toml pnpm exec vitest run src/lib/steering-queue/steering-queue.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts
- MISE_TRUSTED_CONFIG_PATHS=.mise.toml pnpm typecheck
- node scripts/validate-steering-application-receipt.cjs contracts/examples/steering-application-receipt.example.json
- node scripts/validate-runtime-packet-schemas.cjs --all
- git diff --check

Required negative fixtures:

- expected/current turn or message mismatch cannot be applied
- expired steering cannot be applied
- superseded steering cannot be applied
- applied receipt without runtime-card update ref is rejected
- applied receipt with runtime-card update head mismatch is rejected

Widen validation after implementation according to touched surface:

- docs-gate if architecture or governance docs change
- diagram freshness if architecture context requires refresh
- bash scripts/validate-codestyle.sh --fast
- PR-template gate before opening the stacked PR

## Review Requirements

Before marking this slice done:

- intent must be reviewed before implementation or a runtime blocker artifact must explain why review artifact capture failed
- post-implementation adversarial, agent-native, and best-practices review artifacts must exist, or blocker artifacts must classify the runtime failure
- skill lenses must be recorded for improve-codebase-architecture, simplify, `unslopify`, HE code review, and testing

## Acceptance Criteria

- steering-application-receipt/v1 is represented by TypeScript types, JSON schema, checked-in example, semantic validator, and runtime packet manifest entry.
- The checked-in example passes schema validation and the semantic validator.
- Focused tests prove the positive receipt path and the required negative fixtures.
- Architecture/governance docs describe the new deep-module contract and non-claim boundary.
- Goal route truth records CNF-006 as local implementation, PR truth, or blocked state without collapsing it into parent-goal completion.

## Open Risks

- Live Codex producer extraction remains unproven and intentionally out of scope.
- Existing reviewer subagents may fail to persist required artifact files; if repeated, this must be recorded as runtime blocker evidence instead of being treated as review completion.
- The existing stacked PR chain may keep remote CI pending or unstable; PR state must be refreshed separately after push.
