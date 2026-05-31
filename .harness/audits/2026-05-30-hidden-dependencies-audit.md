---
date: 2026-05-30
report_type: hidden-dependencies-audit
status: fixed
repo: coding-harness
---

# Hidden Dependencies Audit

## Table of Contents

- [Resolution Summary](#resolution-summary)
- [Implemented Findings](#implemented-findings)
- [Validation](#validation)

## Resolution Summary

This audit records the durable fixes for hidden dependency findings recovered
from the prior advisory audit. Each item now has either an executable guard, an
owned manifest, or a local owner document so future agents can find the coupled
surfaces before repeating the same search.

## Implemented Findings

| Finding | Status | Durable fix |
| --- | --- | --- |
| Behavior-test evidence guard | Fixed | Added `src/lib/testing/behavior-test-suites.json`, `expectBehavior`, and `scripts/check-behavior-tests.mjs`; wired the guard into `pnpm check`, `scripts/validate-codestyle.sh --fast`, and pre-commit validation. |
| Audit artifact tracking | Fixed | Allowed tracked markdown under `.harness/audits/`, documented the lane in `.harness/README.md`, and added `scripts/check-harness-audit-tracking.mjs`. |
| Shared git environment sanitation | Fixed | Added `src/lib/git/safe-env.ts`, routed existing production git subprocess sanitizers through it, documented policy selection, and added `scripts/check-git-env-sanitizer.mjs`. |
| Command registry pass-through helper | Fixed | Added `defineCommandSpec`, migrated simple adapters, and documented when to use the helper versus bespoke command-spec factories. |
| Project Brain presenter and rule helpers | Fixed | Added `parseBrainRules`, routed preflight rule parsing through it, and documented Project Brain parser, presenter, CLI, and validator ownership. |

## Validation

Command: `pnpm run quality:behavior-tests` -> pass (registered evidence-bearing suites contain `expectBehavior` assertions)

Command: `pnpm run quality:git-env-sanitizer` -> pass (manual git environment cleanup is centralized)

Command: `pnpm run harness:audit-tracking` -> pass (audit tracking contract is documented and allowlisted)

Command: `pnpm vitest run src/lib/testing/expect-behavior.test.ts src/lib/git/safe-env.test.ts src/lib/cli/registry/define-command-spec.test.ts src/lib/project-brain/rules.test.ts` -> pass (focused helper tests)

Command: `pnpm vitest run src/commands/local-memory-preflight.test.ts src/commands/policy-gate.test.ts src/commands/runtime-card.test.ts src/lib/delivery-truth/delivery-truth-composition.test.ts src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts src/lib/external-state/external-state.test.ts src/lib/pr-closeout.test.ts` -> pass (registered evidence-bearing suites)
