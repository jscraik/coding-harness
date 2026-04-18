---
last_validated: 2026-04-18
---

# ADR 001: Result Type Error Handling

## Status
Accepted

## Context
The CLI commands were using a mix of error handling patterns:
- Throwing exceptions
- Returning `{ exitCode: number; output?: string }` objects
- Returning `{ ok: boolean; error?: { code: number; message: string } }` objects

This inconsistency made it difficult to:
- Compose operations reliably
- Handle errors at appropriate abstraction levels
- Test error conditions deterministically

## Decision
We will use a standardized `Result<T, E>` discriminated union type for all command implementations.

```typescript
export interface Ok<T> { readonly ok: true; readonly value: T; }
export interface Err<E> { readonly error: E; readonly ok: false; }
export type Result<T, E> = Ok<T> | Err<E>;
```

For CLI-specific use cases, we use `CliResult<T>` which uses a standardized `CliError` type:

```typescript
export interface CliError {
  readonly code: CliErrorCode;
  readonly message: string;
  readonly details?: unknown;
  readonly cause?: Error;
}
```

## Consequences

### Positive
- **Explicit error handling**: Callers must check `result.ok` before accessing `result.value`
- **Type safety**: TypeScript enforces error checking at compile time
- **Composability**: Result types can be chained with `map()`, `flatMap()`, `match()`
- **Testability**: Error paths are explicit and testable
- **Consistency**: All commands follow the same error handling pattern

### Negative
- **Verbosity**: More boilerplate compared to try/catch
- **Learning curve**: Team needs to understand functional error handling patterns
- **Migration effort**: Existing commands need to be updated

## Implementation Pattern

Each command follows the I/O separation pattern:

```typescript
// Core logic returns Result
export async function runXxx(options: Options): Promise<CliResult<Output>> {
  const validation = validateInput(options.input);
  if (!validation.ok) return err(validation.error);
  // ... process and return ok(result)
}

// CLI wrapper handles I/O and exit codes
export async function runXxxCLI(args: string[]): Promise<number> {
  const result = await runXxx(parseArgs(args));
  if (!result.ok) {
    console.error(`Error: ${result.error.message}`);
    return EXIT_CODES.ERROR;
  }
  console.info(result.value);
  return EXIT_CODES.SUCCESS;
}
```

## References
- `src/lib/result/types.ts` - Core Result type definitions
- `src/commands/diff-budget.ts` - Example implementation
- `src/commands/org-audit.ts` - Complex example with validation
