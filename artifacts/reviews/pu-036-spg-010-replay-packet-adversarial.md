# Adversarial Review: PU-036 / SPG-010 ReplayPacket + Linked-Issue Acceptance Trace

## Scope
- src/lib/replay/replay-packet.ts
- src/lib/replay/replay-packet.test.ts
- scripts/validate-replay-packet.cjs
- contracts/replay-packet.schema.json
- contracts/examples/replay-packet.example.json
- contracts/runtime-packet-schemas.manifest.json
- src/dev/validate-runtime-packet-schemas-script.test.ts
- AGENTS.md
- ARCHITECTURE.md
- README.md
- docs/agents/00-architecture-bootstrap.md
- docs/agents/07b-agent-governance.md
- docs/agents/04-validation.md
- src/lib/pr-template-validator.ts
- src/lib/pr-template-validator-rules.ts
- src/lib/pr-template-validator.test.ts

## Findings (severity-ranked)

### 1) High — Schema/semantic contract mismatch lets invalid replayKind pass TypeScript and script validators
- Validation ownership: introduced by current patch
- Evidence:
  - replayKind is required in schema and constrained to enum values in JSON schema: contracts/replay-packet.schema.json:42.
  - Neither semantic validator validates replayKind:
    - TS validator never checks packet.replayKind in validateReplayPacket(...): src/lib/replay/replay-packet.ts:259.
    - Script validator mirrors same omission: scripts/validate-replay-packet.cjs:182.
  - Existing parity test only checks that the example passes; it does not assert semantic rejection of invalid replayKind: src/dev/validate-runtime-packet-schemas-script.test.ts:108.
- Constructed failure scenario:
  - Trigger: a future producer or caller uses validateReplayPacket(...) directly (or scripts/validate-replay-packet.cjs) without JSON-schema prevalidation.
  - Path: packet sets replayKind: "session_replay_seed_typo" while all other fields remain valid.
  - Outcome: semantic validator returns pass, allowing an off-contract packet into replay/audit workflows; any downstream code assuming three canonical kinds can misroute or silently drop this record.
- Impacted behavior: false-success in semantic gate; contract truth diverges between schema and implementation validator.
- Remediation:
  - Add explicit replayKind enum checks in both src/lib/replay/replay-packet.ts and scripts/validate-replay-packet.cjs.
  - Add negative tests asserting failure on invalid replayKind in both replay-packet tests and validate-runtime-packet-schemas script tests.
- Confidence: 100

### 2) Medium — Orientation packet can claim freshness: stale while passing as freshnessVerdict: current
- Validation ownership: introduced by current patch
- Evidence:
  - Orientation semantics enforce freshnessVerdict === "current" and SHA equality, but do not enforce freshness === "current": src/lib/replay/replay-packet.ts:520.
  - Schema allows both freshness and freshnessVerdict independently; no cross-field constraint: contracts/replay-packet.schema.json:57 and contracts/replay-packet.schema.json:93.
  - CJS validator mirrors same behavior: scripts/validate-replay-packet.cjs:438.
- Constructed failure scenario:
  - Trigger: packet has evidenceUse: "orientation", freshnessVerdict: "current", and matching observedHeadSha/currentHeadSha, but freshness: "stale" and populated staleState.
  - Path: validator accepts because only verdict/SHA/TTL are enforced.
  - Outcome: packet is semantically contradictory; one downstream consumer keyed on freshnessVerdict treats it current, another keyed on freshness treats it stale, producing split routing and inconsistent replay triage.
- Impacted behavior: stale-state ambiguity and contradictory freshness classification across consumers.
- Remediation:
  - In orientation mode, require freshness === "current" and optionally require staleState/blockers to be empty unless explicitly modeled otherwise.
  - Add cross-field negative tests.
- Confidence: 90

### 3) Medium — Linked-issue acceptance trace can pass with an unrelated acceptance ID, masking partial completion
- Validation ownership: introduced by current patch
- Evidence:
  - Early return accepts any acceptance token anywhere in Acceptance trace: src/lib/pr-template-validator.ts:195.
  - Pattern is not bound to linked JSC issue(s): src/lib/pr-template-validator-rules.ts:44.
  - Error path aggregates linked issues from Plan IDs, but success path does not map IDs to those issues: src/lib/pr-template-validator.ts:204.
- Constructed failure scenario:
  - Trigger: Plan IDs contains JSC-111, JSC-222; Acceptance trace includes one real ID for only one lane (for example SA-111-001) plus preparatory text for the other lane without explicit completed IDs: none.
  - Path: ACCEPTANCE_TRACE_ID_PATTERN matches once and returns success before preparatory completeness checks run.
  - Outcome: validator reports pass although one linked issue still lacks explicit acceptance-completion declaration, which weakens the intended anti-ambiguity guard.
- Impacted behavior: false-success in PR governance lane; linked-issue completion truth can be overstated.
- Remediation:
  - Require per-linked-issue acceptance mapping, or at minimum enforce that mixed linked-issue traces include explicit completed IDs: none for each linked issue without completed IDs.
  - Add tests for multi-issue Plan IDs with partial acceptance coverage.
- Confidence: 78

## Residual Risks
- requiresFilesystemExistence is caller-controlled across all ref kinds; there is no kind-based requirement that critical replay refs (for example hook_file, hook_input, hook_output) must exist on disk. This may be intentional for historical/audit snapshots, but if live replayability is expected, this can become a false-replayability vector.

## Testing Gaps
- No negative semantic tests for invalid replayKind.
- No cross-field contradiction tests for orientation freshness (freshnessVerdict vs freshness).
- No multi-linked-issue acceptance-trace test that demonstrates mixed completed/preparatory semantics.

## Validation Failure Classification
- No gate-run command failure observed in this review lane.
- Findings above are classification-level vulnerabilities in current patch behavior, not environment/tooling failures.

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-adversarial.md
