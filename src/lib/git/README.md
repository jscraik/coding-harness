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
| `minimal` | Run git against an explicit repository root while preserving user identity and tool configuration. | Drops caller-scoped repository variables such as `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and `GIT_COMMON_DIR`. |
| `strict` | Run repository validators or wrappers that must not inherit any caller git state. | Drops every `GIT_*` key. |

## Ownership

`src/lib/git/safe-env.ts` is the shared authority for git subprocess
environment cleanup. Runtime-card code, root-hygiene classifiers, and wrapper
invocations should call it through their local adapter instead of repeating
manual deletion logic.

## Validation

Run `pnpm run quality:git-env-sanitizer` after changing git subprocess
environment handling.
