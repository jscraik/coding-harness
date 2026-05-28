# PU-030 SPG-004 Steering Queue - Improve Codebase Architecture Review

schema_version: 1
execution_mode: architecture_deepening_review
scope:
- src/lib/steering-queue/**
- contracts/steering-queue.schema.json
- contracts/examples/steering-queue.example.json
- scripts/validate-steering-queue.cjs
- contracts/runtime-packet-schemas.manifest.json
- architecture/governance documentation touched by the slice

## Verdict

Status: pass

The slice is placed in a real deep module, not a command facade or prose-only docs lane. The module gives callers a compact interface for building, evaluating, hashing, and validating deferred steering while hiding state precedence, stale-precondition derivation, artifact identity checks, and deterministic selection rules behind src/lib/steering-queue/. The post-review size ratchet improved the module shape by splitting the original oversized file into facade, builder, packet validation, item validation, validation helpers, hash, types, and constants modules.

## Findings

No material architecture findings.

## Evidence

- src/lib/steering-queue/index.ts exports a narrow public facade over the steering queue module.
- src/lib/steering-queue/steering-queue.ts remains a compatibility facade; builder.ts owns packet construction and evaluation, validation.ts owns packet-level invariants, validation-item.ts owns item-level invariants, validation-helpers.ts owns shared assertions, hash.ts owns canonical instruction hashing, and types.ts/constants.ts hold the shared contract surface.
- The validator now rejects cross-scope packets, cyclic supersession graphs, and stale/applicable flips caused by duplicate conflicting instruction sources.
- scripts/validate-steering-queue.cjs provides a script-backed validator for JSON artifacts without adding a public harness command.
- contracts/runtime-packet-schemas.manifest.json registers steering-queue/v1 as not_yet_emitted, preserving the current contract-only boundary.
- ARCHITECTURE.md, AGENTS.md, docs/agents/00-architecture-bootstrap.md, and docs/agents/07b-agent-governance.md now identify the deep module and explicitly block authority/claim-support drift.

## Validation

- pnpm vitest run src/lib/steering-queue/steering-queue.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts -> pass
- node scripts/validate-steering-queue.cjs contracts/examples/steering-queue.example.json -> pass
- node scripts/validate-runtime-packet-schemas.cjs --all -> pass
- pnpm typecheck -> pass
- pnpm architecture:check -> pass
- bash scripts/run-harness-gate.sh docs-gate --mode required --json -> pass

## Residual Risk

The packet is not yet consumed by runtime-card continuation logic. That is intentional for this slice and is recorded as runtimeStatus: not_yet_emitted; future wiring must add separate adapter tests before the queue can influence cockpit state.

WROTE: artifacts/reviews/pu-030-spg-004-steering-queue-improve-codebase-architecture.md
