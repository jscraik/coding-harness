# PU-033 SPG-007 ReviewLifecycle HE Code Review Lens

Status: pass

## Scope

Reviewed the slice as Harness Engineering implementation work: contract shape, regression coverage, validator reachability, goal constraints, and agent-native closeout risk.

## Findings

- No blocking findings.
- The slice implements SPG-007 as a narrow packet and validator set rather than broadening Harness into a competing Codex review engine.
- Negative tests cover stale review mode, unresolved active threads, missing/zero-size artifacts, wrong head SHA, forged implementation-produced reviewer artifacts, raw/sensitive fields, unknown top-level fields, and invalid evidence use.
- The delivery-truth/PR closeout regression lane was run to prove this orientation packet does not accidentally satisfy merge-readiness or review-resolution claims.

## Validation Evidence

- `pnpm vitest run src/lib/review-state/review-lifecycle.test.ts --reporter=dot` -> pass
- `node scripts/validate-review-lifecycle.cjs contracts/examples/review-lifecycle.example.json` -> pass
- `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass
- `pnpm vitest run src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot` -> pass
- `pnpm vitest run src/lib/delivery-truth/delivery-truth-composition.test.ts src/lib/pr-closeout.test.ts src/commands/pr-closeout.test.ts --reporter=dot` -> pass
- `pnpm typecheck` -> pass
- `pnpm exec biome check --write .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json contracts/runtime-packet-schemas.manifest.json contracts/review-lifecycle.schema.json contracts/examples/review-lifecycle.example.json scripts/validate-review-lifecycle.cjs src/lib/review-state/review-lifecycle.ts src/lib/review-state/review-lifecycle.test.ts src/lib/review-state/index.ts src/dev/validate-runtime-packet-schemas-script.test.ts` -> pass after fixing one lint finding
- `pnpm exec biome check .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json contracts/runtime-packet-schemas.manifest.json contracts/review-lifecycle.schema.json contracts/examples/review-lifecycle.example.json scripts/validate-review-lifecycle.cjs src/lib/review-state/review-lifecycle.ts src/lib/review-state/review-lifecycle.test.ts src/lib/review-state/index.ts src/dev/validate-runtime-packet-schemas-script.test.ts` -> pass
- `git diff --check -- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json contracts/runtime-packet-schemas.manifest.json contracts/review-lifecycle.schema.json contracts/examples/review-lifecycle.example.json scripts/validate-review-lifecycle.cjs src/lib/review-state/review-lifecycle.ts src/lib/review-state/review-lifecycle.test.ts src/lib/review-state/index.ts src/dev/validate-runtime-packet-schemas-script.test.ts` -> pass

## Residual Risk

This is not yet live producer evidence. It is a contract, schema, semantic validator, fixture, and TypeScript validation slice.

WROTE: artifacts/reviews/pu-033-spg-007-review-lifecycle-he-code-review.md
