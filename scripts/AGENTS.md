---
schema_version: 1
---

# Scripts Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains repo-owned automation, validators, hooks, and support
scripts. Root [AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md),
[Shell Standards](../codestyle/10-shell-bash-zsh.md), and
[TypeScript Standards](../codestyle/08-typescript.md) remain binding.

## Local Rules

- Invoke Bash scripts explicitly with bash; do not source CLI scripts unless
  sourcing is the documented API.
- Keep machine-readable output on stdout and diagnostics on stderr for scripts
  that support automation.
- Use structured parsers for JSON, YAML, TOML, and command output boundaries.
- Route direct prek use through bash scripts/run-prek.sh.
- Route repo-owned uv/Python validation through
  bash scripts/run-uv-python.sh &lt;command&gt; [args...].

## Validation

- For shell or script routing changes, run pnpm run quality:scripts first.
- Run the narrowest script-specific test or validator, then widen to
  bash scripts/validate-codestyle.sh --fast when governed behavior changes.
- Report exact commands as pass, fail, or blocked.
