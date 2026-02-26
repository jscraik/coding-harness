---
status: complete
priority: p2
issue_id: "035"
tags: [code-review, security, path-traversal, context]
dependencies: []
created: 2026-02-26
---

# Hardening Path Containment in Context Indexer

## Problem Statement

The context indexer validates candidate document paths using lexical `resolve`/`relative` checks only and does not resolve symlinks before enforcing base-path boundaries. This allows attackers to pass symlinked paths through validation and index files outside the configured base directory.

## Findings

- `src/lib/context-compound/indexer.ts:130-136` currently computes `resolvedFilePath = resolve(filepath)` and checks `relative(resolvedBasePath, resolvedFilePath)` without `realpath`.
- `getRelativePathWithinBase()` therefore treats `baseDir/safe.md` that is a symlink to `/etc/secret.md` as inside `baseDir`.
- Impact: indexer can ingest arbitrary files outside intended repository scope when symlinks are present in the indexed set.

**Known Pattern:** This mirrors earlier symlink traversal findings (e.g., `todos/016-complete-p1-symlink-bypass-validatePath.md`) and should be fixed consistently.

## Proposed Solutions

### Option 1: Resolve symlinks for containment check (recommended)

**Approach:** Replace lexical checks with `realpathSync` (or guarded `realpathSync` fallback for non-existent files), then compare canonical paths.

**Pros:**
- Prevents symlink-based escapes on existing files.
- Preserves existing public function signature.

**Cons:**
- Requires handling missing/unreadable path edge cases when realpath fails.

**Effort:** Medium

**Risk:** Medium

### Option 2: Reuse centralized validator implementation

**Approach:** Delegate path safety checks to an existing canonical path validator utility and preserve a single secure behavior.

**Pros:**
- Less duplicated security logic.
- Easier future audit and maintenance.

**Cons:**
- Cross-module import changes and test updates.

**Effort:** Medium

**Risk:** Low

### Option 3: Reject symlinked files explicitly before hashing/indexing

**Approach:** Call `lstatSync` and disallow symlinks in input directories.

**Pros:**
- Simple and explicit hardening.

**Cons:**
- Could break valid workflows that rely on symlinked sources and may be overly strict.

**Effort:** Small

**Risk:** Medium

## Recommended Action

✅ Implemented in:
- `src/lib/context-compound/indexer.ts` (replaced lexical containment with `validatePath`).
- `src/lib/context-compound/indexer.test.ts` (added symlink escape regression test).

## Technical Details

**Affected files:**
- `src/lib/context-compound/indexer.ts:130-136`

**Related components:**
- `src/commands/index-context.ts` uses `indexFile` and shares related path trust assumptions.

## Acceptance Criteria

- [x] Path containment check fails for symlinked paths that resolve outside `basePath`.
- [x] Indexing continues to work for non-symlinked files within base path.
- [x] Tests cover symlink escape scenario and normal in-bounds case.
- [x] Security regression test added for `getRelativePathWithinBase` behavior.
- [x] No behavioral change for valid absolute/non-absolute non-symlink inputs.

## Work Log

### 2026-02-26 - Initial Discovery

**By:** Review workflow

**Actions:**
- Reviewed `src/lib/context-compound/indexer.ts` path validation.
- Confirmed lexical path guard uses only `resolve` + `relative`.
- Added this pending finding for secure realpath-based containment.

**Learnings:**
- Existing symlink hardening patterns already exist in earlier resolved todo items and can be reused.

### 2026-02-26 - Resolution

**By:** Internal implementation

**Actions:**
- Replaced `getRelativePathWithinBase()` with `validatePath(basePath, filepath)` and mapped violations to `READ_FAILED`.
- Added a regression test for symlinked file target outside base path.

**Validation:**
- `pnpm vitest src/lib/context-compound/indexer.test.ts`

## Notes

- This is a security-hardening finding for file-system isolation in automation indexing pipelines.
