# Planning precedence policy

## Table of Contents

- [Purpose](#purpose)
- [Precedence model](#precedence-model)
- [Planning artifacts](#planning-artifacts)
- [Project milestone to cycle mapping](#project-milestone-to-cycle-mapping)
- [Cycle assignment rules](#cycle-assignment-rules)
- [Conflict resolution](#conflict-resolution)
- [Reporting separation](#reporting-separation)

## Purpose

This policy resolves planning ambiguity by declaring a single source-of-truth model for coding-harness issue planning. It covers when projects, milestones, and cycles are used and how they relate.

## Precedence model

**Projects + milestones are the strategic source of truth. Cycles are execution slicing windows.**

| Level | Artifact | Purpose | Scope |
| --- | --- | --- | --- |
| 1 (highest) | Project `coding-harness` | Strategic boundary: what is in scope for this repo | Stable, changes quarterly or less |
| 2 | Milestone | Target-state grouping with a deadline | Medium-term (1-6 months), progress-tracked |
| 3 | Cycle | Execution slicing window for throughput planning | Short-term (2 weeks), cadenced |
| 4 (lowest) | Issue | Atomic work unit | Task-level, state-machine driven |

Precedence rule: **when planning guidance conflicts, milestone scope wins over cycle assignment.**

## Planning artifacts

| Artifact | Location | Authority |
| --- | --- | --- |
| Project definition | Linear project `coding-harness` | Repo scope, intake rules, workflow states |
| Milestone: Gold-standard foundation (2026 H1) | Linear milestone | Strategic targets, due 2026-06-30 |
| Current cycle | Linear cycle (2-week cadence) | Throughput window, scoped by milestone |
| Recovery sequence | JSC-181 (parent issue) | Ordered execution plan |
| Linear operations control loop | JSC-190 (parent issue) | Agentic governance automation |

## Project milestone to cycle mapping

Milestones define **what** needs to be done and **by when**. Cycles define **how much** the team plans to complete in a given window.

Mapping rules:

1. Every issue in the active cycle must belong to the active milestone (or be explicitly cross-milestone).
2. Cycle scope is derived by selecting the highest-priority milestone issues that fit the throughput window.
3. Issues may be in the milestone without being in the current cycle (backlog, triage, future work).
4. Issues must not be in the current cycle without milestone membership unless they are triage candidates being evaluated.

### Visual model

```
Milestone (strategic)          Cycle (execution)
┌─────────────────────┐      ┌───────────────┐
│  Gold-standard (H1) │──────│  Cycle N      │  ← pulls from milestone
│  ┌───┐ ┌───┐ ┌───┐  │      │  ┌───┐ ┌───┐  │
│  │ A │ │ B │ │ C │  │      │  │ A │ │ B │  │  ← active work
│  └───┘ └───┘ └───┘  │      │  └───┘ └───┘  │
│  ┌───┐ ┌───┐        │      └───────────────┘
│  │ D │ │ E │ ...    │
│  └───┘ └───┘        │      Cycle N+1
│                      │      ┌───────────────┐
│  target: 2026-06-30  │──────│  │ C │ │ D │  │  ← next window
└─────────────────────┘      └───────────────┘
```

## Cycle assignment rules

| Issue state | Cycle assignment | Rule |
| --- | --- | --- |
| Triage | Optional | Triage candidates may be unassigned from any cycle; assignment happens at promotion |
| Backlog | Ignored | Backlog issues should not be in any cycle |
| Todo | Mandatory | Must be in the current cycle before work starts |
| In Progress | Mandatory | Must be in the current cycle |
| In Review | Mandatory | Must be in the current cycle |
| Done | Preserve | Keep in the cycle where the work was completed for throughput tracking |

### Exceptions

- Parent/epic issues (JSC-181, JSC-190) span multiple cycles and should remain assigned across cycle boundaries until completed.
- Cross-milestone issues must be explicitly marked and tracked outside the standard cycle flow.

## Conflict resolution

If an issue is in a cycle but not in the active milestone:

1. Check if the issue was recently added to the milestone (sync lag).
2. If the issue genuinely belongs outside the milestone, remove it from the cycle.
3. If the issue should be in the milestone, add it.

If an issue is in the milestone but cycle throughput is full:

1. Keep the issue in the milestone (strategic scope is correct).
2. Do not add to the current cycle.
3. Promote to the next cycle when throughput allows.

## Reporting separation

### Strategic view (milestone-level)

- Milestone progress percentage
- Issue count by state across all milestone issues
- Target date proximity
- Blocked items requiring strategic decisions

### Execution view (cycle-level)

- Cycle throughput (completed vs scoped)
- In-progress WIP cap adherence
- Aging items and escalation recommendations
- Cycle burndown

### Where to find reports

- Milestone progress: Linear project view → milestone panel
- Cycle throughput: Linear cycle view
- Governance report: `harness linear governance-report` (JSC-195)
- Aging watchdog: `harness linear aging-report` (JSC-192)
