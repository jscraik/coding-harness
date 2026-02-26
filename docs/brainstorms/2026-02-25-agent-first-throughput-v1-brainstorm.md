---
date: 2026-02-25
topic: agent-first-throughput-v1
---

# Agent-First Throughput v1 Brainstorm

## Table of Contents
- [What We're Building](#what-were-building)
- [Approaches Considered](#approaches-considered)
- [Why This Approach](#why-this-approach)
- [Key Decisions](#key-decisions)
- [Resolved Questions](#resolved-questions)
- [Open Questions](#open-questions)
- [Next Steps](#next-steps)

## What We're Building
A v1 agent-first delivery slice focused on reducing PR lead time by shrinking the review/rework loop. The system should take current-head SHA-bound findings (Greptile + Codex), auto-remediate low/medium-risk findings, and keep high-risk findings human-mediated. The pilot should prioritize deterministic evidence and fast rollback safety over broad feature scope.

## Approaches Considered
### Approach A (Recommended): Deterministic Throughput Loop
Tight scope around one bottleneck (review/rework), strict SHA discipline, bounded auto-remediation, and minimal gap-case tracking.

### Approach B: Safety-First Shadow Mode
Run findings and remediation suggestions without auto-commit until confidence is high.

### Approach C: Broad Agent-First Program
Launch remediation + observability + governance + legibility upgrades as one integrated rollout.

## Why This Approach
Approach A is the shortest path to measurable throughput gains while preserving risk controls. It applies YAGNI by excluding new adapters and broad platform expansions from v1. It also composes with existing harness primitives (policy gates, rerun discipline, and evidence checks) instead of introducing a new orchestration model.

## Key Decisions
- Primary metric: PR lead time (open → merged).
- 30-day target: 35–50% reduction.
- Primary bottleneck: review/rework loop.
- Findings scope: Greptile + Codex only (v1).
- Determinism: strict current-head SHA only.
- Autonomy boundary: auto-commit for low/medium risk only.
- Rollback trigger: any high-risk incident caused by auto-remediation.
- Pilot evidence minimum: SHA-bound findings + remediation actions + rerun outcome.
- Governance: central harness/platform ownership; maintainers request exceptions.
- Rollout: two-phase (pilot 1–2 repos, then expand on gate pass).
- Out of scope: adding new finding providers in v1.
- Secondary scope allowed: minimal incident → gap-case workflow.

## Resolved Questions
- What is v1 optimizing? Throughput.
- Which KPI is the north star? PR lead time.
- How much autonomy is acceptable? Low/medium auto-commit only.
- How strict should evidence be? Current-head SHA binding only.
- What promotes pilot to scale? Improvement + rollback reliability + zero high-risk auto-commit incidents.
- What is the canonical handoff artifact? Create a focused v1 spec doc.

## Open Questions
None for brainstorming scope.

## Next Steps
Create a focused v1 spec doc, then hand off to `/prompts:workflow-plan` for implementation sequencing, acceptance tests, rollout gates, and rollback checks.
