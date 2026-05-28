# PU-030 SPG-004 Steering Queue - Simplify Review

schema_version: 1
execution_mode: scoped_cleanup
diff_source: PU-030 changed files

## Verdict

Status: pass

No further behavior-preserving simplification is required before commit. The first implementation was too large for the repo size ratchet, so it has already been simplified into a small facade plus builder, packet validation, item validation, validation helpers, hash, types, and constants modules, one focused test file, one JSON Schema, one example packet, and one standalone semantic validator.

## Actions

- Kept the CJS validator separate from the TypeScript implementation because it is a repo script contract and should run without depending on a TypeScript build step.
- Kept src/lib/steering-queue/index.ts and steering-queue.ts as narrow facades while moving real behavior into builder.ts, validation.ts, validation-item.ts, validation-helpers.ts, hash.ts, types.ts, and constants.ts.
- Accepted the deep-module split because it satisfied the size ratchet and made adversarial fixes easier to localize.
- Kept blockedBy as a compact pointer rather than prose so packet values remain validator-friendly.

## Skipped

- Did not deduplicate the CJS validator against the TypeScript validator. That would add build/runtime coupling to a script-backed contract before this packet is emitted by production code.
- Did not add a public CLI command. The manifest and semantic validator are enough for the contract-only slice.

## Validation

- pnpm exec biome check over the changed code/schema/validator/test files -> pass
- pnpm vitest run src/lib/steering-queue/steering-queue.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts -> pass (27 tests)
- node scripts/validate-steering-queue.cjs contracts/examples/steering-queue.example.json -> pass

## Risk Note

The main simplification risk is over-compressing authority rules into a generic runtime packet helper. The current module stays explicit about steering-specific stale states and terminal-state handling, which is clearer for future reviewers.

WROTE: artifacts/reviews/pu-030-spg-004-steering-queue-simplify.md
