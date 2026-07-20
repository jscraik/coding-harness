# CC1 Deterministic QA Fallback

## Trigger

Two fresh `QA Disproof` agents returned valid `blocked_validation` artifacts
because their five-minute artifact probes expired before their final evidence
write. The preserved records are `qa-result.json` and `qa2-result.json`.

Under the OC fallback rule, this record reruns the fixed QA command set against
immutable source target `8e7e7251c299d8f7844cf633cf885bedeab2752d` without
reusing either stale QA result as acceptance evidence.

## Deterministic Result

- Command: `git rev-parse HEAD` -> pass (returned 8e7e7251c299d8f7844cf633cf885bedeab2752d, confirming checkout matches the claimed commit).
- Command: `pnpm exec vitest run src/commands/next-fitness-report.test.ts src/commands/next-agent-parity.test.ts src/commands/next-decision-meta.test.ts src/commands/next.test.ts src/lib/decision/harness-decision.test.ts src/lib/synaipse/state.test.ts --reporter=dot` -> pass (6 files, 132 tests).
- Command: `pnpm exec tsc --noEmit` -> pass (no diagnostics).
- Command: `git diff --check bfe275b09244cd44c63ae4cbb641b3630056d04f..8e7e7251c299d8f7844cf633cf885bedeab2752d` -> pass (no whitespace errors).

## Claims Boundary

This is a governed, deterministic local fallback after child transport
freshness failure. It proves the listed commands against the immutable target.
It is not an independent QA-agent acceptance, adversarial review, hosted CI,
external review, acceptance, merge, release, or readiness claim.

WROTE: .harness/review/synaipse-cc1/qa-deterministic-fallback.md
