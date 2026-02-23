---
status: complete
priority: p2
issue_id: 011
tags: [agent-native, api-design, code-review]
dependencies: []
date: 2026-02-23
incorporated_in_plan: true
---

# Return Structured Result from runRiskTier

## Problem Statement

The `runRiskTier()` function returns `void`, making it unusable as a library function. Other code (e.g., GitHub Actions workflows) cannot call it programmatically.

## Findings

**Location:** `src/commands/risk-tier.ts` (planned)

**Current signature:**
```typescript
export function runRiskTier(options: RiskTierOptions): void {
  const contract = loadContract(options.contractPath);
  const tier = resolveOverallTier(options.files, contract);
  console.info(`Risk Tier: ${tier}`);
}
```

**Problems:**
1. Returns void - caller cannot get result
2. Outputs directly to console - not reusable
3. No error handling structure

## Proposed Solutions

### Solution A: Return structured result (Recommended)

```typescript
export interface RiskTierResult {
  ok: true;
  tier: RiskTier;
  filesAnalyzed: number;
  fileTiers: Record<string, RiskTier>;
}

export interface RiskTierError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type RiskTierOutcome = RiskTierResult | RiskTierError;

export function runRiskTier(options: RiskTierOptions): RiskTierOutcome {
  try {
    const contract = loadContract(options.contractPath);
    const resolve = createResolver(contract.riskTierRules);
    const fileTiers = Object.fromEntries(
      options.files.map(f => [f, resolve(f)])
    );
    const tier = resolveOverallTier(options.files, contract);

    return {
      ok: true,
      tier,
      filesAnalyzed: options.files.length,
      fileTiers
    };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: e instanceof ContractLoadError ? 'VALIDATION_ERROR' : 'SYSTEM_ERROR',
        message: sanitizeError(e),
        details: e instanceof ContractLoadError ? e.errors : undefined
      }
    };
  }
}

// CLI wrapper handles output
export function runRiskTierCLI(options: RiskTierOptions, json: boolean): number {
  const result = runRiskTier(options);

  if (result.ok) {
    if (json) {
      console.log(JSON.stringify(result));
    } else {
      console.info(`Risk Tier: ${result.tier}`);
      console.info(`Files analyzed: ${result.filesAnalyzed}`);
    }
    return 0;
  } else {
    console.error(result.error.message);
    return 1;
  }
}
```

**Pros:** Reusable, testable, structured errors
**Cons:** More code
**Effort:** Medium
**Risk:** Low

### Solution B: Throw on error, return result on success

```typescript
export function runRiskTier(options: RiskTierOptions): RiskTierResult {
  // Throws on error
}
```

**Pros:** Simpler success path
**Cons:** Errors via exceptions, not structured
**Effort:** Small
**Risk:** Low

**Recommendation:** Solution A for proper agent-native design. The `ok: true | false` pattern is idiomatic and testable.

## Technical Details

**Affected files:**
- `src/commands/risk-tier.ts` (refactor to return result)
- `src/commands/risk-tier.test.ts` (test new interface)

## Acceptance Criteria

- [ ] `runRiskTier()` returns `RiskTierOutcome` type
- [ ] CLI wrapper handles output formatting
- [ ] Errors returned in structure, not thrown
- [ ] Tests verify both success and error paths

## Work Log

- 2026-02-23: Issue identified during technical review by Agent-Native reviewer
