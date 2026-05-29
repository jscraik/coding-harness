# PU-035 SPG-009 Testing Lens

STATUS: pass

## Scope

Reviewed whether the ArtifactRuntimeSurface/v1 tests cover the intended false-success and unsafe-reference risks.

## Findings

No blocking testing findings remain.

## Test Coverage Assessment

Focused tests cover:

- valid current claim-support packet acceptance
- missing path, zero-byte artifact, stale front matter, broken preview, and preview-required rejection
- unsupported/generic claim refs and self-referential artifact claim rejection
- current-head and lineage head mismatch rejection
- timestamp ordering violations
- absolute, traversal, URL, and home path rejection
- secret-like values in allowed fields
- CJS semantic validator path containment, symlink escape, size, checksum, and current-head checks
- public schema manifest and TypeScript validator example parity

## Validation Evidence

- `pnpm vitest run src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot` -> pass (34 tests)
- `node scripts/validate-artifact-runtime-surface.cjs contracts/examples/artifact-runtime-surface.example.json --repo-root .` -> pass
- `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass (16 packets)

WROTE: artifacts/reviews/pu-035-spg-009-artifact-runtime-surface-testing.md
