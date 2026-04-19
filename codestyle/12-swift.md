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
- Prefer value semantics and protocol-oriented composition for shared logic.
- Keep API surfaces explicit and readable at call sites.
- Avoid hidden global state in core logic.

## Concurrency
- Prefer structured concurrency (`async/await`, task groups) over unmanaged thread patterns.
- Define actor or synchronization boundaries for mutable shared state.
- Keep UI-affecting updates on the appropriate main-thread or actor context.

## Error handling and state
- Propagate typed errors with actionable context.
- Avoid swallowing errors in async flows.
- Keep state transitions explicit and testable.

## Testing and formatting
- Keep unit tests deterministic and focused on behavior contracts.
- Separate heavier integration/UI tests from fast unit suites.
- Apply repo formatting/lint tooling consistently for Swift codepaths.

## Enforcement
- Swift changes MUST pass repository baseline gates:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `bash scripts/verify-work.sh --fast`
- Swift projects SHOULD also run native gates where available:
  - `swift test`
  - `xcodebuild test` (or project-defined equivalent)
- Concurrency and actor-boundary exceptions require explicit waiver metadata (reason, tracker, expiry/ADR).
