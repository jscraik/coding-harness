## Agent-Native Architecture Review (Final Scoped Re-Review)

### Scope Reviewed
- contracts/decision-request.schema.json
- src/dev/validate-runtime-packet-schemas-script.test.ts
- src/lib/decision-request/hilt-boundary.ts
- src/lib/decision-request/builder.ts
- src/commands/decision-request.test.ts
- docs/cli-reference.md

### Summary
No material agent-native parity or HILT-boundary contract defects remain in the scoped files. Runtime and schema behavior now align for whitespace-only evidence references: builder/HILT checks reject them for claim-sensitive boundaries, and schema validation rejects them for externally-authored packets. The regression test added in the schema-validator suite does prove the external packet path by patching the manifest entry to a synthetic decision-request example and asserting validator failure on schema pattern enforcement.

### Capability Map (Scoped)

| UI/CLI Action | Location | Agent Tool / Runtime Primitive | In Prompt/Docs? | Priority | Status |
|---|---|---|---|---|---|
| Emit decision-request with claim-sensitive boundary | src/commands/decision-request.test.ts:305 | buildDecisionRequest + buildHiltBoundary | docs/cli-reference.md:152 | High | Pass |
| Reject blank/whitespace-only evidence refs in claim-sensitive boundaries | src/lib/decision-request/hilt-boundary.ts:86 | validateClaimSensitiveBoundary | docs/cli-reference.md:157 | High | Pass |
| Normalize emitted evidence refs for runtime packet output | src/lib/decision-request/builder.ts:163 | normalizeEvidenceRefs | Implicit via tests | Medium | Pass |
| Validate externally-authored decision-request packets against schema | src/dev/validate-runtime-packet-schemas-script.test.ts:270 | validate-runtime-packet-schemas.cjs manifest walk | manifest-driven tests | High | Pass |

### Findings

#### Critical (Must Fix)
1. None.

#### Warnings (Should Fix)
1. None.

#### Observations
1. Schema-level and runtime-level enforcement now both guard against whitespace-only evidence refs, but they guard different lanes by design (external packet ingestion vs runtime construction). Evidence: contracts/decision-request.schema.json:82 and src/lib/decision-request/hilt-boundary.ts:86. Recommendation: Keep both tests in place to prevent future one-sided regressions.
2. The external packet regression is manifest-scoped and confirms failure semantics, not end-to-end command UX for externally provided packet files. Evidence: src/dev/validate-runtime-packet-schemas-script.test.ts:281 and :289. Recommendation: Optional future hardening is a small CLI integration test that runs the validator command against a temp manifest from the command surface, if command UX drift becomes a concern.

### Direct Answers to Coordinator Questions
1. Runtime/schema alignment for whitespace-only evidence refs and claim-sensitive decision requests: **Yes**. Runtime rejects blank refs via trim-length check for claim-sensitive boundaries (src/lib/decision-request/hilt-boundary.ts:86-93; src/commands/decision-request.test.ts:333-347). Schema rejects whitespace-only refs in external packets via \\S pattern (contracts/decision-request.schema.json:82-88).
2. Schema regression proving external packet path: **Yes**. The test mutates a decision-request example file, rewires the manifest entry, executes the schema validator script, and asserts specific failure output (src/dev/validate-runtime-packet-schemas-script.test.ts:270-303).
3. Remaining material gaps in scoped HILT-boundary contract: **None found** in this scope.

### Residual Risk
- Low: The scoped tests verify schema and builder behavior but do not assert every downstream consumer that might parse decision-request packets outside the canonical validator path. No evidence in this scope suggests an active defect.

### Score
- **4/4 high-priority scoped capabilities are agent-accessible and parity-aligned**
- **Verdict:** PASS

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-final-agent-native.md
