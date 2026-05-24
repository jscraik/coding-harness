---
status: complete
priority: p1
issue_id: 016
tags: [security, path-traversal, code-review]
dependencies: []
created: 2026-02-23
---

# Symlink Bypass Vulnerability in validatePath (sanitize.ts)

## Problem Statement

The `validatePath()` function in `src/lib/input/sanitize.ts` does NOT resolve symlinks before comparison, making it vulnerable to symlink-based path traversal attacks. An attacker with write access to the docs directory can read or write arbitrary files.

**Severity:** CRITICAL (CVSS 9.1) - BLOCKS MERGE

## Findings

**Location:** `src/lib/input/sanitize.ts:45-66`

**Attack Vector:**
```bash
# Attacker creates symlink inside allowed directory
ln -s /etc docs/link_to_etc

# validatePath resolves to: /Users/victim/coding-harness/docs/link_to_etc
# This STARTSWITH /Users/victim/coding-harness -> PASSES validation
# But when accessed, symlink resolves to /etc
```

**Comparison with secure implementation:**
```typescript
// WEAK (sanitize.ts) - vulnerable to symlinks
const resolved = resolve(baseDir ?? process.cwd(), inputPath);
const baseResolved = resolve(baseDir ?? process.cwd());
if (!resolved.startsWith(baseResolved)) { ... }

// STRONG (validator.ts) - uses realpathSync
const realBase = realpathSync(baseDir);
const realResolved = realpathSync(resolved);
if (!realResolved.startsWith(realBase)) { ... }
```

**Evidence:** Security-sentinel agent confirmed vulnerability. Related to existing todo `001-complete-p1-symlink-path-traversal.md`.

## Proposed Solutions

### Option A: Remove duplicate, use validator.ts (Recommended)
- **Description:** Delete `validatePath` from `sanitize.ts`. Update all imports to use `validator.ts` version.
- **Pros:** Uses proven symlink-safe implementation, eliminates duplication
- **Cons:** Requires updating 3 import sites
- **Effort:** Small
- **Risk:** Low

### Option B: Add realpathSync to sanitize.ts version
- **Description:** Add symlink handling to `sanitize.ts` validatePath
- **Pros:** Fixes vulnerability in place
- **Cons:** Maintains duplication, signature inconsistency remains
- **Effort:** Small
- **Risk:** Medium (two implementations to maintain)

## Recommended Action

**Option A** - Consolidate to single canonical implementation in `validator.ts`.

## Technical Details

**Affected files:**
- `src/lib/input/sanitize.ts` - remove validatePath (lines 45-66)
- `src/lib/gardener/link-checker.ts` - update import
- `src/lib/gardener/quality-scorer.ts` - update import
- `src/lib/gardener/stale-detector.ts` - add validation

**Import changes:**
```typescript
// Change from:
import { validatePath } from "../input/sanitize.js";

// To:
import { validatePath } from "../input/validator.js";
```

## Acceptance Criteria

- [ ] `validatePath` removed from `src/lib/input/sanitize.ts`
- [ ] All gardener modules import from `validator.ts`
- [ ] `pnpm test` passes
- [ ] Symlink attack test added and passing

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-23 | Review completed | Security-sentinel identified critical vulnerability |
| 2026-02-23 | Fixed | Removed duplicate validatePath, re-export from validator.ts, updated call sites |
| 2026-02-23 | Verified | pnpm typecheck, lint, test all pass |

## Resources

- Related: `docs/archive/root-cleanup/completed-issue-backlog/001-complete-p1-symlink-path-traversal.md`
- CWE-59: Improper Link Resolution Before File Access
