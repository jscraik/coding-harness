---
schema_version: 1
---

# Artifacts Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory holds generated or reviewable artifacts. Root
[AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md), and artifact schemas
under [contracts](../contracts) remain binding.

## Local Rules

- Treat artifacts as evidence surfaces, not source authority, unless a contract
  explicitly promotes a specific artifact type.
- Keep artifacts redacted, reproducible, and tied to the command or runtime path
  that produced them.
- Do not use artifact presence alone as proof of CI, review, tracker, or merge
  readiness.

## Validation

- Validate changed artifacts with their declared schema, manifest, or nearest
  repo-owned gate.
- Report exact commands as pass, fail, or blocked.
