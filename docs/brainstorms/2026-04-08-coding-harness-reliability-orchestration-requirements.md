---
schema_version: 1
title: Coding Harness Reliability Orchestration Requirements
date: 2026-04-08
status: draft
spec_required: full
risk_level: medium
complexity: large
---

# Coding Harness Reliability Orchestration Requirements

## Table of Contents
- [Problem Frame](#problem-frame)
- [Brainstorm Summary](#brainstorm-summary)
- [Approaches Considered](#approaches-considered)
- [Recommendation](#recommendation)
- [Requirements](#requirements)
- [Success Criteria](#success-criteria)
- [Scope Boundaries](#scope-boundaries)
- [Key Decisions](#key-decisions)
- [Dependencies and Assumptions](#dependencies-and-assumptions)
- [Outstanding Questions](#outstanding-questions)
- [Next Steps](#next-steps)

## Problem Frame
`coding-harness` reliability bottlenecks are concentrated in gate orchestration and control-plane consistency, not missing features. Repeated failures are dominated by coordination drift (Linear key mismatch, check-name mismatch) and expensive recovery loops (restart-from-zero verification after one failed gate). The goal is to make verification deterministic, resumable, and contract-driven without weakening fail-closed governance.

## Brainstorm Summary
What to build:
- A reliability-focused verification orchestration layer for `scripts/verify-work.sh` and related command surfaces (`doctor`, `linear-gate`).
- A single-source contract model for required checks and gate identity so docs, doctor checks, and CI contexts cannot drift independently.
- A retry policy that distinguishes transient infrastructure failures from contract failures.

Why this matters:
- Improves developer and agent throughput by reducing unnecessary full reruns.
- Preserves strict governance while reducing false alarms and avoidable toil.
- Makes CI and local verification outcomes more predictable and explainable.

## Approaches Considered

### Approach A: Minimal Incremental Hardening
Description:
Keep current script-centric flow and add narrow patches: a small retry helper, a basic resume flag in `verify-work.sh`, and incremental doctor messaging updates. This minimizes immediate change surface and can ship quickly.

Pros:
- Lowest short-term change risk.
- Fastest to ship initial improvements.
- Minimal disruption to existing workflows.

Cons:
- Keeps orchestration logic fragmented across scripts and docs.
- Higher long-term maintenance cost due to ad hoc additions.
- Drift risk remains because source-of-truth boundaries stay blurry.

Key risks or unknowns:
- Resume semantics may become inconsistent across gates.
- Future changes may regress reliability because there is no explicit execution model.

Best suited when:
- Immediate relief is needed and large structural work is temporarily blocked.

### Approach B: Contract-Driven Reliability Layer (Recommended)
Description:
Define explicit gate identities, dependency classes, and failure categories as a shared contract consumed by `verify-work`, `doctor`, and docs. Implement a deterministic execution engine with safe read-only parallelism, serial mutating phases, resumable run-state, and classified retry behavior.

Pros:
- Directly targets root causes of coordination drift and rerun overhead.
- Improves correctness and throughput together.
- Creates durable governance surfaces that can scale to new gates.

Cons:
- Medium-to-large initial implementation scope.
- Requires careful migration to avoid temporary confusion across scripts/docs.

Key risks or unknowns:
- Contract ownership and change control must be explicit.
- Rollout sequencing must avoid conflicting sources during transition.

Best suited when:
- Reliability and governance consistency are priority outcomes, not just local speedups.

### Approach C: Full Workflow Runtime Re-platform
Description:
Replace shell-first verification orchestration with a dedicated CLI runtime immediately, including full run graph execution, persistence, telemetry, and policy controls. Treat scripts as thin wrappers only.

Pros:
- Maximum long-term flexibility.
- Strongest foundation for future advanced orchestration.

Cons:
- Highest delivery risk and migration overhead.
- Likely over-scoped for the current reliability problem set.
- Slower time to user-visible improvement.

Key risks or unknowns:
- Potential disruption of existing downstream harness-managed repos.
- Larger behavior-change surface increases rollout complexity.

Best suited when:
- A broader platform rewrite is already approved and funded.

## Recommendation
Choose Approach B.

Reasoning:
- It addresses the current failure modes directly (coordination drift and rerun tax).
- It avoids the fragility of incremental patchwork while staying smaller than a full re-platform.
- It aligns with existing repo contracts (`pr-pipeline` naming, `linear-gate` requirements, doctor alignment checks) and can be phased safely.

## Requirements

**Contract and Identity**
- R1. Define one canonical gate-contract source for gate IDs, required check names, and failure classes used by `verify-work`, `doctor`, and CI/check documentation.
- R2. Ensure `githubCheckName` alignment remains deterministic for CircleCI workflow-level check contexts (for example, `pr-pipeline`) and is validated from the canonical contract.

**Execution Model**
- R3. Introduce explicit gate classes for verification orchestration:
  - read-only gates that may run in bounded parallel batches
  - mutating or side-effectful gates that must run serially
- R4. Keep fail-closed semantics: first blocking failure stops forward progression and returns a non-zero exit.

**Resume Support**
- R5. Persist per-run verification state under `.harness/runs/` with stable gate outcomes and timestamps.
- R6. Support `verify-work --resume-from <gate-id>` (or equivalent) that resumes only from previously incomplete/failed points while preserving contract checks and fail-closed behavior.
- R7. Ensure resumed runs remain auditable by recording whether execution was fresh or resumed.

**Retry Classification**
- R8. Classify gate failures into at least:
  - transient infrastructure failures (eligible for bounded retries with back-off)
  - contract/policy failures (non-retryable, fail immediately)
  - unknown/internal failures (fail with explicit diagnostic status)
- R9. Restrict automatic retries to transient classes only; retries must not mask policy drift, missing required metadata, or check-name mismatches.

**Operator Feedback**
- R10. Emit clear machine-readable and human-readable gate status summaries that name the gate, failure class, and suggested next action.
- R11. Ensure `doctor` and `verify-work` messaging remains consistent for the same underlying contract violation.

**Migration Safety**
- R12. Provide a transition path where legacy script workflows continue to function while the contract-driven model is adopted, without dual-source ambiguity for gate identity.

## Success Criteria
- A single-source gate contract is referenced by `verify-work`, `doctor`, and required-check docs with no contradictory check-name guidance.
- A failing run can resume from an eligible gate without rerunning already-passing unaffected gates.
- Transient failures demonstrate bounded retry behavior; contract failures fail immediately without retry.
- Verification output makes failure category and next action explicit enough for deterministic remediation.
- Governance protections (`linear-gate`, required check naming) remain fail-closed after rollout.

## Scope Boundaries
- No prompt-cache, model-selection, or token-economics optimization work.
- No full CLI runtime re-platform in this phase.
- No weakening of policy gates, required checks, or branch-protection expectations.
- No changes to external provider contract semantics beyond alignment to canonical check identities.

## Key Decisions
- Decision: Focus on reliability orchestration and governance consistency, not model/harness internals.
  - Rationale: Current pain is operational drift and rerun inefficiency.
- Decision: Prefer contract-driven orchestration over incremental script patching.
  - Rationale: Durable reduction of drift requires a shared source of truth.
- Decision: Keep fail-closed behavior while introducing resume support and selective retry.
  - Rationale: Throughput gains must not trade off safety.
- Decision: `spec_required` is `full`.
  - Rationale: Work includes concurrency classes, resumable state, retry taxonomy, and contract migration.

## Dependencies and Assumptions
- Existing contract surfaces remain authoritative, including `.harness/ci-required-checks.json` and current doctor alignment checks.
- CircleCI workflow-level check contexts remain the branch-protection compatibility target.
- Local and CI environments continue to support current script and CLI entrypoints.

## Outstanding Questions
### Resolve Before Planning
- None.

### Deferred to Planning
- [Affects R5-R7] (Technical) Exact run-state schema and retention policy for `.harness/runs/`.
- [Affects R3-R4] (Technical) Gate inventory and mapping rules for read-only versus mutating classification.
- [Affects R8-R9] (Needs research) Standardized retry budget defaults by gate class and environment (local vs CI).
- [Affects R12] (Technical) Migration sequence that prevents temporary dual-source contract drift.

## Next Steps
- Recommended next stage: `ce-spec`.
- This requirements artifact is ready for a full spec focused on execution-state contracts, gate taxonomy, migration sequencing, and validation strategy.
