---
last_validated: 2026-05-08
---

# Project Brain memory-extension rollout

- [Purpose](#purpose)
- [Authority](#authority)
- [What changed in coding-harness](#what-changed-in-coding-harness)
- [Scope model](#scope-model)
- [Per-repo rollout checklist](#per-repo-rollout-checklist)
- [Validation commands](#validation-commands)

## Purpose

This is a reference-only rollout note for mapping Project Brain
memory-extension readiness across repositories. It records the migration shape;
it is not the live policy source for this repository.

## Authority

Use these live sources before this rollout note:

| Question | Source of truth |
| --- | --- |
| Required Project Brain paths | `harness.contract.json` `toolingPolicy.projectBrainMemoryExtension.requiredPaths` |
| Repo-local memory surface | `.harness/memory/LEARNINGS.md` and [local memory](./03-local-memory.md) |
| Tooling and readiness contract | [tooling policy](./02-tooling-policy.md) and `scripts/check-environment.sh` |
| PR closeout learning evidence | [validation](./04-validation.md) north-star learning loop |

If this note conflicts with those surfaces, treat this note as stale reference
context and update or delete the conflicting text.

## What changed in coding-harness

1. Added `toolingPolicy.projectBrainMemoryExtension` to the contract model.
2. Defaulted `projectBrainMemoryExtension.enabled` to `true` with required `.harness/**` paths.
3. Updated scaffolded `scripts/check-environment.sh` to:
   - declare `required_project_brain_paths`
   - enforce those paths only when `project_brain_memory_extension_enabled=true`
4. Updated `harness tooling-audit` to:
   - detect readiness-script drift for Project Brain markers
   - fail when required Project Brain paths are missing
   - detect policy drift against a base contract
5. Updated governance docs to clarify project-local scope and expected evidence.

## Scope model

- Project-local enforcement:
  - `.harness/**` Project Brain files and directories
  - repo `harness.contract.json` tooling policy
  - repo `scripts/check-environment.sh`
- Not workspace-scoped:
  - no dependency on `~/.codex` or other global codex-maintenance state

## Per-repo rollout checklist

1. Ensure the repository has `toolingPolicy.projectBrainMemoryExtension` in `harness.contract.json`.
2. Set `enabled=true` for repositories that should enforce Project Brain.
3. Keep `requiredPaths` aligned to that repository’s actual `.harness/**` scaffold.
4. Re-run scaffold/update flow so `scripts/check-environment.sh` includes:
   - `project_brain_memory_extension_enabled=true`
   - `required_project_brain_paths=(...)`
5. Verify all required Project Brain paths exist in the repository.
6. Re-run tooling audit and fix drift before enabling strict gates.

## Validation commands

Use the repo-local wrappers/gates:

1. `pnpm test -- src/commands/tooling-audit.test.ts src/lib/contract/validator.test.ts src/commands/init.test.ts`
2. `pnpm lint`
3. `pnpm typecheck`
4. `bash scripts/verify-work.sh --fast`

If a repository is being migrated gradually, run `harness tooling-audit --path <repo-root>` first and land policy + scaffold updates together. In this source repository, use `pnpm exec tsx src/cli.ts tooling-audit --path . --json` when proving the current checkout before package-build parity.
