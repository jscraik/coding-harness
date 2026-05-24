# coding-harness — Robust Linear Triage System
**Date:** 2026-04-08  
**Scope:** `coding-harness` project only  
**Source inputs:** live Linear project state + archived strategy artifacts
**Goal:** deterministic, dependency-aware triage that minimizes thrash and maximizes throughput

## Table of Contents
- [Live Snapshot](#live-snapshot)
- [Operating Rules](#operating-rules)
- [Scoring Model](#scoring-model)
- [Lane Model](#lane-model)
- [Outstanding Issue Inventory](#outstanding-issue-inventory)
- [Recommended Execution Sequence](#recommended-execution-sequence)
- [Cycle Cadence](#cycle-cadence)
- [Triage Checklist](#triage-checklist)

## Live Snapshot

- Open issues (not `Done`, not `Canceled`, not `Duplicate`): **30**
- Status distribution:
  - `In Progress`: **3**
  - `In Review`: **0**
  - `Todo`: **0**
  - `Triage`: **23**
  - `Backlog`: **4**
- `Blocked` label count: **0**
- Current cycle: **Cycle 1**, ends **2026-04-12**

## Operating Rules

1. **Finish before start**: keep active WIP small, finish `In Progress` before pulling from `Triage`.
2. **Linear-first traceability**: every started issue must keep one current progress thread and PR metadata aligned to the same `JSC-*` key (`Refs JSC-*`).
3. **Dependency-first ordering**: unblock foundation issues before follow-on refinements.
4. **No bucket drift**: only `Triage`, `Backlog`, `In Progress`, `In Review`, `Done` are valid flow states here unless explicitly blocked.
5. **Cycle realism**: only move work into active cycle if it can plausibly finish within the cycle window.

## Scoring Model

Use a weighted score per issue to rank pull order inside each lane.

`score = (3 x impact) + (3 x unblock_value) + (2 x urgency) + (1 x confidence) - (2 x effort)`

Scale each input 1-5:
- `impact`: user/business value if completed
- `unblock_value`: how much downstream work this unlocks
- `urgency`: risk of delay (stability, security, adoption)
- `confidence`: clarity of scope and acceptance criteria
- `effort`: estimated implementation cost/complexity

Interpretation:
- `13+`: pull now
- `10-12`: next pull in-lane
- `7-9`: keep triaged, not active yet
- `<=6`: backlog or re-scope

## Lane Model

### Lane A — Active Stabilization
Purpose: complete currently active work and remove immediate friction.
WIP limit: **3 total**

### Lane B — Adoption Path
Purpose: first-run value and user-facing clarity from `init` to safe usage.
WIP limit: **2**

### Lane C — Architecture and Policy Foundations
Purpose: core contract/policy chain and extension architecture.
WIP limit: **2**

### Lane D — Security and Trust Posture
Purpose: least privilege, OSPS/SLSA, secure-deployment posture.
WIP limit: **1-2**

### Lane E — Instruction and Docs Surface Efficiency
Purpose: reduce agent/human cognitive load and documentation sprawl.
WIP limit: **1**

### Lane F — Deferred Enhancements
Purpose: non-blocking improvements parked in backlog until dependencies land.
WIP limit: **0** (pull only when prerequisite complete)

## Outstanding Issue Inventory

### Lane A — Active Stabilization (current active work)
| Key | Status | Priority | Theme |
|---|---|---|---|
| JSC-123 | In Progress | High | Contract authoring ergonomics |
| JSC-127 | In Progress | High | Zero-config first-run check |
| JSC-96 | In Progress | Medium | Setup check hardening for legacy manifests |

### Lane B — Adoption Path
| Key | Status | Priority | Notes |
|---|---|---|---|
| JSC-126 | Triage | High | Depends on first-run value path |
| JSC-124 | Triage | High | Lite-mode profile for small teams |
| JSC-120 | Triage | High | CLI taxonomy redesign |
| JSC-121 | Triage | Medium | Vocabulary simplification |
| JSC-106 | Triage | Medium | `init` scaffold split |

### Lane C — Architecture and Policy Foundations
| Key | Status | Priority | Notes |
|---|---|---|---|
| JSC-131 | Triage | High | Core policy chain contract |
| JSC-134 | Triage | High | `contextCompact` policy schema |
| JSC-135 | Triage | High | Gate pre/post extension points |
| JSC-108 | Triage | High | Workflow-contract hardening |
| JSC-130 | Triage | High | Dogfood silent-error in CI |
| JSC-132 | Triage | High | Replay trace normalization |
| JSC-104 | Triage | High | `ci-migrate` subsystem refactor |
| JSC-109 | Triage | Medium | Pilot evaluate clarification |
| JSC-87 | Triage | High | Repo-local verify-work/governance defaults |

### Lane D — Security and Trust Posture
| Key | Status | Priority | Notes |
|---|---|---|---|
| JSC-115 | Triage | High | GitHub Actions least privilege |
| JSC-112 | Triage | High | OSPS baseline + Scorecard |
| JSC-114 | Triage | Medium | SLSA roadmap |
| JSC-116 | Triage | Medium | Secure-by-design + deployment posture |
| JSC-107 | Triage | Medium | Trust artifacts/examples |

### Lane E — Instruction and Docs Surface Efficiency
| Key | Status | Priority | Notes |
|---|---|---|---|
| JSC-125 | Triage | High | Canonical cross-agent instruction source |
| JSC-122 | Triage | High | Progressive docs/instruction layering |
| JSC-128 | Triage | High | Separate repo docs vs governance refs |
| JSC-129 | Triage | High | Compress repo-facing instruction surface |

### Lane F — Deferred Enhancements (Backlog)
| Key | Status | Priority | Pull condition |
|---|---|---|---|
| JSC-156 | Backlog | Unset | Pull after `init` architecture settles |
| JSC-157 | Backlog | Unset | Pull after baseline update-path hardening |
| JSC-158 | Backlog | Unset | Pull after policy chain (`JSC-131`) stabilizes |
| JSC-159 | Backlog | Unset | Pull after `ci-migrate` refactor (`JSC-104`) |

## Recommended Execution Sequence

### Wave 0 — Close current active work (cycle-critical)
1. JSC-123
2. JSC-127
3. JSC-96

### Wave 1 — Adoption path with minimal context switching
1. JSC-126
2. JSC-124
3. JSC-120
4. JSC-121
5. JSC-106

### Wave 2 — Foundation chain (dependency-aware)
1. JSC-131
2. JSC-134
3. JSC-135
4. JSC-108
5. JSC-130
6. JSC-132
7. JSC-104
8. JSC-87
9. JSC-109

### Wave 3 — Security/trust hardening
1. JSC-115
2. JSC-112
3. JSC-114
4. JSC-116
5. JSC-107

### Wave 4 — Instruction/doc compression
1. JSC-125
2. JSC-122
3. JSC-128
4. JSC-129

### Wave 5 — Deferred backlog enhancements
1. JSC-157
2. JSC-156
3. JSC-159
4. JSC-158

## Cycle Cadence

Run this triage loop every 2-3 days during active cycles:

1. Pull open issue snapshot by status.
2. Recompute score for only top 10 triaged issues.
3. Enforce lane WIP caps before moving new work to `In Progress`.
4. Move at most 2 issues from `Triage` to `In Progress` per review.
5. Confirm each active issue has:
   - linked branch name containing one `JSC-*` key
   - PR reference using `Refs JSC-*` when PR exists
   - one current progress note

## Triage Checklist

Use this per issue before changing status:

- Is the problem statement specific and testable?
- Does it duplicate an open issue in the same lane?
- Does it unblock higher-value follow-on work?
- Is acceptance criteria concrete enough for one agent pass?
- Is the issue correctly labeled (`Bug`, `Feature`, `Improvement`, `Policy`, `Security`, etc.)?
- Should it stay `Backlog` until a prerequisite lands?

If any answer is “no”, keep it in `Triage` and tighten the issue before pulling.
