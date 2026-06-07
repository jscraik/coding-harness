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

**2026-05-20 [Codex]:** Current-session steering admission existed as prose but not as a validated artifact contract -> write .harness/implementation-notes/*steering-admission*.md before resuming feature work, validate required proof fields with `pnpm run docs:steering:guard`, and prefer deterministic guards over chat promises.

**2026-05-20 [Codex]:** Coding-harness-specific reviewer agents were installed globally after project-scope intent -> keep project-owned Codex subagent roles under `.codex/agents/<role>/<role>.toml`, treat `.agents/skills/**/agents` as skill interface metadata only, and remove global registrations when a role is meant to be repo-scoped.

**2026-05-23 [Codex]:** CodeRabbit updates in Slack `#code-fixes` can look like generic inbox noise even though they are cross-repo review and eval signals -> daily checks should extract CodeRabbit review updates, requested changes, reports, autofix/simplify notices, and check-status signals into an action queue for coding-harness, agent-skills, and evals; preserve separate blocker classes and recheck live GitHub/CI/review-thread/Linear truth before closeout.

**2026-05-24 [Codex]:** ROOT/scaffold recovery was mistaken for ROOT tidy because source-map evidence landed without top-level hygiene classification -> treat source-map restoration, scaffold validation, generated evidence sync, and root hygiene as separate acceptance items; before claiming ROOT is sorted, produce a root-hygiene evidence table and validate the steering admission with `pnpm run docs:steering:guard`.

**2026-05-27 [Codex]:** Goal source links and listed validation commands can still miss future changes when they rely on operator memory -> wire adopted source freshness checks into the default goal-board path, add positive and negative propagation tests, and keep the goal text explicit that the standard board gate owns the freshness check.

**2026-05-28 [Codex]:** Private env recovery can hang when `~/.codex/.env` is a FIFO or other non-regular credential surface -> before sourcing it, prove the path is a regular file with `test -f`; if it is a pipe, socket, missing, or unreadable, classify credential loading as blocked and use existing authenticated CLIs or a repo-owned env-loading wrapper instead of reading it directly.

**2026-05-28 [Codex]:** Repeated slice-level judgment can stay trapped in conversation unless it has a promotion threshold -> when the same judgment is needed twice, or the failure mode can recur across slices, promote it into the smallest durable primitive that changes future behavior; use implementation notes or plan evidence for one-off knowledge, validators or guards for deterministic rules, CLI helpers for repeatable operator commands, and skills only for reusable routed workflows with explicit inputs, artifacts, validation, ownership, and review expectations.

**2026-05-30 [Codex]:** Bash command 'source' failed with exit code 1 -> summarize the failure and change approach before rerunning the same command (auto-key:2774403046)

**2026-06-04 [Codex]:** Specific implementation-detail feedback was still at risk of being handled as a local fix despite pattern-generalization guidance -> treat specific feedback, review comments, line-level corrections, and function examples as systemic until proven isolated; classify local or systemic scope, search sibling patterns, identify the engineering preference, and choose a validator, lint rule, schema constraint, shared utility, repository convention, CI check, documented invariant, or tracked exception before finalizing.

**2026-06-07 [Codex]:** Plain \`prek\` can try to write \`/Users/jamiecraik/.cache/prek/prek.log\` in sandboxed Codex runs and silently break hook or push triage -> route direct prek validation, setup-hook installation, generated hook docs, scaffolded environment actions, and downstream required support files through \`bash scripts/run-prek.sh\`, which sets \`PREK_HOME\` to the worktree cache before invoking \`prek\`.
