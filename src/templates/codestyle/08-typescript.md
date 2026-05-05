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
- Exported public API declarations in changed production `src/**` files MUST have JSDoc; `pnpm run quality:docstrings` enforces this changed-file ratchet.
- Use strict TypeScript configuration and keep boundary validation explicit.
- `any` SHOULD be avoided in production paths; use concrete types or `unknown` plus narrowing. If a temporary `any` is unavoidable, keep it local, justified, and covered by tests or a follow-up waiver.

## Banned patterns
- Unjustified `: any`, `as any`, `Promise<any>`, and `Record<string, any>` in production code MUST NOT be used.
- `value as unknown as T` double assertions MUST NOT be used without runtime validation.
- `// @ts-ignore` and `// @ts-nocheck` MUST NOT be used; use `@ts-expect-error` with rationale only when unavoidable.
- Unsafe type assertions MUST NOT be used without guard functions or schema validation.

## Linting and module rules
- Biome handles formatting and style-level lint in this repository and MUST pass where enabled.
- TypeScript type safety MUST be enforced with `tsc --noEmit`.
- Downstream projects MAY use ESLint for additional policy checks when an `eslint.config.*` file exists; do not claim ESLint coverage where it is not configured.
- Node/TS packages SHOULD use ESM and explicit module syntax.
- Local ESM imports MUST include `.js` extensions for emitted JavaScript compatibility.
- NodeNext TypeScript projects MUST keep `module` and `moduleResolution` aligned to `NodeNext` unless a documented runtime migration changes both together.
- With `verbatimModuleSyntax` enabled, imports MUST reflect runtime semantics; use `import type` for type-only imports.
- JSON imports in NodeNext-style modules MUST use import attributes when the runtime/compiler requires them, for example `with { type: "json" }`.
- Imports MUST be acyclic; barrels that create circular dependency chains MUST NOT be used.

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
  - `pnpm run quality:docstrings`

  - `pnpm run quality:size`
  - `pnpm run test:related`

  - `pnpm test`
  - `pnpm audit`
  - `pnpm check`
  - `bash scripts/validate-codestyle.sh`
  - `bash scripts/verify-work.sh --fast`
- Avoid soft bypasses for type/lint errors; temporary suppressions require waiver metadata with rule ID or section, reason, tracking ticket, and expiry or ADR reference.
- Validation evidence MUST be explicit:
  - `Command: <exact command> -> pass|fail|blocked (<reason>)`
