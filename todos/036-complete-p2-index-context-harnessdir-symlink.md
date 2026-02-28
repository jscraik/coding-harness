---
status: complete
priority: p2
issue_id: "036"
tags: [code-review, security, path-traversal, index-context]
dependencies: []
created: 2026-02-26
---

# Harden `--harness-dir` Validation in Index Context

## Problem Statement

The `runIndexContext` CLI validates `--harness-dir` with lexical path checks only, which can pass symlinked directories that resolve outside the configured base directory. This can redirect vector store writes to attacker-controlled targets.

## Findings

- `src/commands/index-context.ts:57-66` uses `resolve(baseDir, candidatePath)` + `relative` and does not validate symlink resolution.
- `isPathWithinBase()` can accept a `harnessDir` that is lexically inside `baseDir` but symlink-resolves outside.
- `VectorStore` path is then derived from `join(validatedHarnessDir, DEFAULT_DB_FILENAME)`, so an escaping path can shift persistence location.

**Known Pattern:** Similar path traversal risk previously addressed for other input validators in `todos/016-complete-p1-symlink-bypass-validatePath.md`.

## Proposed Solutions

### Option 1: Canonicalize and verify paths with `realpathSync` for candidate and base

**Approach:** Resolve/canonicalize `candidatePath` before validation, or verify parent realpath when target doesn’t yet exist.

**Pros:**
- Strong security against symlink escape.
- Minimal behavior change for normal in-bound directories.

**Cons:**
- Handling non-existent candidate paths requires explicit fallback behavior.

**Effort:** Medium

**Risk:** Medium

### Option 2: Centralize harness directory path validation

**Approach:** Introduce/reuse shared validator utility that handles symlinks, missing paths, and relative path checks.

**Pros:**
- Reduces duplicated boundary logic across CLI commands.
- Easier to add security tests once.

**Cons:**
- Requires small refactor and additional imports.

**Effort:** Medium

**Risk:** Low

### Option 3: Disallow symlink candidates for harness directory

**Approach:** Reject any candidate where `lstatSync` identifies symlink for existing candidates.

**Pros:**
- Simple and explicit hardening.

**Cons:**
- Overly restrictive for setups that intentionally use symlinked directories.

**Effort:** Small

**Risk:** Medium

## Recommended Action

✅ Implemented in:
- `src/commands/index-context.ts` (added `validatePath`-based harness dir validation in `runIndexContext`).
- `src/commands/index-context.test.ts` (added regression test for symlink and out-of-base `harnessDir` rejection).

## Technical Details

**Affected files:**
- `src/commands/index-context.ts:57-67`
- `src/commands/index-context.ts:96-120`

## Acceptance Criteria

- [x] `--harness-dir` symlink escaping outside `baseDir` is rejected with explicit error.
- [x] Existing legitimate relative/absolute in-base harness paths are still supported.
- [x] Vector store writes are guaranteed under validated base context.
- [x] Added regression tests for symlinked harness directory cases.

## Work Log

### 2026-02-26 - Initial Discovery

**By:** Review workflow

**Actions:**
- Reviewed command input validation in `src/commands/index-context.ts`.
- Confirmed `isPathWithinBase` lacks realpath-based symlink checks.
- Created this pending item for secure path canonicalization.

**Learnings:**
- Existing symlink traversal patterns indicate consistent handling should be applied across all new boundary-check helpers.

### 2026-02-26 - Resolution

**By:** Internal implementation

**Actions:**
- Introduced `getValidatedHarnessDir(baseDir, candidatePath)` using shared `validatePath`.
- Rejected escaped harness directories with explicit error (`Invalid harness directory: path escapes base directory`), returning `EXIT_CODES.ERROR`.
- Added tests for relative-escape and symlinked harness directory escaping base.

**Validation:**
- `pnpm vitest src/commands/index-context.test.ts`

## Notes

- Keep behavior deterministic for both JSON and non-JSON code paths when rejecting invalid harness directories.
