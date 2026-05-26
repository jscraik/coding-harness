## Agent-Native Architecture Review

### Summary
This slice updates closeout evidence classification so required CI checks drive merge readiness with explicit terminal, blocked, and unknown outcomes. Agent integration already exists in the closeout contract builder (buildCloseoutClaims) and verifier tests, and this change improves parity: agents can now make the same required-vs-optional CI readiness call a human reviewer would make from GitHub conclusions, without hidden manual interpretation.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Inspect PR check conclusions (required vs optional) | GitHub PR checks (external), mapped in closeout evidence logic | buildCloseoutClaims via buildTestsPassedClaim + buildCiGreenClaim | Yes (closeout claims are first-class verifier outputs) | Must have | Covered |
| Decide closeout status for non-success required checks (NEUTRAL/SKIPPED) | Closeout workflow state machine | isPassingCheck + claim status blocked | Yes | Must have | Covered |
| Keep optional check noise from blocking merge readiness | Closeout workflow state machine | Required-check filtering in checkClaimOptions and claim builders | Yes | Should have | Covered |
| Distinguish terminal required-check failures (CANCELLED/TIMED_OUT) | Closeout workflow state machine | isFailedCheck + claim status fail | Yes | Must have | Covered |
| Track required-check freshness against head SHA | Closeout evidence freshness claim | required_checks_match_current_head claim builder | Yes | Must have | Covered |
| Require Linear alignment evidence | PR metadata/body and tracker alignment | hasLinearReference + linear_tracker_state_aligned claim | Yes | Should have | Covered |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
None.

#### Observations
1. **Formatter drift in touched file** -- src/lib/pr-closeout/evidence.ts:20 has an extra indentation before export function isPassingCheck. This is non-functional but worth normalizing in a housekeeping pass to reduce noisy diffs.
2. **Context boundary remains intentionally heuristic for Linear** -- src/lib/pr-closeout/claim-builders.ts:244-258 still treats Linear alignment as PR-body reference presence, not live tracker state. This is consistent with existing contract but remains a known precision limit, not a regression from this slice.

### What's Working Well
- Required-check semantics are now explicit and test-backed for ambiguous (NEUTRAL, SKIPPED) and terminal (CANCELLED, TIMED_OUT) states.
- Claim freshness and head-SHA coupling remain preserved through required_checks_match_current_head, reducing stale-closeout risk for both users and agents.
- The added tests at src/lib/pr-closeout.test.ts:1171-1333 provide direct behavioral proof for agent-operable closeout decisions.

### Score
- **5/5 high-priority capabilities are agent-accessible**
- **Verdict:** PASS
