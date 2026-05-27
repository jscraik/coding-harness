# PU-021 GAP-003 Public Packet Schemas Architecture Lens

Status: pass

## Scope

Reviewed whether the GAP-003 fix is placed in the right repo layer and whether it strengthens the public packet contract without creating a new runtime subsystem.

## Findings

No architecture blocker found.

The implementation correctly treats this slice as a contract-publication and drift-detection layer. Public packet contracts live under contracts/, example fixtures live under contracts/examples/, and the validator lives under scripts/ with a focused regression under src/dev/. The existing runtime deep modules remain the source of runtime behavior.

## Architecture Assessment

- Keep: contracts/runtime-packet-schemas.manifest.json as the narrow schemaVersion/source/status map.
- Keep: decision-request/v1 and session-context/v1 as not_yet_emitted manifest entries with GAP owner metadata instead of invented runtime emission.
- Keep: validator dependency-free until an AJV/package-review decision exists.
- Avoid now: wiring schema validation into harness next, runtime-card, or closeout execution before the production verifier surface is intentionally designed.

## Residual Risk

Schema parity is not a full TypeScript-to-JSON-Schema proof. The current mitigation is focused parity against existing TypeScript validators where they exist plus explicit not-yet-emitted ownership for future packet families.

## Validation Evidence

- node scripts/validate-runtime-packet-schemas.cjs --all -> pass
- pnpm vitest run src/dev/validate-runtime-packet-schemas-script.test.ts -> pass
- pnpm exec biome check over bounded PU-021 files -> pass

WROTE: artifacts/reviews/pu-021-gap-003-public-packet-schemas-improve-codebase-architecture.md
