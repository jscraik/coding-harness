---
schema_version: 1
purpose: Project-specific agent knowledge base — repo-scoped fixes and gotchas.
scope: This repo only.
update_policy: |
  Append after any bug, tool failure, or extra-effort fix that is specific to this repository.
  Universal fixes belong in ~/.codex/instructions/Learnings.md.
  Do not delete entries; append only.
  Format: **YYYY-MM-DD [Agent]:** `problem → fix`
---

# Learnings

## Table of Contents
- [Learnings](#learnings)

Repo-specific agent knowledge base. Append-only.

> Scope: this repository only.
> Format: **YYYY-MM-DD [Agent]:** `problem → fix`

**2026-05-01 [manual]:** Path-like user input used to compose repository writes must be validated twice: reject separators in semantic labels early, then resolve the final output path and prove it stays under the intended root before writing.

**2026-05-16 [Codex]:** JSC closeout/readiness questions can look complete from local specs, plans, and validation while the live PR is still blocked -> generate `runtime-card/v1`, feed it to `harness next --runtime-card`, and treat live PR/Linear/git/artifact blockers as stop conditions before claiming readiness.

**2026-05-16 [Codex]:** Runtime evidence contracts and PR ledger projections can appear wired while only validating headings or array shape -> reject blank evidence values, use explicit sentinels such as `unknown` for missing runtime facts, and make downstream generated validators check every required field before claiming projection parity.

**2026-05-16 [Codex]:** Bash command 'zsh' failed with exit code 3 -> summarize the failure and change approach before rerunning the same command (auto-key:1476607300)
