# System Constraint Audit

Date: 2026-05-30
Scope: `.harness` closeout and JSC-363 execution control-plane

## 1) Current constraint

The active system constraint is **closeout and merge-readiness rework**, not implementation throughput.

Primary signal:
- `bash scripts/verify-work.sh --fast` reports North-Star `primary bottleneck: review_rework_loop` and confirms `.harness` route truth, PR checks, lint/doc/test gates, and workflow contracts are passing.

## 2) Evidence

### Longest queue
- File-backed queue pressure is highest in `review` artifacts:
  - `review`: 40 files
  - `research`: 24 files
  - `specs`: 14 files
  - `plan`: 14 files
  - `linear`: 2 files
- This points to a control-plane/closeout constraint, not runtime implementation capacity.

### Highest wait time
- Longest wait is on open PR merge-readiness lanes:
  - `PR #320`: `MERGED` and no longer a live blocker.
  - `PR #321`: live refresh at 2026-05-30T22:39Z reports `mergeable=MERGEABLE`, `mergeStateStatus=BLOCKED`, successful `ci/circleci: check` and `ci/circleci: test`, and pending `pr-pipeline` plus `ci/circleci: orb-pinning`.
- `.harness/active-artifacts.md` repeatedly lists unclaimed closeout claims (merge-ready, Judge/PM-ready, runtime producer emission, delivery-truth consumption, Linear scope alignment), so this lane is still the live constraint.

### Most frequent blocker
- Most frequent blocker class is still **unclaimed/blocked closeout state across PR, review, and merge-readiness lanes**, now concentrated in PR #321 pending external checks, review-thread refresh, and post-rebase push truth.
- `scripts/check-goal-board.py` succeeds (with current receipt `R154`) but route truth is not the blocker anymore; closeout lanes are.

### Highest rework area
- Rework concentrates in `review` and runtime-governance-adjacent artifacts:
  - 1 open PR with unresolved merge/check/review readiness status
  - Unrefreshed or unclaimed `merge readiness`, `Linear`, `Judge/PM`, and closeout lanes in `active-artifacts` and goal state.

## 3) Cost of constraint

- Wastes context on parallel implementation while closeout truth is incomplete.
- Increases risk of “false green” assumptions from stale PR/merge metadata.
- Blocks adjacent implementation because next-slice claims require separate lane convergence.

## 4) What feeds it

- PR surface (`#321`) with pending external checks, review-state refresh, and post-rebase push truth; PR #320 is closed as merged evidence.
- Review surface with unresolved/queued review decisions and comments.
- External/Linear surface with alignment claims still unclaimed.
- Evidence plane (claims) where `merge-ready`, `delivery-truth`, and `Judge/PM-ready` remain pending.

## 5) What depends on it

- JSC-363 Worker and implementation continuation
- Merge-readiness and PR closeout claims
- Runtime producer emission evidence claims
- Delivery-truth claim support
- Goal completion/Judge/PM-ready completion

## 6) How to increase throughput

- Drain the closeout queue before any adjacent code slice.
- Classify blockers per lane with fresh evidence from PR, check, review, and Linear snapshots.
- Keep claim families separate; do not conflate local validation with merge or external-state truth.
- After any PR/Linear refresh, immediately run a single snapshot command bundle:
  - `bash scripts/check-goal-board.sh docs/goals/codex-runtime-evidence-verifier-cockpit`
  - `python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit`
  - `bash scripts/verify-work.sh --fast`
- Normalize blocker labels in their owning lane so they can be cleared deterministically.

## 7) Next Steps

1. Refresh `.harness/active-artifacts.md` with latest lane truth (one timestamped closeout snapshot).
2. Resolve/queue-close the unclaimed closeout items: pending PR #321 checks, review-thread truth, external-state/Linear alignment, runtime producer and delivery-truth claims.
3. Re-run the three-command verification bundle above and only then continue adjacent implementation.
4. If a lane remains blocked, capture exact blocker class and blocker proof before taking non-constraint work.

## Constraint policy

Do not optimize non-constraints. We should only work on actions that reduce closeout uncertainty and merge readiness.
