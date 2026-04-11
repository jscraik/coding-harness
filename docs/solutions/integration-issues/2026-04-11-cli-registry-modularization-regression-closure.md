---
schema_version: 1
status: draft
applies_to:
  - coding-harness
  - command-registry-runtime
module: command-registry-runtime
date: 2026-04-11
problem_type: regression
component: command-registry
severity: medium
applies_when:
  - command-registry refactor is split across extracted specs and runtime wiring
  - check-environment validates hook configuration in prek.toml
symptoms:
  - check-environment can false-pass malformed prek hook wiring
  - extracted command-spec module can drift from runtime command manifest
  - --all-commands behavior can diverge from help output contract
root_cause: partial refactor with weakened invariants
resolution_type: bug fix
tags:
  - command-registry-runtime
  - command-registry
  - check-environment
  - prek
  - regression
---

# Solution: Close Command Registry Refactor Regressions

## Table of Contents
- [Problem](#problem)
- [Why It Happened](#why-it-happened)
- [Implemented Solution](#implemented-solution)
- [Verification Evidence](#verification-evidence)
- [Prevention](#prevention)
- [Related Artifacts](#related-artifacts)

## Problem

A command-registry refactor introduced three behavior regressions: hook validation accepted malformed `prek.toml` wiring when matching keys appeared in different hook blocks, runtime command registration remained sourced from an inline manifest instead of the extracted command-spec module, and help output stopped honoring `includeLegacy` semantics behind `--all-commands`.

## Why It Happened

The refactor split structure without preserving contract-level coupling checks.

1. `check-environment` switched to fast regex checks that verified line presence globally, not per hook object.
2. Command spec extraction created a second manifest source while runtime still used the inline array.
3. Help-row generation no longer filtered by `includeLegacy`, but calling paths and help text still advertised the legacy expansion behavior.

## Implemented Solution

The fix set restored invariant checks and single-source runtime wiring.

### 1. Restored per-hook semantic validation for `prek.toml`

- Updated `scripts/check-environment.sh` to parse TOML via `python3` + `tomllib`.
- Validation now checks required fields on the same local hook object (`id`, `entry`, `run`) rather than global text matches.

### 2. Removed runtime manifest drift risk

- Updated `src/lib/cli/command-registry.ts` to import extracted specs from `src/lib/cli/registry/command-specs.ts`.
- Runtime registry now composes the local `commands` entry with extracted specs, removing dual-manifest behavior.

### 3. Reinstated `includeLegacy` behavior for help output

- Updated `getRegistryCommandHelpRows` in `src/lib/cli/command-registry.ts` to honor `includeLegacy`.
- Updated regression assertion in `src/lib/cli/command-registry.test.ts` to verify alias/expanded output when legacy rows are requested.

## Verification Evidence

Validated on branch `codex/jsc-178-modularize-contract-registry-writable` and committed in `271af49f`.

Command outcomes:
- `pnpm exec vitest src/lib/cli/command-registry.test.ts src/lib/cli/registry/command-specs.test.ts` -> pass
- `bash scripts/validate-codestyle.sh --fast` -> pass
- `bash scripts/check-environment.sh` -> pass

Delivery evidence:
- Branch push to origin succeeded with head `271af49fc5ba566aa18838a8c871b1f4b7fcb2a4`.
- PR updated: `https://github.com/jscraik/coding-harness/pull/166`.

## Prevention

- Treat configuration validators as structure-aware parsers when correctness depends on field co-location.
- Keep runtime command registration sourced from one manifest path to avoid silent spec drift.
- Preserve option/flag contract coverage in command-help tests when refactoring presentation logic.

## Related Artifacts

- Commit: `271af49f` (`fix(cli): remove registry drift and restore hook validation`)
- PR: `https://github.com/jscraik/coding-harness/pull/166`
- Modified surfaces:
  - `scripts/check-environment.sh`
  - `src/lib/cli/command-registry.ts`
  - `src/lib/cli/command-registry.test.ts`
