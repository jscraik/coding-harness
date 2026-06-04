# PU-050 / CNF-004 Runtime-Card Continuity Intent

## Intent

Add compact Codex continuity references to the existing runtime-card Codex
projection so future agents can orient around thread, turn, trace, goal,
client-message, queue, approval, and heartbeat/automation evidence without
embedding raw prompts, transcripts, event streams, secrets, or bulky runtime
payloads.

## Scope

- Deep module: `src/lib/runtime/`.
- Primary contracts:
  - `runtime-evidence-bundle/v1` as the producer-supplied input.
  - `runtime-card/v1` `codexRuntime` as the compact advisory output.
- Expected fields:
  - `threadRefs`
  - `turnRefs`
  - `traceRefs`
  - `goalRefs`
  - `clientMessageRefs`
  - `queueRefs`
  - `approvalRefs`
  - `heartbeatRefs`
- Each continuity ref must also appear in `codexRuntime.receiptRefs` and in the
  runtime-card `sources` list.

## Non-Goals

- Do not implement live Codex Desktop extraction.
- Do not synthesize message identity from timestamps, PR data, artifact paths,
  branch names, or model output.
- Do not create delivery-truth, review-state, external-state, root-hygiene,
  Judge/PM, merge-readiness, or goal-completion support.
- Do not make runtime-card output command authority.
- Do not duplicate the tool-exposure or environment-snapshot contracts.

## Architecture Boundary

`runtime-evidence-bundle/v1` owns producer-supplied continuity refs. The
runtime-card adapter may project those refs into `codexRuntime.continuity` only
after validation proves every ref is compact, non-empty, receipt-backed, and
source-backed. `runtime-card/v1` remains an advisory orientation artifact.

## Implementation Plan

1. Add a `RuntimeCardCodexRuntimeContinuityProjection` type in
   `src/lib/runtime/runtime-card-codex-runtime.ts`.
2. Add an optional `continuity` input to `RuntimeEvidenceBundle`.
3. Validate continuity arrays in `runtime-evidence-bundle/v1`.
4. Project continuity refs from the bundle into `codexRuntime.continuity`.
5. Validate runtime-card continuity refs against `codexRuntime.receiptRefs`.
6. Add positive and negative tests for:
   - all continuity fields projecting when backed by sources,
   - continuity refs missing from bundle sources,
   - continuity refs missing from runtime-card receipt refs,
   - unknown `codexRuntime.continuity` fields,
   - raw/bulky payload fields still rejected.

## Validation Gates

- `pnpm exec vitest run src/lib/runtime/runtime-card-codex-runtime-projection.test.ts`
  - Expected: exit code 0, all tests passing
  - On failure: review test output for failing assertions, fix implementation or tests, rerun until pass
  - Owner: Coordinator
- `pnpm exec vitest run src/lib/runtime/runtime-evidence-bundle.test.ts`
  - Expected: exit code 0, all tests passing
  - On failure: review test output for failing assertions, fix implementation or tests, rerun until pass
  - Owner: Coordinator
- `pnpm typecheck`
  - Expected: exit code 0, no type errors
  - On failure: resolve TypeScript compilation errors before proceeding
  - Owner: Coordinator
- `git diff --check`
  - Expected: exit code 0, no whitespace errors
  - On failure: fix trailing whitespace or line-ending issues, rerun until pass
  - Owner: Coordinator

Wider gates such as docs-gate, diagram freshness, and codestyle run before
slice handoff because this changes an architecture-adjacent runtime-card
contract.

## Review Requirements

- Use `improve-codebase-architecture` to keep the change inside the existing
  runtime deep module.
- Use `simplify`, `unslopify`, `he-code-review`, and `testing` as validation
  lenses before done.
- Request `agent-native-reviewer` and `adversarial-reviewer` before any done
  claim. If reviewer artifact output fails again, record a blocker artifact and
  do not claim independent review completion.

## Explicit Non-Claims

- No live producer extraction is proven by this intent.
- No PR, CI, CodeRabbit, Linear, review-thread, merge-readiness, Judge/PM, or
  parent-goal completion claim is made by this slice.
