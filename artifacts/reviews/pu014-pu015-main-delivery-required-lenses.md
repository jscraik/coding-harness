# PU-014 / PU-015 Current-Main Delivery Required Lenses

## Scope

This review covers the current-main delivery branch
`codex/jsc-363-pu014-pu015-main-delivery` through commit
`e8df62b7`. The branch ports the PR closeout state-packet bridge and the
delivery-truth consumption seam onto current `origin/main`, preserves the
receipt-backed reviewer proof requirement, refreshes architecture/governance
surfaces, and encodes the sequential no-stacked-PR slice policy.

## Simplify

Status: pass with explicit ratchet warnings

The branch keeps the state-packet bridge under the existing `pr-closeout`
deep-module family instead of adding a public command or a new closeout
authority surface. The delivery-truth composition is extracted into
`src/lib/pr-closeout/state-packet-delivery-truth.ts`, and repeated evidence
selection helpers now live in `src/lib/pr-closeout/report-helpers.ts`.

The simplification pass intentionally did not split
`src/lib/pr-closeout/state-packets.ts` during this port because the repo size
gate reports that file as a warning rather than a blocking failure, and a
larger split would increase PR risk while the active goal is to recover the
stacked PR work onto current main.

Evidence:

- `pnpm run quality:size` via `bash scripts/validate-codestyle.sh --fast`
  passed with warnings for `state-packets.ts` and `evaluator.ts`.
- `pnpm exec vitest run src/lib/pr-closeout/state-packets.test.ts src/lib/pr-closeout.test.ts src/lib/architecture/module-boundaries.test.ts --reporter=dot`
  passed with 3 files and 142 tests.

## Improve-Codebase-Architecture

Status: pass

The branch keeps the bridge as a read-only adapter over existing typed
contracts:

- `src/lib/pr-closeout/state-packets.ts` derives validated
  `external-state-snapshot/v1` and `review-state/v1` packets from normalized
  closeout input.
- `src/lib/pr-closeout/state-packet-delivery-truth.ts` derives only
  `remote_checks_current` and `review_threads_resolved` delivery-truth
  verdicts from validated state packets.
- `src/lib/architecture/module-boundaries.test.ts` records the allowed parent
  import seam for the delivery-truth helper.

The branch also refreshes `AGENTS.md`, `AI/context/diagram-context.md`, and
the generated diagram manifest so the human and generated architecture surfaces
match the deep-module placement.

Evidence:

- `bash scripts/check-diagram-freshness.sh` passed after
  `bash scripts/refresh-diagram-context.sh --force`.
- `bash scripts/run-harness-gate.sh docs-gate --mode required --json` passed
  after the AGENTS governance sync.
- `bash scripts/validate-codestyle.sh --fast` passed on the current head.

## Sy Review

Status: pass for local evidence lanes, blocked for external PR lanes

Claim under review: the current branch is locally ready for PR handoff under the
new sequential slice policy.

Evidence lanes:

- `local_worktree`: pass. `git status --short --branch` is clean at
  `e8df62b7` before this artifact is added.
- `local_validation`: pass. Focused pr-closeout tests, typecheck,
  review-backfill validation, goal-board validation, audit-freshness, and
  `validate-codestyle --fast` passed.
- `artifact`: pass for current required lens artifact after this file is
  committed; older PU-014/PU-015 artifacts remain historical and contain the
  old `unslopify` and `he-code-review` vocabulary.
- `PR`: blocked. The current branch has not yet been pushed as the
  current-main delivery PR.
- `CI`: blocked. Remote checks cannot be current until the PR exists and is
  pushed.
- `review_threads`: blocked. Live review-thread truth cannot be current until
  the PR exists and CodeRabbit/Codex review are refreshed on that head.
- `tracker`: blocked. Linear JSC-363 remains separate tracker truth and does
  not prove local implementation or PR readiness.
- `mergeability`: blocked. Merge readiness requires live PR mergeability,
  required checks, review-thread state, and current-head proof.

Finding: no local source blocker was found in the current-head evidence. The
next stage is PR handoff followed by `$pr-green-sweep`; starting another
implementation slice before that PR merges would violate the new goal contract.

## Testing

Status: pass

Validation evidence:

- `pnpm exec vitest run src/lib/pr-closeout/state-packets.test.ts src/lib/pr-closeout.test.ts src/lib/architecture/module-boundaries.test.ts --reporter=dot`
  -> pass, 3 files and 142 tests.
- `pnpm typecheck` -> pass.
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-review-backfill.py docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json --repo .`
  -> pass, required lenses are `simplify`,
  `improve-codebase-architecture`, `sy-review`, and `testing`.
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit`
  -> pass.
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .`
  -> pass.
- `bash scripts/validate-codestyle.sh --fast` -> pass, including lint,
  docs lint, skill validation, workflow validation, typecheck, quality gates,
  behavior-test guard, git-env sanitizer, audit tracking, and related tests.

## Non-Claims

This artifact does not claim PR creation, remote CI green, CodeRabbit current
review, review-thread resolution, Linear field-text alignment, PR merge, local
main refresh after merge, Judge/PM readiness, or parent goal completion.

WROTE: artifacts/reviews/pu014-pu015-main-delivery-required-lenses.md
