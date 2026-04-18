---
last_validated: 2026-04-18
---

# Benchmarks

## Table of Contents

- [Scope](#scope)
- [Benchmark cadence](#benchmark-cadence)
- [Track definition](#track-definition)
- [Run script](#run-script)
- [Run record schema](#run-record-schema)
- [Storage layout](#storage-layout)

## Scope

This directory defines the canonical benchmark track workflow and run-record format for release evidence.

## Benchmark cadence

Minimum cadence:

- Run the SWE track weekly on `main`.
- Run the SWE track before each release tag.

## Track definition

Current canonical track:

- `swe`: repository benchmark command track captured with structured metadata.

## Run script

Use the helper script to execute and record a run:

```bash
bash scripts/benchmarks/run-swe-track.sh "pnpm check"
```

Defaults:

- Command: `pnpm check`
- Output directory: `docs/benchmarks/runs`

## Run record schema

Run records must validate against:

- `docs/benchmarks/schema/benchmark-run.schema.json`

The schema captures command, git context, timing, status, and core metrics.

## Storage layout

- `schema/benchmark-run.schema.json`: canonical JSON Schema definition.
- `runs/`: generated benchmark run records (JSON).
