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
last_reviewed: 2026-07-31
review_cadence: on-change
maintenance_trigger: [agent-operating-policy-change, validation-contract-change]
semver_impact: minor
validated_by: [pnpm docs:lifecycle, pnpm docs:layer-budgets]
depends_on: [CODESTYLE.md, UBIQUITOUS_LANGUAGE.md, docs/README.md, harness.contract.json]
---

# Coding Harness agent instructions

Coding Harness helps an agent understand a task, make one bounded change, run
repository-native proof, and hand the work back truthfully. Keep the routine
path small.

## Start

1. Read this file, [CODESTYLE.md](CODESTYLE.md), and the concise
   [quickstart](docs/agents/quickstart.md).
2. Inspect the branch, worktrees, package manager, and dirty ownership. Preserve
   owned or unknown changes. Never reset, stash, clean, force-push, or delete a
   branch or worktree without explicit authority.
3. Start cold-agent routing with `harness next --json`. Optional maintenance is
   a warning, not the primary action. Use documented wrappers through `zsh -lc`
   with Node `>=26.3.0` and pnpm `10.33.0`.

## Routine product

Use only the command that answers the current question:

- `harness next --json` — orient and identify the next useful action.
- `harness init --minimal --dry-run --json` — preview a small installation.
- `harness check --json` — diagnose local repository health.
- `harness verify-work --fast` — run the focused proof route.
- `harness pr-closeout --pr <number> --json` — read PR lanes separately.

Everything else is internal or explicitly scoped expert work. Do not make it a
default agent route without a named consumer.

## Delivery rules

- Current source, schemas, lockfiles, generated artifacts, and runtime output
  outrank summaries. Resolve instruction conflicts before editing.
- Name one outcome, bound the paths, and run focused proof. Use delegation only
  when requested or when the risk needs independent coverage.
- Keep local tests, runtime, hosted checks, review threads, approval, merge,
  release, and cleanup as distinct evidence lanes.
- Branch from `main` and use a PR for merges. Required hosted checks are
  `pr-pipeline`, `security-scan`, and `CodeRabbit`; CodeQL is separate.
- The tag-driven private npm release workflow bootstraps the repository-pinned
  `uv` runtime before artifact validation. Local checks do not prove npm
  publication or release completion.
- Treat feedback as an observed local defect first; local repair or
  `no_system_change` is routine. A `no_system_change` record names its reason,
  checked scope, and no-durable-destination decision. Add a durable control
  only when the existing contract is contradictory, a safety boundary is
  crossed, the same failure recurs across independent work, or a named current
  consumer requires a reusable rule.
- Generated instruction packs must preserve outcome-first local correction and
  must not require systemic generalisation before routine closeout.

## Validation and handoff

- Start with the narrowest relevant behavioral check. Changed production code
  requires `pnpm run quality:docstrings`, `pnpm run quality:size`, and
  `pnpm run test:related`; changed tests require
  `pnpm run quality:self-affirming`.
- Use `bash scripts/run-harness-gate.sh docs-gate --mode required --json` for
  governed docs, `pnpm check:static` for static policy, and
  `bash scripts/verify-work.sh --fast` for the fast integrated route. Local
  Memory is an explicit diagnostic or acceptance lane, not routine preflight.
- Before creating or updating a PR, run
  `python3 ~/.codex/scripts/pr-readiness.py --phase create|update --scope-file <file> --write-receipt`.
- Report `Command: <exact command> -> pass|fail|blocked (<reason>)`. Do not
  infer hosted approval, mergeability, release, or cleanup from local proof.

## References

- [CLI reference](docs/cli-reference.md)
- [Ubiquitous language map](UBIQUITOUS-MAP.md)
- [Validation and closeout](docs/agents/04-validation.md)
- [Security and governance](docs/agents/06-security-and-governance.md)
- [Release](docs/agents/08-release-and-change-control.md)

Keep durable repository knowledge separate from private runtime data, caches,
and raw sessions. PR bodies may cite concise evidence but never secrets or raw
telemetry.
