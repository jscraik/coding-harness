---
schema_version: 1
---

# Evals Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains harness evaluation scenarios and registries. Root
[AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md), and
[Testing Standards](../codestyle/17-testing.md) remain binding.

## Local Rules

- Treat eval scenarios as evidence inputs and regression surfaces, not as proof
  of CI, review, tracker, or merge readiness.
- Keep scenario registries, fixtures, expected outputs, and validators aligned.
- Preserve provenance boundaries for traces or sessions used as eval evidence.

## Validation

- Run the focused eval validator or scenario command for changed eval assets.
- Report exact commands as pass, fail, or blocked.
