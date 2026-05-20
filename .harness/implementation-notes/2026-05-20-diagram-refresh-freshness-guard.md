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

A later drift-gate boundary slice showed a second failure mode: if the refresh
subprocess hangs, the freshness check can leave generated diagram artifacts
dirty and keep an exec session alive instead of returning a crisp validation
result.

The root cause of the hang was the generator's broad default glob set
(`**/*.ts`, `**/*.js`, and related language globs). The generator applied
`--max-files` after glob expansion, so a pre-push freshness run could spend
the budget walking non-source repository surfaces before producing any diagram
artifact.

## Durable Change

- `.gitignore` now ignores `.tmp-diagram-refresh-*/` scratch directories.
- `scripts/refresh-diagram-context.sh` excludes all diagram refresh scratch
  directories from generator input, not only the current run directory.
- Quiet-mode diagram generation now reports a direct error when the generator
  exits before writing its stderr file.
- `scripts/refresh-diagram-context.sh` now constrains diagram generation to the
  repository's architecture source surfaces (`src`, `scripts`, and `e2e`) and
  uses deterministic diagram output.
- The C4 context normalizer no longer assumes a stable generated `ext_N`
  ordering for the Version Control dependency group.
- `scripts/check-diagram-freshness.sh` now runs refresh with a bounded timeout,
  refuses to refresh over pre-existing diagram artifact edits, and restores
  generated diagram artifacts when refresh fails.

## Validation Contract

The proving command is:

```bash
bash scripts/check-diagram-freshness.sh
```

Expected result: pass, with any semantically equivalent generated diagram churn
restored or left out of the commit scope.
