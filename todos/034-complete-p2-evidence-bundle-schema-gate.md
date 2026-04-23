---
status: complete
resolved_date: 2026-02-26
incorporated_in_plan: docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md
priority: p2
issue_id: "034"
tags: [code-review, architecture, quality, observability]
dependencies: ["028"]
---

# Add canonical schema validation for evidence bundle artifacts

The plan requires a SHA-bound evidence bundle but does not define a strict schema/version validation gate.

## Problem Statement
Without canonical schema checks, artifact format drift can silently break evaluators and promotion logic.

## Findings
- Evidence bundle is required in acceptance criteria.
- Artifact paths are listed, but no JSON schema/version gate is defined.
- Agent-native review flagged missing schema gate as P2.

## Proposed Solutions
### Option 1: Define schema contracts and validation command
**Approach:** Add versioned JSON schema for each artifact type and require validation in quality gates.
**Pros:** Strong compatibility guarantees.
**Cons:** Requires schema maintenance.
**Effort:** 2-3 hours
**Risk:** Low

### Option 2: Keep best-effort parsing
**Approach:** Defer schema formalization.
**Pros:** Lower immediate overhead.
**Cons:** Higher drift and breakage risk.
**Effort:** 0.5 hour
**Risk:** Medium

## Recommended Action
Use Option 1.

## Technical Details
- Candidate schemas: remediation-events, rollback-events, incidents, evaluator-output.
- Add explicit `schemaVersion` field and compatibility policy.

## Resources
- Plan sections: data collection methods, evaluator contract, acceptance criteria.

## Acceptance Criteria
- [x] All required pilot artifacts have schema definitions.
- [x] `schemaVersion` is mandatory in each artifact.
- [x] Quality gates require schema validation to pass.
- [x] Evaluator fails closed on unknown/invalid schema versions.

## Work Log
### 2026-02-25 - Initial Discovery
**By:** Codex
**Actions:** Converted evidence-schema gap into actionable todo.

### 2026-02-26 - Completed
**By:** Codex
**Actions:** Resolved all acceptance criteria in the v1 pilot plan and marked TODO as complete.

### 2026-02-26 - Approved for Work
**By:** Codex Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

**Learnings:**
- Versioned schema validation is required to keep evaluator artifacts stable over time.

## Notes
P2 integration robustness item.
