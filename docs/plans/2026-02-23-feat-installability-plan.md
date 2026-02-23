---
title: Phase 4 Installability - harness init Command
type: feat
status: active
date: 2026-02-23
origin: docs/brainstorms/2026-02-23-phase-4-installability-brainstorm.md
---

# Phase 4 Installability - harness init Command

## Overview

Implement `harness init` command that scaffolds or retrofits repositories with the coding-harness control plane, supporting new repos, existing repos, re-installs with interactive updates, and rollback capability.

## Problem Statement

Without an installer, each repo must manually copy templates and configure the harness. This creates:
- Inconsistent setups across repos
- Manual work that discourages adoption
- No upgrade path when harness evolves

## Proposed Solution

A single `harness init` command that handles all installation scenarios:
- **New repos:** Full scaffold with contract, workflows, scripts, and .harness/ directory
- **Existing repos:** Non-destructive retrofit with conflict reporting
- **Re-installs:** Interactive update mode for outdated files
- **Rollback:** Explicit `--rollback` flag to restore pre-install state

## Technical Approach

### Architecture

```
src/
├── commands/
│   └── init.ts              # Main init command entry point
├── lib/
│   └── installer/
│       ├── templates.ts      # Template content and checksums
│       ├── detector.ts       # Repo state detection (new/existing/installed)
│       ├── fileops.ts        # Safe file operations with backup
│       ├── package-manager.ts # Lockfile detection
│       ├── migrator.ts       # Contract schema migration
│       └── rollback.ts       # Restore from manifest
└── templates/               # Embedded template files
    ├── harness.contract.json
    ├── pr-pipeline.yml
    └── check.sh
```

### Implementation Phases

#### Phase 1: Core Infrastructure

- [ ] Create `src/lib/installer/types.ts` - Shared types and interfaces
- [ ] Create `src/lib/installer/templates.ts` - Template registry with embedded content
- [ ] Create `src/lib/installer/detector.ts` - Install state detection
- [ ] Create `src/lib/installer/fileops.ts` - Safe file operations with checksums

#### Phase 2: Detection & Package Manager

- [ ] Create `src/lib/installer/package-manager.ts` - Lockfile detection
- [ ] Create `src/lib/installer/migrator.ts` - Schema migration logic
- [ ] Add unit tests for detection and migration

#### Phase 3: Init Command

- [ ] Create `src/commands/init.ts` - Main command implementation
- [ ] Wire up CLI parsing in `src/cli.ts`
- [ ] Implement conflict detection and reporting
- [ ] Implement interactive update prompts

#### Phase 4: Rollback

- [ ] Create `src/lib/installer/rollback.ts` - Rollback implementation
- [ ] Create manifest structure for tracking changes
- [ ] Add `--rollback` flag handling

#### Phase 5: Integration & Polish

- [ ] Add `--dry-run` mode
- [ ] Add `--force` flag for non-interactive mode
- [ ] Write integration tests
- [ ] Update CLI help text

## System-Wide Impact

### Interaction Graph

```
harness init
    ├── detector.ts → reads filesystem (harness.contract.json, .harness/, lockfiles)
    ├── package-manager.ts → reads lockfiles
    ├── templates.ts → provides template content
    ├── migrator.ts → transforms contract if needed
    ├── fileops.ts → writes files with backup
    └── rollback.ts → restores from .harness/restore-manifest.json
```

### Error Propagation

- File read/write errors → surfaced to user with clear message
- Invalid contract → migration fails gracefully with warning
- Missing permissions → user sees actionable error

### State Lifecycle

- Manifest created at install time in `.harness/restore-manifest.json`
- Contains: file paths, original checksums, backup paths (for existing files)
- Rollback reads manifest and restores state

## Acceptance Criteria

### Functional Requirements

- [ ] `harness init` in empty directory creates full scaffold:
  - `harness.contract.json` with default contract
  - `.github/workflows/pr-pipeline.yml` for CI
  - `scripts/check` with executable permissions
  - `.harness/restore-manifest.json` tracking installation
- [ ] `harness init` in existing repo adds harness without breaking existing files
- [ ] Skipped files due to conflicts are reported in summary
- [ ] `harness init --dry-run` shows exactly what would happen (no writes)
- [ ] `harness init --rollback` restores repo to pre-install state
- [ ] Re-running `harness init` with existing installation:
  - Detects `.harness/restore-manifest.json` presence
  - Compares checksums to detect outdated files
  - Prompts for each changed file (y/n/diff)
- [ ] Package manager detected correctly from lockfile:
  - `pnpm-lock.yaml` → pnpm
  - `package-lock.json` → npm
  - `yarn.lock` → yarn
- [ ] Schema migration logs changes clearly when contract version outdated

### Non-Functional Requirements

- [ ] All file operations are atomic (no partial writes)
- [ ] Clear error messages for common failure modes
- [ ] Progress output during installation

## Dependencies & Risks

### Dependencies

- Node.js fs/path modules (built-in)
- Crypto for checksums (built-in)
- readline for interactive prompts (built-in)

### Risks

| Risk | Mitigation |
|------|------------|
| Corrupting user files | Always backup before overwrite; atomic writes |
| Breaking existing workflows | Skip conflicting files; report for manual review |
| Incompatible contract versions | Migration with backwards-compatible defaults |
| Large repos slow detection | Limit detection to root-level files only |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-23-phase-4-installability-brainstorm.md](../brainstorms/2026-02-23-phase-4-installability-brainstorm.md)
- Key decisions carried forward:
  - Template Scope: Full install
  - Conflict Handling: Skip and report
  - Re-run Behavior: Interactive update
  - Schema Migration: Auto-migrate
  - Package Manager: Auto-detect
  - Rollback: Explicit flag

### Internal References

- CLI structure: `src/cli.ts:62-111`
- Command pattern: `src/commands/risk-tier.ts`
- Contract types: `src/lib/contract/types.ts`

## MVP

### src/lib/installer/types.ts

```typescript
export type InstallMode = "new" | "existing" | "update";

export type PackageManager = "npm" | "pnpm" | "yarn" | "unknown";

export interface TemplateFile {
  path: string;
  content: string;
  checksum: string;
}

export interface InstallResult {
  mode: InstallMode;
  created: string[];
  skipped: string[];
  conflicts: string[];
  migrated: string[];
}

export interface RestoreManifest {
  version: string;
  installDate: string;
  harnessVersion: string;
  files: Array<{
    path: string;
    checksum: string;
    existed: boolean;
    backupPath?: string;
  }>;
}
```

### src/lib/installer/detector.ts

```typescript
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { InstallMode, PackageManager } from "./types.js";

const MANIFEST_PATH = ".harness/restore-manifest.json";

export function detectInstallMode(cwd: string): InstallMode {
  const manifestPath = join(cwd, MANIFEST_PATH);
  if (existsSync(manifestPath)) {
    return "update";
  }

  // Check for any existing files that would conflict
  const hasExistingFiles = existsSync(join(cwd, "harness.contract.json")) ||
    existsSync(join(cwd, ".github"));

  return hasExistingFiles ? "existing" : "new";
}

export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "package-lock.json"))) return "npm";
  return "unknown";
}
```

### src/commands/init.ts

```typescript
import { createHash } from "node:crypto";
import type { InstallMode, PackageManager, TemplateFile, InstallResult, RestoreManifest } from "../lib/installer/types.js";
import { detectInstallMode, detectPackageManager } from "../lib/installer/detector.js";

// Template registry with embedded content and checksums
const TEMPLATES: TemplateFile[] = [
  {
    path: "harness.contract.json",
    content: JSON.stringify({
      version: "1.0",
      riskTierRules: {},
      reviewPolicy: { timeoutSeconds: 600, timeoutAction: "fail" }
    }, null, 2),
    checksum: "", // Computed at load time
  },
  // ... other templates
];

export interface InitOptions {
  mode?: "new" | "existing";
  dryRun: boolean;
  rollback: boolean;
  force: boolean;
}

export async function runInit(cwd: string, options: InitOptions): Promise<number> {
  const installMode = options.mode ?? detectInstallMode(cwd);
  const packageManager = detectPackageManager(cwd);

  if (options.dryRun) {
    console.log("Dry run - would perform the following operations:");
    // Print planned operations
    return 0;
  }

  if (options.rollback) {
    return performRollback(cwd);
  }

  // Installation logic here
  console.log(`Installing harness (mode: ${installMode}, package manager: ${packageManager})`);

  return 0;
}

async function performRollback(cwd: string): Promise<number> {
  // Read manifest and restore files
  console.log("Rolling back harness installation...");
  return 0;
}
```
