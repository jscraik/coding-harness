---
date: 2026-03-04
topic: symphony-harness-adoption
clients:
  - Codex App/CLI
  - Linear
---

# Symphony + Harness Engineering Adoption Brainstorm

## Table of Contents
- [What We're Building](#what-were-building)
- [Why This Approach](#why-this-approach)
- [Approaches Considered](#approaches-considered)
- [Key Decisions](#key-decisions)
- [Assumptions](#assumptions)
- [Open Questions](#open-questions)
- [Next Steps](#next-steps)

## What We're Building
Define a safe, incremental way to adopt Symphony as the orchestration layer on top of existing harness engineering in this repository. The goal is to move from ad hoc “agent operation” toward managed “work operation,” where issues are dispatched from Linear into isolated workspaces with explicit workflow policy and human handoff states.

This brainstorm is focused on scope and decision boundaries, not implementation details. We want to preserve current coding-harness governance strengths (risk gates, deterministic checks, review artifacts) while adding Symphony only where it increases throughput and operational clarity.

## Why This Approach
Recommended direction: **phased adoption with a narrow pilot**, then expansion only after measurable stability and safety confidence.

This is the best fit because Symphony is explicitly a preview/prototype pattern and expects local hardening. A phased pilot keeps blast radius small, validates policy fit against current harness controls, and avoids over-committing to workflow changes before team confidence is earned.

## Approaches Considered
### Approach A (Recommended): Phased Pilot
Start with one constrained Linear project and explicit handoff states, then scale scope after evidence.

**Pros:** Lowest risk, fastest learning loop, easy rollback.  
**Cons:** Slower path to full automation coverage.

### Approach B: Full Immediate Rollout
Adopt Symphony-driven orchestration across all suitable projects at once.

**Pros:** Maximum short-term automation coverage.  
**Cons:** High operational risk, harder incident triage, larger policy-change surface.

### Approach C: No Symphony, Keep Current Harness Only
Continue with existing harness workflows and defer orchestration adoption.

**Pros:** No new platform risk.  
**Cons:** Leaves throughput and orchestration standardization opportunities unrealized.

## Key Decisions
- Use Symphony as an **orchestration layer**, not a replacement for harness policy governance.
- Treat `WORKFLOW.md` as a **versioned policy contract** owned by the repository.
- Default to **human-review handoff states** before merge/land actions.
- Apply **least-privilege posture** for approvals, tool access, and tracker scope.
- Gate expansion on evidence: run quality, safety incidents, and review burden.

## Assumptions
- Linear remains the tracker for candidate-work polling.
- The team prefers controlled adoption over immediate broad rollout.
- Existing `pnpm check` and governance gates remain mandatory after orchestration adoption.

## Open Questions
- Which Linear project should be the initial pilot scope?
- What exact success threshold should trigger expansion (for example: stability period, pass rate, review load)?
- Which operations should remain human-only in phase 1 (for example: merge/land, status transitions, both)?

## Next Steps
→ Run `/workflows:plan` to produce an implementation plan with phased rollout, acceptance criteria, validation gates, rollback criteria, and ownership.
