# Adversarial Review — PU-016 GAP-002 Intent

## Severity: High
### Optional skipped or neutral checks can still block global closeout after success-only classifier hardening

**Failure scenario**

1. The GAP-002 intent explicitly hardens closeout so only explicit success conclusions satisfy required CI claims ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:5](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:5), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:78](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:78)).
2. Claim builders currently compute both `tests_passed` and `ci_green` using universal predicates over full check sets (`every(isPassingCheck)`) rather than scoped required-success sets ([src/lib/pr-closeout/claim-builders.ts:83](/Users/jamiecraik/dev/coding-harness/src/lib/pr-closeout/claim-builders.ts:83), [src/lib/pr-closeout/claim-builders.ts:112](/Users/jamiecraik/dev/coding-harness/src/lib/pr-closeout/claim-builders.ts:112)).
3. Today, `isPassingCheck` includes `NEUTRAL` and `SKIPPED`, so optional checks do not trip those universal predicates ([src/lib/pr-closeout/evidence.ts:24](/Users/jamiecraik/dev/coding-harness/src/lib/pr-closeout/evidence.ts:24)).
4. If GAP-002 narrows `isPassingCheck` to success-only without changing claim composition, a run with required checks successful but one optional check skipped/neutral will make `checks.every(isPassingCheck)` false.
5. Because no check is failed in this scenario, claim builders fall through to `"blocked"` instead of `"pass"` for both `ci_green` and potentially `tests_passed`, producing a false blocker for otherwise merge-ready evidence.

**Why this is adversarially material**

- This is a composition failure: each change is locally correct (strict success classifier, existing claim builders), but the combination creates a new false-negative closeout state.
- The failure is easy to trigger in normal CI usage where optional or conditional checks legitimately emit `skipped`/`neutral`.

**Remediation suggestion**

- Decouple required-claim success evaluation from optional-check conclusions:
- Compute pass/fail for `ci_green` and `tests_passed` from the required check subset (or explicit required test subset), while tracking optional skipped/neutral as advisory detail.
- Preserve hard fail semantics for failed required checks.
- Add regression fixtures for: (a) required success + optional skipped, (b) required success + optional neutral, (c) required success + required skipped.
- Validate this with targeted table tests in [src/lib/pr-closeout.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/pr-closeout.test.ts) tied to the GAP-002 acceptance criteria.

WROTE: artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-intent-adversarial.md
