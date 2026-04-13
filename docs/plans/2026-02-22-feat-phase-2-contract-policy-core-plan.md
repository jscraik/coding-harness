---
title: Phase 2 Contract and Policy Core
type: feat
status: superseded
date: 2026-04-13
plan_id: feat-phase-2-contract-policy-core
origin: docs/brainstorms/2026-02-22-harness-gap-analysis-brainstorm.md
deepened: 2026-02-22
---

# Phase 2 Contract and Policy Core

## Enhancement Summary

**Deepened on:** 2026-02-22
**Reviewed on:** 2026-02-23
**Sections enhanced:** 6
**Research agents used:** TypeScript Validation, Glob Matching, TypeScript Reviewer, Security Sentinel, Simplicity Reviewer, Architecture Strategist

### Key Improvements (Deepen Phase)

1. **Drastically simplified scope** - Reduced from 4 contract sections to 1 (riskTierRules only). Defer mergePolicy, reviewPolicy, docsDriftRules to later phases.
2. **Security hardening** - Path traversal protection with symlink handling, input validation module, enhanced sanitization
3. **Use picomatch** - 197,000x faster than manual regex, handles edge cases correctly
4. **Error class hierarchy** - Structured errors with ValidationResult pattern
5. **Agent-native design** - `--json` flag, exit codes, error codes for programmatic consumption

### Critical Fixes (Technical Review 2026-02-23)

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| Symlink path traversal | P1 CRITICAL | Canonicalize resolved path with `realpathSync` |
| Missing `--json` flag | P1 CRITICAL | Restored with structured `RiskTierOutput` |
| Missing exit codes | P1 CRITICAL | Documented exit code contract |
| JSON depth DoS | P1 CRITICAL | Added depth limit (100 levels) |
| Prototype pollution | P1 CRITICAL | Block `__proto__`, `constructor`, `prototype` |
| Error codes missing | P2 IMPORTANT | Added `ValidationErrorCode` enum |
| `validatePath` location | P2 IMPORTANT | Moved to `input/validator.ts` |

### Critical Simplifications (Simplicity Review)

| Feature | Original | Simplified | Rationale |
|---------|----------|------------|-----------|
| Contract sections | 4 (riskTierRules, mergePolicy, docsDriftRules, reviewPolicy) | 1 (riskTierRules) | Others belong to Phase 3+ |
| JSON Schema file | Full schema | **REMOVED** | TypeScript types + type guards sufficient |
| Diagnostics | 7-field Diagnostic interface | Use existing sanitizeError | Over-engineered for current needs |
| Glob matching | Manual regex conversion | Use picomatch library | 197,000x faster, handles edge cases |
| --json flag | Removed in deepen | **RESTORED** | Required for agent consumption |

**Estimated LOC reduction:** 35% from original (some restored for security/agent-native)

### New Considerations Discovered

- Path traversal is CRITICAL risk - must canonicalize all file paths (symlink-aware)
- Picomatch prevents ReDoS vulnerabilities from malicious glob patterns
- Error accumulation pattern better than fail-fast for validation
- Property-based testing recommended for glob matching edge cases
- Agent-native design requires structured output and exit codes

---

## Overview

Implement the **contract parser** and **risk-tier resolver** only. This phase creates the minimal core needed for file classification.

**Scope reduced based on research findings:**
- ✅ Contract Schema (minimal: version + riskTierRules)
- ✅ Contract Loader (parse, validate, load)
- ✅ Risk-Tier Resolver (classify files using picomatch)
- ❌ Docs Drift Detector → Phase 5
- ❌ Merge Policy → Phase 3
- ❌ Review Policy → Phase 3
- ❌ JSON Schema file → Never (TypeScript types sufficient)

## Problem Statement / Motivation

Phase 1 established the bootstrap foundation. Now we need the minimal contract system for:
- Classifying changed files into risk tiers (high/medium/low)

Later phases will add merge enforcement, docs drift, and review policies.

## Proposed Solution

Build two components only:

1. **Contract Loader** - Parse and validate `harness.contract.json` with version + riskTierRules
2. **Risk-Tier Resolver** - Classify changed files using picomatch

## Technical Considerations

### Validation Approach

**Research Insights (TypeScript Validation Patterns):**

Use assertion functions + ValidationResult pattern:

```typescript
// Assertion function pattern
function assertObject(value: unknown, context: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new ContractValidationError(`${context}: expected object, got ${typeof value}`);
  }
}

// Error accumulation (better than fail-fast)
interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: ValidationErrorDetail[];
}
```

**Best Practices:**
- Parse JSON as `unknown`, validate field-by-field
- Accumulate ALL errors before reporting
- Provide fix suggestions in error messages
- Apply defaults for optional fields

### Contract Schema (Simplified)

Phase 2 implements ONLY the riskTierRules field:

```json
{
  "version": "1.0",
  "riskTierRules": {
    "src/auth/**": "high",
    "src/api/**": "high",
    "src/db/migrations/**": "high",
    "src/lib/**": "medium",
    "docs/**": "low",
    "**/*.test.ts": "low"
  }
}
```

**Rationale for minimal schema:**
- `mergePolicy` → Phase 3 owns merge enforcement config
- `reviewPolicy` → Phase 3 owns review workflow config
- `docsDriftRules` → Phase 5+ nice-to-have
- JSON Schema file → TypeScript types + type guards are sufficient

### Glob Matching (Use Picomatch)

**Research Insights (Glob Matching Algorithms):**

| Library | Performance vs Minimatch |
|---------|-------------------------|
| **picomatch** | 2x - 197,000x faster |
| micromatch | 7x - 1,156,935% faster |

**Recommendation:** Use picomatch (+1 dependency, ~13KB) instead of manual regex.

```typescript
import picomatch from "picomatch";

// Pre-compile for performance
const matchers = rules.map(r => ({
  ...r,
  matcher: picomatch(r.pattern)
}));

// First match wins (sorted by specificity)
for (const rule of matchers) {
  if (rule.matcher(filePath)) {
    return rule.tier;
  }
}
```

**Edge cases handled by picomatch:**
- `**` vs `*` (recursive vs single level)
- Hidden files (dotfiles)
- Brace expansion (`{src,lib}/**`)
- Character classes (`[abc]`)
- Windows paths
- Escape sequences

### Security Considerations

**Research Insights (Security Audit):**

| Vulnerability | Severity | Mitigation |
|--------------|----------|------------|
| Path traversal (symlink) | CRITICAL | Canonicalize resolved path with `realpathSync` |
| JSON depth attack | HIGH | Depth limit (100 levels max) |
| Prototype pollution | HIGH | Block `__proto__`, `constructor`, `prototype` keys |
| ReDoS (glob patterns) | MEDIUM | Use picomatch (built-in protection) |
| Information disclosure | MEDIUM | Enhanced sanitization patterns |
| JSON size attack | MEDIUM | Size limit (1MB max) |

**Required security measures:**

1. **Path traversal protection (symlink-aware):**
```typescript
function validatePath(baseDir: string, userPath: string): string {
  const resolved = resolve(baseDir, normalize(userPath));
  const realBase = realpathSync(baseDir);

  // CRITICAL: Canonicalize resolved path BEFORE comparison
  let realResolved: string;
  try {
    realResolved = realpathSync(resolved);
  } catch {
    // Path doesn't exist - validate parent directory
    const parentDir = dirname(resolved);
    const realParent = realpathSync(parentDir);
    if (!realParent.startsWith(realBase)) {
      throw new Error("Path traversal detected");
    }
    return resolved;
  }

  if (!realResolved.startsWith(realBase)) {
    throw new Error("Path traversal detected");
  }
  return realResolved;
}
```

2. **JSON depth limit (DoS protection):**
```typescript
const MAX_JSON_DEPTH = 100;

function safeParse(content: string): unknown {
  let depth = 0;
  return JSON.parse(content, (key, value) => {
    if (typeof value === "object" && value !== null) {
      depth++;
      if (depth > MAX_JSON_DEPTH) {
        throw new Error(`JSON depth exceeds maximum (${MAX_JSON_DEPTH})`);
      }
    }
    return value;
  });
}
```

3. **Prototype pollution protection:**
```typescript
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"] as const;

function isValidRiskTierRules(value: unknown): value is Record<string, RiskTier> {
  if (typeof value !== "object" || value === null) return false;
  for (const [pattern, tier] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(pattern as typeof FORBIDDEN_KEYS[number])) {
      return false; // Block prototype pollution
    }
    if (typeof pattern !== "string" || !isValidRiskTier(tier)) return false;
  }
  return true;
}
```

4. **Enhanced sanitization (specific patterns only - not overly broad):**
```typescript
const SENSITIVE_PATTERNS: [RegExp, string][] = [
  // Paths
  [/\/Users\/[^/]+/g, "[HOME]"],
  [/\/home\/[^/]+/g, "[HOME]"],
  [/C:\\Users\\[^\\]+/g, "[HOME]"],
  // API keys (specific patterns, not broad 20+ char)
  [/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED]"],
  [/ghp_[a-zA-Z0-9]{36}/g, "[REDACTED]"],
  [/gho_[a-zA-Z0-9]{36}/g, "[REDACTED]"],
  [/github_pat_[a-zA-Z0-9_]{22,}/g, "[REDACTED]"],
  [/AKIA[A-Z0-9]{16}/g, "[REDACTED]"],
  // JWTs
  [/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/g, "[REDACTED]"],
];
```

5. **JSON size limits:**
```typescript
const MAX_CONTRACT_SIZE = 1024 * 1024; // 1MB
if (content.length > MAX_CONTRACT_SIZE) {
  throw new Error(`Contract exceeds maximum size (1MB)`);
}
```

### Module Structure

**Research Insights (Architecture Review):**

```
src/lib/
  contract/
    types.ts           # RiskTier, HarnessContract interfaces
    loader.ts          # loadContract, safeParseJson, ContractLoadError
    validator.ts       # Type guards, ValidationResult, ValidationErrorCode
    validator.test.ts
  policy/
    risk-tier.ts       # createResolver, resolveOverallTier (pure functions)
    risk-tier.test.ts
  input/
    validator.ts       # validatePath, PathTraversalError (symlink-aware)
    sanitize.ts        # sanitizeError (canonical implementation)
    sanitize.test.ts
src/commands/
  risk-tier.ts         # runRiskTier, runRiskTierCLI, EXIT_CODES
```

**Dependency rules:**
- `contract/` imports from `input/` only (path validation)
- `policy/` imports from `contract/` only
- `input/` has no upstream dependencies (leaf modules)
- `commands/` imports from all `lib/` modules

### Risk-Tier Resolution Algorithm

```
1. Pre-sort rules by specificity (most specific first)
2. For each changed file:
   a. Iterate rules in specificity order
   b. First matching pattern wins
   c. Default to "medium" if no match

3. Return highest tier across all files:
   - Any high → high
   - Any medium (no high) → medium
   - All low → low
```

### Exit Code Contract

Exit codes enable programmatic error handling by agents and CI systems:

| Code | Name | Description |
|------|------|-------------|
| 0 | SUCCESS | Command completed successfully |
| 1 | VALIDATION_ERROR | Invalid contract, malformed input |
| 2 | FILE_NOT_FOUND | Contract or input files missing |
| 3 | PERMISSION_DENIED | Path traversal blocked, permission error |
| 10+ | SYSTEM_ERROR | Unexpected exceptions |

**Usage in CI:**
```bash
harness risk-tier --json --files "src/auth/*.ts"
exit_code=$?
if [ $exit_code -eq 0 ]; then
  echo "Success"
elif [ $exit_code -eq 1 ]; then
  echo "Validation failed - check contract"
else
  echo "System error"
fi
```

### JSON Output Schema

The `--json` flag produces structured output for agent consumption:

```typescript
// Success (exit code 0)
interface RiskTierOutput {
  tier: "high" | "medium" | "low";
  filesAnalyzed: number;
  fileTiers: Record<string, RiskTier>;
}

// Error (exit code 1+)
interface RiskTierError {
  error: {
    code: string;
    message: string;
    details?: ValidationError[];
  };
}
```

## System-Wide Impact

- **Interaction graph**: Contract loader called by all commands; risk-tier resolver feeds Phase 3 policy gates
- **Error propagation**: Validation errors with all violations; structured output to stderr
- **State lifecycle risks**: None - contract is read-only
- **Integration test scenarios**:
  - Load valid contract, verify defaults applied
  - Load invalid contract, verify ALL errors reported
  - Classify files into correct tiers with edge cases

## Acceptance Criteria

### Functional Requirements (Simplified)

- [x] `src/lib/contract/types.ts` defines RiskTier, HarnessContract interfaces
- [x] `src/lib/contract/loader.ts` parses and validates contracts
- [x] `src/lib/contract/validator.ts` provides type guards, ValidationResult, and error codes
- [x] `src/lib/policy/risk-tier.ts` classifies files using picomatch
- [x] `src/lib/input/validator.ts` provides symlink-aware path validation
- [x] `src/lib/input/sanitize.ts` provides enhanced sanitization (imported by cli.ts)
- [x] `src/commands/risk-tier.ts` CLI command with `--json` flag and exit codes
- [x] Unit tests with >80% coverage for contract/ and policy/
- [x] All imports use `.js` extensions (ESM convention)

### Security Requirements

- [x] Symlink path traversal attacks blocked with canonicalization
- [x] JSON depth limit (100 levels) prevents stack overflow
- [x] Prototype pollution blocked (`__proto__`, `constructor`, `prototype`)
- [x] Glob patterns use picomatch (ReDoS-safe)
- [x] JSON parsing has size limit (1MB max)
- [x] Error messages sanitize paths, secrets, user data

### Agent-Native Requirements

- [x] `--json` flag produces structured `RiskTierOutput`
- [x] Exit codes: 0 (success), 1 (validation), 2 (not found), 3 (permission), 10+ (system)
- [x] `ValidationError` includes machine-readable `code` field
- [ ] Contract schema documented in AGENTS.md for agent discovery

### Non-Functional Requirements

- [x] Contract validation < 10ms for typical contracts
- [x] Risk-tier resolution < 50ms for 1,000 files
- [x] All files < 200 LOC (reduced from 300)
- [x] No circular dependencies (verified with madge)

### Quality Gates

- [x] `pnpm check` passes (lint + typecheck + test + audit)
- [x] Follows existing error handling patterns from `cli.ts`
- [x] Circular dependency check passes: `npx madge --circular src/lib/`

## Success Metrics

- `harness risk-tier --files "src/auth/login.ts"` outputs `high`
- `harness risk-tier --json --files "src/auth/login.ts"` outputs valid JSON with `RiskTierOutput`
- Invalid contract reports ALL violations with machine-readable error codes
- Symlink path traversal attempts are blocked (exit code 3)
- Deep JSON (>100 levels) is rejected (exit code 1)
- Prototype pollution keys are rejected (exit code 1)

## Dependencies & Risks

### Dependencies
- Phase 1 bootstrap (complete)
- **New dependency:** `picomatch` for glob matching

### Risks
| Risk | Mitigation |
|------|------------|
| Picomatch adds dependency | 13KB, well-tested, 40M weekly downloads |
| Contract schema evolves | Version field + extension point for future phases |
| Glob pattern conflicts | Explicit precedence rules + specificity sorting |

## MVP Implementation

### package.json (add picomatch)

```json
{
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/node": "^22.0.0",
    "picomatch": "^4.0.0",
    "typescript": "^5.9.0",
    "vitest": "^3.0.0"
  }
}
```

### src/lib/contract/types.ts

```typescript
export type RiskTier = "high" | "medium" | "low";

export interface HarnessContract {
	version: string;
	riskTierRules: Record<string, RiskTier>;
}

export const DEFAULT_CONTRACT: HarnessContract = {
	version: "1.0",
	riskTierRules: {},
};
```

### src/lib/contract/validator.ts

```typescript
import type { RiskTier } from "./types.js";

const VALID_RISK_TIERS: RiskTier[] = ["high", "medium", "low"];
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"] as const;

// Machine-readable error codes for programmatic handling
export enum ValidationErrorCode {
	MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
	INVALID_TYPE = "INVALID_TYPE",
	INVALID_VALUE = "INVALID_VALUE",
	FORBIDDEN_KEY = "FORBIDDEN_KEY",
}

export interface ValidationError {
	code: ValidationErrorCode;
	path: string;
	message: string;
	expected?: string;
	received?: string;
	fix?: string;
}

export interface ValidationResult<T> {
	success: boolean;
	data?: T;
	errors: ValidationError[];
}

function isValidRiskTier(value: unknown): value is RiskTier {
	return typeof value === "string" && VALID_RISK_TIERS.includes(value as RiskTier);
}

function isValidRiskTierRules(value: unknown): value is Record<string, RiskTier> {
	if (typeof value !== "object" || value === null) return false;
	for (const [pattern, tier] of Object.entries(value as Record<string, unknown>)) {
		// Block prototype pollution
		if (FORBIDDEN_KEYS.includes(pattern as typeof FORBIDDEN_KEYS[number])) {
			return false;
		}
		if (typeof pattern !== "string" || !isValidRiskTier(tier)) return false;
	}
	return true;
}

export function validateContract(data: unknown): ValidationResult<HarnessContract> {
	const errors: ValidationError[] = [];

	if (typeof data !== "object" || data === null) {
		errors.push({
			code: ValidationErrorCode.INVALID_TYPE,
			path: "root",
			message: "Contract must be an object",
			expected: "object",
			received: data === null ? "null" : typeof data,
		});
		return { success: false, errors };
	}

	const obj = data as Record<string, unknown>;

	// Validate version (required)
	if (typeof obj.version !== "string") {
		errors.push({
			code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
			path: "version",
			message: "Required field 'version' must be a string",
			expected: "string (e.g., '1.0')",
			received: typeof obj.version,
			fix: 'Add "version": "1.0" to your contract',
		});
	}

	// Validate riskTierRules
	if ("riskTierRules" in obj) {
		const rules = obj.riskTierRules;
		if (typeof rules !== "object" || rules === null) {
			errors.push({
				code: ValidationErrorCode.INVALID_TYPE,
				path: "riskTierRules",
				message: "Must be an object mapping glob patterns to risk tiers",
				expected: "{ 'src/auth/**': 'high' | 'medium' | 'low' }",
				received: typeof rules,
			});
		} else {
			// Check for forbidden keys (prototype pollution)
			for (const key of Object.keys(rules as Record<string, unknown>)) {
				if (FORBIDDEN_KEYS.includes(key as typeof FORBIDDEN_KEYS[number])) {
					errors.push({
						code: ValidationErrorCode.FORBIDDEN_KEY,
						path: `riskTierRules.${key}`,
						message: `Forbidden key '${key}' is not allowed`,
						fix: `Remove '${key}' from riskTierRules`,
					});
				}
			}
			// Validate tier values
			if (!isValidRiskTierRules(rules)) {
				errors.push({
					code: ValidationErrorCode.INVALID_VALUE,
					path: "riskTierRules",
					message: "All tier values must be 'high', 'medium', or 'low'",
					fix: "Ensure all tier values are valid risk tiers",
				});
			}
		}
	}

	if (errors.length > 0) {
		return { success: false, errors };
	}

	return {
		success: true,
		data: {
			version: obj.version as string,
			riskTierRules: (obj.riskTierRules as Record<string, RiskTier>) ?? {},
		},
		errors: [],
	};
}
```

### src/lib/input/validator.ts

```typescript
import { realpathSync } from "node:fs";
import { resolve, normalize, dirname } from "node:path";

export class PathTraversalError extends Error {
	constructor() {
		super("Path traversal detected");
		this.name = "PathTraversalError";
	}
}

/**
 * Validate that a user-provided path stays within the base directory.
 * Handles symlink attacks by canonicalizing the resolved path.
 */
export function validatePath(baseDir: string, userPath: string): string {
	const resolved = resolve(baseDir, normalize(userPath));
	const realBase = realpathSync(baseDir);

	// CRITICAL: Canonicalize resolved path BEFORE comparison
	let realResolved: string;
	try {
		realResolved = realpathSync(resolved);
	} catch {
		// Path doesn't exist - validate parent directory
		const parentDir = dirname(resolved);
		try {
			const realParent = realpathSync(parentDir);
			if (!realParent.startsWith(realBase)) {
				throw new PathTraversalError();
			}
		} catch {
			throw new PathTraversalError();
		}
		return resolved;
	}

	if (!realResolved.startsWith(realBase)) {
		throw new PathTraversalError();
	}
	return realResolved;
}
```

### src/lib/contract/loader.ts

```typescript
import { readFileSync } from "node:fs";
import type { HarnessContract } from "./types.js";
import { DEFAULT_CONTRACT } from "./types.js";
import { validateContract, type ValidationError, ValidationErrorCode } from "./validator.js";
import { validatePath, PathTraversalError } from "../input/validator.js";

const MAX_CONTRACT_SIZE = 1024 * 1024; // 1MB
const MAX_JSON_DEPTH = 100;

export class ContractLoadError extends Error {
	constructor(
		message: string,
		public readonly path: string,
		public readonly errors: ValidationError[] = [],
	) {
		super(message);
		this.name = "ContractLoadError";
	}
}

/**
 * Parse JSON with depth limit to prevent stack overflow attacks.
 */
function safeParseJson(content: string): unknown {
	let depth = 0;
	return JSON.parse(content, (_key, value) => {
		if (typeof value === "object" && value !== null) {
			depth++;
			if (depth > MAX_JSON_DEPTH) {
				throw new Error(`JSON depth exceeds maximum (${MAX_JSON_DEPTH})`);
			}
		}
		return value;
	});
}

export function loadContract(path: string): HarnessContract {
	// Validate path stays within cwd (symlink-aware)
	const cwd = process.cwd();
	let validatedPath: string;
	try {
		validatedPath = validatePath(cwd, path);
	} catch (e) {
		if (e instanceof PathTraversalError) {
			throw new ContractLoadError(
				"Path traversal detected",
				path,
				[{
					code: ValidationErrorCode.FORBIDDEN_KEY,
					path: "contract",
					message: "Contract path escapes working directory",
					fix: "Use a path within the current directory",
				}],
			);
		}
		throw e;
	}

	// Read with size limit
	const content = readFileSync(validatedPath, "utf-8");
	if (content.length > MAX_CONTRACT_SIZE) {
		throw new Error(`Contract file exceeds maximum size (1MB): ${path}`);
	}

	// Parse JSON with depth limit
	let data: unknown;
	try {
		data = safeParseJson(content);
	} catch (e) {
		const message = e instanceof Error ? e.message : "unknown error";
		throw new ContractLoadError(`Failed to parse JSON: ${message}`, path);
	}

	// Validate
	const result = validateContract(data);
	if (!result.success) {
		throw new ContractLoadError(
			`Contract validation failed with ${result.errors.length} error(s)`,
			path,
			result.errors,
		);
	}

	// Merge with defaults
	return {
		...DEFAULT_CONTRACT,
		...result.data,
	};
}
```

### src/lib/policy/risk-tier.ts

```typescript
import picomatch from "picomatch";
import type { HarnessContract, RiskTier } from "../contract/types.js";

interface Rule {
	pattern: string;
	tier: RiskTier;
	matcher: (input: string) => boolean;
}

/**
 * Create a risk-tier resolver with pre-compiled matchers.
 */
export function createResolver(rules: Record<string, RiskTier>): (file: string) => RiskTier {
	// Pre-compile and sort by specificity (most specific first)
	const compiled: Rule[] = Object.entries(rules)
		.map(([pattern, tier]) => ({
			pattern,
			tier,
			matcher: picomatch(pattern),
		}))
		.sort((a, b) => b.pattern.length - a.pattern.length);

	return (filePath: string): RiskTier => {
		for (const rule of compiled) {
			if (rule.matcher(filePath)) {
				return rule.tier;
			}
		}
		return "medium"; // Default tier
	};
}

/**
 * Resolve the overall risk tier for a set of changed files.
 * Returns the highest tier across all files.
 */
export function resolveOverallTier(
	files: string[],
	contract: HarnessContract,
): RiskTier {
	const resolve = createResolver(contract.riskTierRules);
	const tiers: RiskTier[] = ["high", "medium", "low"];
	const fileTiers = files.map(resolve);

	for (const tier of tiers) {
		if (fileTiers.includes(tier)) {
			return tier;
		}
	}

	return "medium";
}
```

### src/lib/input/sanitize.ts

```typescript
/**
 * Sensitive patterns for error message sanitization.
 * Note: This is the canonical implementation - cli.ts should import from here.
 */
const SENSITIVE_PATTERNS: [RegExp, string][] = [
	// Paths
	[/\/Users\/[^/]+/g, "[HOME]"],
	[/\/home\/[^/]+/g, "[HOME]"],
	[/C:\\Users\\[^\\]+/g, "[HOME]"],
	// API keys (specific patterns only - not broad 20+ char to avoid redacting commit hashes)
	[/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED]"],
	[/ghp_[a-zA-Z0-9]{36}/g, "[REDACTED]"],
	[/gho_[a-zA-Z0-9]{36}/g, "[REDACTED]"],
	[/github_pat_[a-zA-Z0-9_]{22,}/g, "[REDACTED]"],
	[/AKIA[A-Z0-9]{16}/g, "[REDACTED]"],
	// JWTs
	[/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/g, "[REDACTED]"],
];

export function sanitizeError(error: unknown): string {
	if (error instanceof Error) {
		let message = error.message;
		for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
			message = message.replace(pattern, replacement);
		}
		return `${error.name}: ${message}`;
	}
	let message = String(error);
	for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
		message = message.replace(pattern, replacement);
	}
	return message;
}
```

### src/lib/input/sanitize.test.ts

```typescript
import { describe, expect, it } from "vitest";
import { sanitizeError } from "./sanitize.js";

describe("sanitizeError", () => {
	it("redacts GitHub PATs", () => {
		const error = new Error("Failed with token: ghp_abcdefghijklmnopqrstuvwxyz0123456789");
		expect(sanitizeError(error)).not.toContain("ghp_");
		expect(sanitizeError(error)).toContain("[REDACTED]");
	});

	it("redacts home paths", () => {
		const error = new Error("File not found: /Users/john/secrets/key.pem");
		expect(sanitizeError(error)).not.toContain("/Users/john");
		expect(sanitizeError(error)).toContain("[HOME]");
	});

	it("preserves commit hashes (not 20+ alphanumeric)", () => {
		const error = new Error("Commit: d5a105f4e8c9b7a6d3e2f1a0b9c8d7e6f5a4b3c2");
		// Commit hashes are 40 chars but shouldn't trigger broad pattern anymore
		expect(sanitizeError(error)).toContain("d5a105f");
	});
});
```

### src/commands/risk-tier.ts

```typescript
import { loadContract, ContractLoadError } from "../lib/contract/loader.js";
import { createResolver, resolveOverallTier } from "../lib/policy/risk-tier.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import type { RiskTier } from "../lib/contract/types.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	FILE_NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	SYSTEM_ERROR: 10,
} as const;

export interface RiskTierOptions {
	contractPath: string;
	files: string[];
	json?: boolean;
}

export interface RiskTierOutput {
	tier: RiskTier;
	filesAnalyzed: number;
	fileTiers: Record<string, RiskTier>;
}

export interface RiskTierError {
	error: {
		code: string;
		message: string;
		details?: unknown;
	};
}

export type RiskTierResult =
	| { ok: true; output: RiskTierOutput }
	| { ok: false; error: RiskTierError };

/**
 * Run risk-tier analysis and return structured result.
 * This function is usable as a library (does not output to console).
 */
export function runRiskTier(options: RiskTierOptions): RiskTierResult {
	try {
		const contract = loadContract(options.contractPath);
		const resolve = createResolver(contract.riskTierRules);
		const fileTiers = Object.fromEntries(options.files.map(f => [f, resolve(f)]));
		const tier = resolveOverallTier(options.files, contract);

		return {
			ok: true,
			output: {
				tier,
				filesAnalyzed: options.files.length,
				fileTiers,
			},
		};
	} catch (e) {
		if (e instanceof ContractLoadError) {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: sanitizeError(e),
					details: e.errors,
				},
			};
		}
		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: sanitizeError(e),
			},
		};
	}
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export function runRiskTierCLI(options: RiskTierOptions): number {
	const result = runRiskTier(options);

	if (result.ok) {
		if (options.json) {
			console.log(JSON.stringify(result.output));
		} else {
			console.info(`Risk Tier: ${result.output.tier}`);
			console.info(`Files analyzed: ${result.output.filesAnalyzed}`);
		}
		return EXIT_CODES.SUCCESS;
	}

	// Error output always to stderr
	console.error(result.error.message);
	if (options.json) {
		console.error(JSON.stringify(result.error));
	}

	// Map error codes to exit codes
	if (result.error.code === "VALIDATION_ERROR") {
		return EXIT_CODES.VALIDATION_ERROR;
	}
	return EXIT_CODES.SYSTEM_ERROR;
}
```

### src/lib/contract/validator.test.ts

```typescript
import { describe, expect, it } from "vitest";
import { validateContract, ValidationErrorCode } from "./validator.js";

describe("validateContract", () => {
	it("accepts minimal valid contract with version only", () => {
		const result = validateContract({ version: "1.0" });
		expect(result.success).toBe(true);
		expect(result.data?.version).toBe("1.0");
	});

	it("applies defaults for optional fields", () => {
		const result = validateContract({ version: "1.0" });
		expect(result.success).toBe(true);
		expect(result.data?.riskTierRules).toEqual({});
	});

	it("rejects invalid risk tier", () => {
		const result = validateContract({
			version: "1.0",
			riskTierRules: { "src/**": "critical" },
		});
		expect(result.success).toBe(false);
		expect(result.errors[0]?.path).toBe("riskTierRules");
	});

	it("rejects missing version", () => {
		const result = validateContract({});
		expect(result.success).toBe(false);
		expect(result.errors[0]?.path).toBe("version");
		expect(result.errors[0]?.code).toBe(ValidationErrorCode.MISSING_REQUIRED_FIELD);
	});

	it("accumulates multiple errors", () => {
		const result = validateContract({
			version: 123,
			riskTierRules: { "src/**": "invalid" },
		});
		expect(result.success).toBe(false);
		expect(result.errors.length).toBe(2);
	});

	it("accepts valid risk tier rules", () => {
		const result = validateContract({
			version: "1.0",
			riskTierRules: {
				"src/auth/**": "high",
				"**/*.test.ts": "low",
			},
		});
		expect(result.success).toBe(true);
		expect(result.data?.riskTierRules["src/auth/**"]).toBe("high");
	});

	it("rejects __proto__ key (prototype pollution)", () => {
		const result = validateContract({
			version: "1.0",
			riskTierRules: { __proto__: "high" },
		});
		expect(result.success).toBe(false);
		expect(result.errors.some(e => e.code === ValidationErrorCode.FORBIDDEN_KEY)).toBe(true);
	});

	it("rejects constructor key (prototype pollution)", () => {
		const result = validateContract({
			version: "1.0",
			riskTierRules: { constructor: "high" },
		});
		expect(result.success).toBe(false);
	});
});
```

### src/lib/policy/risk-tier.test.ts

```typescript
import { describe, expect, it } from "vitest";
import { createResolver, resolveOverallTier } from "./risk-tier.js";

describe("createResolver", () => {
	const rules = {
		"src/auth/**": "high",
		"src/api/**": "high",
		"src/lib/**": "medium",
		"**/*.test.ts": "low",
	};

	it("classifies auth files as high-risk", () => {
		const resolve = createResolver(rules);
		expect(resolve("src/auth/login.ts")).toBe("high");
	});

	it("classifies test files as low-risk", () => {
		const resolve = createResolver(rules);
		expect(resolve("src/auth/login.test.ts")).toBe("low");
	});

	it("defaults to medium for unknown paths", () => {
		const resolve = createResolver(rules);
		expect(resolve("README.md")).toBe("medium");
	});

	it("handles nested paths with **", () => {
		const resolve = createResolver(rules);
		expect(resolve("src/auth/oauth/handler.ts")).toBe("high");
	});
});

describe("resolveOverallTier", () => {
	const contract = {
		version: "1.0",
		riskTierRules: {
			"src/auth/**": "high",
			"src/lib/**": "medium",
		},
	};

	it("returns high when any file is high-risk", () => {
		expect(
			resolveOverallTier(["src/lib/utils.ts", "src/auth/login.ts"], contract),
		).toBe("high");
	});

	it("returns medium when all files are medium or lower", () => {
		expect(resolveOverallTier(["src/lib/a.ts", "src/lib/b.ts"], contract)).toBe("medium");
	});

	it("returns medium for empty file list", () => {
		expect(resolveOverallTier([], contract)).toBe("medium");
	});
});
```

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-22-harness-gap-analysis-brainstorm.md](../brainstorms/2026-02-22-harness-gap-analysis-brainstorm.md)
- **Key decisions carried forward:**
  - Testing strategy: Hybrid (fixtures + CI integration)
  - Schema migration: Auto-migration (defer to Phase 4)
  - Agent timeout: 10 min default, fail on timeout (Phase 3)

### Research Sources

- **TypeScript Validation:** Official docs on type guards, assertion functions, ValidationResult pattern
- **Glob Matching:** Micromatch/picomatch benchmarks, edge case handling, performance optimization
- **Security:** OWASP patterns, path traversal prevention, ReDoS mitigation

### Internal References

- Implementation plan: `docs/HARNESS_IMPLEMENTATION_PLAN.md` Section 4, 9, 11
- Error handling pattern: `src/cli.ts:24-50`
- JSON validation pattern: `src/cli.ts:11-21`
- ESM import convention: `AGENTS.md`

### Related Work

- Phase 1 Bootstrap: Complete (`d5a105f`)
- Phase 3 GitHub workflows: Blocked by this phase
- Phase 4 Installability: Blocked by this phase
