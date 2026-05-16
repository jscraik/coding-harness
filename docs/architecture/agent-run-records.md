---
last_validated: 2026-04-18
---

# Agent Run Records

## Table of Contents
- [Purpose](#purpose)
- [Canonical Layout](#canonical-layout)
- [Companion Artifacts](#companion-artifacts)
- [Discovery Order](#discovery-order)
- [Write Semantics](#write-semantics)
- [Validation Rules](#validation-rules)

## Purpose

Define the canonical storage and discovery contract for run-level runtime artifacts produced by autonomy-relevant commands.

`harness-run-context/v1` is the local runtime-evidence packet that can feed
run-record producers. It captures repo/worktree identity, session ids, trace
ids, workspace roots, permission context, lifecycle status, targets, validation
evidence references, review artifact references, and blockers before a command
persists terminal run evidence.

## Canonical Layout

Canonical records are stored under `artifacts/agent-runs/<runId>/` with:

- `manifest.json`: terminal manifest (`agent-run-manifest/v1`)
- `events.jsonl`: append-only event stream (`agent-run-event/v1`)

Legacy compatibility filenames remain recognized under the same run directory:

- `run-manifest.json`
- `run-events.jsonl`

## Companion Artifacts

Commands may write additive companion artifacts under the same run directory when
they need richer operator or governance state without changing
`agent-run-manifest/v1` or `agent-run-event/v1`.

Current companion-artifact pattern:

- `review-gate` writes `decision-packet.json`
- `pilot-evaluate` writes `decision-packet.json`

`decision-packet.json` is the operator-facing summary for the run and captures:

- decision state:
  - `green-and-ready`
  - `blocked-with-remediation`
  - `escalated-for-decision`
- review-gate PR closure status:
  - `ready-to-merge`
  - `awaiting-remediation`
  - `awaiting-operator-decision`
- pilot-evaluate promotion status:
  - `ready-to-promote`
  - `hold`
  - `rollback-required`
  - `evaluation-failed`
- compaction recommendations for repeated or noisy blocker states
- guardrail-promotion candidates that should become reusable checks or policy

Companion artifacts are additive evidence. Canonical manifest/event files remain
the runtime truth foundation and should reference companion artifacts through
`artifactRefs` when they are produced.

A future run-record companion artifact may persist the validated
`harness-run-context/v1` packet, but it must remain additive. Do not extend
`agent-run-manifest/v1` or `agent-run-event/v1` solely to carry operator-facing
context that can live beside the canonical manifest and event stream.

## Discovery Order

Consumers must resolve each artifact family independently using this precedence:

1. Canonical filename (`manifest.json` / `events.jsonl`)
2. Legacy filename (`run-manifest.json` / `run-events.jsonl`)

If the canonical file exists but is invalid, fail closed; do not silently fall back to legacy.

## Write Semantics

- Manifest writes use temp-write then atomic rename.
- Event append uses temp-copy + append + atomic rename.
- Event streams enforce hash-chain continuity (`prevEventHash` -> previous `eventHash`).
- Companion artifacts should be written before terminal manifest emission when
  they need to appear in `artifactRefs`.

## Validation Rules

- Manifest and event payloads must match schema versions:
  - `agent-run-manifest/v1`
  - `agent-run-event/v1`
- Companion artifacts must use command-specific schema versions and remain
  additive; do not extend canonical manifest/event schemas for v1 operator
  state.
- `repo.headSha` must be either a 40-character lowercase hex SHA or the explicit `unknown` sentinel for degraded provenance capture; producers must never fabricate a hash-shaped placeholder.
- Artifacts must reject known sensitive key classes (`token`, `secret`, `password`, `apiKey`, `authorization`, `cookie`) before persistence.
- Event logs must remain line-delimited and hash-valid end-to-end.
