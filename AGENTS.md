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
last_reviewed: 2026-06-20
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
- Agent governance details live in [docs/agents/07b-agent-governance.md](./docs/agents/07b-agent-governance.md); validation and steering-feedback closeout details live in [docs/agents/04-validation.md](./docs/agents/04-validation.md). Keep this root file as the compact operating contract and route situational policy there.
- Agent engineering proof: repeated steering, review comments, workflow skill misses, line-level correction, and benchmark-style code production feedback are stop-the-line environment defect evidence, not ordinary feature work. Convert feedback into principle, sibling patterns, OODA horizons, and durable destination.
- Steering admission triggers: create a current-session steering admission record when Jamie says not permitted to proceed, planning-only, planning conversation, not making changes yet, do not implement, or no file edits. Record feedback class, inferred principle, searched surfaces, durable destination, and forbidden recurrence behavior before ordinary work resumes.
- Pattern and blocker handling: treat a Principle Signal, example-based feedback, named-function feedback, specific feedback, single-line corrections, and line-level correction as systemic until proven isolated. Line-level feedback requires pattern-generalization across sibling implementations and a pattern scope inventory naming sibling implementations searched, siblings changed, siblings left unchanged, deferred follow-ups, and the durable validator, lint rule, schema constraint, shared utility, repository convention, CI check, documented invariant, or tracked exception. Observed fixable blockers require fixing it in the same pass and rerunning the narrowest proving command unless authority, credentials, safety, or ownership blocks it; otherwise record a tracked exception with the exact reason.
- Repeated-error research: when the same error happens twice, list 3-5 Candidate/Fix/Option entries, choose the repo-fit fix, implement it, and record proof before continuing.
- Tool Promotion Threshold: if the same judgment is needed twice or a failure mode can recur across slices, build the smallest durable validator, guard script, CLI helper, workflow hook, fixture, or scoped skill. Keep one-off implementation knowledge in implementation notes, plan evidence, or PR closeout evidence; create or update a skill only for a reusable routed workflow with explicit inputs, artifacts, validation, ownership, and review expectations.
- OODA horizon checks must cover horizontal horizon, vertical horizon, single-turn context, stacked trajectories, adjacent PR, and adjacent organizational activity; include reflected context, resumed target context, session-collector, agent reflection, unobserved horizon, compaction, and environment boundaries when feedback may cross boundaries.
- Workflow skill changes need capture-the-flag proof: define the win condition, show the flag is captured, run a skill workout, and include self-reflection on failures.
- Env-Backed Validation Recovery: before reporting missing credentials, inspect required variable names in `~/.codex/.env` without printing values. If that path is a FIFO, use `op run --env-file ~/.codex/.env -- <command>` or a repo-owned FIFO-aware loader; do not source or cat it. If it is a regular readable file, rerun with `set -a; source ~/.codex/.env; set +a` when present.
- Closeout completion is not equivalent to green checks; prove PR state, merge or auto-merge state, branch/worktree state, Linear state, next-lane routing, and any waiting reason.
- Harness Reviewer Roles First and Harness Tool Builder are root guard anchors:
  project-local harness reviewer roles are first-choice subagents, use
  `spawn_agent(agent_type="harness-product-code-reviewer")` for covered review
  work, use `spawn_agent(agent_type="harness-toolsmith")` for recurring tooling
  friction, and treat `unknown agent_type` as runtime-freshness blocked.
- Types and schemas are contract surfaces. TypeScript, Python, JSON, YAML,
  Markdown metadata, shell, and generated artifacts should use configured type,
  schema, lint, and validation gates rather than ad hoc string assumptions.
- Coding policy routing is a machine-readable control-plane surface:
  `coding-policy.json` maps changed-file patterns to codestyle modules and
  required gates, while Markdown codestyle modules remain the prose authority.
  Cold agents should use
  `pnpm run coding-policy:route -- <path...>` to discover the policy modules
  and gates for a concrete changed-file set, or
  `pnpm run coding-policy:route:changed` to route the current git changes.
  Use `pnpm run coding-policy:route:branch` to route the current branch diff
  against `origin/main`.
- GitHub Actions release workflow inputs are untrusted shell-boundary data.
  Pass manual `workflow_dispatch` inputs through named `env` variables before
  validation instead of interpolating `github.event.inputs.*` directly inside
  shell scripts.
- Harness fitness evidence (`harness-fitness/v1` and `harness fitness`) is
  a validation graph surface. Keep schema, TypeScript types, runtime
  validators, conventional artifact names, deterministic lane commands, and
  advisory trend snapshots synchronized. Treat
  `harness next --fitness-report` as a routing consumer of that evidence, and
  keep next-command routing synchronized separately.
  Deterministic fitness lanes block on architecture, quality size, type safety,
  static lint, behavior proof, and feedback learning; AI-assisted review remains
  advisory unless an explicit contract update promotes it. Trend snapshots are
  advisory history and must not promote advisory review findings into blocking
  authority.
- Observed eval telemetry from `~/.agents/` or CI exports is input evidence, not
  authority. Keep CircleCI, session, and OpenTelemetry feeds bounded, redacted,
  artifact-backed, and separate from CI pass, review, tracker, or merge-readiness
  claims unless a validated consumer explicitly joins those lanes.
- Prompt-context drift reports are agent-readiness cockpit evidence, not
  delivery truth. Refresh stale or missing reports with
  `node scripts/write-prompt-context-drift-report.cjs --repo-root .`, then
  validate the generated artifact with
  `node scripts/validate-prompt-context-drift.cjs artifacts/context-integrity/prompt-context-drift-report.json --repo-root .`.
  Agent-readiness consumers must read prompt-context drift reports through the
  canonical no-follow descriptor reader, not ad hoc repo-relative file reads.
  Keep writer output, validator proof, CI state, review state, tracker state,
  and merge readiness as separate lanes.
- Agent-native ratchet packets are advisory cockpit evidence, not delivery
  truth. Keep `agent-native-ratchets/v1`, `session-distill/v1`,
  `agent-rework/v1`, `reviewer-decision/v1`, and
  `governance-decision-surface/v1` contract-first, validate them through
  runtime-packet schema checks and `pnpm artifact:types`, expose their
  operator path through public `harness ...` commands, and prove installed
  downstream portability with the package canary before claiming source-checkout
  independence. Review-feedback eval-seed classifiers are part of this advisory
  cockpit surface when they turn raw review comments into current, stale,
  unmapped, or unsafe candidate evidence without production traces. Keep CI,
  review threads, tracker state, external readiness, and
  merge readiness separate until a canonical consumer explicitly joins those
  lanes.
- `harness-decision/v1` cockpit lanes are advisory route metadata for
  `harness next --json`, not delivery truth. Keep `cockpitLane` synchronized
  across schema, TypeScript types, Python artifact contracts, next-decision
  tests, generated architecture context, and operator docs; `orient`, `prove`,
  `repair`, `review`, and `handoff` must route operator work without collapsing
  CI, review-thread, tracker, external-readiness, or merge-readiness claims.
- PR closeout handoff evidence must stay claim/evidence driven. `harness next
  --pr-closeout <path>` may consume only validated `pr-closeout/v1` artifacts
  and must fail closed into repair guidance when required evidence is missing,
  stale, shallow, false-ready, or non-mergeable.

## Validation

- Baseline gates: `pnpm codestyle:parity`, `pnpm codex:agents:guard`,
  `pnpm check:static`, `pnpm check`, `bash scripts/validate-codestyle.sh`, and
  `bash scripts/verify-work.sh`.
- Fast-failure lanes run before broad gates: `pnpm run quality:scripts`
  catches shell syntax regressions, and `pnpm run tooling:parity` catches
  required-tool drift across `.mise.toml`, CircleCI, Codex environment actions,
  package scripts, and environment scaffolds.
- Local CI-equivalent lanes must not stack silently. `pnpm test:ci` and
  `pnpm run quality:behavior-tests` run through repo-scoped validation locks,
  and `scripts/hook-pre-push.sh` starts with `validation-locks` so active
  duplicate lanes fail before heavier gates run. The `make hooks-pre-push`
  target is a manual wrapper around that leaf adapter. If this guard reports an active lane,
  wait for it or stop it deliberately; if the owner process is gone, the checker
  removes the dead lock.
- Iterate with the narrowest proving check first, then
  `bash scripts/validate-codestyle.sh --fast`.
- Before patching an already-open PR with multiple review or CI signals, run
  `pnpm run pr:triage -- <pr-number>` and batch the open review comments,
  failing checks, pending checks, and mergeability state into one fault queue.
- Pre-commit leaf adapters must keep
  `bash ./scripts/validate-codestyle.sh --fast` between codestyle parity and
  lint/typecheck, and generated hook commands must follow the detected package
  manager rather than hard-coding pnpm.
- Changed production source requires `pnpm run quality:docstrings`,
  `pnpm run quality:size`, and `pnpm run test:related`; `quality:size`
  enforces changed production file size, function size, and function complexity.
  Changed tests require `pnpm run quality:self-affirming`.
- Runtime or artifact behavior changes require `pnpm test:deep`.
- Docs-gate categories require
  `bash scripts/run-harness-gate.sh docs-gate --mode required --json`.
- Direct `prek` operations must use `bash scripts/run-prek.sh <args>` so hook
  validation uses the worktree cache instead of a home-directory cache that may
  be non-writable in sandboxed Codex runs.
- Repo-owned uv/Python validation paths must use
  `bash scripts/run-uv-python.sh <command> [args...]` so worktree-scoped uv
  cache and environment defaults stay centralized across hooks, package scripts,
  and generated scaffolds.
- Repo-owned Semgrep security lanes must use Python-runtime-scoped worktree
  caches and an executable `pysemgrep` or `semgrep --version` probe before
  reusing scanner state; stale metadata or ABI-mismatched site-packages are
  blocked scanner state, not proof.
- `harness init` memory scaffolds must keep `memory.json` schema-compatible for
  non-package repositories by emitting a non-empty repo fallback. Environment
  readiness for this project is Python/uv-based and must not require Ralph.
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
- PR bodies for AI-assisted work need a concrete session or traceability
  reference without raw transcripts, prompts, secrets, or bulky telemetry.

## Memory

- At session start, read `~/.codex/instructions/Learnings.md` and
  [.harness/memory/LEARNINGS.md](./.harness/memory/LEARNINGS.md) when present.
- Use [UBIQUITOUS-MAP.md](./UBIQUITOUS-MAP.md) for fast language-context
  routing and [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md) for
  authoritative project terms.
- Project Brain files under `.harness/` are operational surfaces. Verify live paths
  before relying on them, and keep durable memory separate from local
  databases, caches, backups, generated run output, and secrets.
- The weekly reviewed north-star status surface is
  [docs/roadmap/agent-first-status.md](./docs/roadmap/agent-first-status.md);
  refresh it with `harness.contract.json` when drift-gate reports an
  agent-first-status-matrix cadence breach.
