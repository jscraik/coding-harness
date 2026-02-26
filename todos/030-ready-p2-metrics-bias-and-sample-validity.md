---
status: complete
resolved_date: 2026-02-26
incorporated_in_plan: docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md
priority: p2
issue_id: "030"
tags: [code-review, metrics, performance, analytics]
dependencies: []
---

# Harden pilot metric methodology against survivorship bias

The current KPI design can bias toward successful/instrumented PRs and may be statistically weak at low sample sizes.

## Problem Statement
If failed or missing-evidence runs are excluded, lead-time improvement can be overstated. Small sample windows can also produce unstable promotion decisions.

## Findings
- Eligibility filter requires deterministic evidence bundle.
- Pilot gate uses relatively small sample threshold (`n >= 20`).
- Performance review flagged survivorship bias and weak statistical confidence controls.

## Proposed Solutions
### Option 1: Add coverage and confidence gates
**Approach:** Track total eligible attempts vs fully instrumented runs, enforce coverage threshold, and add confidence intervals/minimum sample per repo.
**Pros:** More trustworthy go/no-go decision.
**Cons:** Added analytics complexity.
**Effort:** 3-5 hours
**Risk:** Medium

### Option 2: Keep current metric rules
**Approach:** Use simple thresholds only.
**Pros:** Faster to start.
**Cons:** Higher false-positive promotion risk.
**Effort:** 0.5 hour
**Risk:** Medium-High

## Recommended Action
Use Option 1.

## Technical Details
- Add metrics:
  - instrumentation coverage ratio
  - per-repo minimum N
  - confidence interval on lead-time delta
- Add hold condition when coverage/CI quality is insufficient.

## Resources
- Plan sections: practical metric definitions, baseline windows, promotion evaluator rules.

## Acceptance Criteria
- [x] Coverage denominator metrics are defined.
- [x] Minimum sample/quality gates are explicit.
- [x] Promotion evaluator blocks on insufficient statistical confidence.
- [x] Metric definitions include treatment of missing evidence.

## Work Log
### 2026-02-25 - Initial Discovery
**By:** Codex
**Actions:** Consolidated performance-oracle concerns on bias and sample quality.

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
- Promotion metrics should include coverage and confidence controls to avoid biased decisions.

## Notes
P2 decision-quality risk.
