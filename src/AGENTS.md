---
schema_version: 1
---

# Source Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains production TypeScript source, templates emitted by the
CLI, and source-level tests. Root [AGENTS.md](../AGENTS.md),
[CODESTYLE.md](../CODESTYLE.md), [TypeScript Standards](../codestyle/08-typescript.md),
and [Testing Standards](../codestyle/17-testing.md) remain binding.

## Local Rules

- Keep public API boundaries explicitly typed and documented according to the
  changed-file docstring ratchet.
- Use runtime validation at trust boundaries instead of unsafe assertions or ad
  hoc parsing.
- Keep local ESM imports compatible with emitted JavaScript by using .js
  extensions where required.
- Changed production source requires related behavior proof through the
  repository test and quality gates.

## Validation

- For changed production source, run pnpm run quality:docstrings,
  pnpm run quality:size, and pnpm run test:related.
- Run the narrowest focused Vitest or CLI command before widening.
- Report exact commands as pass, fail, or blocked.
