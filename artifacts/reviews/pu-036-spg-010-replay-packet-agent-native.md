## Agent-Native Architecture Review

### Summary
Scoped review covered ReplayPacket/v1 contract, semantic validator, manifest wiring, and linked-issue acceptance-trace guard changes. Agent integration exists via machine-consumable validators and governance constraints that keep replay packets orientation/audit-only. Overall parity is strong for this slice with one should-fix drift risk.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|---|---|---|---|---|---|
| Validate replay packet contract example against runtime manifest | contracts/runtime-packet-schemas.manifest.json; src/dev/validate-runtime-packet-schemas-script.test.ts | node scripts/validate-runtime-packet-schemas.cjs + validateReplayPacket(...) | Yes | Must-have | Covered |
| Validate replay packet semantic invariants | scripts/validate-replay-packet.cjs; src/lib/replay/replay-packet.ts | standalone semantic validator + TS validator | Yes | Must-have | Covered |
| Enforce linked-issue acceptance-trace preparatory wording | src/lib/pr-template-validator.ts; src/lib/pr-template-validator-rules.ts | PR template validator | Yes | Should-have | Covered |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
1. Semantic drift risk between TS and CJS replay validators -- src/lib/replay/replay-packet.ts:122, scripts/validate-replay-packet.cjs:8, src/dev/validate-runtime-packet-schemas-script.test.ts:104 -- Replay validation logic is duplicated across TS and CJS implementations, but parity proof currently checks only a positive example. Edge-case divergence can pass CI while yielding conflicting agent/runtime verdicts.
Fix: add shared pass/fail fixture matrix consumed by both validators, or refactor CJS to reuse a single compiled validator core.
Validation ownership: introduced by current patch.
Confidence: 0.82.

#### Observations
1. No orphan feature detected in scope; replay packet flows are tool-addressable and artifact-first.
2. Acceptance-trace tightening reduces ambiguous preparatory linked-issue closure claims.

### What's Working Well
- ReplayPacket/v1 constraints are explicit and machine-checkable.
- Manifest registration and packet-count regression stayed synchronized.
- Governance/docs boundaries align with implementation (not claim-support or merge-readiness proof).

### Score
- 3/3 high-priority capabilities are agent-accessible
- Verdict: PASS (with one should-fix warning)

## Validation Evidence
- pnpm -s vitest src/lib/replay/replay-packet.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts src/lib/pr-template-validator.test.ts -> pass (88 tests)
- node scripts/validate-runtime-packet-schemas.cjs -> pass (packetCount: 17, errors: [])

## Accountability Receipt
- status: completed_with_warnings
- manifest_path: artifacts/agent-runs/agent-native-reviewer-pu-036-spg-010/manifest.json
- artifact_paths: artifacts/reviews/pu-036-spg-010-replay-packet-agent-native.md
- findings: warning on TS/CJS replay-validator drift risk
- failures_or_blockers: none
- improvement_opportunities: add cross-validator negative-case parity matrix; reduce duplicated validation logic
- strengths: strong machine-readable contracts; clear governance boundaries
- validation_evidence: targeted vitest suite passed; runtime packet schema validation passed
- next_action: harden validator parity before broader replay producer rollout
- useful_findings: identified non-blocking consistency risk early
- avoided_false_positive: did not flag intended acceptance-trace strictness as regression
- evidence_quality: high
- followed_scope: yes
- reusable_learning: positive-example-only parity checks are insufficient for dual-implementation validators
- coordinator_score: 9/10

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-agent-native.md
