# Agent Run Records

## Table of Contents
- [Purpose](#purpose)
- [Canonical Layout](#canonical-layout)
- [Discovery Order](#discovery-order)
- [Write Semantics](#write-semantics)
- [Validation Rules](#validation-rules)

## Purpose

Define the canonical storage and discovery contract for run-level runtime artifacts produced by autonomy-relevant commands.

## Canonical Layout

Canonical records are stored under `artifacts/agent-runs/<runId>/` with:

- `manifest.json`: terminal manifest (`agent-run-manifest/v1`)
- `events.jsonl`: append-only event stream (`agent-run-event/v1`)

Legacy compatibility filenames remain recognized under the same run directory:

- `run-manifest.json`
- `run-events.jsonl`

## Discovery Order

Consumers must resolve each artifact family independently using this precedence:

1. Canonical filename (`manifest.json` / `events.jsonl`)
2. Legacy filename (`run-manifest.json` / `run-events.jsonl`)

If the canonical file exists but is invalid, fail closed; do not silently fall back to legacy.

## Write Semantics

- Manifest writes use temp-write then atomic rename.
- Event append uses temp-copy + append + atomic rename.
- Event streams enforce hash-chain continuity (`prevEventHash` -> previous `eventHash`).

## Validation Rules

- Manifest and event payloads must match schema versions:
  - `agent-run-manifest/v1`
  - `agent-run-event/v1`
- `repo.headSha` must be either a lowercase hex SHA or the explicit `unknown` sentinel for degraded provenance capture; producers must never fabricate a hash-shaped placeholder.
- Artifacts must reject known sensitive key classes (`token`, `secret`, `password`, `apiKey`, `authorization`, `cookie`) before persistence.
- Event logs must remain parseable line-by-line and hash-valid end-to-end.
