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
last_reviewed: 2026-07-29
review_cadence: on-change
maintenance_trigger: [agent-operating-policy-change, validation-contract-change, workflow-governance-change]
semver_impact: minor
validated_by: [pnpm docs:lifecycle, pnpm docs:layer-budgets]
depends_on: [CODESTYLE.md, UBIQUITOUS_LANGUAGE.md, docs/README.md]
---

# Coding Harness - AGENTS.md

Coding Harness helps a developer orient, make a bounded change, run local
proof, and hand work back truthfully. Keep the routine path small.

## Start

1. Read this file, [CODESTYLE.md](CODESTYLE.md),
   [quickstart](docs/agents/quickstart.md), and the smallest route in
   [the instruction map](docs/agents/01-instruction-map.md).
2. Inspect branch, worktrees, package manager, and dirty ownership. Preserve
   owned or unknown changes. Never reset, stash, clean, force-push, or delete
   a branch or worktree without explicit authority.
3. Use `harness next --json` for cold-agent routing. Optional maintenance is a
   warning, never the primary action; hidden internal recovery commands remain
   explicit diagnostics. Use documented wrappers through `zsh -lc` with Node
   `>=26.3.0` and pnpm `10.33.0`.
4. Use the compact default `harness commands --json` catalogue for supported
   work; query `--all` or `--plumbing` only for a named compatibility consumer.

## Delivery rules

- Current source, schemas, lockfiles, generated artifacts, and runtime output
  outrank copied summaries. Resolve instruction conflicts before editing.
- Name one outcome and keep paths bounded. Direct local work may proceed with
  focused proof; use delegation only when explicitly requested or risk needs it.
- Keep local tests, runtime state, PR/CI, review threads, acceptance, merge,
  release, and cleanup as separate evidence lanes.
- Branch from `main` and use a PR for merges. Required hosted checks are
  `pr-pipeline`, `security-scan`, and `CodeRabbit`; CodeQL is a separate lane.
- Treat repeated steering or review feedback as a local fix unless the current
  contract is contradictory, a safety boundary is crossed, or the same failure
  recurs across independent work. Prefer an existing validator, fixture,
  wrapper, or instruction over a new system surface.
- Agent engineering proof: the expected outcome is a software engineer, not a
  code generator; every durable repo/system change names its concrete repo path,
  maintainability, traceability, and handoff quality.
- Repeat-feedback admission: repeated steering or the same steering twice stops
  ordinary feature work until a current-session steering admission record names
  feedback class, inferred principle, searched surfaces, durable destination,
  and forbidden recurrence behavior. Planning-only means do not implement and
  make no file edits. Repeated-error research uses 3-5 numbered Candidate/Fix/
  Option choices; fix observed fixable blockers in the same pass, then rerun the
  narrowest proving command.
- A Principle Signal from example-based feedback, named-function feedback, or a
  specific line-level correction is systemic until proven isolated: synthesize
  the principle, sibling patterns, OODA horizons, and durable destination; use
  pattern-generalization with a pattern scope inventory of sibling
  implementations searched, siblings changed, siblings left unchanged, and
  deferred follow-ups. If the same judgment is needed twice or a failure mode
  recurs across slices, promote the smallest durable validator, guard script,
  CLI helper, workflow hook, fixture, or scoped skill. Keep one-off
  implementation notes separate from a reusable routed workflow with inputs,
  artifacts, validation, and ownership.
- Use Env-Backed Validation Recovery with `op run --env-file ~/.codex/.env --
  <command>` before a missing-credential blocker. For wider context, inspect
  horizontal and vertical OODA horizons, single-turn and stacked trajectories,
  adjacent PR and organizational activity, plus reflected context, resumed
  target context, session-collector, agent reflection, unobserved horizon,
  compaction, and environment boundaries. Workflow skill proof needs a
  capture-the-flag win condition, flag captured, skill workout, and
  self-reflection. Green checks provide validation evidence for their
  individual checks, but do not alone establish closeout completion.
- Harness Reviewer Roles First and Harness Tool Builder are first-choice subagents
  when review or reusable tooling is explicitly selected: use
  `spawn_agent(agent_type="harness-product-code-reviewer")` or
  `spawn_agent(agent_type="harness-toolsmith")`; classify `unknown agent_type`
  as a runtime-freshness blocker.
- Generated instruction packs must preserve outcome-first local correction,
  must not require systemic generalisation before routine closeout, and must
  preserve project-local technical authority.

## Validation and handoff

- Start narrow. Changed production code requires `pnpm run quality:docstrings`,
  `pnpm run quality:size`, and `pnpm run test:related`; changed tests require
  `pnpm run quality:self-affirming`. Runtime or artifact changes require
  `pnpm test:deep`.
- Use `bash scripts/run-harness-gate.sh docs-gate --mode required --json` for
  governed docs, `pnpm check:static` for static policy, and
  `bash scripts/verify-work.sh --fast` for the fast integrated route. The
  routine preflight does not invoke Local Memory; use
  `bash scripts/codex-preflight.sh --stack auto --mode required` only for an
  explicit Local Memory diagnostic or acceptance lane.
- Before a PR create or update, run
  `python3 ~/.codex/scripts/pr-readiness.py --phase create|update --scope-file <file> --write-receipt`.
- Report `Command: <exact command> -> pass|fail|blocked (<reason>)`. Do not
  infer hosted approval, mergeability, release, or cleanup from local proof.

## References

- [Language map](UBIQUITOUS-MAP.md) and [authoritative language](UBIQUITOUS_LANGUAGE.md)
- [Validation and closeout](docs/agents/04-validation.md)
- [Security and governance](docs/agents/06-security-and-governance.md)
- [Release](docs/agents/08-release-and-change-control.md)
- [Required checks](docs/agents/17-ci-required-checks.md)
- [CLI reference](docs/cli-reference.md)
- [Recovery status](docs/roadmap/agent-first-status.md), whose validation date
  and registered `harness.contract.json` cadence must remain aligned.

Keep `.harness` durable knowledge separate from private runtime data, caches,
and raw sessions. PR bodies may cite concise evidence but must not include
secrets or raw telemetry.
