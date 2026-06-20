---
schema_version: 1
---

# Contracts Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains schemas, manifests, examples, and fixtures that define
machine-readable harness contracts. Root [AGENTS.md](../AGENTS.md) and
[CODESTYLE.md](../CODESTYLE.md) remain binding.

## Local Rules

- Treat schemas and manifests as contract surfaces. Keep examples, validators,
  TypeScript types, and generated artifacts synchronized.
- Use structured parsers and schema validation instead of ad hoc string checks.
- Preserve fail-closed behavior for stale, shallow, missing, or contradictory
  evidence.

## Validation

- Run the specific schema or manifest validator for changed contract files.
- When runtime packet schemas change, run
  node scripts/validate-runtime-packet-schemas.cjs --all.
- Report exact commands as pass, fail, or blocked.
