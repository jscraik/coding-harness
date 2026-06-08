---
schema_version: 1
doc_schema: coding-harness-doc/v1
doc_type: operator-instructions
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: on-change
maintenance_trigger:
  - agent-operating-policy-change
  - validation-contract-change
  - workflow-governance-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - CODESTYLE.md
  - UBIQUITOUS_LANGUAGE.md
  - docs/README.md
---

# Coding Harness - AGENTS.md

## Table of Contents
- [Mission](#mission)
- [Mandatory Workflow](#mandatory-workflow)
- [Non-Negotiables](#non-negotiables)
- [Validation](#validation)
- [Routing](#routing)
- [Workflow](#workflow)
- [Memory](#memory)

## Mission

Coding Harness is a TypeScript control plane for agentic development. Expected outcome: Codex behaves like a software engineer, not merely a code generator, through compact orientation, executable guardrails, durable memory, and evidence-based handoff.

## Mandatory Workflow

1. Explore repo evidence first, then invoke a task-relevant skill.
2. Use retrieval-led reasoning for React, Tauri, Apps-SDK UI, Tailwind, Vite,
   Storybook, Chat Widget, and other version-sensitive surfaces.
3. Read [CODESTYLE.md](./CODESTYLE.md) before edits or validation claims, then
   route to [codestyle/README.md](./codestyle/README.md).
4. Add a Table of Contents when creating or materially restructuring docs.
5. Run shell commands through `zsh -lc`; prefer `rg`, `fd`, and `jq`.

## Non-Negotiables

- Runtime/toolchain: `pnpm@10.33.0` and Node `>=26.3.0` from `package.json`.
- Compatibility posture: canonical-only. Repo evidence, lockfiles, scripts,
  schemas, generated artifacts, and runtime output outrank copied assumptions.
- Keep local code/test truth, PR state, CI, review threads, tracker state,
  artifacts, and merge readiness as separate lanes unless a contract joins them.
- Do not claim CI, reviews, tracker state, or merge readiness without current
  evidence from the same closeout window.
- Agent engineering proof: repeated steering, review comments, workflow skill misses, line-level correction, and benchmark-style code production feedback are stop-the-line environment evidence; create a current-session steering admission record when Jamie says not permitted to proceed, planning-only, planning conversation, not making changes yet, do not implement, or no file edits.
- Repeated-error research: when the same error happens twice, list 3-5 Candidate/Fix/Option entries, choose the repo-fit fix, implement it, and record the proof before continuing.
- Convert feedback into principle, sibling patterns, OODA horizons, and durable destination; specific feedback and named-function feedback are a Principle Signal and systemic until proven isolated across horizontal horizon, vertical horizon, reflected context, compaction, session-collector, and environment boundaries.
- Line-level feedback requires pattern-generalization and a pattern scope inventory: sibling implementations searched, siblings changed, siblings left unchanged, deferred follow-ups, and the validator, lint rule, schema constraint, shared utility, repository convention, CI check, documented invariant, tracked exception, or other durable destination.
- Observed fixable blockers require fixing it in the same pass and rerun the narrowest proving command unless blocked by authority, credentials, safety, or ownership; otherwise record a tracked exception with the exact reason.
- If the same judgment is needed twice or a failure mode can recur across slices, build the smallest durable validator, guard script, CLI helper, workflow hook, fixture, or scoped skill; one-off implementation knowledge belongs in implementation notes, plan evidence, or PR closeout evidence, and a skill needs reusable routed workflow inputs, artifacts, validation, and ownership.
- Workflow skill changes need capture-the-flag proof: define the win condition, show the flag is captured, run a skill workout, and include self-reflection on failures.
- Closeout completion is not equivalent to green checks; prove PR state, merge or auto-merge state, branch/worktree state, Linear state, next-lane routing, and any waiting reason.
- Harness Reviewer Roles First: project-local harness reviewer roles are first-choice subagents before generic reviewers; use `spawn_agent(agent_type="harness-product-code-reviewer")`, and if a role returns `unknown agent_type`, treat runtime freshness as blocked and use a fresh thread rooted in this checkout.
- Harness Tool Builder: use `spawn_agent(agent_type="harness-toolsmith")` when recurring friction needs a tool; do not simulate that enforced role with a generic agent.
- Env-backed validation recovery: before reporting missing credentials, inspect required variable names in `~/.codex/.env` without printing values, then rerun with `set -a; source ~/.codex/.env; set +a` when present.
- Types and schemas are contract surfaces. TypeScript, Python, JSON, YAML,
  Markdown metadata, shell, and generated artifacts should use configured type,
  schema, lint, and validation gates rather than ad hoc string assumptions.

## Validation

- Baseline gates: `pnpm codestyle:parity`, `pnpm codex:agents:guard`,
  `pnpm check`, `bash scripts/validate-codestyle.sh`, and
  `bash scripts/verify-work.sh`.
- Local CI-equivalent lanes must not stack silently. `pnpm test:ci` and
  `pnpm run quality:behavior-tests` run through repo-scoped validation locks,
  and `make hooks-pre-push` starts with `validation-locks` so active duplicate
  lanes fail before heavier gates run. If this guard reports an active lane,
  wait for it or stop it deliberately; if the owner process is gone, the checker
  removes the dead lock.
- Iterate with the narrowest proving check first, then
  `bash scripts/validate-codestyle.sh --fast`.
- Changed production source requires `pnpm run quality:docstrings`,
  `pnpm run quality:size`, and `pnpm run test:related`; changed tests require
  `pnpm run quality:self-affirming`.
- Runtime or artifact behavior changes require `pnpm test:deep`.
- Docs-gate categories require
  `bash scripts/run-harness-gate.sh docs-gate --mode required --json`.
- Direct `prek` operations must use `bash scripts/run-prek.sh <args>` so hook
  validation uses the worktree cache instead of a home-directory cache that may
  be non-writable in sandboxed Codex runs.
- Report exact commands with explicit `pass`, `fail`, or `blocked` outcomes.

## Routing

1. Discover instructions in order: `~/.codex/AGENTS.md`, this file, then
   deeper `AGENTS.md` or `AGENTS.override.md` files.
2. For task routing, open [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md).
3. Tooling: [02-tooling-policy](./docs/agents/02-tooling-policy.md).
4. Validation: [04-validation](./docs/agents/04-validation.md).
5. Security: [06-security-and-governance](./docs/agents/06-security-and-governance.md).
6. Architecture and runtime cockpit: [00-architecture-bootstrap](./docs/agents/00-architecture-bootstrap.md).
7. Agent governance: [07b-agent-governance](./docs/agents/07b-agent-governance.md).
8. Release: [08-release-and-change-control](./docs/agents/08-release-and-change-control.md).
9. Linear: [13-linear-production-workflow](./docs/agents/13-linear-production-workflow.md).
10. CI required checks: [17-ci-required-checks](./docs/agents/17-ci-required-checks.md).

## Workflow

- Branch from `main`; never push directly to `main`.
- Use `codex/<linear-key>-<short-description>` when work is tracked in Linear.
- Open a PR for every merge to `main`; CodeRabbit review remains independent.
- AI-assisted PRs need concrete traceability evidence without raw transcripts,
  prompts, secrets, or bulky telemetry.

## Memory

- At session start, read `~/.codex/instructions/Learnings.md` and
  [.harness/memory/LEARNINGS.md](./.harness/memory/LEARNINGS.md) when present.
- Use [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md) for project terms.
- Project Brain files under `.harness/` are operational surfaces. Verify live paths
  before relying on them, and keep durable memory separate from local
  databases, caches, backups, generated run output, and secrets.
