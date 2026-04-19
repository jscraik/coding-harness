---
last_validated: 2026-04-18
---

# ADR 002: Centralized Input Validation Layer

## Status
Accepted

## Context
CLI commands accept user input through arguments and options. This input can be malicious (intentional attacks) or malformed (accidental errors). Without validation, risks include:

- **Shell injection**: `; rm -rf /` in file paths
- **Path traversal**: `../../../etc/passwd` to access sensitive files
- **Buffer overflow**: Extremely long inputs causing memory issues
- **Command injection**: Backticks or `$()` for command substitution

Previously, validation was scattered across commands with inconsistent approaches.

## Decision
We will implement a centralized input validation layer (`src/lib/input/validation.ts`) that provides:

1. **Length limits** to prevent buffer overflow
2. **Shell injection detection** for dangerous characters
3. **Path traversal prevention** for file system safety
4. **Git ref validation** to prevent option injection
5. **Identifier validation** for names and keys
6. **URL validation** to block dangerous protocols

All validators return `CliResult<T>` for consistent error handling.

## Consequences

### Positive
- **Security by default**: All inputs validated through consistent layer
- **Centralized policy**: Security rules in one location
- **Composability**: Validators can be combined and chained
- **Testability**: Validation logic tested independently
- **Documentation**: Security requirements are explicit

### Negative
- **Performance overhead**: Multiple regex checks on each input
- **Strictness**: Some valid inputs may be rejected (false positives)
- **Maintenance**: New attack vectors require layer updates

## Validation Constants

```typescript
export const MAX_INPUT_LENGTH = 4096;
export const MAX_PATH_LENGTH = 4096;
export const MAX_GIT_REF_LENGTH = 255;
export const MAX_IDENTIFIER_LENGTH = 256;
export const MAX_ARRAY_SIZE = 10000;
```

## Usage Pattern

```typescript
import { validateIdentifier, validatePathComponent } from "../lib/input/validation.js";

export async function runXxxCLI(args: string[]): Promise<number> {
  const rawName = args[0];
  const validation = validateIdentifier(rawName, "preset name");
  if (!validation.ok) {
    console.error(`Error: ${validation.error.message}`);
    return EXIT_CODES.VALIDATION_ERROR;
  }
  const name = validation.value; // Safe to use
  // ...
}
```

## References
- `src/lib/input/validation.ts` - Validation implementation
- `src/lib/input/validation.test.ts` - Test cases
- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
