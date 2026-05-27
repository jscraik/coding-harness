# PU-022 GAP-004 Session Context Simplify Review

## Scope

- Slice: PU-022 / GAP-004.
- Mode: behavior-preserving simplification review over the bounded diff.

## Verdict

Status: pass. No behavior-preserving simplification is worth applying before implementation review.

The implementation is already split along useful seams: `collector.ts` for evidence projection, `cli.ts` for argument and exit behavior, `types.ts` for the contract, and a tiny command facade. A simplification pass should not collapse those files because that would make the agent-facing trust boundary less inspectable.

## Evidence

- `src/lib/session-context/collector.ts:25` and `src/lib/session-context/collector.ts:33` keep allow-listed discovery constants explicit.
- `src/lib/session-context/collector.ts:132`, `146`, `152`, and `161` keep active artifacts, runtime cards, review artifacts, and session evidence as separate collection steps.
- `src/lib/session-context/collector.ts:292` and `302` separate file-only checks from safe path admission.
- `src/lib/session-context/cli.ts:70` centralizes usage-error JSON/human output.
- `src/commands/session-context.test.ts:27`, `69`, `89`, `111`, `127`, and `139` are focused behavior examples rather than broad snapshot tests.

## Skipped Simplifications

- Do not merge `safeExistingFile()` and `safeExistingPath()`: file-only runtime-card semantics are different from broad artifact ref admission.
- Do not replace explicit stale-state cases with a generic loop: the separate messages are operator-facing evidence and support future reviewer diagnosis.
- Do not broaden review artifact traversal recursively: this would increase packet size and risk turning orientation into incomplete review proof.

## Validation Reviewed

- Focused test and typecheck evidence already ran after implementation.
- No code edits were made by this review lens, so no additional command is required from this lens alone.

WROTE: artifacts/reviews/pu-022-gap-004-session-context-simplify.md
