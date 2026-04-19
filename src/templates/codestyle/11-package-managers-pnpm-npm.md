# Package Manager Standards (pnpm and npm)

## Table of Contents
- [Scope](#scope)
- [Primary contract](#primary-contract)
- [Lockfiles and installs](#lockfiles-and-installs)
- [Script conventions](#script-conventions)
- [CI and verification](#ci-and-verification)
- [Enforcement](#enforcement)

## Scope
- This module defines package-manager behavior for JavaScript/TypeScript workflows.

## Primary contract
- `pnpm` MUST be used as the default workflow tool in this repository.
- Use `npm` only where repository scripts or external tooling specifically require it.
- Keep package-manager usage consistent within a given command sequence.
- `pnpm-lock.yaml` MUST be treated as the authoritative lockfile.

## Lockfiles and installs
- Treat lockfiles as authoritative dependency state.
- Use deterministic install flags in CI (for example frozen lockfile behavior).
- Do not mix ad hoc install strategies that rewrite dependency trees without intent.

## Script conventions
- Prefer repository-defined scripts over ad hoc command variants.
- Keep script names stable when they are part of documented validation contracts.
- Update docs when script contracts change.

## CI and verification
- Run the repo baseline gates (`lint`, `typecheck`, `test`) through the canonical package-manager interface.
- When requested, run deeper gates (for example deep/test variants) using the same manager contract.
- Record exact command outcomes and blockers.

## Enforcement
- In this repository, package-manager validation MUST use:
  - `pnpm check` (canonical aggregate contract gate)
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm audit`
  - `pnpm run test:deep` (when change scope requires deep validation)
  - `bash scripts/validate-codestyle.sh`
  - `bash scripts/verify-work.sh --fast`
- Do not default to `npm test` or mixed manager command chains unless the repository contract explicitly requires it.
- Lockfile rewrites and dependency mutations MUST be intentional and reflected in validation evidence.
