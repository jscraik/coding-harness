---
schema_version: 1
---

# Body Instructions

## Table of Contents
- [Scope](#scope)
- [Local Rules](#local-rules)
- [Validation](#validation)

## Scope

This directory is for body text, message bodies, or generated copy fragments.
Root [AGENTS.md](../AGENTS.md), [CODESTYLE.md](../CODESTYLE.md), and
[Docs, Config, And Release Standards](../codestyle/04-docs-config-and-release.md)
remain binding.

## Local Rules

- Keep copy evidence-backed, plain, and free of raw secrets, transcripts, or
  oversized telemetry.
- Do not turn body text into an authority surface unless a repo contract points
  to it as canonical.
- Preserve claim boundaries: body text may summarize local, CI, review, or
  tracker state only when that lane was checked.

## Validation

- Run the nearest docs, template, or consumer validation for changed body text.
- Report exact commands as pass, fail, or blocked.
