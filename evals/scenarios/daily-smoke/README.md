# Daily Smoke Scenario Registry

## Table of Contents
- [Purpose](#purpose)
- [Scenario Sets](#scenario-sets)
- [Lane Notes](#lane-notes)

## Purpose

This registry is the canonical CP5 smoke-suite metadata for the canonical run/eval substrate.

Mandatory scenarios cover v1-core behavior and must pass in both local validation and CI retention lanes.
Optional scenarios cover CP4b retrieval parity and remain lane-gated until explicitly enabled in rollout evidence.

## Scenario Sets

- `mandatory`
  - `producer-emission`
  - `consumer-ingestion-decisioning`
  - `rollback-marker-flow`
  - `replay-consumption`
  - `retrieval-v1-core`
- `optional`
  - `retrieval-lexical-parity`

## Lane Notes

- `advisory` lane is artifact-producing and exit-neutral for drift-only findings.
- `health` lane blocks on schema, runtime, integrity, or adapter block-after violations.
- kill-switch/manual-safe-mode evidence must be attached before promotion can resume.
