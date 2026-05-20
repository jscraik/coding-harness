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

**2026-05-17 [Codex]:** PR closeout acknowledged steering in chat instead of synchronizing PR template/validator/steering guard -> require Meta-behavior proof and Learning when PR admits repeated steering, keep validators synchronized, run pnpm run docs:steering:guard before resuming.

**2026-05-17 [Codex]:** Repeated steering stayed in chat despite existing rules -> treat "not permitted to proceed" as steering admission trigger: stop work, write admission to repo memory/docs/gates, name forbidden behavior, run pnpm run docs:steering:guard.

**2026-05-17 [Codex]:** Repeated local retry after identical error wastes signal and hides research -> stop on second identical error, research trusted sources, list 3-5 fixes, implement best fit, record Repeated-error research in PR closeout.

**2026-05-17 [Codex]:** Concrete correction treated as local missed broader design model -> example-based or line-level corrections implying principles trigger pattern-generalization: infer rule, search siblings, update shared patterns, record unchanged siblings with reasons.

**2026-05-17 [Codex]:** Pattern-generalization missed feedback when relying on exact trigger words -> treat examples, single-line requests, named-function feedback, review comments, "generally" or "across everything" as principle signals unless pattern scope inventory proves local intent.

**2026-05-17 [Codex]:** Line-level correction encoded general API/design principle missed during fix -> before claiming done, infer principle, search sibling code/tests/docs/templates/skills/gates, update shared pattern or siblings, record intentionally unchanged with reasons.

**2026-05-18 [Codex]:** Heartbeat became stale after PR merged, repeated DONT_NOTIFY wasted tokens -> once stop condition is true, delete or update automation in same turn; if app API unavailable, identify repo-owned automation.toml, remove file, rmdir empty directory, verify ID gone.

**2026-05-18 [Codex]:** Current-session steering admission can drift if the learning surface only implies the rule -> write the exact current-session steering admission trigger, preserve not permitted to proceed wording, record repeated-error research with 3-5 candidate fixes, and search similar misbehavior classes before claiming a pattern-generalization fix.

**2026-05-18 [Codex]:** PR closeout gates can be technically wired but invisible if agents must know to supply HE phase-exit evidence -> expose them as first-class Coding Harness closeout gates in command help, command catalog examples, PR closeout JSON, and docs; keep HE phase-exit only as a compatibility alias.

**2026-05-19 [Codex]:** Deep validation reported missing GitHub/Linear credentials even though they were available in `~/.codex/.env` -> before marking credentialed validation blocked, inspect required env names without printing values, load `~/.codex/.env`, rerun the exact command, and record env-backed validation recovery evidence.

**2026-05-20 [Codex]:** Planning-only steering was treated as an implementation cue -> stop file edits when Jamie says the thread is planning-only, says the agent is not making changes yet, or says this is the planning; admit the execution-mode failure through docs/gates/memory and run `pnpm run docs:steering:guard` before resuming implementation.
