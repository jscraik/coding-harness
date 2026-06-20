---
schema_version: 1
---

# Tests Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains shared test fixtures and consumer-repo test surfaces.
Root [AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md), and
[Testing Standards](../codestyle/17-testing.md) remain binding.

## Local Rules

- Keep consumer fixtures realistic enough to prove scaffold behavior without
  becoming hidden production dependencies.
- Tests must assert requirement-derived expectations, not the implementation
  under test as its own oracle.
- Credentialed or external-service test paths must report blockers explicitly
  and use local fallbacks only as fallback evidence.

## Validation

- Run the focused Vitest, fixture, or consumer-repo test for changed tests.
- Changed tests also require pnpm run quality:self-affirming.
- Report exact commands as pass, fail, or blocked.
