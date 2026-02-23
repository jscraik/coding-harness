---
status: pending
priority: p2
issue_id: 001
tags: [security, code-review, gardener, path-traversal]
dependencies: []
---

# Security: Add Path Validation to Gardener Commands

## Problem Statement

The gardener command accepts user-controlled `docsPath` input that is passed directly to external commands and file operations without validation. This could allow path traversal attacks if untrusted input is provided.

## Findings

### 1. Command Injection Risk in Link Checker
**Location:** `src/lib/gardener/link-checker.ts:63-79`
**Issue:** `basePath` passed directly to `spawnSync()` without sanitization:
```typescript
const result = spawnSync(
    "lychee",
    ["--format", "json", "--output", reportPath, "--config", ".lychee.toml", basePath],
    ...
);
```

### 2. Path Traversal in Quality Score File Writing
**Location:** `src/lib/gardener/quality-scorer.ts:123`
**Issue:** `docsPath` used to construct file path without validation:
```typescript
const filePath = join(docsPath, "QUALITY_SCORE.md");
```

### 3. Information Disclosure via Error Messages
**Location:** `src/commands/gardener.ts:39`
**Issue:** Error messages reveal internal path structure:
```typescript
message: `Docs directory not found: ${docsPath}`,
```

## Proposed Solutions

### Option A: Whitelist Path Validation (Recommended)
Add a validation function that:
- Rejects paths containing `..` or `~`
- Ensures resolved path is within allowed base directory
- Only allows alphanumeric, hyphens, underscores, forward slashes

**Pros:** Secure by default, minimal changes
**Cons:** May break valid use cases with symlinks
**Effort:** Small
**Risk:** Low

### Option B: Path Resolution with Jail
Use `path.resolve()` and verify the resolved path starts with expected base:
```typescript
const resolved = path.resolve(baseDir, userPath);
if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error("Path traversal detected");
}
```

**Pros:** More flexible than whitelist
**Cons:** Complex symlink handling
**Effort:** Small
**Risk:** Low

### Option C: Documentation + Trust Boundary
Document that gardener is intended for trusted CI/CD environments only and should not process untrusted input.

**Pros:** No code changes
**Cons:** Security by documentation, not by design
**Effort:** Minimal
**Risk:** Medium (relies on users reading docs)

## Recommended Action

Implement Option A (whitelist validation) in:
1. `src/lib/gardener/link-checker.ts` - validate `basePath` before `spawnSync`
2. `src/lib/gardener/quality-scorer.ts` - validate `docsPath` before file operations
3. `src/commands/gardener.ts` - sanitize paths in error messages

## Technical Details

**Affected Files:**
- `src/lib/gardener/link-checker.ts`
- `src/lib/gardener/quality-scorer.ts`
- `src/commands/gardener.ts`

**Related Patterns:**
- See `src/lib/input/sanitize.ts` for existing sanitization utilities

## Acceptance Criteria

- [ ] Path validation function created in shared location
- [ ] All user-provided paths validated before use
- [ ] Error messages do not expose internal paths
- [ ] Tests added for path traversal attempts
- [ ] Documentation updated with security considerations

## Work Log

- **2026-02-23**: Issue identified during code review (commit d17ffc2)
