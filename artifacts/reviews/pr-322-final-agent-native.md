## Agent-Native Architecture Review

### Summary
This diff improves agent-native closeout parity by making Linear mutation availability an explicit machine-readable claim signal and by tightening feedback-loop closure evidence checks. The changes preserve lane separation (local/test truth vs. Linear mutation availability vs. claim support) and prevent unknown/blocked evidence from being reported as ready or mergeable.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Run PR closeout and evaluate readiness including Linear availability | src/commands/pr-closeout.test.ts:501 | harness pr-closeout claim builder path via buildCloseoutClaims | n/a (CLI/output contract) | Must-have | Pass |
| Emit claim-level blocker details for unavailable Linear mutation path | src/lib/pr-closeout/claim-builders.ts:245 | linear_tracker_state_aligned claim with blockerClass/evidenceRef | n/a (CLI/output contract) | Must-have | Pass |
| Audit repeated-steering closure inventory with evidence + metadata completeness | src/lib/feedback-loop-audit.ts:258 | buildFeedbackLoopAudit machine-readable report | n/a (CLI/output contract) | Should-have | Pass |

### Findings

#### Critical (Must Fix)
1. None.

#### Warnings (Should Fix)
1. None.

#### Observations
1. Contract brittleness by fixed cardinality -- src/lib/feedback-loop-audit.ts:100 -- The audit is intentionally deterministic through hard-coded expected counts (19/5/7). This is fail-safe (prevents false success) but will require synchronized updates when index inventory evolves. Recommendation: keep this coupling documented and ensure index evolution always ships with expectation updates and regression tests.

### What's Working Well
- Linear mutation unavailability now flows into claim status, blocker classification, and next action in machine-readable output (blocked and unknown paths are both tested).
- The closeout path explicitly avoids false-ready outcomes when Linear mutation is unavailable (mergeable: false and non-ready status in tests).
- Feedback-loop audit now verifies both closure evidence and actionable metadata completeness for gaps and recommendations, improving future-agent determinism.

### Score
- 3/3 high-priority capabilities are agent-accessible
- Verdict: PASS

### Accountability Receipt
- status: completed
- artifact_paths: artifacts/reviews/pr-322-final-agent-native.md
- manifest_path: n/a (single-review artifact task; no manifest path was provided by coordinator contract)
- findings: no material defects; 1 low-risk observation
- failures_or_blockers: none
- improvement_opportunities: document/update fixed-count coupling workflow for feedback-loop index evolution
- strengths: clear lane separation, explicit blocker projection, strong regression coverage for unknown/blocked semantics
- validation_evidence:
  - Command: git diff -- src/commands/pr-closeout.test.ts src/lib/pr-closeout/claim-builders.ts src/lib/feedback-loop-audit.ts src/lib/feedback-loop-audit.test.ts
  - Evidence: reviewed changed hunks and corresponding assertion coverage for linear mutation and feedback-loop closure checks
- next_action: coordinator can treat this lane as PASS and proceed with final synthesis

WROTE: artifacts/reviews/pr-322-final-agent-native.md
