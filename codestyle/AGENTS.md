---
schema_version: 1
---

# Codestyle Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains the detailed coding standards pack. Root
[AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md), and
[codestyle/README.md](./README.md) remain binding.

## Local Rules

- Treat these modules as normative policy when they use MUST, MUST NOT, or
  another explicit enforcement term.
- Keep [../CODESTYLE.md](../CODESTYLE.md) as the front door and update it when
  module links, names, or routing change.
- When standards change, update checksums and preserve waiver expectations.

## Validation

- Run pnpm run codestyle:checksums after changing codestyle modules.
- Run pnpm codestyle:parity and the narrowest affected policy check before
  handoff.
- Report exact commands as pass, fail, or blocked.
