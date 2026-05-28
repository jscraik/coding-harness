---
schema_version: 1
status: active
owner: coding-harness-maintainers
---

# Agent Readiness Contract

## Table of Contents
- [Purpose](#purpose)
- [Readiness Dimensions](#readiness-dimensions)
- [Command Contract](#command-contract)
- [Boundaries](#boundaries)

## Purpose

Agent readiness means a future Codex run can discover the project operating
system from tracked files, prove work through repository-native capabilities,
respect explicit approval boundaries, and traverse prior evidence without
depending on chat-only memory.

This contract turns that expectation into a read-only harness check:

```bash
harness agent-readiness --json
```

## Readiness Dimensions

The command checks six dimensions:

- `instructions`: root instructions, scoped-rule routing, and codestyle entrypoints.
- `artifacts`: durable specs, plans, checklists, and the active artifact index.
- `capabilities`: tests, browser or screenshot capability, and logs or run-record evidence.
- `approval_gates`: destructive, expensive, credentialed, and shared-state action boundaries.
- `traceability`: links among tickets, docs, files, sessions, branches, commits, PRs, and validation evidence.
- `context_health`: advisory stale-context orientation for active artifacts,
  Project Brain memory and knowledge, runtime-card evidence, and unobserved
  external horizon state.

Each finding reports `pass`, `warn`, or `fail` with concrete file evidence.

## Command Contract

`harness agent-readiness [path] [--repo-root <path>] [--json]`

- `--repo-root <path>` overrides the positional `[path]` when both are provided.
- Exit `0`: all required checks pass, with optional warnings.
- Exit `1`: one or more required readiness surfaces fail.
- Exit `2`: CLI usage error.
- JSON output uses `schemaVersion: agent-readiness/v1`.
- JSON output includes `contextHealth.schemaVersion:
  agent-readiness-context-health/v1`. This projection is orientation-only and
  must not be used as claim-supporting closeout evidence.
- The canonical deep context-integrity report remains `context-health-report/v1`
  from `harness context-health --json`; `agent-readiness` only points to it and
  does not duplicate its artifact refs, contradiction history, metrics, or
  inventory model.
- `contextHealth.suggestedRefreshCommands` is a projection-level convenience
  list. Consumers must inspect each surface's `suggestedRefreshCommands`,
  `staleReasons`, and `evidenceUse` before deciding whether a command applies;
  a local context refresh must not be treated as PR, CI, Linear, CodeRabbit, or
  review-thread freshness proof.
- JSON usage errors use `schemaVersion: agent-readiness-error/v1` so parsers
  do not confuse invalid arguments with normal readiness reports.

Warnings are intentionally non-blocking because downstream repositories may
adopt the harness progressively. Required failures are reserved for missing
baseline surfaces that prevent reliable agent operation.

## Boundaries

The command is read-only. It does not create files, mutate tracker state, stage
changes, open PRs, run tests, or grant approval. It only answers whether the
repository exposes enough direct evidence for an agent to act with capability
and restraint.
