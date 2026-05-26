## Agent-Native Architecture Review

### Summary
The PU-015 slice adds a structured Judge/PM readiness verifier and wires it into closeout consumption in a way that is broadly agent-native: the verifier is exported as code primitives, emits machine-readable blocker metadata, and closeout treats non-pass or stale verdicts as blocking evidence. Overall parity is strong, with one routing-specific gap where multiple distinct reviewer-artifact failures collapse into a single generic blocker code/class.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Consume delivery-truth verdicts during PR closeout | src/lib/pr-closeout/delivery-truth.ts:20 | `buildDeliveryTruthSummary` + `collectDeliveryTruthBlockers` | N/A (library primitive) | Must have | Covered |
| Verify Judge/PM readiness from reviewer artifacts + issue authority + supporting verdicts | src/lib/delivery-truth/judge-pm-audit.ts:99 | `buildJudgePmAuditVerdict` + `buildJudgePmAuditPacket` | N/A (library primitive) | Must have | Covered |
| Discover Judge/PM verifier API surface from package entrypoint | src/lib/delivery-truth/index.ts:2 | Re-exported typed interfaces + builders | N/A (library primitive) | Should have | Covered |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
1. **Reviewer artifact blocker codes are too coarse for deterministic next-step routing** -- src/lib/delivery-truth/judge-pm-audit.ts:209-214, src/lib/delivery-truth/judge-pm-audit.ts:243-261, src/lib/delivery-truth/judge-pm-audit.ts:267-272
Description: many materially different failures (receipt schema invalid, producer mismatch, non-pass status, stale freshness, wrong evidenceUse, missing sizeBytes) collapse to `blockerCode: "invalid_reviewer_artifact"` and mostly `blockerClass: "unknown"`. This weakens agent routing because remediation differs (refresh artifact vs fix producer wiring vs regenerate receipt).
Recommendation: split into finer stable blocker codes (for example `review_artifact_stale`, `review_artifact_schema_invalid`, `review_artifact_policy_invalid`, `review_artifact_producer_mismatch`) and classify each with explicit ownership.
Validation ownership classification: **introduced by current patch** (new Judge/PM audit classifier surface in this slice).

#### Observations
1. **Fail-safe closeout behavior is present and explicitly tested for Judge/PM gating** -- src/lib/pr-closeout.test.ts:645-687, src/lib/pr-closeout/delivery-truth.ts:49-59
The closeout layer blocks on non-pass or stale delivery-truth verdicts, including `goal_ready_for_judge_pm`, preventing silent merge-ready outcomes when Judge/PM evidence is insufficient.
2. **Structured contracts for reviewer artifacts and issue authority are first-class** -- src/lib/delivery-truth/judge-pm-audit.ts:30-50, src/lib/delivery-truth/judge-pm-audit.ts:64-88
Reviewer artifact proof and issue authority are represented as typed packet inputs/outputs with explicit status, freshness, and refs, which supports machine consumption over prose parsing.
3. **Tests exercise production paths directly (not fixture-only self-affirming assertions)** -- src/lib/delivery-truth/judge-pm-audit.test.ts:27-148, src/lib/pr-closeout.test.ts:645-687
Both suites call production builders and assert contract outputs under pass/fail/stale conditions relevant to routing behavior.

### What's Working Well
- Judge/PM verifier is discoverable via the delivery-truth index export surface.
- The verifier enforces multi-surface evidence (reviewer artifacts, issue authority, required supporting verdicts) before passing.
- Closeout integration treats stale and non-pass verdicts as blockers instead of advisory signals.
- Blocker refs are consistently populated enough to anchor evidence lookups.

### Score
- **3/3 high-priority capabilities are agent-accessible**
- **Verdict:** NEEDS WORK
