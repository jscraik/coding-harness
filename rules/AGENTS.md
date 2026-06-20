---
schema_version: 1
---

# Rules Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains static analysis and policy rules. Root
[AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md), and
[Security Standards](../codestyle/16-security.md) remain binding.

## Local Rules

- Keep rules deterministic, narrowly scoped, and backed by fixtures or a
  documented false-positive strategy.
- Prefer repo-owned wrappers for Semgrep or policy tools so cache, runtime, and
  environment behavior stay centralized.
- Do not weaken a rule without recording the contract reason and replacement
  guardrail.

## Validation

- Run the specific rule engine, fixture test, or repo security/policy wrapper
  that exercises the changed rule.
- Report exact commands as pass, fail, or blocked.
