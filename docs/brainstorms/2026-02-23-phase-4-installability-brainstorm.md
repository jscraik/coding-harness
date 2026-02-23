---
title: Phase 4 Installability - harness init Command
type: feat
date: 2026-02-23
status: active
---

# Phase 4 Installability - harness init Command

## What We're Building

A `harness init` command that scaffolds or retrofits repositories with the coding-harness control plane:

- **New repos:** Full scaffold with contract, workflows, scripts, and .harness/ directory
- **Existing repos:** Non-destructive retrofit with conflict reporting
- **Re-installs:** Interactive update mode for outdated files
- **Rollback:** Explicit `--rollback` flag to restore pre-install state

## Why This Matters

Without an installer, each repo must manually copy templates and configure the harness. This creates:
- Inconsistent setups across repos
- Manual work that discourages adoption
- No upgrade path when harness evolves

The installer makes harness adoption a single command and provides a safe rollback mechanism.

## Key Decisions

### 1. Template Scope: Full Install
Install all harness components:
- `harness.contract.json` - Default contract template
- `.github/workflows/pr-pipeline.yml` - Combined preflight + CI workflow
- `scripts/check` - Local parity with CI
- `.harness/restore-manifest.json` - Tracks installer changes for rollback

### 2. Conflict Handling: Skip and Report
When files already exist:
- Skip the file (don't overwrite)
- Add to conflict report
- Print summary at end with manual resolution steps

### 3. Re-run Behavior: Interactive Update
When harness is already installed (detected by `.harness/restore-manifest.json` presence):
- Compare installed file checksums (stored in manifest) with current template checksums
- Prompt for each changed file: "Update .github/workflows/pr-pipeline.yml? (y/n/diff)"
- Allow viewing diff before deciding

### 4. Schema Migration: Auto-migrate
When contract schema evolves:
- Detect outdated `version` field in harness.contract.json
- Apply migration with backwards-compatible defaults
- Log all changes for user review
- Preserve user customizations where possible

### 5. Package Manager: Auto-detect
Detect from lockfile presence:
- `pnpm-lock.yaml` → pnpm
- `package-lock.json` → npm
- `yarn.lock` → yarn

Use detected manager in generated scripts/check command.

### 6. Rollback: Explicit Flag
- `harness init --rollback` reads `.harness/restore-manifest.json`
- Reverts all files to pre-install state
- Removes files that were created by harness
- Idempotent: safe to run multiple times

## CLI Interface

```
harness init [options]

Options:
  --mode <new|existing>   Target repo type (auto-detected if omitted)
  --dry-run               Print planned operations without executing
  --rollback              Restore to pre-install state
  --force                 Skip confirmation prompts
```

## Success Criteria

1. `harness init` in empty directory creates full scaffold
2. `harness init` in existing repo adds harness without breaking existing files
3. `harness init --dry-run` shows exactly what would happen
4. `harness init --rollback` restores repo to pre-install state
5. Re-running `harness init` prompts for updates on outdated files
6. Package manager detected correctly from lockfile
7. Schema migration logs changes clearly

## Open Questions

None - all key decisions resolved.

## Out of Scope

- Browser evidence verification (Phase 5)
- Observability hooks (Phase 5)
- Memory policy gates (Phase 7)
- Multi-repo batch installation
