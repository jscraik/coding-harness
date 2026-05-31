# Git Helpers

## Table of Contents

- [Environment Policies](#environment-policies)
- [Ownership](#ownership)
- [Validation](#validation)

## Environment Policies

Use `sanitizeGitEnvironment` for git subprocess environments instead of deleting
`GIT_*` variables in feature modules.

| Policy | Use | Behavior |
| --- | --- | --- |
| `minimal` | Run git against an explicit repository root while preserving user identity and tool configuration. | Drops caller-scoped repository, object-store, quarantine, and env-provided config variables such as `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_COMMON_DIR`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_QUARANTINE_PATH`, `GIT_CONFIG`, and all `GIT_CONFIG_*` keys. |
| `strict` | Run repository validators or wrappers that must not inherit any caller git state. | Drops every `GIT_*` key. |

`minimal` intentionally does not preserve inherited object-store indirection. Callers that require alternates or quarantine object paths need a separate reviewed execution policy instead of broadening the default repository-root sanitizer.

## Ownership

`src/lib/git/safe-env.ts` is the shared authority for git subprocess
environment cleanup. Runtime-card code, root-hygiene classifiers, and wrapper
invocations should call it through their local adapter instead of repeating
manual deletion logic.

## Validation

Run `pnpm run quality:git-env-sanitizer` after changing git subprocess
environment handling.
