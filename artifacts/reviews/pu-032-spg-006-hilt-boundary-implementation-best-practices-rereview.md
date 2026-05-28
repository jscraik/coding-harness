# PU-032 / SPG-006 HILT Boundary Re-Review (Best Practices)

## Scope
- src/lib/decision-request/hilt-boundary.ts
- src/lib/decision-request/builder.ts
- src/lib/decision-request/types.ts
- src/commands/decision-request.test.ts
- contracts/decision-request.schema.json
- docs/cli-reference.md
- artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-*.md

## Verdict
No material regressions found relative to the prior finding set. The post-fix implementation now enforces claim-sensitive evidence/stale-state requirements in builder logic, normalizes emitted evidence refs, and documents the accepted HILT boundary taxonomy plus claim-sensitive rule.

## Findings (Severity Ranked)

### 1) Low - JSON Schema still accepts whitespace-only evidence refs in externally-authored packets
- Severity: low
- Evidence: contracts/decision-request.schema.json:82-87 (`evidenceRefs.items.minLength = 1` rejects empty string but still permits whitespace-only strings such as `"   "`).
- Impacted behavior: External producers that bypass the builder can submit whitespace-only evidence refs and still pass schema validation; this is partially mitigated because claim-sensitive enforcement in builder trims refs (src/lib/decision-request/hilt-boundary.ts:86-89) and emitted packets are normalized (src/lib/decision-request/builder.ts:163-165).
- Remediation: Consider tightening schema with a non-whitespace pattern (for example `pattern: ".*\\S.*"`) for `evidenceRefs` items to align schema-level acceptance with runtime semantics.
- Confidence: high
- Validation ownership: pre-existing contract permissiveness (not introduced by this patch set).

## Fixed-Area Confirmation Evidence
- Blank or whitespace refs no longer satisfy claim-sensitive boundaries:
- src/lib/decision-request/hilt-boundary.ts:86-93 uses trimmed non-empty check and requires non-current stale state.
- src/commands/decision-request.test.ts:333-347 covers rejection of `["", "   "]` for `merge_readiness`.
- Emitted packet evidence refs are normalized:
- src/lib/decision-request/builder.ts:149 and src/lib/decision-request/builder.ts:163-165 trim and drop empties.
- src/commands/decision-request.test.ts:350-365 validates emitted `["runtime-card:JSC-363"]` from mixed or blank input.
- Schema rejects empty evidence ref strings:
- contracts/decision-request.schema.json:82-87 enforces `minLength: 1`.
- Docs disclose taxonomy plus claim-sensitive requirement:
- docs/cli-reference.md:152-160 lists accepted `--boundary` values and claim-sensitive requirement for non-empty `--evidence` plus non-current stale-state evidence.

## Residual Risks
- Schema and runtime acceptance are not fully symmetrical for whitespace-only `evidenceRefs` in externally-authored packets (low severity, mitigated by builder path).

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-best-practices-rereview.md
