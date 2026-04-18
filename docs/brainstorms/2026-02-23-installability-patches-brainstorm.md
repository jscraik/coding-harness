---
title: Installability Patches - Update Detection, Interactive Mode, Schema Migration, Rollback
type: feat
date: 2026-02-23
status: active
origin: docs/plans/2026-02-23-feat-installability-plan.md (Future Patches section)
last_validated: 2026-04-18
---

# Installability Patches

## What We're Building

Four incremental patches to enhance the `harness init` command:

| Patch | Name | Purpose |
|-------|------|---------|
| **4** | Rollback System | Restore to pre-install state |
| **1** | Update Detection | Check for and apply template updates |
| **2** | Interactive Mode | y/n/diff prompts before changes |
| **3** | Schema Migration | Auto-migrate contract schema versions |

## Why This Matters

The MVP init command is intentionally minimal. These patches address real-world adoption friction:
- **Rollback**: Users need a safety net before trusting an installer
- **Updates**: Templates evolve; users need upgrade paths
- **Interactive**: Diff preview reduces "blind install" anxiety
- **Migration**: Schema v2 will happen; users shouldn't hand-edit JSON

## Implementation Order

**4 → 1 → 2 → 3** (Rollback first, provides safety net for other patches)

Each patch is a separate PR for independent review and rollback.

---

## Patch 4: Rollback System

### Design

**Hybrid approach**: Git-based by default, manifest as opt-in.

```bash
# Default: rely on git (current behavior, documented)
harness init              # Creates files
git checkout .            # Undo

# Opt-in: track changes for non-git users
harness init --track      # Creates .harness/restore-manifest.json
harness init --rollback   # Restores from manifest
```

### What Gets Tracked (with --track)

```
.harness/
├── restore-manifest.json   # Tracks created/modified files
└── backups/                # Pre-install file backups
    └── harness.contract.json.bak
```

### Manifest Structure

```json
{
  "version": "1.0",
  "installedAt": "2026-02-23T12:00:00Z",
  "harnessVersion": "0.4.0",
  "files": [
    {
      "path": "harness.contract.json",
      "action": "created",
      "backup": null
    },
    {
      "path": ".github/workflows/pr-pipeline.yml",
      "action": "modified",
      "backup": ".harness/backups/pr-pipeline.yml.bak"
    }
  ]
}
```

### CLI Flags

| Flag | Purpose |
|------|---------|
| `--track` | Create restore manifest and backups |
| `--rollback` | Restore from manifest, remove created files |
| `--rollback --force` | Rollback even if manifest is stale |

### Exit Codes (new)

```typescript
ROLLBACK_SUCCESS: 10,
ROLLBACK_NO_MANIFEST: 11,
ROLLBACK_MANIFEST_CORRUPT: 12
```

---

## Patch 1: Update Detection

### Design

**Version tracking**: Store installed harness version in manifest.

```bash
harness init --check-updates   # Compare installed vs current
harness init --update          # Apply updates to outdated files
```

### Version Comparison

```typescript
// In .harness/restore-manifest.json
{
  "harnessVersion": "0.3.0",  // Installed version
  // ...
}

// Compare with current CLI version
const currentVersion = getVersion(); // From cli.ts
const needsUpdate = semver.gt(currentVersion, manifest.harnessVersion);
```

### Update Behavior

| Scenario | `--check-updates` | `--update` |
|----------|-------------------|------------|
| No manifest | "Not installed" | "Run `harness init` first" |
| Same version | "Up to date" | No-op |
| Newer version | "Update available: v0.3.0 → v0.4.0" | Updates templates |

---

## Patch 2: Interactive Mode

### Design

**Inquirer prompts**: y/n/diff for each file change.

```bash
harness init --interactive
```

### Interaction Flow

```
Installing harness (package manager: pnpm)

? harness.contract.json exists. Overwrite? (y/N/diff)
  > diff
--- current
+++ new
@@ -1,5 +1,5 @@
 {
   "version": "1.0",
-  "reviewPolicy": { "timeoutSeconds": 300 }
+  "reviewPolicy": { "timeoutSeconds": 600 }
 }

? Apply this change? (y/N)
  > y
  ✓ harness.contract.json updated
```

### Dependency

Add `@inquirer/prompts` for interactive prompts (lightweight, tree-shakeable).

---

## Patch 3: Schema Migration

### Design

**Migration registry**: Auto-migrate contract schema versions.

```typescript
const MIGRATIONS: Migration[] = [
  {
    fromVersion: "1.0",
    toVersion: "2.0",
    migrate: (contract) => ({
      ...contract,
      version: "2.0",
      // New fields with defaults
      memoryPolicy: { enabled: true, maxEntries: 100 }
    })
  }
];
```

### Migration Flow

```
Detected contract version 1.0 (current: 2.0)
Running migration: 1.0 → 2.0
  + Added memoryPolicy.enabled (default: true)
  + Added memoryPolicy.maxEntries (default: 100)
✓ Contract migrated to version 2.0
```

### CLI Flag

```bash
harness init --migrate    # Auto-migrate outdated contract
```

---

## Key Decisions

1. **Rollback first**: Provides safety net for other patches
2. **Hybrid rollback**: Git by default, manifest opt-in
3. **Incremental PRs**: Each patch is independently reviewable
4. **No breaking changes**: All new features are opt-in flags
5. **Reuse patterns**: Leverage existing `safeParseJson`, `atomicWrite`, result types

---

## Resolved Questions

### Q1: Manifest location
**Decision:** `.harness/` directory - keeps harness artifacts together.

### Q2: Backup retention
**Decision:** Delete after successful rollback - no point keeping.

### Q3: Interactive mode default
**Decision:** Non-interactive default with `--interactive` flag - CI-friendly.

---

## Sources

- Original plan: `docs/plans/2026-02-23-feat-installability-plan.md`
- Current implementation: `src/commands/init.ts`
- Contract types: `src/lib/contract/types.ts`
