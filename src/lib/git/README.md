# Git Helpers

## Table of Contents

- [Purpose](#purpose)
- [Environment Sanitation](#environment-sanitation)
- [Validation](#validation)

## Purpose

This directory owns shared git subprocess helpers. Feature modules should use
these helpers instead of hand-rolling git environment cleanup beside their own
runtime or evidence logic.

## Environment Sanitation

Use `sanitizeGitEnvironment` from `safe-env.ts` before spawning git commands
from code that may run inside hooks, tests, or nested fixture repositories.

Policies:

- `strict`: drop every `GIT_*` variable. Use this when inherited git state,
  identity, and hook-local values must not affect the subprocess.
- `minimal`: drop repository-scoped variables only:
  `GIT_COMMON_DIR`, `GIT_DIR`, `GIT_INDEX_FILE`, and `GIT_WORK_TREE`. Use this
  when caller identity/configuration may remain but repository binding must be
  reset.

Do not manually delete `GIT_*` keys in feature modules. Route new cases through
this helper so root-hygiene, runtime-card, fixture, and hook contexts keep one
shared policy surface.

## Validation

Run `pnpm run quality:git-env-sanitizer` after changing git subprocess
environment handling. The guard fails when production source manually deletes
or broadly filters `GIT_*` variables outside `src/lib/git/safe-env.ts`.
