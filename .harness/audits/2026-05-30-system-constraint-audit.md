---
date: 2026-05-30
report_type: system-constraint-audit
status: implemented
repo: coding-harness
branch: codex/jsc-363-intermediary-receipt-coverage
---

# System Constraint Audit

## Purpose

Find the current system constraint using local evidence and tie it to:

- longest queue
- highest wait time
- most frequent blocker
- highest rework area

## Current Constraint

The current system constraint is still **cross-lane closeout readiness reconciliation** (PR/CI/review/Linear evidence composition), not raw implementation throughput.

This is the highest-latency boundary for this system because the active route (`JSC-363`) reaches green implementation conditions faster than it reaches trusted merge/goal proof across all required lanes.

## Recommendations In Progress / Implemented

Execution added in this pass addresses the constraint directly: PR closeout readiness now emits a compact, cross-lane **snapshot** alongside the full report.

Implemented items:

- `src/commands/pr-closeout.ts`: added `--snapshot` output mode so `--json --snapshot` returns `pr-closeout-snapshot/v1` directly.
- `src/lib/pr-closeout/evaluator.ts`: added snapshot projection logic with lane-level status (`pr`, `checks`, `review`, `linear`, `branch`, `deliveryTruth`), stale-class tagging (`stale-ci`, `stale-pr-metadata`, `stale-review`, `stale-linear`, `stale-external`), and handoff pointers for claims requiring action.
- `src/lib/pr-closeout/types.ts`: added compact snapshot types for constraint consumption.
- `src/commands/pr-closeout/args.ts`: added explicit `--snapshot` parsing and usage text.
- `src/commands/pr-closeout.test.ts`: added regression coverage for `--json --snapshot` and stale evidence lane behavior.

Execution evidence:

- `pnpm vitest run src/commands/pr-closeout.test.ts src/lib/pr-closeout.test.ts` (pass; 99 tests)
- `bash scripts/validate-codestyle.sh --fast` (pass)
- New snapshot output verifies `pr-closeout-snapshot/v1`, `staleEvidenceClasses`, lane staleness, and actionable handoff requirements.

## Evidence Snapshot

### 1) Longest Queue

Primary queue metric: durable execution artifacts pending reconciliation.

| Queue artifact class | Count |
| --- | ---: |
| `.harness/review` | 28 |
| `.harness/specs` | 14 |
| `.harness/plan` | 14 |
| `.harness/research` | 12 |
| `.harness/media` | 11 |
| `.harness/evals` | 10 |

Interpretation: while there is large research/evidence history, the **active operational queue** that blocks slicing is `.harness/review` plus live proof-lane dependencies (`specs`/`plan`), and it is larger than any direct feature-facing implementation slice.

Supporting record:
- `.harness/active-artifacts.md` lists current active route and explicit unclaimed closeout lanes.
- `.harness/active-artifacts.md` is still anchored to `JSC-363` and shows multiple unclaimed proof lanes (`merge-readiness`, `Linear scope alignment`, `review-thread truth`, `Judge/PM readiness`, `runtime producer emission`, `delivery-truth consumption`, and `final closeout`).

### 2) Highest Wait Time

Active-route wait indicators:

- `.harness/active-artifacts.md` `Last reconciled: 2026-05-28` (this checkout’s current local reconciliation point is old relative to active execution).
- `.harness/linear/coding-harness-linear-plan.md` `Last synced: 2026-05-12` (oldest explicit live-routing snapshot in this artifact).
- `.harness/linear/2026-05-22-coding-harness-evidence-led-gap-fixes-linear-plan.md` `linear_mutation_status: confirmation_required` and destination mismatch notes since 2026-05-22.
- Active JSC entries remain live in `Triage`/`In Progress` posture in `specs` + `plan` frontmatter (for example, `2026-05-24...JSC-363`, `linear_status: Triage`).

Interpretation: the bottleneck is not first-mile coding delay; it is stale cross-lane refresh debt and unclaimed validation/closeout truth across multiple lanes.

### 3) Most Frequent Blocker

Term frequency across `.harness` markdown artifacts:

| Term | Count |
| --- | ---: |
| `blocked` | 808 |
| `blocker` | 760 |
| `rework` | 105 |
| `pending` | 108 |
| `unresolved` | 97 |
| `waiting` | 22 |
| `merge-readiness` | 13 |
| `unclaimed` | 13 |
| `reviewDecision` | 8 |
| `Linear scope alignment` | 7 |

Interpretation: the language of obstruction is not rare; it dominates near-term evidence surface and is repeated through the same proof surfaces and route artifacts.

### 4) Highest Rework Area

Concentration of blocked/rework-bearing files:

| Class | Files with blocker/rework terms |
| --- | ---: |
| `.harness/research` | 47 |
| `.harness/review` | 31 |
| `.harness/specs` | 13 |
| `.harness/plan` | 13 |
| `.harness/media` | 9 |
| `.harness/evals` | 9 |

Interpretation: research and review evidence surfaces are currently being reworked most, with `.harness/research` carrying the largest repeatability signal and `.harness/review` remaining the highest direct operations-drag class for proof-lane reconciliation.

## Constraint Cost

1. New implementation work cannot produce reliable merge-ready progress until proof lanes are refreshed.
2. Evidence composition is split across `review`, `specs`, `plan`, PR, and external states, which induces repeated handoff cost.
3. The system burns cycle on stale reconciliation debt instead of moving execution capacity into new code work.
4. The repository’s own north-star objective (`PR lead time`, `review/rework loop`) is therefore constrained by proof-lane friction, not raw function delivery.

## What Feeds the Constraint

- Unclaimed closeout truth in `.harness/active-artifacts.md`.
- Multi-lane proof requirements in `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` (PR/CI/review/Linear separation).
- Multiple stale/tracker-dependent states in the same active route (`JSC-363`).
- External-state drift surfaces noted in the local route artifacts.

## What Depends on This Constraint

- `JSC-363` lifecycle completion and acceptance.
- PR closeout and merge-readiness claims.
- Delivery-truth and route-readiness outputs.
- Any next `JSC-311` / `JSC-331` or follow-on closeout slice.
- Judge/PM readiness and final goal-completion proof.

## How to Increase Throughput

1. Stop adding new implementation-only slices until closeout lanes drain in the current active route.
2. Refresh the active route evidence bundle now: `Local PR state + review threads + Linear alignment + runtime-card input freshness + delivery-truth status` in one pass.
3. Reconcile and close proof lanes explicitly in `active-artifacts.md` before starting adjacent code work.
4. Convert repeated failure modes (same blocked terms across the same lanes) into validators/replayable checks and tests in the same modules that consume those signals.
5. Keep work scoped to `JSC-363` closeout completion and gate-typing so throughput gains show up as reduced re-opened review/closeout work, not as raw file edits.

## Detailed Next Steps

1. **Drain closeout queue first (Priority 1):**
   - Capture and classify current PR/check/review/Linear states with concrete evidence.
   - Update `.harness/active-artifacts.md` only once truth is current.
2. **Run focused parity/validation checks (Priority 1):**
   - `bash scripts/check-goal-board.py .harness/active-artifacts.md docs/goals/...` (as documented in the goal).
   - `bash scripts/verify-work.sh --fast` and any gate checks required by touched lanes.
3. **Normalize blockers (Priority 2):**
   - For each top blocker class (`blocked`, `merge-readiness`, `Linear scope alignment`), add deterministic classification in the shortest owning module or command.
4. **Close out unclaimed lanes before expand scope (Priority 2):**
   - Explicitly mark `merge-readiness`, `Judge/PM readiness`, `review-thread truth`, and `runtime producer emission` as either **allowed exceptions** or **proven ready** with references.
5. **Only then resume adjacent implementation (Priority 3):**
   - New implementation slices only after a fresh merged/clean lane snapshot and no unclaimed closeout lanes remain.

## Do Not Optimize Non-Constraints

- Do not add new feature slices that do not reduce closeout queue length.
- Do not reduce work by skipping independent proof lanes.
- Do not optimize `specs`/`review` churn by adding prose layers; convert recurring churn into guardrails.
