---
title: Patch 1 - Update Detection for harness init
type: feat
status: completed
date: 2026-02-23
origin: docs/brainstorms/2026-02-23-installability-patches-brainstorm.md
---

# Patch 1 - Update Detection for harness init

## Overview

Implement version tracking and update detection for `harness init`. Store the installed harness version in the manifest and provide flags to check for and apply template updates.

## Problem Statement / Motivation

Templates evolve over time. Users who installed harness months ago have outdated templates but no way to know or update them. This creates:
- **Version drift**: Installed templates diverge from current best practices
- **Manual migration**: Users must manually compare and update files
- **No visibility**: No way to check if updates are available

**From brainstorm:** Version tracking with `--check-updates` and `--update` flags addresses this.

## Proposed Solution

```bash
# Check if updates are available
harness init --check-updates   # Compares manifest version vs current CLI

# Apply updates to outdated files
harness init --update          # Updates templates to current version
```

## Technical Approach

### Architecture

Extend the existing rollback system's manifest with version tracking:

```
.harness/
└── restore-manifest.json     # Now includes harnessVersion
```

### Type Changes

**Extend RestoreManifest** (src/commands/init.ts):

```typescript
export interface RestoreManifest {
  harnessVersion: string;  // NEW: CLI version at install time
  files: ManifestEntry[];
}
```

**New result types**:

```typescript
export type UpdateCheckResult =
  | { ok: true; value: { currentVersion: string; installedVersion: string; updateAvailable: boolean } }
  | { ok: false; error: InitErrorOutput };

export type UpdateResult =
  | { ok: true; value: { updated: string[]; skipped: string[] } }
  | { ok: false; error: InitErrorOutput };
```

### Version Comparison

Use semver comparison (add `semver` dependency) or implement simple semver.gt():

```typescript
import semver from "semver";

function checkForUpdates(manifest: RestoreManifest, currentVersion: string): UpdateCheckResult {
  const installedVersion = manifest.harnessVersion || "0.0.0";
  const updateAvailable = semver.gt(currentVersion, installedVersion);

  return {
    ok: true,
    value: { currentVersion, installedVersion, updateAvailable }
  };
}
```

### Implementation Steps

#### Phase 1: Extend Manifest with Version

1. Add `harnessVersion: string` to `RestoreManifest` interface
2. In `runInit()` when `--track` is used, store `getVersion()` result in manifest
3. In `loadManifest()`, handle manifests without `harnessVersion` (default to "0.0.0")
4. Update tests for new manifest structure

#### Phase 2: --check-updates Flag

1. Add `checkUpdates?: boolean` to `InitOptions`
2. In `runInit()`, when `--check-updates`:
   - Load manifest (fail if not found)
   - Compare versions using semver
   - Return structured result
3. In `runInitCLI()`, format output:
   - No manifest: "Not installed. Run `harness init --track` first."
   - Same version: "Up to date (v0.4.0)"
   - Update available: "Update available: v0.3.0 → v0.4.0"
4. Add CLI flag parsing in src/cli.ts
5. Write tests

#### Phase 3: --update Flag

1. Add `update?: boolean` to `InitOptions`
2. In `runInit()`, when `--update`:
   - Load manifest (fail if not found)
   - Check version (no-op if same)
   - For each tracked file, re-render template and write
   - Update `harnessVersion` in manifest
3. Reuse existing `atomicWrite()` and `sanitizePath()` for security
4. In `runInitCLI()`, format output:
   - No manifest: "Not installed. Run `harness init` first."
   - Same version: "Already up to date."
   - Updated: List updated files
5. Add CLI flag parsing
6. Write tests

### Update Behavior Matrix

| Scenario | `--check-updates` | `--update` |
|----------|-------------------|------------|
| No manifest | "Not installed. Run `harness init --track` first." | "Not installed. Run `harness init` first." |
| Same version | "Up to date (v0.4.0)" | "Already up to date." (no-op) |
| Newer version | "Update available: v0.3.0 → v0.4.0" | Updates templates, updates manifest version |

### Exit Codes

Reuse existing codes - no new codes needed:

```typescript
EXIT_CODES.SUCCESS: 0     // Check/update succeeded
EXIT_CODES.WRITE_ERROR: 2 // No manifest, corrupted manifest, etc.
```

## System-Wide Impact

### Interaction Graph

```
harness init --check-updates
    └── loadManifest() → getVersion() → semver.gt() → return result

harness init --update
    ├── loadManifest()
    ├── checkForUpdates()
    ├── for each tracked file:
    │   ├── sanitizePath()
    │   ├── render()
    │   └── atomicWrite()
    └── update manifest harnessVersion
```

### Error Propagation

| Error | Code | Message |
|-------|------|---------|
| No manifest found | WRITE_ERROR | "Not installed. Run `harness init --track` first." |
| Manifest corrupted | WRITE_ERROR | "Failed to load manifest: ..." |
| Version parse error | WRITE_ERROR | "Invalid version format: ..." |

### Backward Compatibility

- Manifests without `harnessVersion` default to "0.0.0"
- This ensures old manifests always show "update available"
- No migration required

## Acceptance Criteria

### Functional Requirements

- [x] `harness init --track` stores `harnessVersion` in manifest
- [x] `harness init --check-updates` reports update status
- [x] `harness init --check-updates` fails gracefully without manifest
- [x] `harness init --update` rewrites templates when update available
- [x] `harness init --update` is no-op when already current
- [x] `harness init --update` updates manifest version after success
- [x] Manifests without `harnessVersion` default to "0.0.0"

### Non-Functional Requirements

- [x] Add semver dependency (or implement simple comparison)
- [x] Reuse existing security patterns (sanitizePath, atomicWrite)
- [x] Follow existing result type patterns

### Documentation Requirements

- [x] Help text updated with `--check-updates` and `--update` flags

## Dependencies & Risks

### Dependencies

- **semver** package (add to dependencies) OR implement simple semver.gt()

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking manifest format | LOW | Backward compatible; default missing version to "0.0.0" |
| semver dependency size | LOW | ~25KB minified; acceptable for CLI tool |
| Template content drift | MEDIUM | --update overwrites local customizations; document this |

## Estimated Effort

| Component | LOC | Notes |
|-----------|-----|-------|
| Extend manifest type | ~5 | harnessVersion field |
| checkForUpdates() | ~20 | Version comparison logic |
| executeUpdate() | ~40 | Re-render and write templates |
| CLI flag parsing | ~15 | --check-updates, --update |
| Tests | ~80 | New test suites |
| **Total** | **~160** | In existing init.ts |

## Sources & References

### Origin

- **Brainstorm:** [docs/brainstorms/2026-02-23-installability-patches-brainstorm.md](docs/brainstorms/2026-02-23-installability-patches-brainstorm.md)
- Key decisions carried forward:
  - Store `harnessVersion` in manifest
  - `--check-updates` for version comparison
  - `--update` to apply updates
  - semver.gt() for comparison

### Internal References

- Version retrieval: `src/cli.ts:46-50`
- Manifest structure: `src/commands/init.ts:34-41`
- Atomic write pattern: `src/commands/init.ts:187-211`
- Path sanitization: `src/commands/init.ts:130-179`
- CLI parsing: `src/cli.ts:112-130`
