---
schema_version: 1
---

# Docs Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains governed documentation, architecture notes, plans,
specs, and operator guidance. Root [AGENTS.md](../AGENTS.md),
[CODESTYLE.md](../CODESTYLE.md), [docs/README.md](./README.md), and
[Instruction map](./agents/01-instruction-map.md) remain binding.

## Local Rules

- Add or preserve a Table of Contents when creating or materially restructuring
  docs.
- Keep frontmatter, lifecycle metadata, manifest entries, and canonical links in
  sync for governed docs.
- Keep agent-facing operating policy compact in root AGENTS.md; place longer
  situational detail in routed docs with verified context pointers.

## Validation

- For governed docs, run
  bash scripts/run-harness-gate.sh docs-gate --mode required --json.
- For documentation lifecycle changes, run pnpm docs:lifecycle.
- Report exact commands as pass, fail, or blocked.

- When explaining something to the user, use the [$visualize:visualize](/Users/jamiecraik/.codex/plugins/cache/openai-bundled/visualize/1.0.19/skills/visualize/SKILL.md) skill
