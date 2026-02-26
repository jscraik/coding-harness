---
status: complete
resolved_date: 2026-02-26
incorporated_in_plan: docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md
priority: p2
issue_id: "033"
tags: [code-review, security, governance, metrics]
dependencies: ["030"]
---

# Harden promotion gate against causality-classification gaming

The promotion logic can be influenced by delayed or downgraded causality labels unless stricter governance rules are added.

## Problem Statement
If incidents remain `automation_possible`/`unknown` without strict SLA handling, promotion outcomes may be optimistic before causality is resolved.

## Findings
- Plan includes causality taxonomy and a hard gate only for `automation_confirmed` high-risk incidents.
- Security review flagged potential gaming/delay risk for unresolved classifications.

## Proposed Solutions
### Option 1: Add unresolved-causality hold rule
**Approach:** Promotion is blocked when high-severity incidents are unresolved beyond SLA or downgraded without secondary review.
**Pros:** Stronger governance and auditability.
**Cons:** Slightly slower promotion decisions.
**Effort:** 1-2 hours
**Risk:** Low

### Option 2: Keep current rule set
**Approach:** Only block on confirmed causality.
**Pros:** Faster decisions.
**Cons:** Higher governance risk.
**Effort:** 0 hours
**Risk:** Medium

## Recommended Action
Use Option 1.

## Technical Details
- Add acceptance criterion for unresolved-causality hold.
- Require timestamped reviewer identity for causality downgrades.

## Resources
- Plan sections: incident classification model and evaluator rules.

## Acceptance Criteria
- [x] Promotion gate blocks if unresolved high-severity incidents exceed SLA.
- [x] Causality downgrades require dual-review and audit trail.
- [x] Evaluator output includes unresolved-incident count and SLA status.

## Work Log
### 2026-02-25 - Initial Discovery
**By:** Codex
**Actions:** Captured governance risk from security review findings.

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
- Unresolved high-severity causality states need hard hold rules to prevent optimistic promotion.

## Notes
P2 risk-management improvement.
