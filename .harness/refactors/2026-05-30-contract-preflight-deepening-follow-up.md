---
date: 2026-05-30
status: follow-up
source_audit: .harness/audits/2026-05-30-shallow-modules-audit.md
---

# Contract And Preflight Deepening Follow-up

## Table of Contents

- [Context](#context)
- [Contract Type Core](#contract-type-core)
- [Preflight Validator Core](#preflight-validator-core)
- [Exit Criteria](#exit-criteria)

## Context

The shallow-modules audit identified two high-leverage modules that should not
be refactored casually inside an opportunistic cleanup:

- `src/lib/contract/types-core.ts`
- `src/lib/preflight/validator-core.ts`

Both are broad public or validation-critical surfaces. Treat them as planned
decomposition work with compatibility facades and focused validation.

## Contract Type Core

Smallest useful move:

- Split `types-core.ts` into policy-family type/default modules.
- Keep `src/lib/contract/types.ts` as the compatibility facade.
- Keep emitted contract schema and public imports stable.
- Add module-boundary ratchets that prevent new family modules from becoming
  dumping grounds.

Suggested first families:

- docs-gate policy
- tooling policy
- CI ownership policy
- runtime and memory policy

## Preflight Validator Core

Smallest useful move:

- Keep `runPreflightGate` as the public interface.
- Move check definitions under `src/lib/preflight/checks/` by concern.
- Add `buildPreflightCheckRegistry(options)` to own ordering and mode-specific
  inclusion.
- Preserve current JSON result shape and CLI behavior.

Suggested first check families:

- filesystem checks
- contract checks
- git/worktree checks
- version/tooling checks
- hook extension checks

## Exit Criteria

- Existing contract and preflight imports continue to work.
- Focused tests prove unchanged public behavior.
- `pnpm run quality:docstrings`, `pnpm run quality:size`, `pnpm run test:related`,
  and the relevant preflight/contract tests pass.
- Audit follow-up notes record any intentionally deferred family split.
