---
title: Patch 4 - Rollback System for harness init
type: feat
status: completed
date: 2026-02-23
plan_id: feat-rollback-system
origin: docs/brainstorms/2026-02-23-installability-patches-brainstorm.md
deepened: 2026-02-23
---

# Patch 4 - Rollback System for harness init

## Enhancement Summary

**Deepened on:** 2026-02-23
**Research agents used:** kieran-typescript-reviewer, security-sentinel, code-simplicity-reviewer

### Key Improvements from Research

1. **Simplified manifest schema** - Removed YAGNI fields (version, installedAt, harnessVersion, targetDir)
2. **Hash-based backup naming** - Prevents path collision attacks
3. **Symlink detection** - Reject symlinks to prevent arbitrary file read/write
4. **Discriminated unions** - Type-safe handling of created vs modified entries
5. **Temp file cleanup** - Clean up temp files on atomic write failure

### Security Considerations Discovered

| Severity | Finding | Mitigation |
|----------|---------|------------|
| CRITICAL | Manifest tampering enables arbitrary file delete | Re-validate all paths during rollback |
| HIGH | Symlink attacks during backup/restore | Detect and reject symlinks |
| HIGH | Backup path collision (`foo/bar` vs `foo-bar`) | Use SHA256 hash for backup names |

---

## Overview

Implement a hybrid rollback system for `harness init`:
- **Default:** Rely on git for recovery (documented workflow)
- **Opt-in:** Manifest-based rollback with `--track` flag for non-git users

This is the first of 4 installability patches, implemented first because it provides a safety net for the others.

## Problem Statement / Motivation

Users need a way to undo `harness init` changes:
- Git users: `git checkout .` works but isn't obvious
- Non-git users: No recovery mechanism exists
- Current `--force` overwrites without backup

**From brainstorm:** Git-first approach delegates complexity to git, manifest opt-in for users without version control.

## Proposed Solution

```bash
# Default: no manifest, rely on git
harness init                    # Creates files, no manifest
git checkout .                  # Undo (documented in output)

# Opt-in: create manifest and backups
harness init --track            # Creates .harness/restore-manifest.json
harness init --rollback         # Restores from manifest, cleans up
```

## Technical Approach

### Architecture

Single-file extension to `src/commands/init.ts` (no new modules). Add ~100 LOC for manifest/backup logic.

### Research Insights: Type Design

**Best Practice: Use discriminated unions for type-safe handling**

```typescript
// RECOMMENDED: Discriminated union eliminates null checks
type ManifestEntry =
  | { path: string; action: "created" }           // No backup needed
  | { path: string; action: "modified"; backupHash: string }; // Hash of backup

// This enables type-safe rollback:
function restoreFile(entry: ManifestEntry, targetDir: string): RestoreResult {
  if (entry.action === "created") {
    // TypeScript knows backupHash doesn't exist here
    return deleteFile(resolve(targetDir, entry.path));
  }
  // TypeScript knows backupHash is string here
  return restoreFromBackup(entry.backupHash, resolve(targetDir, entry.path));
}
```

### Simplified Types (Research: YAGNI fields removed)

```typescript
// Minimal manifest - removed version, installedAt, harnessVersion, targetDir
interface RestoreManifest {
  files: ManifestEntry[];
}

// Discriminated union for type safety
type ManifestEntry =
  | { path: string; action: "created" }
  | { path: string; action: "modified"; backupHash: string };

// Extended options
interface InitOptions {
  dryRun: boolean;
  force: boolean;
  track: boolean;      // NEW: Create manifest + backups
  rollback: boolean;   // NEW: Restore from manifest
}
```

### Research Insights: Exit Codes

**Simplification:** Skip exit codes 10-12. Use existing `WRITE_ERROR` (2) with distinct error messages.

```typescript
// EXISTING - no new codes needed
export const EXIT_CODES = {
  SUCCESS: 0,
  PATH_TRAVERSAL: 1,
  WRITE_ERROR: 2,      // Use for rollback errors too
  INVALID_PATH: 3,
} as const;
```

### Research Insights: Security Mitigations

**CRITICAL: Path validation during rollback**

```typescript
function validateManifestEntry(entry: ManifestEntry, targetDir: string): boolean {
  // Re-apply sanitizePath to every entry during rollback
  const pathResult = sanitizePath(targetDir, entry.path);
  if (!pathResult.ok) return false;

  // Backup path must be within .harness/backups/
  if (entry.action === "modified") {
    const backupDir = resolve(targetDir, '.harness/backups');
    const expectedBackup = resolve(backupDir, `${entry.backupHash}.bak`);
    if (!existsSync(expectedBackup)) return false;
  }
  return true;
}
```

**HIGH: Symlink detection**

```typescript
function createBackup(targetDir: string, relativePath: string): BackupResult {
  const source = resolve(targetDir, relativePath);

  // CRITICAL: Reject symlinks to prevent arbitrary file read
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) {
    return {
      ok: false,
      error: { code: "BACKUP_FAILED", message: `Symlink detected at ${relativePath} - rejected for security` }
    };
  }

  // ... rest of backup logic
}
```

**HIGH: Hash-based backup naming (prevents collision)**

```typescript
function createBackup(targetDir: string, relativePath: string): BackupResult {
  const source = resolve(targetDir, relativePath);
  if (!existsSync(source)) {
    return { ok: true, value: null }; // New file, no backup needed
  }

  // Use SHA256 hash of path for collision-safe naming
  // foo/bar.yml -> a1b2c3d4.bak (not foo-bar.yml.bak)
  const backupHash = createHash('sha256').update(relativePath).digest('hex').slice(0, 16);
  const backupPath = resolve(targetDir, '.harness/backups', `${backupHash}.bak`);

  // Check for symlink before copying
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) {
    return { ok: false, error: { code: "BACKUP_FAILED", message: "Symlink rejected" } };
  }

  mkdirSync(dirname(backupPath), { recursive: true });
  copyFileSync(source, backupPath);
  return { ok: true, value: backupHash };
}
```

### Implementation Steps

#### Phase 1: Manifest Creation (--track flag)

1. Add `--track` flag to CLI parsing in `src/cli.ts`
2. Add `track: boolean` to `InitOptions` interface
3. In `runInit()`, before creating files:
   - For each existing file that will be modified:
     - Check for symlinks (reject if found)
     - Create backup with hash-based name
   - Track all files (created + modified) in manifest
4. After all files created, write manifest to `.harness/restore-manifest.json` (inline atomicWrite call)
5. Update output to mention manifest when `--track` used

#### Phase 2: Rollback Command (--rollback flag)

1. Add `--rollback` flag to CLI parsing
2. Add `rollback: boolean` to `InitOptions`
3. In `runInit()`, when `--rollback`:
   - Load manifest with `safeParseJson()`
   - **CRITICAL:** Validate every entry's path with `sanitizePath()`
   - For "created" entries: delete them
   - For "modified" entries: restore from backup using hash
   - Delete backups and manifest
   - Return exit code 0 on success, 2 on error

#### Phase 3: CLI Integration

1. Add help text for `--track` and `--rollback`
2. Update success messages

### Research Insights: Temp File Cleanup

```typescript
function atomicWrite(filePath: string, content: string): WriteResult {
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(tempPath, content, "utf-8");
    renameSync(tempPath, filePath);
    return { ok: true, value: undefined };
  } catch (e) {
    // NEW: Cleanup temp file on failure
    try { rmSync(tempPath, { force: true }); } catch {}
    return { ok: false, error: { code: "WRITE_ERROR", message: sanitizeError(e), path: filePath } };
  }
}
```

### File Structure (when --track used)

```
.harness/
├── restore-manifest.json     # Minimal manifest
└── backups/
    └── a1b2c3d4e5f6g7h8.bak  # Hash-named backups (not path-based)
```

### Key Functions (Simplified)

```typescript
// Inline into runInit() - just 2 lines
const manifestPath = resolve(targetDir, ".harness/restore-manifest.json");
atomicWrite(manifestPath, JSON.stringify({ files }, null, 2));

// Keep: createBackup with symlink detection and hash naming
function createBackup(targetDir: string, relativePath: string): BackupResult { ... }

// Keep: loadManifest with validation
function loadManifest(targetDir: string): ManifestResult { ... }

// Keep: executeRollback with path re-validation
function executeRollback(targetDir: string, manifest: RestoreManifest): RollbackResult { ... }
```

---

## System-Wide Impact

### Interaction Graph

```
harness init --track
    ├── detectPackageManager() → unchanged
    ├── for each template:
    │   ├── if exists: createBackup() → check symlink, hash name
    │   ├── render() → unchanged
    │   └── atomicWrite() → unchanged
    └── inline manifest write → atomicWrite()

harness init --rollback
    ├── loadManifest() → safeParseJson()
    ├── validate ALL paths → sanitizePath() CRITICAL
    └── for each entry:
        ├── created: rmSync()
        └── modified: copyFileSync(hash.bak, original)
```

### Error Propagation

| Error | Exit Code | Message |
|-------|-----------|---------|
| No manifest found | 2 | "No restore manifest found. Run `harness init --track` first." |
| Manifest corrupted | 2 | "Restore manifest is corrupted: {details}" |
| Backup file missing | 2 | "Backup file missing: {hash}" |
| Path escapes target | 1 | "Path traversal blocked: {path}" |
| Symlink detected | 2 | "Symlink at {path} - backup rejected for security" |

### State Lifecycle

- **Manifest created:** After all files written successfully
- **Backups created:** Before any file modifications (with symlink check)
- **Partial failure:** If manifest write fails, backups remain but are orphaned
- **Rollback cleanup:** Backups and manifest deleted after successful restore

---

## Acceptance Criteria

### Functional Requirements

- [x] `harness init --track` creates `.harness/restore-manifest.json`
- [x] `harness init --track` backs up existing files to `.harness/backups/`
- [x] `harness init --track` uses hash-based backup naming (not path-based)
- [x] `harness init --track` rejects symlinks with clear error
- [x] `harness init --rollback` restores all files to pre-install state
- [x] `harness init --rollback` re-validates all paths before restore
- [x] `harness init --rollback` deletes backups and manifest after restore
- [x] `harness init --rollback` fails with clear error when no manifest exists
- [x] `harness init` (without --track) behavior unchanged

### Non-Functional Requirements

- [x] Manifest is minimal JSON (no unused metadata)
- [x] Backup files use collision-safe hash naming
- [x] Path traversal protection applied during rollback
- [x] All file operations are atomic (temp file + rename)
- [x] Temp files cleaned up on failure

### Security Requirements

- [x] Symlinks rejected during backup creation
- [x] All manifest paths re-validated during rollback
- [x] Backup paths validated to be within `.harness/backups/`

### Documentation Requirements

- [x] Help text updated with `--track` and `--rollback` flags
- [x] Success message mentions rollback when `--track` used

---

## Test Scenarios

| Scenario | Setup | Expected |
|----------|-------|----------|
| Track new install | Empty dir, `--track` | Manifest created, no backups |
| Track with existing files | Files exist, `--track` | Backups created with hash names |
| Track with symlink | Symlink at target path, `--track` | Error, no backup created |
| Rollback created files | `--track` then `--rollback` | Created files deleted |
| Rollback modified files | `--track` then `--rollback` | Files restored from backup |
| Rollback no manifest | `--rollback` without prior track | Exit 2, clear error |
| Rollback corrupted manifest | Invalid JSON in manifest | Exit 2, clear error |
| Manifest path traversal | Manually edited manifest with `../etc/passwd` | Path blocked, error |
| Normal init unchanged | `harness init` (no flags) | Same behavior as before |

---

## Dependencies & Risks

### Dependencies

- None (uses only Node.js built-ins: `node:fs`, `node:path`, `node:crypto`)

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Manifest tampering | CRITICAL | Re-validate all paths during rollback |
| Symlink attacks | HIGH | Detect and reject symlinks |
| Backup collision | HIGH | Use SHA256 hash naming |
| Orphaned backups on crash | LOW | Document cleanup: `rm -rf .harness/` |
| Manifest committed to git | LOW | Add `.harness/` to `.gitignore` template |
| Large file backup | LOW | No size limit in MVP; document that backups are full copies |

---

## Estimated Effort

| Component | LOC | Notes |
|-----------|-----|-------|
| Manifest types | ~15 | Simplified from plan |
| createBackup() | ~25 | With symlink check + hash naming |
| loadManifest() | ~30 | With validation |
| executeRollback() | ~40 | With path re-validation |
| Modified runInit() | ~20 | Branch handling |
| CLI integration | ~10 | Flags + help text |
| **Total** | **~140** | In single file |

---

## Sources & References

### Origin

- **Brainstorm:** [docs/brainstorms/2026-02-23-installability-patches-brainstorm.md](../brainstorms/2026-02-23-installability-patches-brainstorm.md)
- Key decisions carried forward:
  - Hybrid approach: Git by default, manifest opt-in
  - Manifest at `.harness/restore-manifest.json`
  - Delete backups after successful rollback

### Research Insights

- **TypeScript patterns:** Discriminated unions, result types, temp file cleanup
- **Security:** Symlink detection, path validation during rollback, hash-based naming
- **Simplicity:** YAGNI fields removed, inline trivial functions, skip exit code proliferation

### Internal References

- Current implementation: `src/commands/init.ts`
- Atomic write pattern: `src/commands/init.ts:137-155`
- Path sanitization: `src/commands/init.ts:92-129`
- Safe JSON parsing: `src/lib/contract/loader.ts`
- CLI parsing: `src/cli.ts:106-120`

### Future Patches (not in scope)

- Patch 1: Update Detection
- Patch 2: Interactive Mode
- Patch 3: Schema Migration
