---
schema_version: 1
---

# Test Fixtures Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains reusable test fixtures. Root [AGENTS.md](../AGENTS.md),
[CODESTYLE.md](../CODESTYLE.md), and [Testing Standards](../codestyle/17-testing.md)
remain binding.

## Local Rules

- Keep fixtures minimal, deterministic, and named for the behavior or contract
  they prove.
- Fixtures must not contain live secrets, private telemetry, or unredacted
  provider data.
- Update expected outputs and schema examples together when a fixture represents
  a contract.

## Validation

- Run the focused test or validator that consumes changed fixtures.
- Report exact commands as pass, fail, or blocked.
