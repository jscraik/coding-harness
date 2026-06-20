---
schema_version: 1
---

# E2E Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains end-to-end tests, clients, environment helpers, and E2E
configuration. Root [AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md),
and [Testing Standards](../codestyle/17-testing.md) remain binding.

## Local Rules

- Keep E2E tests isolated, deterministic where possible, and explicit about
  credential or external-service blockers.
- Do not treat skipped or credential-blocked E2E paths as proof of runtime
  behavior.
- Redact provider, GitHub, Linear, browser, and CI credentials from logs and
  artifacts.

## Validation

- Run the narrowest E2E command or Vitest config that exercises the changed
  path.
- If credentials or external services block the exact path, state the blocker
  and run the nearest meaningful local validation.
- Report exact commands as pass, fail, or blocked.
