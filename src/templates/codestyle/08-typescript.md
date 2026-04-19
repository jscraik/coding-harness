# TypeScript Standards

## Table of Contents
- [Scope](#scope)
- [Type discipline](#type-discipline)
- [Banned patterns](#banned-patterns)
- [Linting and module rules](#linting-and-module-rules)
- [Async and cancellation](#async-and-cancellation)
- [Testing](#testing)
- [Enforcement](#enforcement)

## Scope
- This module is the canonical TypeScript-specific standards reference for this codestyle pack.

## Type discipline
- Explicit types at public API boundaries (functions, modules, component props) are REQUIRED.
- Use strict TypeScript configuration and keep boundary validation explicit.
- `any` is forbidden in production paths; use concrete types or `unknown` plus narrowing.

## Banned patterns
- `: any`, `as any`, `Promise<any>`, and `Record<string, any>` in production code.
- `value as unknown as T` double assertions without runtime validation.
- `// @ts-ignore` and `// @ts-nocheck`; use `@ts-expect-error` with rationale only when unavoidable.
- Unsafe type assertions without guard functions or schema validation.

## Linting and module rules
- ESLint MUST be type-aware for TS policy checks.
- Biome handles formatting and style-level lint where configured and MUST pass where enabled.
- Prefer ESM and explicit module syntax for Node/TS packages.
- Keep imports acyclic; avoid barrels that create circular dependency chains.

## Async and cancellation
- Prefer `async/await` over nested Promise chains.
- Exported async APIs that do I/O or long work SHOULD accept `AbortSignal`.
- Surface cancellation as expected behavior, not as opaque failures.

## Testing
- Co-locate tests (`*.test.ts` / `__tests__`) and assert user-visible behavior where applicable.
- Keep snapshots limited to intentionally stable serialized outputs.
- Validate parsing boundaries (`JSON.parse`, `Response.json`) with schemas or typed helpers.

## Enforcement
- TypeScript changes MUST pass:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `bash scripts/verify-work.sh --fast`
- Avoid soft bypasses for type/lint errors; temporary suppressions require a waiver with reason, tracker, and expiry/ADR.
- Validation evidence MUST be explicit:
  - `Command: <exact command> -> pass|fail|blocked (<reason>)`
