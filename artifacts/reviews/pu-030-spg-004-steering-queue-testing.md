# PU-030 SPG-004 Steering Queue - Testing Review

schema_version: 1
execution_mode: validation_route
changed_surface: runtime packet contract, deep module evaluator, script-backed semantic validator, manifest registration, architecture docs

## Selected Validation Route

The smallest adequate proof is a focused Vitest suite for the TypeScript evaluator and manifest admission, a direct semantic validator run for the JSON example, a manifest-wide packet schema validator run, TypeScript compilation, changed-file formatting/linting, architecture docs gates, and later the repo fast gate before commit.

## Current Results

| Command | Result | Notes |
| --- | --- | --- |
| pnpm exec biome check src/lib/steering-queue/index.ts src/lib/steering-queue/steering-queue.ts src/lib/steering-queue/builder.ts src/lib/steering-queue/constants.ts src/lib/steering-queue/hash.ts src/lib/steering-queue/types.ts src/lib/steering-queue/validation.ts src/lib/steering-queue/validation-helpers.ts src/lib/steering-queue/validation-item.ts src/lib/steering-queue/steering-queue.test.ts contracts/steering-queue.schema.json contracts/examples/steering-queue.example.json contracts/runtime-packet-schemas.manifest.json scripts/validate-steering-queue.cjs src/dev/validate-runtime-packet-schemas-script.test.ts | pass | Changed-file code/schema/script check |
| pnpm vitest run src/lib/steering-queue/steering-queue.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts | pass | 2 files, 27 tests, including cross-scope, supersession-cycle, and duplicate-instruction-source regressions |
| node scripts/validate-steering-queue.cjs contracts/examples/steering-queue.example.json | pass | Semantic validator accepts the example |
| node scripts/validate-runtime-packet-schemas.cjs --all | pass | Manifest validates 12 packet contracts |
| pnpm typecheck | pass | TypeScript compile check |
| pnpm run docs:ubiquitous:guard | pass | AGENTS glossary linkage preserved |
| bash scripts/run-harness-gate.sh docs-gate --mode required --json | pass | Required docs surfaces present |
| pnpm architecture:check | pass | Only baselined pre-existing warnings reported |

## Coverage Gaps

- Runtime-card consumption is not tested because PU-030 intentionally does not wire a runtime-card adapter.
- Script-backed validation is still CJS-owned; parity is protected by the Vitest semantic tests and manifest-wide schema validator rather than by sharing TypeScript runtime code.
- PR/CI/review readiness is not implied by these local checks and must be refreshed separately after push.

## Next Required Gates Before Commit

- bash scripts/validate-codestyle.sh --fast
- bash scripts/verify-work.sh --fast if feasible for current repo state
- Final independent adversarial and agent-native review artifacts

WROTE: artifacts/reviews/pu-030-spg-004-steering-queue-testing.md
