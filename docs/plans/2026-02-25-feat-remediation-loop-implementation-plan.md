---
title: Remediation Loop Implementation
type: feat
status: superseded
date: 2026-02-25
plan_id: feat-remediation-loop-implementation
origin: docs/brainstorms/2026-02-24-code-factory-remediation-gap-loop-brainstorm.md
deepened: 2026-02-25
---

# Remediation Loop Implementation

## Enhancement Summary

**Deepened on:** 2026-02-25
**Reviewed on:** 2026-02-25
**Sections enhanced:** 6
**Research agents used:** TypeScript Reviewer, Security Sentinel, Architecture Strategist, Performance Oracle, Simplicity Reviewer, Context7

### Key Improvements
1. **Security hardening** - Path validation, TOCTOU race condition fixes, cryptographic markers
2. **Performance optimizations** - Batch ancestry checks, SHA deduplication, caching strategy
3. **Type safety** - Exhaustive checking, discriminated unions, type guards
4. **Simplified architecture** - Removed barrel export, reuse existing validators

### P1 Critical Fixes Applied (Technical Review)
1. **Reuse existing path validation** - Use `validatePath()` from `src/lib/input/validator.ts` instead of creating duplicate module
2. **GitHubClient adapter pattern** - Document that orchestrator interface needs adapter to existing client
3. **MARKER_SECRET hardening** - Require secret in production, no fallback to 'default'
4. **Multiple TOCTOU checkpoints** - Add start, mid-processing, and end HEAD verification
5. **Type guards for unknown inputs** - Replace unsafe `as` assertions with proper type guards

### New Considerations Discovered
- Tier bypass vulnerability in `tierAllowsAuto()` (severity validation edge case) - FIXED
- SHA ancestry check TOCTOU race condition - FIXED with multiple checkpoints
- Sequential API calls creating 5-10x performance overhead - FIXED with batching
- Provider extensibility locked by hardcoded `greptile`/`codex` values - Documented as v1 scope

---

## Overview

Build the remediation library (types, finding-normalizer, orchestrator) and wire up the `remediate` command to complete Phase 2 of the Deterministic Remediation Gap Loop. The `gap-case` command is already implemented; this plan focuses on the remediation side.

## Problem Statement / Motivation

The `remediate.ts` command exists as a stub but lacks the core logic to:
1. Normalize findings from Greptile and Codex into a canonical format
2. Orchestrate remediation actions (commit, push, comment) based on severity
3. Respect policy constraints (tier limits, dry-run defaults, evidence requirements)

This creates a gap in the deterministic loop: findings are generated but cannot be systematically processed.

## Proposed Solution

Implement a three-layer architecture:
1. **Types layer** (`src/lib/remediation/types.ts`) - Canonical finding schema and action types
2. **Normalization layer** (`src/lib/remediation/finding-normalizer.ts`) - Provider-specific adapters
3. **Orchestration layer** (`src/lib/remediation/orchestrator.ts`) - Policy-driven action execution

## Technical Considerations

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     remediate.ts (CLI)                      │
│  Parses args, calls orchestrator, formats output            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   orchestrator.ts                            │
│  - Loads RemediationPolicy from contract                    │
│  - Filters findings by tier/age/evidence                    │
│  - Decides actions: commit/push/comment/skip                │
│  - Executes with retry/timeout                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                finding-normalizer.ts                         │
│  - normalizeCodeqlFinding() → CanonicalFinding              │
│  - normalizeCodexFinding() → CanonicalFinding               │
│  - Validates SHAs, timestamps, required fields              │
│  - NEW: Path validation, input bounds checking              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      types.ts                                │
│  CanonicalFinding, RemediationAction, RemediationResult     │
│  NEW: Exhaustive error codes, branded types                 │
└─────────────────────────────────────────────────────────────┘
```

### Research Insights: Architecture

**Best Practices:**
- Use provider registry pattern for extensibility (avoid hardcoded providers)
- Extract presenter layer for CLI output to improve testability
- Unified error taxonomy across validation and remediation layers

**Provider Extensibility Pattern:**
```typescript
// Future-proof provider interface
interface FindingProvider<T = unknown> {
  readonly name: string;
  normalize(raw: T): NormalizedFinding[];
  isStale(finding: NormalizedFinding, headSha: string): boolean;
}

// Registry allows adding providers without code changes
const providers = new Map<string, FindingProvider>();
```

**References:**
- Existing patterns in `src/lib/contract/types.ts` and `src/commands/gap-case.ts`

### Key Design Decisions (from brainstorm)

1. **Greptile + Codex only in v1** - Scope to known providers
2. **Low/medium auto-commit, high remains human-mediated** - Tier-based automation
3. **SHA-bound findings** - Ignore stale findings (commit not in HEAD ancestry)
4. **Canonical rerun with marker dedupe** - Use HTML markers for comment deduplication

### Research Insights: Security

**CRITICAL - Path Validation (P1 FIX: Reuse Existing):**

Findings contain `filePath` from untrusted sources. **REUSE existing `validatePath()` from `src/lib/input/validator.ts`** instead of creating a duplicate module:

```typescript
// finding-normalizer.ts - REUSE existing validator
import { validatePath, PathTraversalError } from "../input/validator.js";

// Add shell metacharacter check as additional layer (not replacement)
const SHEL_METACHAR_PATTERN = /[<>|&;$`\\]/;

function validateFindingPath(rawPath: string, repoRoot: string): PathValidationResult {
  // Additional check for shell metacharacters (defense in depth)
  if (SHELL_METACHAR_PATTERN.test(rawPath)) {
    return { ok: false, error: "Shell metacharacters in path", code: "E_INVALID_CHARS" };
  }

  // Reuse existing battle-tested validator
  try {
    const safePath = validatePath(repoRoot, rawPath);
    return { ok: true, safePath };
  } catch (e) {
    if (e instanceof PathTraversalError) {
      return { ok: false, error: "Path traversal detected", code: "E_PATH_TRAVERSAL" };
    }
    throw e;
  }
}
```

**HIGH - Tier Bypass Vulnerability:**

Current `tierAllowsAuto()` allows bypass if severity is unknown:
```typescript
// VULNERABLE: indexOf returns -1 for unknown, and -1 <= 0 is true
const tierIdx = SEVERITY_ORDER.indexOf(tier);
return tierIdx <= maxIdx;

// FIXED: Explicit validation
const SEVERITY_RANK: Record<RemediationSeverity, number> = { low: 0, medium: 1, high: 2 };
function tierAllowsAuto(tier: RemediationSeverity, maxTier: RemediationSeverity): boolean {
  if (!(tier in SEVERITY_RANK) || !(maxTier in SEVERITY_RANK)) return false;
  return SEVERITY_RANK[tier] <= SEVERITY_RANK[maxTier];
}
```

**HIGH - TOCTOU Race Condition (P1 FIX: Multiple Checkpoints):**

SHA ancestry check is non-atomic. Must verify HEAD at multiple points:

```typescript
async remediate(): Promise<RemediationOutcome> {
  // P1 FIX: Fetch fresh HEAD at start, don't trust input
  const initialHead = this.github ? await this.github.getHeadSha() : this.headSha;

  // ... ancestry checks ...

  // P1 FIX: Mid-processing check before action decisions
  if (this.github) {
    const midHead = await this.github.getHeadSha();
    if (midHead !== initialHead) {
      return { ok: false, error: { code: 'E_RACE_DETECTED', message: 'HEAD changed mid-processing' } };
    }
  }

  // ... determine actions ...

  // P1 FIX: Final check before return
  if (this.github) {
    const finalHead = await this.github.getHeadSha();
    if (finalHead !== initialHead) {
      return { ok: false, error: { code: 'E_RACE_DETECTED', message: 'HEAD changed during remediation' } };
    }
  }
}
```

**MEDIUM - Cryptographic Markers (P1 FIX: No Fallback):**

Static HTML markers can be spoofed. Use cryptographic markers **WITH REQUIRED SECRET**:
```typescript
export function generateSecureMarker(findingId: string, headSha: string): string {
  // P1 FIX: REQUIRE secret, no fallback to 'default'
  const secret = process.env.MARKER_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("MARKER_SECRET must be set and >= 32 characters for secure markers");
  }
  const payload = `${findingId}:${headSha}`;
  const hash = createHash('sha256')
    .update(payload)
    .update(secret)
    .digest('hex')
    .slice(0, 16);
  return `<!-- harness-remediation-${hash} -->`;
}
```

### Research Insights: Performance

**CRITICAL - Sequential API Calls:**

Current design makes O(n) API calls for ancestry checks. At 100 findings: ~10-30 seconds.

**Solution - Batch with Concurrency:**
```typescript
const BATCH_SIZE = 10;
for (let i = 0; i < findings.length; i += BATCH_SIZE) {
  const batch = findings.slice(i, i + BATCH_SIZE);
  const results = await Promise.all(
    batch.map(f => this.github.isAncestor(f.commitSha, this.headSha))
  );
}
```

**Expected Improvement:** 5-10x faster (from ~15s to ~2s for 100 findings)

**SHA Deduplication:**

Multiple findings often share the same commit SHA. Group before checking:

```typescript
const uniqueShas = new Set(findings.map(f => f.commitSha));
// Only check unique SHAs, not all findings
for (const sha of uniqueShas) {
  if (sha !== headSha) {  // Skip HEAD SHA check
    ancestryCache.set(sha, await this.github.isAncestor(sha, headSha));
  }
}
```

**Expected Improvement:** 50-80% reduction in API calls

### Error Classification

Follow existing patterns in the codebase:
- Exit codes: `SUCCESS=0, USAGE=2, POLICY=3, PARTIAL=4, INTERNAL=10`
- Result type: `{ ok: true; output } | { ok: false; error: { code, message, details? } }`

### Research Insights: TypeScript Best Practices

**Exhaustive Checking:**
```typescript
// Use never type for exhaustive checking
function handleResult(result: RemediationOutcome): void {
  if (result.ok) {
    // handle success
  } else {
    switch (result.error.code) {
      case "E_GITHUB": // handle
      case "E_POLICY": // handle
      // ... all other codes
      default:
        const _exhaustive: never = result.error.code;
        throw new Error(`Unhandled: ${_exhaustive}`);
    }
  }
}
```

**Discriminated Unions - Inline for Simplicity:**
```typescript
// Instead of separate interfaces:
export type NormalizerOutcome =
  | { ok: true; finding: CanonicalFinding }
  | { ok: false; error: { code: NormalizerErrorCode; message: string; raw?: unknown } };
```

**Branded Types for IDs:**
```typescript
type FindingId = string & { readonly __brand: "FindingId" };
type Sha = string & { readonly __brand: "Sha" };
```

### GitHub Integration

- Use existing Octokit client with throttling/retry plugins
- **Reuse existing `isValidSha()` from `src/lib/github/sha.js`** (don't duplicate regex)
- Comment dedupe: Cryptographic marker + 24h window

## System-Wide Impact

### Interaction Graph

```
remediate command
  → loadContract() (contract/loader.ts)
  → RemediationOrchestrator.remediate()
    → GitHub API (commits, pushes, comments)
    → FindingNormalizer.normalize()
  → gap-case command (if auto-resolve enabled)
```

### Error & Failure Propagation

- GitHub API errors → retry with exponential backoff (existing client)
- Validation errors → return `{ ok: false, error: { code: "E_VALIDATION" } }`
- Policy violations → return `{ ok: false, error: { code: "E_POLICY" } }`
- Partial success → return with `PARTIAL` exit code and details
- **NEW:** Race detection → return `{ ok: false, error: { code: "E_RACE_DETECTED" } }`

### State Lifecycle Risks

- **Orphaned commits**: If push fails after commit → auto-rollback via `git reset`
- **Duplicate comments**: Cryptographic marker-based deduplication prevents spoofing
- **Stale findings**: SHA ancestry check + HEAD verification prevents TOCTOU
- **Concurrent runs**: Add distributed lock using GitHub commit status

## Acceptance Criteria

### Functional Requirements

- [ ] `src/lib/remediation/types.ts` defines `CanonicalFinding`, `RemediationAction`, `RemediationOutcome`
- [ ] `src/lib/remediation/finding-normalizer.ts` normalizes Greptile and Codex findings with path validation
- [ ] `src/lib/remediation/orchestrator.ts` implements tier-based action orchestration with batched checks
- [ ] `src/commands/remediate.ts` wired to use the new library
- [ ] SHA ancestry validation prevents stale finding processing (with TOCTOU protection)
- [ ] Comment deduplication with cryptographic markers works correctly
- [ ] Policy constraints (tier limits, dry-run, evidence) are enforced
- [ ] **NEW:** Path validation prevents command injection and traversal attacks
- [ ] **NEW:** Tier bypass vulnerability fixed with explicit severity validation

### Non-Functional Requirements

- [ ] Unit tests for each library module (>80% coverage)
- [ ] Integration tests for orchestration flow
- [ ] All existing tests continue to pass
- [ ] `pnpm check` passes (lint, typecheck, test)
- [ ] **NEW:** Batch ancestry checks achieve 5x+ performance improvement

### Quality Gates

- [ ] Code review approval
- [ ] No security vulnerabilities in new dependencies (if any)
- [ ] Error messages are actionable and include error codes
- [ ] **NEW:** Exhaustive type checking passes for all discriminated unions

### Security Gates

- [ ] Path validation blocks traversal and injection patterns
- [ ] No hardcoded secrets or static markers
- [ ] TOCTOU race condition mitigated with HEAD verification
- [ ] Tier bypass vulnerability fixed

## Success Metrics

- Deterministic remediation loop completes end-to-end
- Zero manual intervention for low/medium tier findings
- Audit trail preserved in gap-case records
- **NEW:** <3 second processing time for 100 findings

## Dependencies & Risks

### Dependencies

- Existing `RemediationPolicy` in `src/lib/contract/types.ts`
- GitHub Octokit client with plugins
- `gap-case` command for auto-resolve
- **Reuse:** `isValidSha()` from `src/lib/github/sha.js`

### Risks

| Risk | Mitigation | Priority |
|------|------------|----------|
| GitHub API rate limits | Throttling plugin + retry logic + batching | High |
| Partial failures | Atomic operations where possible, rollback on error | High |
| Stale findings | SHA ancestry validation + HEAD verification | Critical |
| Command injection | Path validation with forbidden patterns | Critical |
| Tier bypass | Explicit severity validation | High |
| TOCTOU race | HEAD change detection | High |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-24-code-factory-remediation-gap-loop-brainstorm.md](../brainstorms/2026-02-24-code-factory-remediation-gap-loop-brainstorm.md)
- Key decisions carried forward: Greptile+Codex v1 scope, tier-based automation, SHA-bound findings, marker dedupe

### Internal References

- Contract types: `src/lib/contract/types.ts`
- Gap-case command: `src/commands/gap-case.ts`
- Existing remediate stub: `src/commands/remediate.ts`
- Result patterns: `src/commands/gap-case.ts:74-87`
- SHA validation: `src/lib/github/sha.ts` (reuse, don't duplicate)
- Input sanitization: `src/lib/input/sanitize.ts`

### External References

- TypeScript Discriminated Unions: https://www.typescriptlang.org/docs/handbook/2/narrowing
- GitHub API Rate Limits: https://docs.github.com/en/rest/rate-limit

---

## Task 1: Create Types Module

**Files:**
- Create: `src/lib/remediation/types.ts`
- Test: Skip (type correctness enforced by TypeScript at compile time)

**Step 1: Write the types**

```typescript
// src/lib/remediation/types.ts
import type { RemediationAutoTier } from "../contract/types.js";

// Reuse existing tier type from contract
export type RemediationSeverity = RemediationAutoTier;
export type RemediationProvider = "greptile" | "codex";
export type RemediationActionType = "commit" | "push" | "comment" | "skip";

// Typed error codes (not loose strings)
export type NormalizerErrorCode = "E_PARSE_FAILURE" | "E_MISSING_FIELD" | "E_INVALID_SHA" | "E_INVALID_PATH";
export type RemediationErrorCode = "E_VALIDATION" | "E_POLICY" | "E_GITHUB" | "E_RACE_DETECTED" | "E_INTERNAL";

// CanonicalFinding split by concern for clarity
interface FindingBase {
  id: string;
  provider: RemediationProvider;
  severity: RemediationSeverity;
  title: string;
  description: string;
}

interface FindingLocation {
  filePath: string;  // Validated path (no traversal)
  lineStart: number;
  lineEnd?: number;
}

interface FindingContext {
  commitSha: string;
  discoveredAt: string;
  evidence?: string;
}

export interface CanonicalFinding extends FindingBase, FindingLocation, FindingContext {}

export interface RemediationAction {
  type: RemediationActionType;
  findingId: string;
  reason: string;
  dryRun: boolean;
}

// Inline discriminated union (simpler than separate interfaces)
export type NormalizerOutcome =
  | { ok: true; finding: CanonicalFinding }
  | { ok: false; error: { code: NormalizerErrorCode; message: string; raw?: unknown } };

export type RemediationOutcome =
  | { ok: true; output: { findingsProcessed: number; actions: RemediationAction[]; skipped: Array<{ findingId: string; reason: string }>; telemetry?: { apiCalls: number; cacheHits: number } } }
  | { ok: false; error: { code: RemediationErrorCode; message: string; context?: Record<string, unknown> } };
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/lib/remediation/types.ts
git commit -m "feat(remediation): add canonical types with exhaustive error codes"
```

---

## Task 2: Create Finding Normalizer

**Files:**
- Create: `src/lib/remediation/finding-normalizer.ts`
- **P1 FIX: No separate path-validator.ts** - Reuse existing `validatePath()` from `src/lib/input/validator.ts`
- Test: `src/lib/remediation/finding-normalizer.test.ts`

**Step 1: Implement normalizer (with type guards and reused validation)**

```typescript
// src/lib/remediation/finding-normalizer.ts
import type { NormalizerOutcome, CanonicalFinding, RemediationSeverity } from "./types.js";
import { isValidSha } from "../github/sha.js";  // Reuse existing
import { validatePath, PathTraversalError } from "../input/validator.js";  // P1 FIX: Reuse existing

const MAX_ID_LENGTH = 256;
const MAX_LINE_NUMBER = 1000000;
const MAX_PATH_LENGTH = 4096;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const SHELL_METACHAR_PATTERN = /[<>|&;$`\\]/;

// P1 FIX: Type guards instead of unsafe `as` assertions
export interface CodeqlFindingInput {
  id: string;
  rule?: { id?: string; name?: string; description?: string };
  location: { path: string; startLine: number; endLine?: number };
  commitSha: string;
  severity?: "note" | "warning" | "error";
  discoveredAt?: string;
  evidence?: string;
}

export interface CodexFindingInput {
  id: string;
  ruleName?: string;
  message?: string;
  filePath: string;
  line: number;
  commitSha: string;
  severity?: "info" | "warning" | "critical";
  timestamp?: string;
  evidence?: string;
}

// P1 FIX: Type guard for Greptile input
function isCodeqlFindingInput(value: unknown): value is CodeqlFindingInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.location === "object" &&
    v.location !== null &&
    typeof (v.location as Record<string, unknown>).path === "string" &&
    typeof (v.location as Record<string, unknown>).startLine === "number" &&
    typeof v.commitSha === "string"
  );
}

// P1 FIX: Type guard for Codex input
function isCodexFindingInput(value: unknown): value is CodexFindingInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.filePath === "string" &&
    typeof v.line === "number" &&
    typeof v.commitSha === "string"
  );
}

function mapCodeqlSeverity(severity: string | undefined): RemediationSeverity {
  switch (severity) {
    case "error": return "high";
    case "warning": return "medium";
    default: return "low";
  }
}

function mapCodexSeverity(severity: string | undefined): RemediationSeverity {
  switch (severity) {
    case "critical": return "high";
    case "warning": return "medium";
    default: return "low";
  }
}

function validateId(id: unknown): string | null {
  if (typeof id !== "string" || id.length === 0 || id.length > MAX_ID_LENGTH) {
    return null;
  }
  return id;
}

function validateLineNumber(line: unknown): number | null {
  if (typeof line !== "number" || line < 1 || line > MAX_LINE_NUMBER) {
    return null;
  }
  return line;
}

function validateTimestamp(ts: unknown): string {
  if (typeof ts === "string" && ISO_TIMESTAMP.test(ts)) {
    return ts;
  }
  return new Date().toISOString();
}

// P1 FIX: Reuse existing validatePath with additional shell metacharacter check
function validateFindingPath(rawPath: string, repoRoot: string): { ok: true; safePath: string } | { ok: false; error: string; code: string } {
  if (rawPath.length > MAX_PATH_LENGTH) {
    return { ok: false, error: "Path too long", code: "E_PATH_TOO_LONG" };
  }

  // Additional defense in depth: block shell metacharacters
  if (SHELL_METACHAR_PATTERN.test(rawPath)) {
    return { ok: false, error: "Shell metacharacters in path", code: "E_INVALID_CHARS" };
  }

  // P1 FIX: Reuse existing battle-tested validator
  try {
    const safePath = validatePath(repoRoot, rawPath);
    return { ok: true, safePath };
  } catch (e) {
    if (e instanceof PathTraversalError) {
      return { ok: false, error: "Path traversal detected", code: "E_PATH_TRAVERSAL" };
    }
    return { ok: false, error: String(e), code: "E_PATH_INVALID" };
  }
}

export function normalizeCodeqlFinding(
  input: unknown,
  repoRoot: string = process.cwd()
): NormalizerOutcome {
  // P1 FIX: Use type guard instead of unsafe `as`
  if (!isCodeqlFindingInput(input)) {
    return { ok: false, error: { code: "E_MISSING_FIELD", message: "Invalid Greptile finding structure", raw: input } };
  }

  const raw = input;

  const id = validateId(raw.id);
  if (!id) {
    return { ok: false, error: { code: "E_MISSING_FIELD", message: "Missing or invalid id", raw: input } };
  }

  if (!isValidSha(raw.commitSha)) {
    return { ok: false, error: { code: "E_INVALID_SHA", message: "Invalid commit SHA", raw: input } };
  }

  const startLine = validateLineNumber(raw.location.startLine);
  if (!startLine) {
    return { ok: false, error: { code: "E_MISSING_FIELD", message: "Missing or invalid startLine", raw: input } };
  }

  const pathResult = validateFindingPath(raw.location.path, repoRoot);
  if (!pathResult.ok) {
    return { ok: false, error: { code: "E_INVALID_PATH", message: pathResult.error, raw: { path: raw.location.path } } };
  }

  const endLine = raw.location.endLine !== undefined ? validateLineNumber(raw.location.endLine) : undefined;

  const finding: CanonicalFinding = {
    id,
    provider: "greptile",
    severity: mapCodeqlSeverity(raw.severity),
    title: raw.rule?.name ?? raw.rule?.id ?? "Unknown Greptile rule",
    description: raw.rule?.description ?? "",
    filePath: pathResult.safePath,
    lineStart: startLine,
    lineEnd: endLine && endLine >= startLine ? endLine : undefined,
    commitSha: raw.commitSha,
    discoveredAt: validateTimestamp(raw.discoveredAt),
    evidence: raw.evidence,
  };

  return { ok: true, finding };
}

export function normalizeCodexFinding(
  input: unknown,
  repoRoot: string = process.cwd()
): NormalizerOutcome {
  // P1 FIX: Use type guard instead of unsafe `as`
  if (!isCodexFindingInput(input)) {
    return { ok: false, error: { code: "E_MISSING_FIELD", message: "Invalid Codex finding structure", raw: input } };
  }

  const raw = input;

  const id = validateId(raw.id);
  if (!id) {
    return { ok: false, error: { code: "E_MISSING_FIELD", message: "Missing or invalid id", raw: input } };
  }

  if (!isValidSha(raw.commitSha)) {
    return { ok: false, error: { code: "E_INVALID_SHA", message: "Invalid commit SHA", raw: input } };
  }

  const line = validateLineNumber(raw.line);
  if (!line) {
    return { ok: false, error: { code: "E_MISSING_FIELD", message: "Missing or invalid line number", raw: input } };
  }

  const pathResult = validateFindingPath(raw.filePath, repoRoot);
  if (!pathResult.ok) {
    return { ok: false, error: { code: "E_INVALID_PATH", message: pathResult.error, raw: { path: raw.filePath } } };
  }

  const finding: CanonicalFinding = {
    id,
    provider: "codex",
    severity: mapCodexSeverity(raw.severity),
    title: raw.ruleName ?? "Codex finding",
    description: raw.message ?? "",
    filePath: pathResult.safePath,
    lineStart: line,
    commitSha: raw.commitSha,
    discoveredAt: validateTimestamp(raw.timestamp),
    evidence: raw.evidence,
  };

  return { ok: true, finding };
}
```

**Step 3: Write tests**

```typescript
// src/lib/remediation/finding-normalizer.test.ts
import { describe, expect, it } from "vitest";
import { normalizeCodeqlFinding, normalizeCodexFinding } from "./finding-normalizer.js";

describe("finding-normalizer", () => {
  describe("normalizeCodeqlFinding", () => {
    it("normalizes valid Greptile finding", () => {
      const result = normalizeCodeqlFinding({
        id: "greptile-1",
        rule: { id: "js/sql-injection", name: "SQL Injection", description: "Dangerous" },
        location: { path: "src/db.ts", startLine: 42 },
        commitSha: "a".repeat(40),
        severity: "error",
        discoveredAt: "2026-02-25T00:00:00Z",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.finding.provider).toBe("greptile");
        expect(result.finding.severity).toBe("high");
        expect(result.finding.filePath).toBe("src/db.ts");
      }
    });

    it("rejects invalid SHA", () => {
      const result = normalizeCodeqlFinding({
        id: "greptile-1",
        commitSha: "invalid",
        location: { path: "src/db.ts", startLine: 1 },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("E_INVALID_SHA");
      }
    });

    it("rejects path traversal attempt", () => {
      const result = normalizeCodeqlFinding({
        id: "greptile-1",
        commitSha: "a".repeat(40),
        location: { path: "../../../etc/passwd", startLine: 1 },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("E_INVALID_PATH");
      }
    });

    it("rejects shell metacharacters in path", () => {
      const result = normalizeCodeqlFinding({
        id: "greptile-1",
        commitSha: "a".repeat(40),
        location: { path: "src/test.ts; rm -rf /", startLine: 1 },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("E_INVALID_PATH");
      }
    });
  });

  describe("normalizeCodexFinding", () => {
    it("normalizes valid Codex finding", () => {
      const result = normalizeCodexFinding({
        id: "codex-1",
        ruleName: "Hardcoded Secret",
        message: "API key detected",
        filePath: "src/config.ts",
        line: 10,
        commitSha: "b".repeat(40),
        severity: "critical",
        timestamp: "2026-02-25T00:00:00Z",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.finding.provider).toBe("codex");
        expect(result.finding.severity).toBe("high");
      }
    });
  });
});
```

**Step 4: Run tests**

```bash
pnpm test src/lib/remediation/finding-normalizer.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/remediation/finding-normalizer.ts src/lib/remediation/finding-normalizer.test.ts
git commit -m "feat(remediation): add hardened finding normalizers reusing existing path validation"
```

---

## Task 3: Create Orchestrator (with Performance & Security Fixes)

**Files:**
- Create: `src/lib/remediation/orchestrator.ts`
- Test: `src/lib/remediation/orchestrator.test.ts`

**Step 1: Implement orchestrator (with batching and race protection)**

```typescript
// src/lib/remediation/orchestrator.ts
import type { RemediationPolicy, RemediationAutoTier } from "../contract/types.js";
import type {
  CanonicalFinding,
  RemediationAction,
  RemediationOutcome,
  RemediationSeverity,
} from "./types.js";

export interface OrchestratorOptions {
  policy: RemediationPolicy;
  findings: CanonicalFinding[];
  dryRun?: boolean;
  headSha: string;
  concurrency?: number;
}

export interface GitHubClient {
  getHeadSha(): Promise<string>;
  isAncestor(ancestorSha: string, descendantSha: string): Promise<boolean>;
}

// Fixed: Use Record for O(1) lookup and reject unknown values
const SEVERITY_RANK: Record<RemediationSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
} as const;

function tierAllowsAuto(tier: RemediationSeverity, maxTier: RemediationAutoTier): boolean {
  // Fail closed: reject unknown severities
  if (!(tier in SEVERITY_RANK) || !(maxTier in SEVERITY_RANK)) {
    return false;
  }
  return SEVERITY_RANK[tier] <= SEVERITY_RANK[maxTier as RemediationSeverity];
}

export class RemediationOrchestrator {
  private policy: RemediationPolicy;
  private findings: CanonicalFinding[];
  private dryRun: boolean;
  private headSha: string;
  private github: GitHubClient | null;
  private concurrency: number;

  constructor(options: OrchestratorOptions, github: GitHubClient | null = null) {
    this.policy = options.policy;
    this.findings = options.findings;
    this.dryRun = options.dryRun ?? false;
    this.headSha = options.headSha;
    this.github = github;
    this.concurrency = options.concurrency ?? 10;
  }

  async remediate(): Promise<RemediationOutcome> {
    const actions: RemediationAction[] = [];
    const skipped: Array<{ findingId: string; reason: string }> = [];
    let apiCalls = 0;
    let cacheHits = 0;

    // P1 FIX: Multiple TOCTOU Checkpoint 1 - Fetch fresh HEAD at start, don't trust input
    const initialHead = this.github
      ? await this.github.getHeadSha()
      : this.headSha;
    if (this.github) apiCalls++;

    // Step 1: Batch ancestry checks with deduplication
    const ancestryCache = new Map<string, boolean>();

    if (this.github) {
      // Deduplicate SHAs - only check unique values
      const uniqueShas = new Set(
        this.findings
          .map(f => f.commitSha)
          .filter(sha => sha !== initialHead)  // Skip HEAD SHA
      );

      // Batch checks with concurrency limit
      const shaArray = Array.from(uniqueShas);
      for (let i = 0; i < shaArray.length; i += this.concurrency) {
        const batch = shaArray.slice(i, i + this.concurrency);
        const results = await Promise.all(
          batch.map(async (sha) => ({
            sha,
            isAncestor: await this.github!.isAncestor(sha, initialHead),
          }))
        );
        apiCalls += batch.length;

        for (const { sha, isAncestor } of results) {
          ancestryCache.set(sha, isAncestor);
        }
      }
    }

    // P1 FIX: Multiple TOCTOU Checkpoint 2 - Mid-processing check before action decisions
    if (this.github) {
      const midHead = await this.github.getHeadSha();
      apiCalls++;
      if (midHead !== initialHead) {
        return {
          ok: false,
          error: {
            code: "E_RACE_DETECTED",
            message: "HEAD changed mid-processing; aborting for safety",
            context: { initialHead, currentHead: midHead },
          },
        };
      }
    }

    // Step 2: Process findings using cached results
    for (const finding of this.findings) {
      // Check ancestry (use cache or assume true if no GitHub client)
      if (this.github) {
        // HEAD SHA is always valid (skip check)
        if (finding.commitSha === initialHead) {
          cacheHits++;
        } else {
          const isAncestor = ancestryCache.get(finding.commitSha);
          if (isAncestor === false) {
            skipped.push({ findingId: finding.id, reason: "Commit not in HEAD ancestry" });
            continue;
          }
        }
      }

      // Determine provider config
      const providerConfig = this.policy.providerDefaults[finding.provider];
      const autoTier = providerConfig?.autoApplyMaxTier || "low";
      const dryRunDefault = providerConfig?.dryRunOnlyByDefault ?? true;

      // Check tier allows auto (with fixed validation)
      if (!tierAllowsAuto(finding.severity, autoTier)) {
        actions.push({
          type: "skip",
          findingId: finding.id,
          reason: `Severity ${finding.severity} exceeds auto-apply tier ${autoTier}`,
          dryRun: this.dryRun,
        });
        continue;
      }

      // Check evidence requirement
      if (this.policy.requireEvidence && !finding.evidence) {
        actions.push({
          type: "skip",
          findingId: finding.id,
          reason: "Evidence required but not provided",
          dryRun: this.dryRun,
        });
        continue;
      }

      // Determine action
      const effectiveDryRun = this.dryRun || dryRunDefault;

      if (finding.severity === "high") {
        actions.push({
          type: "comment",
          findingId: finding.id,
          reason: "High severity requires human review",
          dryRun: effectiveDryRun,
        });
      } else {
        actions.push({
          type: "commit",
          findingId: finding.id,
          reason: `Auto-remediation for ${finding.severity} severity`,
          dryRun: effectiveDryRun,
        });
        actions.push({
          type: "push",
          findingId: finding.id,
          reason: `Push auto-remediation for ${finding.severity} severity`,
          dryRun: effectiveDryRun,
        });
      }
    }

    // P1 FIX: Multiple TOCTOU Checkpoint 3 - Final check before return
    if (this.github) {
      const finalHead = await this.github.getHeadSha();
      apiCalls++;
      if (finalHead !== initialHead) {
        return {
          ok: false,
          error: {
            code: "E_RACE_DETECTED",
            message: "HEAD changed during remediation; aborting for safety",
            context: { initialHead, currentHead: finalHead },
          },
        };
      }
    }

    return {
      ok: true,
      output: {
        findingsProcessed: this.findings.length,
        actions,
        skipped,
        telemetry: { apiCalls, cacheHits },
      },
    };
  }
}
```

**Step 2: Write tests**

```typescript
// src/lib/remediation/orchestrator.test.ts
import { describe, expect, it } from "vitest";
import { RemediationOrchestrator } from "./orchestrator.js";
import type { RemediationPolicy } from "../contract/types.js";
import type { CanonicalFinding } from "./types.js";

const mockPolicy: RemediationPolicy = {
  providerDefaults: {
    greptile: { autoApplyMaxTier: "medium", dryRunOnlyByDefault: false },
    codex: { autoApplyMaxTier: "low", dryRunOnlyByDefault: true },
  },
  marker: "<!-- harness-remediation -->",
  timeoutMinutes: 5,
  retryLimit: 3,
  requireEvidence: false,
};

function makeFinding(overrides: Partial<CanonicalFinding> = {}): CanonicalFinding {
  return {
    id: "test-1",
    provider: "greptile",
    severity: "low",
    title: "Test",
    description: "Test finding",
    filePath: "src/test.ts",
    lineStart: 1,
    commitSha: "a".repeat(40),
    discoveredAt: "2026-02-25T00:00:00Z",
    ...overrides,
  };
}

describe("RemediationOrchestrator", () => {
  it("skips stale findings (SHA not in ancestry)", async () => {
    const mockGithub = {
      getHeadSha: async () => "b".repeat(40),
      isAncestor: async () => false,
    };

    const orchestrator = new RemediationOrchestrator(
      { policy: mockPolicy, findings: [makeFinding()], headSha: "b".repeat(40) },
      mockGithub
    );

    const result = await orchestrator.remediate();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.skipped).toHaveLength(1);
      expect(result.output.skipped[0].reason).toContain("ancestry");
    }
  });

  it("commits low/medium severity findings", async () => {
    const mockGithub = {
      getHeadSha: async () => "b".repeat(40),
      isAncestor: async () => true,
    };

    const orchestrator = new RemediationOrchestrator(
      { policy: mockPolicy, findings: [makeFinding({ severity: "low" })], headSha: "b".repeat(40) },
      mockGithub
    );

    const result = await orchestrator.remediate();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const actionTypes = result.output.actions.map((a) => a.type);
      expect(actionTypes).toContain("commit");
      expect(actionTypes).toContain("push");
    }
  });

  // P1 FIX: Test verifies multiple TOCTOU checkpoints
  it("detects TOCTOU race condition at any checkpoint", async () => {
    let callCount = 0;
    const mockGithub = {
      // Returns different SHA on second call (mid-processing checkpoint)
      getHeadSha: async () => callCount++ === 0 ? "b".repeat(40) : "c".repeat(40),
      isAncestor: async () => true,
    };

    const orchestrator = new RemediationOrchestrator(
      { policy: mockPolicy, findings: [makeFinding()], headSha: "b".repeat(40) },
      mockGithub
    );

    const result = await orchestrator.remediate();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("E_RACE_DETECTED");
    }
  });

  it("detects TOCTOU race at final checkpoint", async () => {
    let callCount = 0;
    const mockGithub = {
      // Returns same SHA for first two calls, different on third (final checkpoint)
      getHeadSha: async () => callCount++ < 2 ? "b".repeat(40) : "c".repeat(40),
      isAncestor: async () => true,
    };

    const orchestrator = new RemediationOrchestrator(
      { policy: mockPolicy, findings: [makeFinding()], headSha: "b".repeat(40) },
      mockGithub
    );

    const result = await orchestrator.remediate();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("E_RACE_DETECTED");
    }
  });

  it("rejects unknown severity in tier check", async () => {
    const mockGithub = {
      getHeadSha: async () => "b".repeat(40),
      isAncestor: async () => true,
    };

    // Cast to bypass TypeScript - simulate malicious input
    const maliciousFinding = makeFinding({ severity: "unknown" as unknown as "low" });

    const orchestrator = new RemediationOrchestrator(
      { policy: mockPolicy, findings: [maliciousFinding], headSha: "b".repeat(40) },
      mockGithub
    );

    const result = await orchestrator.remediate();

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Unknown severity should be rejected (fail closed)
      const skipAction = result.output.actions.find((a) => a.type === "skip");
      expect(skipAction).toBeDefined();
    }
  });

  it("batches ancestry checks for performance", async () => {
    let isAncestorCalls = 0;
    const mockGithub = {
      getHeadSha: async () => "b".repeat(40),
      isAncestor: async () => {
        isAncestorCalls++;
        return true;
      },
    };

    // 10 findings, but only 3 unique SHAs
    const findings = [
      makeFinding({ id: "f1", commitSha: "a".repeat(40) }),
      makeFinding({ id: "f2", commitSha: "a".repeat(40) }),
      makeFinding({ id: "f3", commitSha: "a".repeat(40) }),
      makeFinding({ id: "f4", commitSha: "c".repeat(40) }),
      makeFinding({ id: "f5", commitSha: "c".repeat(40) }),
      makeFinding({ id: "f6", commitSha: "d".repeat(40) }),
      makeFinding({ id: "f7", commitSha: "b".repeat(40) }),  // Same as HEAD - skipped
    ];

    const orchestrator = new RemediationOrchestrator(
      { policy: mockPolicy, findings, headSha: "b".repeat(40) },
      mockGithub
    );

    const result = await orchestrator.remediate();

    expect(result.ok).toBe(true);
    // Should only call isAncestor 3 times (unique non-HEAD SHAs) + 1 for getHeadSha
    expect(isAncestorCalls).toBe(3);
  });
});
```

**Step 3: Run tests**

```bash
pnpm test src/lib/remediation/orchestrator.test.ts
```

**Step 4: Commit**

```bash
git add src/lib/remediation/orchestrator.ts src/lib/remediation/orchestrator.test.ts
git commit -m "feat(remediation): add orchestrator with batched checks and race protection"
```

---

## Task 4: Wire Up Remediate Command

**Files:**
- Modify: `src/commands/remediate.ts`

**Step 1: Update remediate.ts**

Replace the stub with real implementation that uses the new library.

**Step 2: Add command tests**

Create or update `src/commands/remediate.test.ts` with CLI-level tests.

**Step 3: Run all tests**

```bash
pnpm test src/commands/remediate.test.ts
```

**Step 4: Commit**

```bash
git add src/commands/remediate.ts src/commands/remediate.test.ts
git commit -m "feat(remediate): wire up remediation library to CLI"
```

---

## Task 5: Final Verification

**Note:** Skip barrel export (`index.ts`) - direct imports are simpler for a 3-file module.

**Step 1: Run full check suite**

```bash
pnpm check
```

**Step 2: Run security audit**

```bash
pnpm audit
```

**Step 3: Verify no secrets in code**

```bash
rg -n "(sk-[a-zA-Z0-9]{20}|ghp_[a-zA-Z0-9]{36}|github_pat_)" src/
```

**Step 4: Commit any remaining changes**

---

## Acceptance Checklist

- [ ] `src/lib/remediation/types.ts` created with exhaustive error codes
- [ ] `src/lib/remediation/finding-normalizer.ts` normalizes findings with security hardening
- [ ] **P1 FIX:** `finding-normalizer.ts` reuses existing `validatePath()` from `src/lib/input/validator.ts` (no separate path-validator.ts)
- [ ] **P1 FIX:** Type guards used instead of unsafe `as` assertions for unknown inputs
- [ ] `src/lib/remediation/orchestrator.ts` implements batched checks with TOCTOU protection
- [ ] **P1 FIX:** Multiple TOCTOU checkpoints (start, mid-processing, end) verify HEAD consistency
- [ ] **P1 FIX:** `tierAllowsAuto()` rejects unknown severities (fail closed)
- [ ] `src/commands/remediate.ts` uses the new library
- [ ] All tests pass (`pnpm check`)
- [ ] No new lint warnings
- [ ] Security audit passes
- [ ] Tier bypass vulnerability fixed
- [ ] Performance: 5x+ improvement for 100 findings
- [ ] **P1 FIX:** MARKER_SECRET required (no fallback to 'default')
- [ ] **P1 FIX:** No duplicate modules (reuses existing validators)
