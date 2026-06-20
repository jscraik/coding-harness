---
schema_version: 1
---

# Templates Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains workflow templates and scaffold inputs. Root
[AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md), and
[Docs, Config, And Release Standards](../codestyle/04-docs-config-and-release.md)
remain binding.

## Local Rules

- Keep generated templates safe by default: no placeholder credentials, broad
  token scopes, writable host paths, or unverified command claims.
- Update downstream template tests or snapshots when template behavior changes.
- Keep template prose aligned with root validation and workflow contracts.

## Validation

- Run the focused template, scaffold, or snapshot test that consumes changed
  templates.
- Report exact commands as pass, fail, or blocked.
