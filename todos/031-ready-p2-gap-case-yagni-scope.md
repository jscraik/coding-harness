---
status: complete
resolved_date: 2026-02-26
incorporated_in_plan: docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md
priority: p2
issue_id: "031"
tags: [code-review, simplicity, yagni, scope]
dependencies: []
---

# Reduce gap-case v1 scope to minimal execution slice

The documented “minimal” gap-case workflow still includes relatively heavy policy/state concerns for first rollout.

## Problem Statement
Over-scoped v1 risk: more implementation surface, slower delivery, and more failure modes before proving throughput value.

## Findings
- Gap-case section includes many flags, SLA knobs, history transitions, and store concerns.
- Simplicity review flagged this as likely YAGNI for v1.
- Primary pilot objective is PR lead-time throughput, not full incident platform capability.

## Proposed Solutions
### Option 1: Trim v1 to strict open/resolve + essential fields
**Approach:** Keep only core fields and append-only record model; defer SLA/reopen/history enhancements.
**Pros:** Faster, safer pilot.
**Cons:** Fewer management features initially.
**Effort:** 2-3 hours (plan reduction)
**Risk:** Low

### Option 2: Keep current design
**Approach:** Implement complete drafted model now.
**Pros:** Fewer future schema changes.
**Cons:** More complexity and delivery risk.
**Effort:** 6-10 hours extra
**Risk:** Medium

## Recommended Action
Use Option 1.

## Technical Details
- Move advanced gap-case fields into “v1.1 deferred” subsection.
- Keep one minimal path aligned with deterministic remediation loop.

## Resources
- Plan sections: gap-case command model/data model, scope boundaries.

## Acceptance Criteria
- [x] v1 gap-case surface limited to open/resolve essentials.
- [x] Deferred features are explicitly listed outside v1 scope.
- [x] Implementation phases reflect trimmed scope.
- [x] Complexity reduction is reflected in test matrix.

## Work Log
### 2026-02-25 - Initial Discovery
**By:** Codex
**Actions:** Captured simplicity-review findings and translated to scope todo.

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
- Keeping v1 scope minimal reduces delivery risk and preserves throughput focus.

## Notes
P2 scope-control item.
