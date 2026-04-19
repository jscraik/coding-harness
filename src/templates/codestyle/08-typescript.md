# TypeScript Standards

## Table of Contents
- [Scope](#scope)
- [Type discipline](#type-discipline)
- [Warn-level Patterns](#warn-level-patterns)
- [Linting and module rules](#linting-and-module-rules)
- [Async and cancellation](#async-and-cancellation)
- [Testing](#testing)
- [Enforcement](#enforcement)

## Scope
- This module is the canonical TypeScript-specific standards reference for this codestyle pack.

## Type discipline
- Explicit types at public API boundaries (functions, modules, component props) are REQUIRED.
- Use strict TypeScript configuration and keep boundary validation explicit.
- `any` SHOULD be avoided in production paths; use concrete types or `unknown` plus narrowing.

## Warn-level Patterns
- `: any`, `as any`, `Promise<any>`, and `Record<string, any>` in production code SHOULD remain warn-level findings in baseline lint gates.
- `value as unknown as T` double assertions without runtime validation.
- `// @ts-ignore` and `// @ts-nocheck`; use `@ts-expect-error` with rationale only when unavoidable.
- Unsafe type assertions without guard functions or schema validation.

## Linting and module rules
- Type-aware policy checks MUST run via the TypeScript compiler (`tsc --noEmit`, typically through `pnpm typecheck`).
- Formatting and style-level linting is handled by Biome (`biome check .`) where configured and MUST pass where enabled.
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
  - `pnpm audit`
  - `pnpm check`
  - `bash scripts/validate-codestyle.sh`
  - `bash scripts/verify-work.sh --fast`
- Avoid soft bypasses for type/lint errors; temporary suppressions require waiver metadata with rule ID or section, reason, tracking ticket, and expiry or ADR reference.
- Validation evidence MUST be explicit:
  - `Command: <exact command> -> pass|fail|blocked (<reason>)`
