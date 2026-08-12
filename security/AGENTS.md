---
schema_version: 1
---

# Security Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory contains security policies and related security evidence. Root
[AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md), and
[Security Standards](../codestyle/16-security.md) remain binding.

## Local Rules

- Treat security policy, auth/authz, dependency provenance, and secret-handling
  changes as high-trust surfaces.
- Never persist raw secrets, tokens, sensitive headers, private telemetry, or
  unredacted traces.
- Critical security findings block normal closeout until fixed or explicitly
  escalated with a tracked exception.

## Validation

- Run the configured security, policy, or audit check for changed security
  surfaces, or record the concrete blocker.
- Report exact commands as pass, fail, or blocked.

- When explaining something to the user, use the [$visualize:visualize](/Users/jamiecraik/.codex/plugins/cache/openai-bundled/visualize/1.0.19/skills/visualize/SKILL.md) skill
