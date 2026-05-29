# Adversarial Postfix Review: PU-036 / SPG-010 ReplayPacket + Linked-Issue Acceptance Trace

## Scope Re-checked
- src/lib/replay/replay-packet.ts
- scripts/validate-replay-packet.cjs
- src/lib/replay/replay-packet.test.ts
- src/lib/pr-template-validator.ts
- src/lib/pr-template-validator-rules.ts
- src/lib/pr-template-validator.test.ts
- contracts/examples/replay-packet.example.json

## Result
No blocking adversarial findings in the re-checked risk areas.

## Verified Fix Closure
- replayKind semantic validation now exists in both validators:
  - src/lib/replay/replay-packet.ts:290
  - scripts/validate-replay-packet.cjs:197
- Orientation contradiction guard now enforces:
  - freshness equals current
  - freshnessVerdict equals current
  - no staleState entries
  - no blockers entries
  - TS: src/lib/replay/replay-packet.ts:530
  - CJS: scripts/validate-replay-packet.cjs:448
- Linked-issue masking path now requires per-linked-issue coverage in multi-issue traces:
  - traceCoversEveryLinkedIssue(...) plus strengthened message/requirements:
  - src/lib/pr-template-validator.ts:219
- Regression coverage added for:
  - invalid replayKind
  - missing no-completion classification in preparatory linked-issue traces
  - multi-issue acceptance trace masking
  - src/lib/replay/replay-packet.test.ts:69
  - src/lib/pr-template-validator.test.ts:102

## Remaining Residual Risk (non-blocking)
### Low — Segment-based linked-issue parsing can still accept semantically weak acceptance mapping text
- Validation ownership: introduced by current patch
- Evidence: traceCoversEveryLinkedIssue(...) checks whether each JSC-* segment contains any acceptance token or preparatory/no-completion phrase, but does not verify that acceptance IDs are structurally bound to the specific linked issue key namespace beyond segment text locality (src/lib/pr-template-validator.ts:219).
- Impacted behavior: governance text that is syntactically valid but semantically vague can still pass.
- Remediation: if stricter traceability is required, enforce canonical per-issue subformat (for example JSC-123: SA-123-* or JSC-123: completed IDs none) with parser-level extraction instead of regex segment heuristics.
- Confidence: 62

## Validation Ownership Classification
- Remaining note above: introduced by current patch (non-blocking design tradeoff).
- No environment/tooling failures observed in this review pass.

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-adversarial-postfix.md
