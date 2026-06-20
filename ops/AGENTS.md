---
schema_version: 1
---

# Ops Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains operational metrics and other maintenance evidence.
Root [AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md), and
[Quality, Security, And Ops Standards](../codestyle/05-quality-security-ops.md)
remain binding.

## Local Rules

- Keep metrics append-only or reproducible when the producing contract requires
  historical continuity.
- Do not promote advisory metrics into blocking authority unless a validated
  contract explicitly does so.
- Keep operational evidence separate from local caches, private telemetry, and
  secrets.

## Validation

- Run the producer or consumer validator for changed operational evidence.
- Report exact commands as pass, fail, or blocked.
