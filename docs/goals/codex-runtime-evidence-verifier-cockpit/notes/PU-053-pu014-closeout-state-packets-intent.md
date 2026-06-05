# PU-053 / PU-014 Closeout State Packets Intent

## Objective

Add a bounded bridge that derives validated `external-state-snapshot/v1` and
`review-state/v1` packets from normalized `pr-closeout` input so live PR
closeout refreshes can produce verifier-owned packet evidence instead of only
raw normalized PR/check/thread summaries.

## Owned Acceptance Scope

- PU-014: PR, CI, review, Linear, and stale-state closeout refresh.
- FR-008 / SA-008: keep review-state and external-state truth separate.
- FR-010 / SA-010: closeout claims must cite current verifier evidence or block.
- GAP-002: skipped, neutral, missing, stale, or unavailable CI must not count as pass.
- GAP-009: reviewer artifact coverage must remain path/role/evidence verified.

## Deep Module Boundary

In scope:

- `src/lib/pr-closeout/**`
- `src/lib/external-state/**`
- `src/lib/review-state/**`
- focused tests for the new bridge and existing closeout behavior

Out of scope:

- public command authority beyond existing read-only `harness pr-closeout`
- mutation of `external-repo:codex`
- Linear field mutation
- PR merge, auto-merge, or closeout completion claims
- treating runtime-card summaries as delivery-truth proof
- resolving the PR #336 reviewer-runtime artifact-output blocker

## Proposed Operating Model

1. Keep the existing live `pr-closeout` fetch path as the source of normalized
   closeout input.
2. Add a small library bridge that builds packet-shaped external-state and
   review-state artifacts from that normalized input.
3. Include verifier-owned fetch receipts, source status, head SHA, TTL,
   evidence use, stale reasons, and blocker classifications.
4. Validate packets using the existing `validateExternalStateSnapshot` and
   `validateReviewStatePacket` validators before any packet can be treated as
   claim-support evidence.
5. Preserve separate verdict lanes: local validation, remote checks, review
   threads, tracker state, merge readiness, and Judge/PM readiness remain
   separate and cannot be collapsed into one status.

## Automation Plan

- Add focused unit tests for passing packet derivation: run `pnpm exec vitest run src/lib/pr-closeout/state-packets.test.ts` and expect exit code 0 with all new packet derivation tests passing.
- Add negative tests for missing PR head SHA, unavailable GitHub checks, unknown review-thread state, and missing reviewer artifact proof: run `pnpm exec vitest run src/lib/pr-closeout/state-packets.test.ts` or the broader suite with focused failure-case patterns and expect validator rejection assertions to pass.
- Run the narrow-focused tests before wider validation: execute `pnpm exec vitest run src/lib/pr-closeout/state-packets.test.ts src/lib/external-state/external-state.test.ts src/lib/review-state/review-state.test.ts src/commands/pr-closeout.test.ts` expecting all tests to pass, then run `pnpm run test:related` expecting exit code 0.
- Run goal-board and audit-freshness after updating route-truth artifacts: execute `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit` expecting exit code 0, then `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .` expecting exit code 0.

## Review Intent

Intent status: ready for review before implementation.

Reviewer expectations:

- Architecture: confirm the bridge belongs in `src/lib/pr-closeout` and does
  not leak raw live API payloads into packet artifacts.
- Simplify/unslopify: keep the API small and avoid public command sprawl.
- Testing: prove the packet validators reject stale/missing/unknown evidence.
- Agent-native: ensure future agents can invoke the existing `pr-closeout`
  path and inspect structured packet evidence without human-only interpretation.
- Adversarial: attack any path that could turn raw normalized input, mailbox
  text, stale checks, or blended status into closeout proof.

## Non-Claims

This slice will not claim PR #336 green, independent reviewer completion,
delivery-truth consumption, merge readiness, Judge/PM readiness, Linear field
currency, or parent-goal completion.
