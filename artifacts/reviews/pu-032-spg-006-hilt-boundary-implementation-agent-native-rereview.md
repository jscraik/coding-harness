## Agent-Native Architecture Re-Review (PU-032 / SPG-006)

### Scope
- Re-review target: post-fix HILT-boundary implementation for decision-request packets.
- Files reviewed:
  - src/lib/decision-request/hilt-boundary.ts
  - src/lib/decision-request/builder.ts
  - src/lib/decision-request/types.ts
  - src/commands/decision-request.test.ts
  - contracts/decision-request.schema.json
  - docs/cli-reference.md
  - prior artifacts under artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-*.md

### Findings (Severity-Ordered)

#### Critical (Must Fix)
1. None.

#### Warnings (Should Fix)
1. None.

#### Observations
1. **Prior finding is fixed: blank/whitespace-only refs do not satisfy claim-sensitive boundaries** -- `src/lib/decision-request/hilt-boundary.ts:86-93`, `src/commands/decision-request.test.ts:333-346`
Impacted behavior: claim-sensitive boundaries now require at least one trimmed, non-empty evidence ref and non-current stale-state evidence, preventing whitespace-only bypass.
Remediation: none needed; keep this guard and test coverage.
Confidence: high.
Validation ownership: introduced by current patch.

2. **Prior finding is fixed: emitted packets normalize evidence refs** -- `src/lib/decision-request/builder.ts:149`, `src/lib/decision-request/builder.ts:163-165`, `src/commands/decision-request.test.ts:350-364`
Impacted behavior: emitted packet evidence refs are trimmed and empty entries are removed, so downstream consumers receive canonical refs.
Remediation: none needed; keep normalization centralized in `normalizeEvidenceRefs`.
Confidence: high.
Validation ownership: introduced by current patch.

3. **Prior finding is fixed: schema rejects empty evidence ref strings** -- `contracts/decision-request.schema.json:82-86`
Impacted behavior: `evidenceRefs` items require `minLength: 1`, so empty strings are invalid at schema-validation time.
Remediation: none needed for the explicit empty-string requirement.
Confidence: high.
Validation ownership: introduced by current patch.

4. **Prior finding is fixed: docs disclose closed HILT taxonomy + claim-sensitive requirement** -- `docs/cli-reference.md:152-160`
Impacted behavior: operator-facing contract now states accepted boundary taxonomy and claim-sensitive requirement for non-empty evidence + non-current stale-state.
Remediation: none needed.
Confidence: high.
Validation ownership: introduced by current patch.

### Residual Risks
- JSON Schema alone does not enforce cross-field claim-sensitive semantics (for example, “if boundaryType is claim-sensitive then staleState must include non-current and evidenceRefs must contain a meaningful ref”); this is enforced in builder/runtime logic and tests instead (`src/lib/decision-request/hilt-boundary.ts:76-105`, `src/commands/decision-request.test.ts:305-346`).
- Schema `minLength: 1` rejects empty strings but still permits whitespace-only strings if they are validated in isolation; runtime normalization and claim-sensitive validation currently mitigate this for emitted packets and decision boundary checks.

### Verdict
- Re-review result: **PASS** for the previously reported issue set.
- No material agent-native parity regressions found in the scoped patch.

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-agent-native-rereview.md
