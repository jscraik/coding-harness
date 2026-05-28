# PU-026 GAP-012 Runtime-Card Trace-Out Testing Lens

## Scope

- Commit reviewed: `e9ff29e4181933446af4549c1fc427957fd47af9`
- Lifecycle unit: `PU-026-gap-012-runtime-card-trace-out`
- Lens: `testing`
- Status: `pass`

## Selected Proof

The smallest exact behavior proof is the runtime-card command test file because the behavior change is an optional CLI flag that must exercise the production command path, argument parsing, trace writer, and generated artifacts.

## Evidence

- [src/commands/runtime-card.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/runtime-card.test.ts:1) is the focused regression surface for runtime-card CLI behavior.
- [src/commands/runtime-card.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/runtime-card.test.ts:1) includes tests for trace-out success, manifest writing, artifact refs, advisory-mode events, failure traces, invalid absolute/traversal paths, invalid run IDs, and non-canonical trace locations.
- [src/lib/runtime-trace/runtime-card-trace.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime-trace/runtime-card-trace.ts:213) writes through the canonical run-record append path, so the behavior check covers the shared schema/hash-chain writer rather than a bespoke JSONL append.

## Commands Reviewed

- `pnpm vitest run src/commands/runtime-card.test.ts` -> pass (rerun after reviewer-driven guardrail patch, 26 tests)
- `pnpm run docs:style:changed` -> pass
- `pnpm run quality:docstrings` -> pass
- `pnpm run quality:size` -> pass after the trace module was trimmed below the new-file size warning threshold
- pre-commit hook -> pass for commit `e9ff29e4`

## Coverage Gaps

- This does not prove remote CI, PR review state, Linear state, or merge readiness.
- This does not prove future delivery-truth consumption; PU-026 intentionally stops at trace production.

## Validation Ownership

No current-patch gate failure remains for the focused local validation surface. The focused suite now covers success and failure traces, advisory policy context, serial run-id reuse, pre-claimed run-id rejection, and invalid trace-out paths. Remote and tracker validation are separate blocked/unobserved horizons.
