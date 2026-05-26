## Agent-Native Architecture Review

### Summary
This PU-012 slice adds a Harness-owned Codex runtime evidence producer boundary and source-provenance validator. The implementation preserves agent-native principles in-scope: it uses explicit runtime facts, defaults unsupported fields to explicit unknown classifications, validates packet shape before handoff, and avoids human-only/manual interpretation paths. No action-parity or context-parity regressions were found within the scoped files.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Build Codex runtime evidence packet from explicit facts | src/lib/runtime/codex-runtime-evidence-producer.ts:100 | `buildCodexRuntimeEvidenceFromProducerInput` | n/a in this slice (library boundary) | must-have | covered |
| Admit/import existing packet only if schema-valid | src/lib/runtime/codex-runtime-evidence-producer.ts:88 | `admitCodexRuntimeEvidencePacket` | n/a in this slice (library boundary) | must-have | covered |
| Fail closed on stale Codex source assumptions (HEAD/blob drift) | src/lib/runtime/codex-runtime-source-provenance.ts:48 | `validateCodexRuntimeSourceSnapshot` | n/a in this slice (library boundary) | must-have | covered |
| Preserve adapter compatibility without shared-contract edits | src/lib/runtime/codex-runtime-evidence-producer.test.ts:95 | producer + existing adapter surface | n/a in this slice (library boundary) | should-have | covered |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
None.

#### Observations
1. **Tool discoverability is deferred to later lifecycle units** -- scope evidence: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-012-intent.json:80-83. This slice correctly implements a deep-module producer boundary but does not itself expose a user-facing/agent-invokable command surface; that exposure should remain validated in PU-013+ where runtime-card/next integrations are introduced.

### What's Working Well
- Producer enforces explicit unknown classifications instead of inferring unavailable runtime facts (`traceFailureClass`, permission failure class, external/review state unknowns): src/lib/runtime/codex-runtime-evidence-producer.ts:111-131, 135-150.
- Contract admission is fail-closed via schema validation at the producer boundary: src/lib/runtime/codex-runtime-evidence-producer.ts:88-97.
- Source provenance gate blocks stale Codex assumptions using pinned repo HEAD and per-file blob checks: src/lib/runtime/codex-runtime-source-provenance.ts:85-97, 139-156.
- Tests verify adapter compatibility and unknown-state blocker projection without mutating shared runtime contracts: src/lib/runtime/codex-runtime-evidence-producer.test.ts:95-127.

### Validation Ownership Classification
- No gate failures reported in this review artifact.
- Ownership classification: n/a (no failing gate to classify as introduced/pre-existing/dirty-worktree/environment).

### Score
- **4/4 high-priority capabilities are agent-accessible at the scoped library boundary**
- **Verdict:** PASS

WROTE: artifacts/reviews/pu012-implementation-agent-native.md
