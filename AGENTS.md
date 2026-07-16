---
schema_version: 1
doc_schema: coding-harness-doc/v1
doc_type: operator-instructions
authority: canon
canon_class: canonical
distribution: source-only
audience: [codex-agent, coding-harness-maintainer]
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-07-15
review_cadence: on-change
maintenance_trigger: [agent-operating-policy-change, validation-contract-change, workflow-governance-change]
semver_impact: minor
validated_by: [pnpm docs:lifecycle, pnpm docs:layer-budgets]
depends_on: [CODESTYLE.md, UBIQUITOUS_LANGUAGE.md, docs/README.md]
---

# Coding Harness - AGENTS.md

## Table of Contents

- [Mission](#mission)
- [Startup](#startup)
- [Operating contract](#operating-contract)
- [Validation](#validation)
- [Routing](#routing)
- [Workflow and memory](#workflow-and-memory)

## Mission

Coding Harness is a TypeScript control plane for evidence-backed agentic
delivery. Orient first, use executable guardrails, preserve durable memory, and
keep local proof separate from hosted, review, tracker, artifact, and readiness
truth.

## Startup

1. Read this file, then
   [`docs/agents/quickstart.md`](docs/agents/quickstart.md); read `CODESTYLE.md`
   and the task route in
   [`docs/agents/01-instruction-map.md`](docs/agents/01-instruction-map.md)
   before making technical changes.
2. Inspect the current repository, package manager, branch, worktrees, and
   dirty ownership before choosing a mutation.
3. Use repository wrappers and documented commands through `zsh -lc`; prefer
   `rg`, `fd`, and `jq`, and use `pnpm@10.33.0` with Node `>=26.3.0`.
4. Use `harness next --json` for cold-agent routing, then run the narrowest
   proving check before widening validation.

## Operating contract

- Canonical repository evidence, lockfiles, schemas, generated artifacts, and
  runtime output outrank copied assumptions. Resolve instruction conflicts
  before editing.
- Preserve owned or unknown dirty state. Never reset, stash, discard, clean,
  force-push, delete worktrees, or bypass a gate without explicit authority.
- Keep local code/test truth, PR and CI truth, review-thread truth, tracker
  state, artifact freshness, acceptance, release, and merge readiness as
  separate claims. Do not infer one lane from another.
- Branch from `main`, open a PR for every merge, and keep CodeRabbit or human
  review independent from code authorship. Required status checks are
  `pr-pipeline`, `security-scan`, and `CodeRabbit`; CodeQL remains separate.
- `review-learning-closeout/v1`, fitness, runtime, rework, and governance
  packets are advisory evidence. Missing evidence is `n.a.` with a concrete
  reason; these packets never prove validation, approval, CI, acceptance,
  release, or merge readiness.
- Treat repeated steering, review feedback, workflow misses, and recurring
  failures as system evidence. Route the durable correction to the smallest
  validator, schema, fixture, wrapper, instruction, or skill. Steering that
  forbids implementation requires an admission record before work resumes.
- Keep types, schemas, preflight runtime/template mirrors, command effects, and external input
  behind their declared boundaries. Detailed governance and reviewer-role
  routing live in [`docs/agents/07b-agent-governance.md`](docs/agents/07b-agent-governance.md).
- Harness Reviewer Roles First and Harness Tool Builder are first-choice subagents: use `spawn_agent(agent_type="harness-product-code-reviewer")` for covered review and `spawn_agent(agent_type="harness-toolsmith")` for recurring tooling friction; treat `unknown agent_type` as runtime-freshness blocked. Agent engineering proof: expected outcome is a software engineer, not a code generator; every durable repo/system change needs a concrete repo path, maintainability, traceability, and handoff quality.
- Repeated steering and the same feedback twice require a current-session steering admission record with feedback class, inferred principle, searched surfaces, durable destination, and forbidden recurrence behavior; planning-only or no file edits stops before implementation. Repeated-error research uses 3-5 numbered Candidate/Fix/Option entries and fixes observed fixable blockers in the same pass before rerunning the narrowest proving command.
- A Principle Signal, example-based feedback, named-function feedback, or line-level correction is systemic until proven isolated: synthesize the principle, sibling patterns, OODA horizons, and durable destination; apply pattern-generalization with a pattern scope inventory naming sibling implementations searched, siblings changed, siblings left unchanged, and deferred follow-ups. If the same judgment is needed twice or a failure mode can recur across slices, promote it into the smallest durable validator, guard script, CLI helper, workflow hook, fixture, or scoped skill, while keeping one-off implementation notes separate from a reusable routed workflow with inputs, artifacts, validation, and ownership.
- Use Env-Backed Validation Recovery with `~/.codex/.env` and `op run --env-file ~/.codex/.env -- <command>` before missing-credential blockers. Check horizontal and vertical OODA horizons, single-turn and stacked trajectories, adjacent PR and adjacent organizational activity, plus reflected context, resumed target context, session-collector, agent reflection, unobserved horizon, compaction, and environment boundaries. Software engineering proof includes maintainability, traceability, and handoff quality; workflow skill proof needs a capture-the-flag win condition, flag captured, skill workout, and self-reflection; closeout completion is not green checks or validation evidence.

## Validation

- Baseline: `pnpm codestyle:parity`, `pnpm codex:agents:guard`,
  `pnpm check:static`, `pnpm check`, `bash scripts/validate-codestyle.sh`,
  and `bash scripts/verify-work.sh`.
- Fast lanes: `pnpm run quality:scripts`, `pnpm run tooling:parity`, and
  `bash scripts/validate-codestyle.sh --fast`.
- Changed production source also requires `pnpm run quality:docstrings`,
  `pnpm run quality:size`, and `pnpm run test:related`; changed tests require
  `pnpm run quality:self-affirming`; runtime or artifact behavior requires
  `pnpm test:deep`.
- Governance-doc changes require
  `bash scripts/run-harness-gate.sh docs-gate --mode required --json` and
  `pnpm docs:layer-budgets` when a Layer 0 or Layer 1 surface changes.
- Report every validation command exactly as
  `Command: <exact command> -> pass|fail|blocked (<reason>)`.
- Hosted checks, review threads, acceptance, release, and merge state must be
  refreshed from their authoritative surfaces in the same closeout window.

## Routing

Use [`docs/agents/quickstart.md`](docs/agents/quickstart.md) for the first
execution path, then route to the smallest authority:

- tooling: [`02-tooling-policy.md`](docs/agents/02-tooling-policy.md)
- validation and closeout: [`04-validation.md`](docs/agents/04-validation.md)
- architecture: [`00-architecture-bootstrap.md`](docs/agents/00-architecture-bootstrap.md)
- security: [`06-security-and-governance.md`](docs/agents/06-security-and-governance.md)
- agent governance: [`07b-agent-governance.md`](docs/agents/07b-agent-governance.md)
- release: [`08-release-and-change-control.md`](docs/agents/08-release-and-change-control.md)
- Linear: [`13-linear-production-workflow.md`](docs/agents/13-linear-production-workflow.md)
- required checks: [`17-ci-required-checks.md`](docs/agents/17-ci-required-checks.md)

## Workflow and memory

- Keep PR bodies truthful and structured: plan IDs, session/trace references,
  affected surfaces, documentation impact, validation commands and outcomes,
  review artifacts, closeout state, and deferred work. Never paste secrets,
  raw transcripts, or bulky telemetry.
- At session start read `~/.codex/instructions/Learnings.md` and
  `.harness/memory/LEARNINGS.md` when present. Treat `.harness/knowledge/**`,
  `.harness/decisions/**`, `.harness/review-log.md`, and `codex/FORJAMIE.md`
  as operational memory surfaces; keep caches, databases, backups, and runs
  separate.
- Use `UBIQUITOUS-MAP.md` for fast language routing and
  `UBIQUITOUS_LANGUAGE.md` for authoritative terms. Keep the weekly
  [`agent-first-status.md`](docs/roadmap/agent-first-status.md) surface aligned
  with the contract when its freshness gate reports drift.
