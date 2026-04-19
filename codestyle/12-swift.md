# Swift Standards

## Table of Contents
- [Scope](#scope)
- [Language and API design](#language-and-api-design)
- [Concurrency](#concurrency)
- [Error handling and state](#error-handling-and-state)
- [Testing and formatting](#testing-and-formatting)
- [Enforcement](#enforcement)

## Scope
- This module defines Swift coding standards for Apple-platform projects and utilities.

## Language and API design
- Implementations SHOULD prefer value semantics and protocol-oriented composition for shared logic.
- API surfaces MUST remain explicit and readable at call sites.
- Hidden global state in core logic MUST be avoided.

## Concurrency
- Implementations SHOULD prefer structured concurrency (`async/await`, task groups) over unmanaged thread patterns.
- Mutable shared state MUST use actor or synchronization boundaries.
- UI-affecting updates MUST stay on the appropriate main-thread or actor context.

## Error handling and state
- Typed errors MUST be propagated with actionable context.
- Async flows MUST NOT swallow errors.
- State transitions MUST remain explicit and testable.

## Testing and formatting
- Unit tests MUST remain deterministic and focused on behavior contracts.
- Heavier integration/UI tests SHOULD be separated from fast unit suites.
- Repo formatting/lint tooling MUST be applied consistently for Swift codepaths.

## Enforcement
- Swift changes MUST pass repository baseline gates:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm audit`
  - `pnpm check`
  - `bash scripts/validate-codestyle.sh`
  - `bash scripts/verify-work.sh --fast`
- Swift projects SHOULD also run native gates where available:
  - `swift test`
  - `xcodebuild test` (or project-defined equivalent)
- Concurrency and actor-boundary exceptions require explicit waiver metadata with rule ID or section, reason, tracking ticket, and expiry or ADR reference.
