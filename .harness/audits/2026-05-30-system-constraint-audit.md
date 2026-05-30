---
date: 2026-05-30
report_type: system-constraint-audit
status: in_progress
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
| `.harness/review` | 40 |
| `.harness/specs` | 14 |
| `.harness/plan` | 14 |
| `.harness/research` | 28 |
| `.harness/media` | 11 |
| `.harness/evals` | 10 |

Interpretation: measured by tracked file count in each queue class, the largest operational queue remains `.harness/review` (40 files), with `specs`/`plan` each at 14, while research/evidence classes still add breadth through repeated closure references.

Supporting record:
- `.harness/active-artifacts.md` lists current active route and explicit unclaimed closeout lanes.
- `.harness/active-artifacts.md` is still anchored to `JSC-363` and shows multiple unclaimed proof lanes (`merge-readiness`, `Linear scope alignment`, `review-thread truth`, `Judge/PM readiness`, `runtime producer emission`, `delivery-truth consumption`, and `final closeout`).

### 2) Highest Wait Time

Active-route wait indicators:

- `.harness/active-artifacts.md` `Last reconciled: 2026-05-30` (this checkout’s local reconciliation point is fresh for closeout capture, but gate checks are still pending).
- `.harness/linear/coding-harness-linear-plan.md` `Last synced: 2026-05-12` (oldest explicit live-routing snapshot in this artifact).
- `.harness/linear/2026-05-22-coding-harness-evidence-led-gap-fixes-linear-plan.md` `linear_mutation_status: confirmation_required` and destination mismatch notes since 2026-05-22.
- Active JSC entries remain live in `Triage`/`In Progress` posture in `specs` + `plan` frontmatter (for example, `2026-05-24...JSC-363`, `linear_status: Triage`).

Interpretation: the bottleneck is not first-mile coding delay; it is stale cross-lane refresh debt and unclaimed validation/closeout truth across multiple lanes.

### 3) Most Frequent Blocker

Term frequency across `.harness` markdown artifacts:

| Term | Count |
| --- | ---: |
| `blocked` | 753 |
| `blocker` | 489 |
| `rework` | 115 |
| `pending` | 84 |
| `unresolved` | 96 |
| `waiting` | 27 |
| `merge-readiness` | 15 |
| `unclaimed` | 13 |
| `reviewDecision` | 8 |
| `Linear scope alignment` | 8 |

Interpretation: the language of obstruction is not rare; it dominates near-term evidence surface and is repeated through the same proof surfaces and route artifacts.

### 4) Highest Rework Area

Concentration of blocker/rework-risk artifact files in tracked `.harness` markdown:

| Class | Files with blocker/rework terms |
| --- | ---: |
| `.harness/research` | 31 |
| `.harness/review` | 29 |
| `.harness/specs` | 13 |
| `.harness/plan` | 13 |
| `.harness/media` | 11 |
| `.harness/evals` | 9 |

Interpretation: `.harness/research` has the largest blocker/rework footprint, while `specs` and `plan` remain tightly coupled and jointly account for a large shared rework surface.

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
   - ✅ Done: refreshed closeout capture in `.harness/active-artifacts.md` with latest PR/CI/review-thread truth and explicit blocked lanes (`merge-readiness`, `Linear scope alignment`, `Judge/PM readiness`, `runtime producer emission`, `delivery-truth consumption`).
   - ✅ Done: set `Last reconciled` to `2026-05-30` in `.harness/active-artifacts.md` and carried the same date into this audit snapshot.
2. **Run focused parity/validation checks (Priority 1):**
   - `bash scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit` (or `python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit`): executed and failed on `receipt.head_sha` mismatch (`bf38426eb...` vs current `6de9e3b7...`), so this closeout lane remains blocked until receipts/head is synchronized.
   - `bash scripts/verify-work.sh --fast`: passed docs lint after report formatting fixes, then re-run end-to-end to confirm all gates still pass on a clean command path.
   - Next step: rerun both checks after receipt head correction and ensure both report pass before any new implementation slice.
3. **Normalize blockers (Priority 2):**
   - Deterministic classification for top blocker classes is now represented in the closeout/snapshot path: `blocked` and proof-lane class flags (`merge-readiness`, `Linear scope alignment`) are surfaced in the PR closeout snapshot command and routed through active-artifacts closeout text.
4. **Close out unclaimed lanes before expand scope (Priority 2):**
   - Current status is explicit `blocked`/`not ready` with references for those lanes in `.harness/active-artifacts.md`; no unclaimed-lane truth was left unclassified in this session.
5. **Only then resume adjacent implementation (Priority 3):**
   - Hold implementation expansion until gate checks are re-run with full command allowance, closeout lanes are fully claimed, and a rerun of `pr-closeout --json --snapshot` confirms stable lane classes.

## Do Not Optimize Non-Constraints

- Do not add new feature slices that do not reduce closeout queue length.
- Do not reduce work by skipping independent proof lanes.
- Do not optimize `specs`/`review` churn by adding prose layers; convert recurring churn into guardrails.
