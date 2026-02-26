---
status: complete
resolved_date: 2026-02-26
incorporated_in_plan: docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md
priority: p1
issue_id: "024"
tags: [code-review, architecture, determinism, remediation]
dependencies: []
---

# Resolve SHA invariant drift in pilot plan

The plan mixes two different invariants for remediation eligibility: exact current-head SHA match and ancestry-based acceptance. This ambiguity can produce non-deterministic behavior and weakens the core safety claim.

## Problem Statement
The v1 plan promises strict current-head SHA discipline, but multiple sections still describe or test ancestry behavior. If uncorrected, implementation may auto-remediate findings that are not from the exact decision head.

## Findings
- Exact-match invariant is stated in research/criteria sections.
- Integration scenarios still reference stale/ancestry behavior as acceptable.
- Agent reports flagged this as a P1 architecture mismatch.
- Related known pattern: deterministic SHA-bound gating in `docs/brainstorms/2026-02-24-code-factory-remediation-gap-loop-brainstorm.md`.

## Proposed Solutions
### Option 1: Canonical invariant block + global replacement
**Approach:** Add one canonical invariant statement and update all conflicting lines to exact-match language.
**Pros:** Fastest, lowest risk, removes ambiguity.
**Cons:** Requires careful sweep of all scenarios/tests text.
**Effort:** 1-2 hours
**Risk:** Low

### Option 2: Dual-mode model (exact + ancestry)
**Approach:** Keep both modes and document mode-specific behavior.
**Pros:** Flexible for future use cases.
**Cons:** Adds complexity and weakens v1 deterministic scope.
**Effort:** 3-5 hours
**Risk:** Medium

## Recommended Action
Use Option 1. v1 should be exact-match only.

## Technical Details
- Affected file: [docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md](../docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md)
- Sections to normalize: research insights, integration scenarios, acceptance criteria.

## Resources
- Plan under review: [docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md](../docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md)
- Related brainstorm: [docs/brainstorms/2026-02-24-code-factory-remediation-gap-loop-brainstorm.md](../docs/brainstorms/2026-02-24-code-factory-remediation-gap-loop-brainstorm.md)

## Acceptance Criteria
- [x] Plan defines one canonical SHA invariant for v1.
- [x] No section implies ancestry-based auto-remediation in v1.
- [x] Integration test scenarios align with exact-match behavior.
- [x] Review checklist confirms consistency across all sections.

## Work Log
### 2026-02-25 - Initial Discovery
**By:** Codex
**Actions:** Identified contradictory SHA invariants during multi-agent review.

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
- Deterministic exact-head SHA gating is critical to prevent stale-context remediation.

## Notes
This is merge-blocking because it can directly change safety behavior.
