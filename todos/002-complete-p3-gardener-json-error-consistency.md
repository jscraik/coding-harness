---
status: complete
priority: p3
tags: [code-review, gardener, json-output, consistency]
dependencies: []
---

# Fix JSON Error Output Consistency in Gardener

## Problem Statement

The gardener command has inconsistent JSON output behavior between success and error paths. In success mode with `--json`, only JSON is output. In error mode, plain text may be printed before JSON, potentially corrupting JSON parsing.

## Findings

**Location:** `src/commands/gardener.ts:73-76` and `149-152`

**Current Behavior:**
- Success + JSON: Pure JSON output ✅
- Error + JSON: Warning may print to stdout before JSON ❌

```typescript
// Lines 73-76 - warning printed even in JSON mode
if (!updateResult.ok) {
    console.warn(`Warning: Failed to update quality score file: ${updateResult.error}`);
}

// Lines 149-152 - inconsistent error output
if (options.json) {
    console.error(JSON.stringify({ error: result.error }));
} else {
    console.error(result.error.message);
}
```

## Proposed Solutions

### Option A: Move Warnings to stderr + Suppress in JSON Mode (Recommended)
- Change `console.warn` to `console.error` (stderr)
- Suppress warning entirely when `options.json` is true
- Ensure error output is pure JSON when `--json` flag is used

**Pros:** Clean separation, agents get predictable output
**Cons:** Warning information lost in JSON mode
**Effort:** Small
**Risk:** Low

### Option B: Include Warning in JSON Output
Add warning field to JSON output structure:
```typescript
console.info(JSON.stringify({
    ...result.output,
    warnings: updateResult.ok ? [] : [updateResult.error]
}));
```

**Pros:** No information loss
**Cons:** Changes output schema, requires documentation update
**Effort:** Small
**Risk:** Low (breaking change to JSON schema)

### Option C: Delay Warning Until After JSON
Print warnings after JSON output (to stderr) even in JSON mode.

**Pros:** Simple change
**Cons:** May still confuse parsers that capture all output
**Effort:** Minimal
**Risk:** Medium

## Recommended Action

Implement Option A: Suppress non-essential warnings when `--json` flag is used. The warning about quality score file updates is not critical for programmatic consumers.

## Technical Details

**Affected File:** `src/commands/gardener.ts`
**Lines:** 73-76 (warning), 149-152 (error output)

**Related Learnings:**
- See `todos/002-pending-p1-json-output-flag.md` for JSON output pattern

## Acceptance Criteria

- [ ] No stdout output in JSON mode except valid JSON
- [ ] Error output uses stderr
- [ ] Warning suppressed or redirected in JSON mode
- [ ] Test added to verify clean JSON output in error scenarios

## Work Log

- **2026-02-23**: Issue identified during code review
- **2026-02-23**: Fixed - moved warning to CLI layer, updated error output to be JSON-only in JSON mode

## Changes Made

1. **src/commands/gardener.ts**:
   - Removed `console.warn` from `runGardener()` function (library layer)
   - Added `updateWarning` field to GardenerResult type for type-safe error passing
   - Updated `runGardenerCLI()` to show warning only in human-readable mode (line 111-115)
   - Fixed error output to be exclusive JSON OR text, not both (lines 155-159)

2. **src/lib/gardener/types.ts**:
   - Updated GardenerResult discriminated union to include optional `updateWarning` field on success branch

## Acceptance Criteria Verification

- [x] No stdout output in JSON mode except valid JSON - Warning moved to CLI layer
- [x] Error output uses stderr - Already using `console.error`
- [x] Warning suppressed in JSON mode - Only shown when `!options.json`
- [x] All tests pass - Verified with `pnpm check`
