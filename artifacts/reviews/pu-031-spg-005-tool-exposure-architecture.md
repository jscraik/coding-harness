# PU-031 SPG-005 Architecture Lens

Status: pass

## Scope Checked

- `src/lib/tool-exposure/**`
- `src/lib/runtime/runtime-card-codex-runtime*.ts`
- `src/lib/runtime/runtime-evidence-{bundle,adapter}.ts`
- `contracts/tool-exposure-snapshot.schema.json`
- `contracts/runtime-packet-schemas.manifest.json`

## Findings

No blocking architecture findings.

## Evidence

- New behavior is placed in a bounded deep module: `src/lib/tool-exposure/types.ts`, `validation.ts`, `projection.ts`.
- Runtime-card integration is additive and compact: `src/lib/runtime/runtime-card-codex-runtime.ts` adds only optional `toolExposure`.
- The adapter remains the only path from `runtime-evidence-bundle/v1` into runtime-card projection: `src/lib/runtime/runtime-evidence-adapter.ts`.
- The public command surface is unchanged.

## Validation Ownership

No gate failures observed in focused validation. Ownership: introduced by current patch, validated locally.

WROTE: artifacts/reviews/pu-031-spg-005-tool-exposure-architecture.md

