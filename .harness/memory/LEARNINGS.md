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

**2026-05-17 [Codex]:** `High-signal user steering can be acknowledged in chat while still failing to change future agent behavior -> require PR closeout to name Meta-behavior proof and Learning / reinforcement whenever the PR admits repeated steering or user correction, keep the PR template/scaffold/validator/steering guard synchronized, and run pnpm run docs:steering:guard plus the PR-template validator tests before resuming feature work.`

**2026-05-17 [Codex]:** `Repeated high-signal steering can still stay in chat even when the generic steering-feedback rule exists -> treat "not permitted to proceed" as a current-session steering admission trigger: stop feature work, write the admission into repo memory/docs/gates, name the forbidden recurrence behavior, and run pnpm run docs:steering:guard before resuming.`

**2026-05-17 [Codex]:** `Repeating the same local retry after the same error happens twice wastes signal and hides missing research -> stop retries on the second identical error, research trusted web/upstream sources, list 3-5 candidate fixes, choose the most efficient repo-fit fix, implement it, and record Repeated-error research evidence in PR closeout before claiming the issue is resolved.`

**2026-05-17 [Codex]:** `Treating a concrete correction as local misses the user's design model -> every example-based or line-level correction that implies a broader principle must trigger a pattern-generalization pass: infer the design/API rule, search sibling implementations and similar misbehavior classes, update the shared pattern or matching siblings, and record unchanged or deferred siblings with reasons before claiming the fix is done.`

**2026-05-17 [Codex]:** `Pattern-generalization rules can still miss feedback when they depend on exact trigger words -> treat examples, single-line requests, named-function feedback, review comments, and "generally" or "across everything" language as principle signals until a pattern scope inventory proves the correction is intentionally local.`

**2026-05-17 [Codex]:** `A line-level correction can encode a general API/design principle, not just a local edit -> before claiming the fix, infer the principle, search sibling code/tests/docs/templates/skills/gates for the same misbehavior, update the shared pattern or matching siblings, and record any intentionally unchanged siblings with reasons.`
