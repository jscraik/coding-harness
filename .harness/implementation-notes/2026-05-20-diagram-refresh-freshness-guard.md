# Diagram Refresh Freshness Guard

## Table of Contents

- [Feedback Signal](#feedback-signal)
- [Operational Failure](#operational-failure)
- [Durable Change](#durable-change)
- [Validation Contract](#validation-contract)

## Feedback Signal

Jamie repeatedly asked for the live module-layout visual to stay updated during
deep-module work and later asked whether the failing diagram freshness
requirement should be disabled or pushed upstream.

## Operational Failure

The freshness lane left repo-root `.tmp-diagram-refresh-*` scratch directories
behind and the refresh command only excluded the current scratch directory from
the diagram generator scan. A later freshness run could fail inside the guard
with a missing temporary stderr file, which made the visual-update requirement
look flaky instead of enforceable.

Failure category: weak validation, stale state, weak observability.

## Durable Change

- `.gitignore` now ignores `.tmp-diagram-refresh-*/` scratch directories.
- `scripts/refresh-diagram-context.sh` excludes all diagram refresh scratch
  directories from generator input, not only the current run directory.
- Quiet-mode diagram generation now reports a direct error when the generator
  exits before writing its stderr file.

## Validation Contract

The proving command is:

```bash
bash scripts/check-diagram-freshness.sh
```

Expected result: pass, with any semantically equivalent generated diagram churn
restored or left out of the commit scope.
