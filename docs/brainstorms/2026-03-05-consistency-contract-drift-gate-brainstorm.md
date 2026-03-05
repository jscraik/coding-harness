---
date: 2026-03-05
topic: consistency-contract-drift-gate
---

# Consistency Contract + Drift Gate (Advisory-First)

## Table of Contents
- [What We're Building](#what-were-building)
- [Why This Approach](#why-this-approach)
- [Key Decisions](#key-decisions)
- [Open Questions](#open-questions)
- [Resolved Questions](#resolved-questions)
- [Next Steps](#next-steps)

## What We're Building
A focused reliability improvement that reduces contradiction and drift across the highest-impact governance surfaces in this repository. The intent is to establish one canonical source of truth for selected artifacts (command surface documentation, status narrative, todo lifecycle signaling, and quality score metadata) and continuously detect divergence before it compounds.

This is an MVP guardrail, not a full platform refactor. The goal is to make repo truth legible and consistent for contributors and reviewers in a short 4–6 week window.

## Why This Approach
This approach is the best fit for the stated success metric: zero contradictions in core governance surfaces. It prioritizes clarity and trust over breadth, applies YAGNI by avoiding a full architecture rewrite, and starts in advisory mode to reduce rollout friction while still producing measurable drift signals.

Alternative paths (CLI-first restructuring or broad governance unification) have value but are either too narrow for cross-surface coherence or too large for the desired time horizon.

## Key Decisions
- Scope is **MVP guardrails** over a limited set of high-impact truth surfaces.
- Success is defined as **zero contradictions** in those surfaces.
- Enforcement starts **advisory-first**, with a later option to harden to blocking once signal quality is stable.
- This effort optimizes **consistency and trust** first; deeper architecture debt can follow as a separate initiative.

## Open Questions
- None for this MVP definition.

## Resolved Questions
- Primary focus: build a **truth engine** for canonical consistency.
- Near-term win condition: **zero contradictions** in core surfaces.
- Initial scope posture: **MVP guardrails**, not repo-wide unification.
- Initial enforcement posture: **advisory-first** rather than immediate merge blocking.

## Next Steps
Proceed to planning to define explicit acceptance criteria, surface boundaries, and rollout phases for this brainstorm.

→ /prompts:workflow-plan
