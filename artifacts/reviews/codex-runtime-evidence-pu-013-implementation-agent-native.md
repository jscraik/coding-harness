## Agent-Native Architecture Review

### Summary
This slice preserves agent-native parity for runtime cockpit evidence ingestion: actions available to a human operator through `harness runtime-card --evidence`, `harness next --runtime-card`, and `harness next --phase-exit` remain available to agents through the same CLI surfaces, with shared repo-boundary enforcement and machine-readable blocked decisions. The change is additive and keeps `runtime-card/v1` advisory/compact rather than executable authority.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Ingest runtime evidence via `--evidence` and generate card | src/commands/runtime-card.ts:51 | `harness runtime-card --evidence` (same CLI action) | Yes (CLI contract) | Must have | Pass |
| Load explicit runtime-card artifact for next-step recommendation | src/commands/next-runtime-card.ts:12 | `harness next --runtime-card` (same CLI action) | Yes (CLI contract) | Must have | Pass |
| Load explicit phase-exit artifact for next-step recommendation | src/commands/next-phase-exit.ts:17 | `harness next --phase-exit` (same CLI action) | Yes (CLI contract) | Must have | Pass |
| Enforce repo-contained artifact trust boundary | src/lib/runtime/repo-runtime-artifact.ts:23 | Shared helper reused by both commands | Yes (error output metadata) | Must have | Pass |
| Surface codex runtime summary in advisory metadata | src/commands/next.test.ts:403 | `harness next --json` metadata projection | Yes (decision meta contract) | Should have | Pass |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
None.

#### Observations
1. **Error-shape consistency is mostly structured but bifurcated across commands** -- `src/commands/runtime-card.ts:165` returns `runtime-card-error/v1` on failure, while `harness next` returns blocked `harness-decision` objects (`src/commands/next-runtime-card.ts:27`, `src/commands/next-phase-exit.ts:32`). This is acceptable today and still agent-consumable, but a future harmonization note may reduce orchestration branching for downstream agent tooling.

### What's Working Well
- Shared trust-boundary helper centralizes path traversal and symlink-escape protections for read/write runtime artifacts (`src/lib/runtime/repo-runtime-artifact.ts`), reducing drift between command surfaces.
- Codex packet ingestion is normalized through the existing runtime-evidence adapter seam instead of introducing a parallel workflow path (`src/commands/runtime-card.ts:27-58`), preserving composability.
- Agent-visible failure metadata remains explicit and actionable (`failureClass`, `frictionClass`, sanitized `error`) in next-command blocked decisions (`src/commands/next-runtime-card.ts:31-39`, `src/commands/next-phase-exit.ts:36-44`).
- Tests cover outside-repo and symlink escape cases for both runtime-card and next-phase runtime paths (`src/commands/runtime-card.test.ts:712+`, `src/commands/next.test.ts:1039+`), which is exactly the kind of agent safety parity expected for trust-boundary logic.
- Runtime-card metadata remains advisory and compact in `next` projection, with no executable command authority or merge-readiness overreach demonstrated by this patch (`src/commands/next.test.ts:457+`).

### Score
- **5/5 high-priority capabilities are agent-accessible**
- **Verdict:** PASS

Residual risk:
- Low: downstream automation consuming both runtime-card and next outcomes must continue handling two schema families (`runtime-card-error/v1` vs blocked `harness-decision`) until/unless unified by explicit contract work.

Validation ownership classification:
- No new validation failures identified in reviewed scope.

WROTE: artifacts/reviews/codex-runtime-evidence-pu-013-implementation-agent-native.md
