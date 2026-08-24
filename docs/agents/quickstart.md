---
last_validated: 2026-07-15
---

# Quickstart

## Table of Contents

- [Prerequisites](#prerequisites)
- [Agent-native loop](#agent-native-loop)
- [Validate](#validate)
- [Create a PR](#create-a-pr)
- [Route deeper](#route-deeper)

## Prerequisites

```bash
node -v   # >= 26.3.0; see .mise.toml
pnpm -v   # 10.33.0
```

## Agent-native loop

For an installed package consumer, start with the read-only cockpit entrypoint:

```bash
harness next --json
```

From this source checkout, install dependencies first, then prove the checkout
rather than whichever global binary happens to be on `PATH`:

```bash
pnpm install --frozen-lockfile

# Before a build, use the source loader:
node --import tsx src/cli.ts next --json

# After a build, use the package-local binary:
pnpm build
pnpm exec harness next --json
```

The bare `harness` command is not source proof when a global version may shadow
the checkout.

Read `nextCommand` and `executionBoundary.safeToRun`, run the recommendation
when safe, and repeat after repository state changes; use the [CLI reference](../cli-reference.md).

## Validate

```bash
pnpm install --frozen-lockfile
bash scripts/validate-codestyle.sh --fast
pnpm check
bash scripts/verify-work.sh --fast
```

The codestyle wrapper sanitizes hook-exported `GIT_*` values before nested
`pnpm` commands.

## Create a PR

```bash
git checkout -b codex/JSC-XXX-short-description
# make changes, validate, then commit
bash scripts/validate-codestyle.sh
git push -u origin HEAD
```

Open a PR for every merge and keep independent review evidence separate from
local validation. Use the repository PR template and record exact commands and
outcomes.

## Route deeper

- tooling: [02-tooling-policy](02-tooling-policy.md)
- validation: [04-validation](04-validation.md)
- Linear: [13-linear-production-workflow](13-linear-production-workflow.md)
- full map: [01-instruction-map](01-instruction-map.md)
