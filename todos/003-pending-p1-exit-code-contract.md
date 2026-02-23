---
status: complete
priority: p1
issue_id: 003
tags: [agent-native, cli, code-review]
dependencies: []
date: 2026-02-23
incorporated_in_plan: true
---

# Missing Exit Code Contract

## Problem Statement

Agents and automation cannot distinguish between different failure modes because exit codes are not documented or consistently implemented.

## Findings

**Location:** `src/commands/risk-tier.ts` and `src/cli.ts` (planned)

**Current state:** No exit code contract documented. The CLI may exit with code 1 for all errors, making it impossible for agents to:
- Distinguish validation errors from system errors
- Implement appropriate retry logic
- Provide specific error feedback to users

## Proposed Solutions

### Solution A: Document and implement exit code contract (Recommended)

```typescript
// Exit codes:
export const EXIT_CODES = {
  SUCCESS: 0,
  VALIDATION_ERROR: 1,    // Invalid contract, malformed input
  FILE_NOT_FOUND: 2,      // Contract or input files missing
  PERMISSION_DENIED: 3,   // Path traversal blocked, permission error
  SYSTEM_ERROR: 10,       // Unexpected exceptions
} as const;

// Usage in runRiskTier:
export function runRiskTier(options: RiskTierOptions): number {
  try {
    const contract = loadContract(options.contractPath);
    // ...
    console.info(`Risk Tier: ${tier}`);
    return EXIT_CODES.SUCCESS;
  } catch (e) {
    if (e instanceof ContractLoadError) {
      console.error(formatErrors(e.errors));
      return EXIT_CODES.VALIDATION_ERROR;
    }
    if (e instanceof PathTraversalError) {
      console.error("Path traversal blocked");
      return EXIT_CODES.PERMISSION_DENIED;
    }
    console.error("Unexpected error");
    return EXIT_CODES.SYSTEM_ERROR;
  }
}
```

**Pros:** Clear contract for agents, enables programmatic error handling
**Cons:** Requires discipline to maintain
**Effort:** Small
**Risk:** Low

### Solution B: Use stderr for errors with structured format

```typescript
// All errors go to stderr in JSON format
console.error(JSON.stringify({ error: { code, message, details } }));
```

**Pros:** Machine-readable errors
**Cons:** More complex, requires stderr parsing
**Effort:** Medium
**Risk:** Medium

**Recommendation:** Implement Solution A first. Solution B can be added later if needed.

## Technical Details

**Affected files:**
- `src/commands/risk-tier.ts` (implementation)
- `src/cli.ts` (exit code handling)
- `AGENTS.md` (documentation)

## Acceptance Criteria

- [ ] Exit code 0 for success
- [ ] Exit code 1 for validation errors
- [ ] Exit code 2 for file not found
- [ ] Exit code 3 for permission denied / path traversal
- [ ] Exit code 10+ for system errors
- [ ] Exit codes documented in AGENTS.md

## Work Log

- 2026-02-23: Issue identified during technical review by Agent-Native reviewer
