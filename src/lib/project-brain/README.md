# Project Brain Module Map

## Table of Contents

- [Purpose](#purpose)
- [Ownership Map](#ownership-map)
- [Rule Grammar](#rule-grammar)
- [Validation](#validation)

## Purpose

This directory owns the `harness brain` command family and the local Project
Brain helpers it uses to inspect `.harness` knowledge, rules, metadata,
staleness, and lint state.

## Ownership Map

| Surface | Owner | Notes |
| --- | --- | --- |
| CLI dispatch | `cli.ts` | Routes `harness brain <subcommand>` and renders help before validation. |
| Shared flag parsing | `cli-args.ts` and `cli-value-flags.ts` | Keep flags that consume a following value in `BRAIN_VALUE_FLAGS`. |
| Human output | `*-presenter.ts` | Keep presentation separate from scanners and command validation. |
| JSON result shapes | `cli-types.ts` | Public command result contracts used by CLI tests and downstream callers. |
| Rules grammar | `rules.ts` | Parses and formats Project Brain markdown rule entries. |
| Validation | `brain-validator.ts` and `lint-*.ts` | Own Project Brain structure, metadata, and lint diagnostics. |

## Rule Grammar

Project Brain rule documents use markdown list items with this shape:

```md
- **R-001**: Existing numeric rule
- **R-auto**: Added rule from brain add
```

Rule IDs must match `R-[a-z0-9_-]+`. Keep parser changes in `rules.ts`
covered by fixture-shaped tests so documentation and extraction stay aligned.

## Validation

Run focused checks:

```bash
pnpm vitest run src/lib/project-brain/rules.test.ts src/lib/project-brain/cli.test.ts --reporter=dot
```

Expected outcome: command exits `0` and every Project Brain parser,
presenter, and CLI assertion passes.

Owner: Project Brain module owners.

Failure handling:
- Re-run with the same command after the fix.
- Do not update snapshots unless the rule grammar or presenter output
  intentionally changed.
- Open or reference a tracked blocker if the failure cannot be repaired in the
  current slice.
