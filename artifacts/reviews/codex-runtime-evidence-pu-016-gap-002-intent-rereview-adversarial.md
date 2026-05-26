# Adversarial Re-Review — PU-016 GAP-002 Intent (Scope Update)

## Result
No blocker found in the updated intent for the previously reported failure mode.

## Prior Blocker Re-Check
- Previous blocker: success-only classifier hardening could falsely block closeout when optional skipped/neutral checks were still part of universal claim predicates.
- Update verification:
  - src/lib/pr-closeout/claim-builders.ts is now explicitly in inScope and guardedPathGlobs.
  - Acceptance criteria now require optional SKIPPED/NEUTRAL checks not to block tests_passed or ci_green when required checks pass.
  - Focused regression command now explicitly proves both conditions in one lane:
    - required skipped/neutral cannot satisfy pass
    - optional skipped/neutral do not create false blockers

## Adversarial Safety Assessment
- Assumption-violation risk for this slice is now bounded: the intent no longer assumes classifier-only changes are sufficient.
- Composition risk identified in prior review is directly addressed by allowing claim-builder scoping updates and mandating regression coverage.
- Abuse-case risk for normal CI behavior (optional conditional checks emitting skipped/neutral) is explicitly included in acceptance and validation.

## Residual Risk (Non-blocking)
- Implementation must ensure required-check subset logic is used consistently for both tests_passed and ci_green; partial scoping in only one builder would reintroduce drift.
- Existing broad PR closeout tests should still pass to guard against unintended status-regression side effects.

WROTE: artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-intent-rereview-adversarial.md
