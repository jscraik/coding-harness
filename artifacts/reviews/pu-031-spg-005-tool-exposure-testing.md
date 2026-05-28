# PU-031 SPG-005 Testing Lens

Status: pass

## Commands Run

- `pnpm vitest run src/lib/tool-exposure/tool-exposure-snapshot.test.ts src/lib/runtime/runtime-card-codex-runtime-projection.test.ts --reporter=dot` -> pass
- `node scripts/validate-runtime-packet-schemas.cjs` -> pass
- `pnpm exec biome check src/lib/tool-exposure src/lib/runtime/runtime-card-codex-runtime.ts src/lib/runtime/runtime-card-codex-runtime-validation.ts src/lib/runtime/runtime-evidence-bundle.ts src/lib/runtime/runtime-evidence-adapter.ts src/lib/runtime/runtime-card-codex-runtime-projection.test.ts contracts/tool-exposure-snapshot.schema.json contracts/examples/tool-exposure-snapshot.example.json contracts/runtime-packet-schemas.manifest.json .harness/memory/LEARNINGS.md` -> pass
- `pnpm typecheck` -> pass
- `pnpm vitest run src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot` -> pass
- `bash scripts/validate-codestyle.sh --fast` -> pass with baseline non-blocking size/drift warnings

## Coverage Notes

Tests exercise positive projection, orientation-only rejection of claim-support, raw payload/path/command rejection, blocked-permission closed taxonomy, required failure classification, key-name cardinality, truncation invariants, runtime-card discoverability, manifest packet-count parity, and the repo fast validation lane.

WROTE: artifacts/reviews/pu-031-spg-005-tool-exposure-testing.md
