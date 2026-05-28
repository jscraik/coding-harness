## Agent-Native Architecture Review

### Summary
SteeringQueue/v1 is implemented as a contract-only, advisory packet surface in `src/lib/steering-queue/**` with deterministic selection, stale-context safeguards, and semantic validators. Agent-native parity for this slice is preserved: agents can discover the packet contract and validate it, but cannot use it as execution authority (intentionally blocked). Overall verdict: PASS for the stated PU-030/SPG-004 boundaries.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Publish deferred steering packet contract | contracts/runtime-packet-schemas.manifest.json:108 | `node scripts/validate-steering-queue.cjs` + semantic validator | Yes (governance/docs) | Must | PASS |
| Select applicable deferred steering item deterministically | src/lib/steering-queue/builder.ts:49 | build API (`buildSteeringQueuePacket`) | Yes (module contract) | Must | PASS |
| Reject cross-scope arbitration in one packet | src/lib/steering-queue/validation.ts:109 | semantic validator | Yes | Must | PASS |
| Reject cyclic supersession graph | src/lib/steering-queue/validation.ts:129 | semantic validator | Yes | Must | PASS |
| Fail closed on conflicting duplicate instruction sources | src/lib/steering-queue/builder.ts:77 | builder stale classification | Yes | Must | PASS |
| Keep packet non-authoritative for command execution/merge proof | docs/agents/07b-agent-governance.md:149 | N/A (policy guardrail) | Yes | Must | PASS |

### Findings

#### Critical (Must Fix)
1. None.

#### Warnings (Should Fix)
1. None.

#### Observations
1. **No explicit schema-level single-scope/cycle invariants** -- `contracts/steering-queue.schema.json` captures structure only; cross-scope and cycle checks are semantic-only (`src/lib/steering-queue/validation.ts:109`, `:129`). Recommendation: keep semantic validator mandatory anywhere this packet is consumed. Validation ownership: introduced by current patch. Confidence: high.

### What’s Working Well
- Implementation split is clean and aligned with deep-module contract: `builder.ts`, `validation.ts`, `validation-item.ts`, `validation-helpers.ts`, `hash.ts`, `types.ts`, `constants.ts`, with facade export surface in `src/lib/steering-queue/index.ts`.
- One-scope-per-packet invariant is enforced and regression tested (`src/lib/steering-queue/steering-queue.test.ts:216`).
- Supersession cycle detection is enforced and regression tested (`src/lib/steering-queue/steering-queue.test.ts:231`).
- Duplicate conflicting instruction-source refs degrade to `instruction_hash_unverifiable` (builder mapping at `src/lib/steering-queue/builder.ts:86`) and are regression tested (`src/lib/steering-queue/steering-queue.test.ts:247`).
- Runtime packet manifest correctly keeps `steering-queue/v1` as `not_yet_emitted` and parity validator `none` with a semantic validator path (`contracts/runtime-packet-schemas.manifest.json:108`).

### Score
- **6/6 high-priority capabilities are agent-accessible within intended advisory-only boundaries**
- **Verdict:** PASS

### Validation Evidence
- `pnpm vitest run src/lib/steering-queue/steering-queue.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts` -> pass, 27 tests.
- `node scripts/validate-steering-queue.cjs contracts/examples/steering-queue.example.json` -> pass.
- `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass, 12 contracts.
- `pnpm typecheck` -> pass.
- `pnpm run quality:size` -> pass (pre-existing ratchet warnings outside this slice).
- `pnpm run quality:docstrings` -> pass.

### Accountability Receipt
- status: completed
- manifest_path: artifacts/agent-runs/agent-native-reviewer-019e6c6e-1aa4-7830-a191-5d3be775eb41/manifest.json
- artifact_paths: artifacts/reviews/pu-030-spg-004-steering-queue-postfix-agent-native-reviewer.md
- findings: 0 critical, 0 warnings, 1 observation
- failures_or_blockers: none
- improvement_opportunities: enforce semantic validator invocation contract at all packet-consumer boundaries
- strengths: deterministic selection, stale-safe hash verification, explicit non-authority governance guardrails
- validation_evidence: commands listed above with pass outcomes
- next_action: coordinator can proceed with synthesis; no blocking agent-native parity gaps found
- useful_findings: semantic invariant coverage is present and test-backed
- avoided_false_positive: did not flag intentional non-emission/non-authority posture as defect
- evidence_quality: high (code + tests + executed validators)
- followed_scope: yes (only requested files and direct validation surfaces)
- reusable_learning: keep invariants that cannot be expressed in JSON Schema in semantic validator plus explicit tests
- coordinator_score: strong

WROTE: artifacts/reviews/pu-030-spg-004-steering-queue-postfix-agent-native-reviewer.md
