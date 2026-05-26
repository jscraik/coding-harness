## PU-012 Agent-Native Rereview (Implementation Pass)

### Scope Reviewed
- src/lib/runtime/codex-runtime-source-provenance.ts
- src/lib/runtime/codex-runtime-source-provenance.test.ts
- src/lib/runtime/codex-runtime-evidence-producer.ts
- src/lib/runtime/codex-runtime-evidence-producer.test.ts

### First-Pass Findings Status

1. **Stale source snapshot not enforced at producer boundary** — **Fixed**
- Evidence:
  - Producer now validates expected vs observed snapshot before packet admission: `src/lib/runtime/codex-runtime-evidence-producer.ts:121-127`
  - Snapshot validator compares head and blob parity: `src/lib/runtime/codex-runtime-source-provenance.ts:48-57`, `59-98`, `100-159`
  - Regression test for stale observed snapshot now exists: `src/lib/runtime/codex-runtime-evidence-producer.test.ts:161-178`

2. **Write-capable permission profile accepted without writable root evidence** — **Fixed**
- Evidence:
  - Write-capable profiles with empty roots are downgraded to `unknown`: `src/lib/runtime/codex-runtime-evidence-producer.ts:165-168`
  - Failure class now defaults to `producer_input_missing_writable_roots` for this case: `src/lib/runtime/codex-runtime-evidence-producer.ts:169-175`
  - Regression test added for downgrade behavior: `src/lib/runtime/codex-runtime-evidence-producer.test.ts:180-202`

### Remaining Findings (Material)
- None in PU-012 scope.

### Agent-Native Parity Assessment (PU-012 scope)
- The runtime evidence producer now refuses stale source assumptions and refuses to overstate write capability without root evidence, which restores agent/user trust-boundary parity for this packet surface.
- No further material improvements remain inside the PU-012 implementation scope based on this rereview.

WROTE: artifacts/reviews/pu012-implementation-agent-native-rereview.md
