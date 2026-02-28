---
status: complete
priority: p3
issue_id: "037"
tags: [code-review, correctness, cli, validation]
dependencies: []
created: 2026-02-26
---

# CLI `context` Command Silences Malformed Numeric Flags

## Problem Statement

`runContextCLI` silently ignores malformed `--limit` and `--threshold` values instead of surfacing parse errors. Users passing typos or malformed values get fallback defaults with no visibility, increasing debugging and misconfiguration risk.

## Findings

- `src/commands/context.ts:265-283` only assigns parsed values when validation succeeds; invalid values are ignored without warning.
- `parsePositiveInteger` and `parseThreshold` return `undefined` for invalid inputs, but caller does not emit diagnostics.
- This behavior can hide runtime mistakes (e.g., `--limit ten`, `--threshold 2`, `--threshold abc`) and silently execute with defaults.

## Proposed Solutions

### Option 1: Emit explicit CLI validation errors (recommended)

**Approach:** When a flag is present but value is invalid, return usage/validation error and non-zero exit code.

**Pros:**
- Immediate feedback and operator clarity.
- Prevents silent misconfiguration.

**Cons:**
- May be slightly stricter for typo-ed inputs.

**Effort:** Small

**Risk:** Low

### Option 2: Add warning mode

**Approach:** Keep defaults but log explicit warning for invalid values.

**Pros:**
- Backward-compatible with implicit fallback behavior while improving visibility.

**Cons:**
- Warnings can still allow hidden failures and inconsistent behavior.

**Effort:** Small

**Risk:** Medium

### Option 3: Add schema-based parser

**Approach:** Introduce shared numeric option parser that validates and reports all CLI parse errors consistently.

**Pros:**
- Strong consistency across commands.
- Easier future maintenance of CLI parsing.

**Cons:**
- Larger refactor, potential migration impact across multiple commands.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

✅ Implemented in:
- `src/commands/context.ts` (explicit errors and `EXIT_CODES.ERROR` for malformed/missing `--limit`/`--threshold`).
- `src/commands/context.test.ts` (added explicit error-path tests for malformed numeric options).

## Technical Details

**Affected files:**
- `src/commands/context.ts:265-283`
- `src/commands/context.ts:12-31` (parsing helpers)
- `src/commands/context.ts:254-310` (CLI entry path)

## Acceptance Criteria

- [x] Invalid `--limit` and `--threshold` inputs emit explicit error diagnostics.
- [x] Invalid values return non-zero exit code when strict mode is selected (or consistent policy).
- [x] Existing valid numeric values continue to parse correctly.
- [x] CLI tests added/updated to cover invalid-input scenarios.

## Work Log

### 2026-02-26 - Initial Discovery

**By:** Review workflow

**Actions:**
- Reviewed argument parsing in `runContextCLI`.
- Observed silent fallback behavior for malformed numeric flags.
- Added this pending UX/correctness finding.

**Learnings:**
- Similar strict-input behavior should likely be standardized across other command parsers for consistency.

### 2026-02-26 - Resolution

**By:** Internal implementation

**Actions:**
- Updated `runContextCLI` to require option values for `--limit` and `--threshold`.
- Added validation failures for invalid numeric input with clear error messages and non-zero exit.
- Extended tests to assert invalid inputs return `EXIT_CODES.ERROR`.

**Validation:**
- `pnpm vitest src/commands/context.test.ts`

## Notes

- Decide whether strict parsing should be applied globally to reduce duplicated silent-failure patterns.
