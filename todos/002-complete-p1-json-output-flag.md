---
status: complete
priority: p1
issue_id: 002
tags: [agent-native, cli, code-review]
dependencies: []
date: 2026-02-23
incorporated_in_plan: true
---

# Missing --json Output Flag for Programmatic Consumption

## Problem Statement

The plan removed the `--json` flag citing "no consumer yet", but the harness itself is the consumer. Agents, GitHub Actions workflows, and automation need structured output to parse CLI results reliably.

## Findings

**Location:** `src/commands/risk-tier.ts` (planned)

**Current plan output:**
```typescript
console.info(`Risk Tier: ${tier}`);
console.info(`Files analyzed: ${options.files.length}`);
```

**Problem:** This human-readable output is fragile for agents:
- Parsing depends on exact format string
- Internationalization could break parsers
- No structured way to get file-level tiers

**Agent-Native Score impact:** Without --json, only 3/6 capabilities are agent-accessible.

## Proposed Solutions

### Solution A: Add --json flag with structured output (Recommended)

```typescript
export interface RiskTierOutput {
  tier: RiskTier;
  filesAnalyzed: number;
  fileTiers: Record<string, RiskTier>;
}

export function runRiskTier(options: RiskTierOptions, json: boolean): void {
  const contract = loadContract(options.contractPath);
  const resolve = createResolver(contract.riskTierRules);
  const fileTiers = Object.fromEntries(
    options.files.map(f => [f, resolve(f)])
  );
  const tier = resolveOverallTier(options.files, contract);

  const output: RiskTierOutput = { tier, filesAnalyzed: options.files.length, fileTiers };

  if (json) {
    console.log(JSON.stringify(output));
  } else {
    console.info(`Risk Tier: ${tier}`);
    console.info(`Files analyzed: ${options.files.length}`);
  }
}
```

**Pros:** Enables agent consumption, machine-readable
**Cons:** Adds one flag to CLI surface
**Effort:** Small
**Risk:** Low

### Solution B: Return structured result from function

```typescript
export function runRiskTier(options: RiskTierOptions): RiskTierOutput {
  // ... compute ...
  return { tier, filesAnalyzed, fileTiers };
}

// CLI wrapper handles output formatting
```

**Pros:** Function is testable and reusable
**Cons:** Doesn't solve CLI output issue alone
**Effort:** Small
**Risk:** Low

**Recommendation:** Implement both - function returns structured result, CLI wrapper adds --json flag.

## Technical Details

**Affected files:**
- `src/commands/risk-tier.ts` (implementation)
- `src/commands/risk-tier.test.ts` (tests needed)

## Acceptance Criteria

- [ ] `--json` flag produces valid JSON output
- [ ] Output includes tier, filesAnalyzed, and fileTiers
- [ ] Human-readable output unchanged (default behavior)
- [ ] Exit code 0 on success, non-zero on failure

## Work Log

- 2026-02-23: Issue identified during technical review by Agent-Native reviewer
