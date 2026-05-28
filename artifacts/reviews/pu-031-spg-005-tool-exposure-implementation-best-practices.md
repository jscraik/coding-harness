# SPG-005 Tool Exposure Implementation Best-Practices Review

## Scope
- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-031-spg-005-tool-exposure-projection-intent.json
- src/lib/tool-exposure/**
- src/lib/runtime/runtime-card-codex-runtime.ts
- src/lib/runtime/runtime-card-codex-runtime-validation.ts
- src/lib/runtime/runtime-evidence-bundle.ts
- src/lib/runtime/runtime-evidence-adapter.ts
- src/lib/runtime/runtime-card-codex-runtime-projection.test.ts
- contracts/tool-exposure-snapshot.schema.json
- contracts/examples/tool-exposure-snapshot.example.json
- contracts/runtime-packet-schemas.manifest.json
- .harness/memory/LEARNINGS.md

## Findings (Severity-Ranked)

### 1) Severity: medium - runtime-card validation does not enforce blocker/tool-exposure count coherence
- Evidence:
  - Intent acceptance explicitly requires rejecting inconsistent blocked/unavailable vs blocker-count states (.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-031-spg-005-tool-exposure-projection-intent.json:46).
  - Runtime-card codex projection validates toolExposure shape and local field constraints, but does not cross-check codexRuntime.toolExposure.blockedPermissionAttemptCount or unavailable-related counts against codexRuntime.blockerCount (src/lib/runtime/runtime-card-codex-runtime-validation.ts:243-302).
  - Existing consistency checks cover blockedSourceCount/sourceCount/refs only, not toolExposure-vs-blockers semantics (src/lib/runtime/runtime-card-codex-runtime-validation.ts:115-193,195-241).
  - Projection tests validate happy-path projection and redaction, but no negative test for toolExposure count drift against blocker counts (src/lib/runtime/runtime-card-codex-runtime-projection.test.ts:164-193,404-508).
- Impacted behavior:
  - A runtime card can report blocked permission attempts or unavailable tool classes while blocker totals remain semantically out-of-sync, reducing operator trust in compact orientation summaries.
- Remediation:
  - Add a codex-runtime semantic check that enforces explicit policy, for example:
    - If toolExposure.blockedPermissionAttemptCount > 0, require codexRuntime.blockerCount > 0.
    - Define and enforce how unavailableToolCount contributes (or does not contribute) to blocker semantics, then codify in validator and tests.
  - Add at least one failing fixture in runtime-card-codex-runtime-projection.test.ts proving the mismatch is rejected.
- Confidence: medium-high.
- Validation ownership: introduced by current patch.
- Validation owner: implementation lane (src/lib/runtime/runtime-card-codex-runtime-validation.ts + projection tests).

## Intent Coverage Check

- Orientation-only tool exposure: PASS
  - evidenceUse constrained to orientation/audit_trail and claim_support rejected (src/lib/tool-exposure/types.ts:6-10; src/lib/tool-exposure/validation.ts:542-547; src/lib/tool-exposure/tool-exposure-snapshot.test.ts:54-66).
- Closed blocked-permission taxonomy: PASS
  - Closed enums for permission kinds and blocked reasons in types/schema/validation (src/lib/tool-exposure/types.ts:32-50; contracts/tool-exposure-snapshot.schema.json:197-216; src/lib/tool-exposure/validation.ts enum checks).
- No raw command/path/secret payloads: PASS
  - Forbidden key checks + sensitive string pattern + raw embedding rejection on runtime card (src/lib/tool-exposure/validation.ts:20-37,71-95,131-155; src/lib/runtime/runtime-card-codex-runtime-validation.ts:11-67; tests at src/lib/tool-exposure/tool-exposure-snapshot.test.ts:68-104 and src/lib/runtime/runtime-card-codex-runtime-projection.test.ts:195-403).
- Bounded key tool names: PASS
  - Hard cap constant + validation + truncation projection logic + tests (src/lib/tool-exposure/types.ts:4; src/lib/tool-exposure/validation.ts:196-219; src/lib/tool-exposure/projection.ts:13-15; src/lib/tool-exposure/tool-exposure-snapshot.test.ts:160-194).
- Schema/example/manifest registration: PASS
  - Present and linked in manifest with SPG-005 owner gap (contracts/tool-exposure-snapshot.schema.json; contracts/examples/tool-exposure-snapshot.example.json; contracts/runtime-packet-schemas.manifest.json:119-127).
- Runtime-card discoverability: PASS
  - Projection threaded through bundle/adapter/codexRuntime optional field and validated by runtime-card test coverage (src/lib/runtime/runtime-evidence-bundle.ts:100-101,378-381; src/lib/runtime/runtime-evidence-adapter.ts:144-177; src/lib/runtime/runtime-card-codex-runtime.ts:16; src/lib/runtime/runtime-card-codex-runtime-projection.test.ts:164-193).

## Additional Notes
- .harness/memory/LEARNINGS.md includes the env FIFO learning entry at line 62.
- Requested local-memory CLI workflow could not run in this sandbox due write denial for PID path.

## Accountability Receipt
- status: completed_with_findings
- artifact_paths:
  - artifacts/reviews/pu-031-spg-005-tool-exposure-implementation-best-practices.md
- manifest_path:
  - artifacts/agent-runs/best-practices-researcher-019e6cd3-1795-7f20-aea3-c3b5b66322fe/manifest.json
- findings:
  - 1 medium issue (blocker/tool-exposure coherence check gap).
- failures_or_blockers:
  - blocked_local_memory_cli:
    - command: local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness/task:spg-005-review" --json
    - error: failed to save PID: failed to write PID file: open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted
    - command: local-memory search "SPG-005 tool exposure snapshot orientation-only runtime card" --session_filter_mode all --json
    - error: same PID write permission failure
- improvement_opportunities:
  - Add semantic cross-check rules between toolExposure blocked/unavailable totals and codexRuntime.blockerCount.
  - Add explicit mismatch regression tests.
- strengths:
  - Strong orientation-only boundaries and pointer-safe validation.
  - Good schema/example/manifest wiring.
  - Clear compact projection surface for runtime-card.
- validation_evidence:
  - Static source review with line-anchored evidence across scoped files.
  - No code edits performed.
  - No test reruns executed in this review pass.
- useful_findings: 1
- avoided_false_positive: 2
- evidence_quality: medium-high
- followed_scope: yes
- reusable_learning:
  - Compact runtime projections need semantic coherence checks, not just structural shape checks.
- coordinator_score: 0.87
- next_action:
  - Implement and test blocker/tool-exposure coherence rule in runtime-card codex validation lane.

WROTE: artifacts/reviews/pu-031-spg-005-tool-exposure-implementation-best-practices.md
