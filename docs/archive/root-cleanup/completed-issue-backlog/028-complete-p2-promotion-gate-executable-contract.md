---
status: complete
resolved_date: 2026-02-26
incorporated_in_plan: docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md
priority: p2
issue_id: "028"
tags: [code-review, architecture, agent-native, metrics]
dependencies: ["024", "026"]
---

# Define executable promotion-gate component contract

The plan includes promotion gate rules and an example JSON output, but does not define the concrete command/module that agents run to compute that decision.

## Problem Statement
Without a named executable interface, the gate can drift into ad-hoc/manual evaluation and lose reproducibility.

## Findings
- Evaluator output contract is described in the plan.
- Coverage gaps still acknowledge missing explicit evaluator command/output path.
- Agent-native review flagged this as important for execution-loop completeness.

## Proposed Solutions
### Option 1: Introduce explicit `pilot-evaluate` command contract in plan
**Approach:** Add command name, inputs, outputs, exit codes, and required artifacts.
**Pros:** Machine-executable and testable.
**Cons:** Slightly increases upfront specificity.
**Effort:** 1-2 hours
**Risk:** Low

### Option 2: Keep evaluator conceptual
**Approach:** Defer command naming to implementation.
**Pros:** Flexible.
**Cons:** Higher drift risk.
**Effort:** 0.5 hour
**Risk:** Medium

## Recommended Action
Use Option 1.

## Technical Details
- Add explicit interface in Phase 4 deliverables.
- Include expected schema versioning and deterministic output for promote/hold/rollback.

## Resources
- Plan section: Promotion gate evaluator contract and phase 4.

## Acceptance Criteria
- [x] Plan names the evaluator command/module.
- [x] Inputs/outputs/exit codes are defined.
- [x] Schema version for evaluator payload is explicit.
- [x] Quality gates include evaluator test scenarios.

## Work Log
### 2026-02-25 - Initial Discovery
**By:** Codex
**Actions:** Consolidated architecture + agent-native findings.

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
- Promotion decisions require a single executable contract to remain reproducible.

## Notes
P2 architectural completeness item.
