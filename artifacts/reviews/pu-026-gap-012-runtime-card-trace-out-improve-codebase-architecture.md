# PU-026 GAP-012 Runtime-Card Trace-Out Architecture Lens

## Scope

- Commit reviewed: `e9ff29e4181933446af4549c1fc427957fd47af9`
- Lifecycle unit: `PU-026-gap-012-runtime-card-trace-out`
- Lens: `improve-codebase-architecture`
- Status: `pass`

## Findings

No material architecture blocker found for the committed slice.

## Evidence

- [ARCHITECTURE.md](/Users/jamiecraik/dev/coding-harness/ARCHITECTURE.md:89) now places runtime-evidence deep modules under `src/lib/**` and names `src/lib/runtime-trace/` as the trace-out owner.
- [src/lib/runtime-trace/runtime-card-trace.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime-trace/runtime-card-trace.ts:111) owns canonical `--trace-out` path parsing instead of keeping path policy inside the command facade.
- [src/lib/runtime-trace/runtime-card-trace.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime-trace/runtime-card-trace.ts:155) claims a fresh run directory before the first event append, so run-id ownership is enforced inside the trace deep module.
- [src/commands/runtime-card.ts](/Users/jamiecraik/dev/coding-harness/src/commands/runtime-card.ts:82) keeps the command layer as a thin adapter that creates the recorder and delegates event/manifest emission to the deep module.
- [src/lib/runtime-trace/runtime-card-trace.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime-trace/runtime-card-trace.ts:213) reuses the existing canonical run-record writer, preserving hash-chain and manifest continuity rather than inventing a parallel trace format.

## Assessment

The slice deepens the module shape in the right place: runtime-card trace recording is a reusable library module with a narrow CLI seam, while `harness runtime-card` remains the cockpit command. The change increases leverage for future trace producers because path validation, event projection, artifact refs, and terminal manifest emission are now behind one interface.

## Risks / Tradeoffs

- The public CLI surface gains `--trace-out`, so future closeout work must keep it advisory unless a later verifier explicitly binds the trace to delivery-truth claims.
- Fresh run-id ownership is intentionally strict; operators must choose a new run id rather than appending to an old stream.
- The module is intentionally scoped to runtime-card execution; broader Codex session traversal remains outside this slice.

## Validation Ownership

No gate failure observed in this lens. Validation evidence belongs to the receipt-level command list.
