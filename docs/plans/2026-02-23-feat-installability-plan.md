---
title: Phase 4 Installability - harness init Command
type: feat
status: completed
date: 2026-02-23
plan_id: feat-installability
origin: docs/brainstorms/2026-02-23-phase-4-installability-brainstorm.md
deepened: 2026-02-23
reviewed: 2026-02-23
implemented: 2026-02-23
scope: simplified
---

# Phase 4 Installability - harness init Command (Simplified)

## Enhancement Summary

**Deepened on:** 2026-02-23
**Technical Review:** 2026-02-23
**Scope:** Simplified (81% LOC reduction from original plan)

### Review Findings Incorporated
1. **Security fixes** - Path sanitization with proper prefix matching, unique temp files
2. **Simplicity** - Single-file implementation, git-based recovery
3. **TypeScript patterns** - Simple error handling, no over-abstraction

### Scope Changes from Original Brainstorm
| Feature | Original | MVP | Future Patch |
|---------|----------|-----|--------------|
| Manifest tracking | Yes | No | Patch 4 |
| Rollback system | `--rollback` flag | Git workflow | Patch 4 |
| Interactive updates | y/n/diff prompts | `--dry-run` | Patch 2 |
| Schema migration | Auto-migrate | Error message | Patch 3 |
| Module architecture | 9 modules | 1 file | N/A (single file works) |

---

## Overview

Implement a minimal `harness init` command that scaffolds repositories with the coding-harness control plane.

**Core principle:** This tool copies files. It delegates recovery, history, and diffing to git.

## Problem Statement

Without an installer, each repo must manually copy templates and configure the harness. This creates:
- Inconsistent setups across repos
- Manual work that discourages adoption

## Proposed Solution

A minimal `harness init` command with two modes:
- **Normal mode:** Copies templates, skips existing files (unless `--force`)
- **Dry-run mode:** Shows what would happen without writing

**Recovery strategy:** Document git workflow:
> "Commit before running. Use `--dry-run` to preview. To undo: `git checkout .`"

## Technical Approach

### Architecture (Simplified)

```
src/
└── commands/
    └── init.ts              # Single file (~150 LOC)
```

That's it. No lib/installer directory. No separate modules.

### CLI Interface

```
harness init [options]

Options:
  --dry-run    Preview changes without writing
  --force      Overwrite existing files
```

### Security Essentials (Inlined)

**Path sanitization** (inline, ~15 lines):
```typescript
function sanitizePath(base: string, relativePath: string): string {
  const resolved = path.resolve(base, relativePath);
  const normalizedBase = path.resolve(base);
  const baseWithSep = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : normalizedBase + path.sep;

  if (resolved !== normalizedBase && !resolved.startsWith(baseWithSep)) {
    throw new Error(`Path traversal blocked: ${relativePath}`);
  }
  return resolved;
}
```

**Atomic writes** (inline, ~10 lines):
```typescript
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, filePath);
}
```

### Template Handling

Templates are inline strings (no base64, no checksums - premature optimization):

```typescript
const TEMPLATES = [
  {
    path: 'harness.contract.json',
    render: (pm: string) => JSON.stringify({
      version: '1.0',
      riskTierRules: {},
      reviewPolicy: { timeoutSeconds: 600, timeoutAction: 'fail' }
    }, null, 2)
  },
  {
    path: '.github/workflows/pr-pipeline.yml',
    render: (pm: string) => `# GitHub Actions workflow
# Package manager: ${pm}
...
`
  },
];
```

### Implementation Phases

#### Phase 1: Core Command

- [x] Create `src/commands/init.ts` with:
  - [x] Package manager detection (3 `existsSync` calls)
  - [x] Template rendering with PM substitution
  - [x] `--dry-run` mode
  - [x] `--force` flag
  - [x] Path sanitization (inline)
  - [x] Atomic writes (inline)

#### Phase 2: CLI Integration

- [x] Wire up in `src/cli.ts`
- [x] Add help text
- [x] Add unit tests

#### Phase 3: Documentation

- [ ] Update README with git workflow
- [ ] Document recovery: "commit before init"

---

## System-Wide Impact

### Interaction Graph (Simplified)

```
harness init
    ├── detectPackageManager() → 3 existsSync calls
    ├── for each template:
    │   ├── sanitizePath() → inline check
    │   ├── render() → string substitution
    │   └── atomicWrite() → temp file + rename
    └── print summary
```

### Error Handling

- Throw on errors (no Result pattern - CLI exits anyway)
- Clear error messages with actionable advice
- Exit code 1 on any failure

### State Management

- **No state tracking** - This is the key simplification
- Git is the source of truth for:
  - What changed (`git diff`)
  - How to undo (`git checkout`)
  - History (`git log`)

---

## Acceptance Criteria (Simplified)

### Functional Requirements

- [x] `harness init` in empty directory creates:
  - `harness.contract.json` with default contract
  - `.github/workflows/pr-pipeline.yml` for CI
- [x] `harness init` skips existing files (prints "skip X (exists)")
- [x] `harness init --force` overwrites existing files
- [x] `harness init --dry-run` shows what would happen (no writes)
- [x] Package manager detected from lockfile

### Non-Functional Requirements

- [x] Path traversal attempts blocked with clear error
- [x] All writes are atomic (temp file + rename)
- [x] Clear output showing what was created/skipped

### Documentation Requirements

- [ ] README documents git workflow for recovery
- [ ] Error messages suggest `--dry-run` and git commands

---

## Dependencies

| Package | Purpose | Why Needed |
|---------|---------|------------|
| (none) | - | Node.js built-ins only |

Uses only `node:fs`, `node:path`, `node:crypto`. No new runtime dependencies.

---

## Risks

| Risk | Mitigation |
|------|------------|
| User doesn't commit first | Document prominently; `--dry-run` by default consideration |
| Crash mid-install | Re-run with `--force`, or `git checkout .` |
| Schema version mismatch | Clear error: "Contract version X not supported" |

---

## Future Phases (Deferred Complexity)

These features are valuable but deferred until real use cases emerge. They are tracked as future patches:

### Patch 1: Update Detection (When: Multiple users request upgrade path)

**Trigger:** Users with existing installations need to update templates.

**Scope:**
- Add `.harness/installed-version` file tracking
- `harness init --check-updates` to compare installed vs latest
- `harness init --update` to refresh outdated files

**Estimated effort:** 4-6 hours

### Patch 2: Interactive Updates (When: Users report diff workflow friction)

**Trigger:** Users want built-in diff preview instead of external tools.

**Scope:**
- Add `@inquirer/prompts` dependency
- `harness init --interactive` mode with y/n/diff prompts
- Inline diff preview for changed files

**Estimated effort:** 6-8 hours

### Patch 3: Schema Migration (When: Contract schema v2 is designed)

**Trigger:** Breaking changes to contract format require migration.

**Scope:**
- Version field in contract
- Migration registry with transform functions
- Auto-migrate with `--migrate` flag
- Log changes during migration

**Estimated effort:** 8-12 hours

### Patch 4: Rollback System (When: Non-git users need recovery)

**Trigger:** Users without git need undo capability.

**Scope:**
- `.harness/restore-manifest.json` tracking
- Backup files in `.harness/backups/`
- `harness init --rollback` to restore
- Manifest integrity with checksum

**Estimated effort:** 8-10 hours

### Patch 5: Enterprise Features (When: Audit/compliance requirements)

**Trigger:** Enterprise users need audit trails and signatures.

**Scope:**
- Template signing with Ed25519
- Audit log in `.harness/audit.log`
- Signed manifests for tamper detection
- Process locking for concurrent safety

**Estimated effort:** 12-16 hours

---

## What We're NOT Building (Permanent Cuts)

These were deemed unnecessary even for future phases:

| Feature | Why Permanently Cut |
|---------|---------------------|
| Result pattern | CLI can throw; no library consumers |
| Branded types | Type ceremony without runtime benefit |
| 9-module architecture | Single file is simpler and sufficient |
| Template checksums (MVP) | Add in Patch 5 if needed |

---

## MVP Implementation

### src/commands/init.ts

```typescript
import { existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { cwd } from "node:process";

// === Templates (inline) ===

const TEMPLATES: Array<{
  path: string;
  render: (pm: string) => string;
}> = [
  {
    path: "harness.contract.json",
    render: () =>
      JSON.stringify(
        {
          version: "1.0",
          riskTierRules: {},
          reviewPolicy: { timeoutSeconds: 600, timeoutAction: "fail" },
        },
        null,
        2
      ),
  },
  {
    path: ".github/workflows/pr-pipeline.yml",
    render: (pm) => `name: Harness PR Pipeline

on: pull_request

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: ${pm} install
      - run: ${pm} test
`,
  },
];

// === Package Manager Detection ===

function detectPackageManager(dir: string): string {
  if (existsSync(resolve(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(resolve(dir, "yarn.lock"))) return "yarn";
  if (existsSync(resolve(dir, "package-lock.json"))) return "npm";
  return "npm"; // Default
}

// === Path Sanitization ===

function sanitizePath(base: string, relativePath: string): string {
  const normalizedBase = resolve(base);
  const resolved = resolve(base, relativePath);
  const baseWithSep = normalizedBase.endsWith(sep) ? normalizedBase : normalizedBase + sep;

  if (resolved !== normalizedBase && !resolved.startsWith(baseWithSep)) {
    throw new Error(`Path traversal blocked: ${relativePath}`);
  }
  return resolved;
}

// === Atomic Write ===

function atomicWrite(filePath: string, content: string): void {
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(tempPath, content, "utf-8");
  renameSync(tempPath, filePath);
}

// === Main Command ===

export interface InitOptions {
  dryRun: boolean;
  force: boolean;
}

export function runInit(targetDir: string | undefined, options: InitOptions): number {
  const dir = targetDir ?? cwd();
  const pm = detectPackageManager(dir);

  console.log(`Installing harness (package manager: ${pm})\n`);

  const created: string[] = [];
  const skipped: string[] = [];

  for (const template of TEMPLATES) {
    const targetPath = sanitizePath(dir, template.path);
    const exists = existsSync(targetPath);

    if (exists && !options.force) {
      skipped.push(template.path);
      console.log(`  skip ${template.path} (exists)`);
      continue;
    }

    if (options.dryRun) {
      console.log(`  would ${exists ? "overwrite" : "create"} ${template.path}`);
      continue;
    }

    const content = template.render(pm);
    atomicWrite(targetPath, content);
    created.push(template.path);
    console.log(`  + ${template.path}`);
  }

  if (options.dryRun) {
    console.log("\nDry run complete. No files were modified.");
    return 0;
  }

  console.log(`\n✓ Harness installed!`);
  console.log(`  Created: ${created.length}, Skipped: ${skipped.length}`);

  if (created.length > 0) {
    console.log("\n  Tip: Review changes with 'git diff', undo with 'git checkout .'");
  }

  return 0;
}
```

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Core command | 2-3 hours |
| Phase 2: CLI integration | 1 hour |
| Phase 3: Documentation | 30 min |
| **Total** | **~4 hours** |

Compare to original plan: ~12+ hours for full implementation.

---

## Sources & References

### Review Agents Used
- kieran-typescript-reviewer
- security-sentinel
- architecture-strategist
- code-simplicity-reviewer

### Key Review Findings
- Path sanitization edge case: `startsWith` allows sibling directories
- Race condition: `Date.now()` temp files can collide
- Over-engineering: 9 modules for 3 file copies
- Recommendation: Single file ~150 LOC

### Internal References
- CLI structure: `src/cli.ts`
- Command pattern: `src/commands/risk-tier.ts`
- Contract types: `src/lib/contract/types.ts`
