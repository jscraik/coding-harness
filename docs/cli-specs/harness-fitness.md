---
schema_version: 1
tool_name: harness
command_name: fitness
created: 2026-06-25
status: active
audience: dual-mode
maturity: production-grade
last_validated: 2026-06-25
---

# Harness Fitness CLI Contract

## Table of Contents
- [Purpose](#purpose)
- [Invocation](#invocation)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Exit Codes](#exit-codes)
- [Claim Boundaries](#claim-boundaries)
- [Validation](#validation)

## Purpose

`harness fitness` normalizes deterministic local gate artifacts into a
`harness-fitness/v1` report. The command is read-only: it does not mutate repo
state, install dependencies, update PRs, or resolve review/tracker state.

## Invocation

```bash
harness fitness [--json] [--from-existing-artifacts <dir>] [artifact flags]
```

Source-checkout public-bin equivalent:

```bash
pnpm exec harness fitness [--json] [--from-existing-artifacts <dir>] [artifact flags]
```

Current-tree development probe:

```bash
node --import tsx src/cli.ts fitness [--json] [--from-existing-artifacts <dir>] [artifact flags]
```

## Inputs

Artifact flags accept explicit JSON artifact paths:

| Flag | Source command |
| --- | --- |
| `--architecture-report <path>` | `pnpm architecture:check` |
| `--quality-size-report <path>` | `pnpm run quality:size` |
| `--typecheck-report <path>` | `pnpm run fitness:typecheck-artifact` |
| `--lint-report <path>` | `pnpm run fitness:lint-artifact` |
| `--behavior-tests-report <path>` | `pnpm run quality:behavior-tests` |
| `--audit-tracking-report <path>` | `pnpm run harness:audit-tracking` |
| `--advisory-review-report <path>` | `pnpm run autoreview` |
| `--trend-baseline <path>` | previous `harness-fitness/v1` report |

`--from-existing-artifacts <dir>` discovers conventional artifact names in one
directory: `architecture.json`, `quality-size.json`, `typecheck.json`,
`lint.json`, `behavior-tests.json`, `harness-audit-tracking.json`, and optional
`autoreview.json`.

## Outputs

When `--json` succeeds, stdout emits `harness-fitness/v1`, validated by
[harness-fitness.schema.json](../../contracts/harness-fitness.schema.json).
The report includes:

- `lanes`: current local evidence status for deterministic gate artifacts.
- `coverage`: anti-pattern and engineering-judgement routing metadata that
 maps TypeScript, Python, config, architecture, API, security, testing,
 observability, CI/CD, accessibility, and AI-agent review concerns to fitness
  lanes or adjacent required commands. New reports emit this field; consumers
  still accept older `harness-fitness/v1` artifacts that do not include it.
- `topDeterministicFinding`: the highest-priority non-advisory finding when
  deterministic evidence exists.

When `--json` hits a usage or runtime error, stdout emits
`harness-cli-error/v1`, validated by
[harness-cli-error.schema.json](../../contracts/harness-cli-error.schema.json).

Human-readable mode prints report lines to stdout and diagnostics to stderr.

## Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Report status is `pass` or `warn`. |
| `1` | Report status is `fail` or `needs_evidence`, or input artifacts cannot be read. |
| `2` | Required flag value is missing. |

## Claim Boundaries

Fitness reports normalize local gate evidence only. They do not prove CI state,
PR mergeability, review-thread resolution, tracker closure, external readiness,
or branch hygiene unless another current evidence lane explicitly joins those
claims.

The `coverage` section is not a pass/fail score. When present, it tells agents which
deterministic lane or adjacent command owns each anti-pattern family. A command
listed in `coverage.commands` is proof only when current command evidence or a
validated artifact for that command is present.

`harness next --fitness-report <path>` may consume validated
`harness-fitness/v1` reports for route guidance. Trusted deterministic
recommended commands are centralized in `src/lib/fitness/commands.ts`.

## Validation

Use the narrowest relevant checks first:

```bash
pnpm vitest run src/commands/fitness.test.ts src/commands/next-fitness-report.test.ts
pnpm run artifact:types
```

After source, docs, or contract changes, widen according to policy routing with
`pnpm run quality:docstrings`, `pnpm run quality:size`,
`pnpm run test:related`, and `bash scripts/validate-codestyle.sh --fast`.
