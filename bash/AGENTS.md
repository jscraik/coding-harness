---
schema_version: 1
---

# Bash Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory is for Bash-oriented fixtures, snippets, or support material.
Root [AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md), and
[Shell Standards](../codestyle/10-shell-bash-zsh.md) remain binding.

## Local Rules

- Use Bash for Bash scripts and invoke Bash scripts explicitly with bash.
- Keep snippets shell-safe: quote expansions, prefer arrays for arguments, and
  avoid sourcing CLI entrypoints unless the file documents sourcing as its API.
- Parse structured data with jq, Node, Python, or another structured parser.

## Validation

- Run pnpm run quality:scripts or the narrowest script-specific check when
  shell behavior changes.
- Report exact commands as pass, fail, or blocked.
