---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: advisory-stale-document-archive-candidate-reporting-execution-plan
plan_id: advisory-stale-document-archive-candidate-reporting-execution-plan
artifact_type: sy-execution-plan
canonical_slug: advisory-stale-document-archive-candidate-reporting
title: Advisory Stale-Document Archive Candidate Reporting Execution Plan
harness_stage: sy-execution-plan
status: proposed
date: 2026-06-05
origin: sy-execution-plan from JSC-395 advisory archive trace plan
source_type: plan
authority: execution-input
lifecycle_status: execution-input
canonical_destination: src/lib/docs-surface
owner: coding-harness-maintainers
created: 2026-06-05
last_reviewed: 2026-06-05
review_cadence: event-driven
validated_by:
  - pnpm docs:lint
  - pnpm docs:lifecycle
depends_on:
  - .harness/plan/2026-06-05-advisory-stale-document-archive-candidate-reporting-trace-plan.md
  - .harness/specs/2026-06-05-advisory-stale-document-archive-candidate-reporting-spec.md
linear_issue: JSC-395
linear_parent: JSC-392
linear_project: Harness control-loop hardening
traceability_required: true
safe_to_continue: true
pre_implementation_gate_required: true
blocked_reason: null
---

# Advisory Stale-Document Archive Candidate Reporting Execution Plan

## Command Summary

BLUF: This execution plan turns the accepted JSC-395 trace plan into the
ordered sy-work sequence for the advisory archive-candidate report. It keeps the
slice read-only: build the report contract, scanner, classifier, CLI script,
advisory docs-gate projection, tests, and minimal docs without deleting, moving,
archiving, demoting, or rewriting documentation artifacts. The proof line is
local only; PR, CI, review-thread, Linear, merge, release, and downstream
distribution truth remain unchecked until a later closeout lane refreshes them.

Decision: proceed to sy-work only after PU-000 records current route, dirty-file
ownership, and active-artifacts freshness.

Next action:

~~~text
[$sy-work] implement /Users/jamiecraik/dev/coding-harness/.harness/plan/2026-06-05-advisory-stale-document-archive-candidate-reporting-execution-plan.md
~~~

## Slice Boundaries

In scope:

- Add the advisory archive-candidate report contract under
  `src/lib/docs-surface`.
- Add scanner and classifier modules under `src/lib/docs-surface`.
- Add the operator script `scripts/check-docs-archive-candidates.ts`.
- Add `pnpm docs:archive-candidates`.
- Project the report into docs-gate as advisory-only evidence.
- Add focused tests for contract, scanner, classifier, CLI, and docs-gate
  projection.
- Add minimal docs or governance notes only when docs-gate or implementation
  impact requires them.

Out of scope:

- Delete, move, archive, demote, compress, or rewrite files.
- Update lifecycle metadata, manifests, active-artifacts, or archive indexes
  from the scanner.
- Edit `src/templates/**`.
- Change `.github/PULL_REQUEST_TEMPLATE.md`.
- Mutate Linear, GitHub, CI, branch protection, release settings, or downstream
  repositories.
- Make docs-gate fail solely because advisory archive candidates exist.
- Treat generated architecture context as source truth.

## Files Likely to Change

Primary implementation files:

- `src/lib/docs-surface/archive-candidates-contract.ts`
- `src/lib/docs-surface/archive-candidates-contract.test.ts`
- `src/lib/docs-surface/archive-candidates-scanner.ts`
- `src/lib/docs-surface/archive-candidates-scanner.test.ts`
- `src/lib/docs-surface/archive-candidates.ts`
- `src/lib/docs-surface/archive-candidates.test.ts`
- `scripts/check-docs-archive-candidates.ts`
- `package.json`

Docs-gate projection files:

- `src/commands/docs-gate-core.ts`
- `src/commands/docs-gate.test.ts`
- `src/lib/cli/registry/docs-gate-command-spec.ts`
- `src/lib/output/normalise-docs-gate.ts`

Conditional docs files:

- The smallest current docs-surface or agent-governance doc selected by
  docs-gate and implementation impact.
- This execution plan or implementation notes for handoff evidence.

Must not change in this slice:

- `src/templates/**`
- `.github/PULL_REQUEST_TEMPLATE.md`
- archive directories or archive indexes
- downstream repositories
- Linear, GitHub, CI, branch-protection, or release settings

## Execution Plan

### PU-000: Preflight and Resume Gate

Goal: establish current local truth before source edits.

Steps:

1. Run `git status --short --branch`.
2. Record unrelated dirty files and preserve them.
3. Confirm the current route names this execution plan, the trace plan, and the
   source spec.
4. Classify `.harness/active-artifacts.md` freshness before using it as
   evidence.
5. Record that stale, missing, unparseable, route-mismatched, or unverified
   active-artifacts state is repair evidence only.

Validation:

- Command: `git status --short --branch` -> pending sy-work
- Evidence: preflight notes in implementation notes or closeout

Stop conditions:

- Stop if dirty files overlap the intended implementation paths and ownership
  is unclear.
- Stop if the route cannot be tied to JSC-395, the source spec, and this
  execution plan.
- Stop if the worker resumes after interruption without rerunning PU-000.

Rollback:

- No source edits are allowed before this gate, so rollback is to preserve
  existing worktree state and ask for route clarification.

### PU-001: Report Contract

Goal: define `docs-archive-candidates-report/v1` before scanner behavior grows.

Steps:

1. Define report, candidate, repair finding, protected file, ignored file,
   summary, reason, protection, suggested action, confidence, and evidence-ref
   types.
2. Enforce `advisoryOnly`, `actionAuthority: advisory_only`, closed-enum
   suggested actions, and reviewed-decision requirements.
3. Reject absolute local paths and destructive-looking free-form action text.
4. Add deterministic timestamp injection or normalization.

Validation:

- Command: `pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts` -> pending sy-work

Stop conditions:

- Stop if the contract needs destructive action vocabulary to pass tests.
- Stop if absolute local paths can appear in emitted JSON.

Rollback:

- Revert the contract module and tests only; no persisted repo artifacts should
  have been mutated.

### PU-002: Scanner Boundary

Goal: scan only admitted git-tracked source files and produce bounded reference
evidence.

Steps:

1. Build a production git-index adapter for tracked file discovery.
2. Exclude dependency folders, runtime output, caches, telemetry, raw
   transcripts, binary/deleted files, and unsafe symlink targets.
3. Parse Markdown links, frontmatter path fields, lifecycle manifest
   dependencies, package script references, and low-confidence prose mentions.
4. Ensure code-fenced examples do not count as inbound references unless
   structured evidence admits them.
5. Add a sentinel fixture or adapter spy proving the production command cannot
   pass with a mocked, precomputed, or arbitrary filesystem file list.

Validation:

- Command: `pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts` -> pending sy-work
- Command:
  `pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts -t production-git-index-adapter`
  -> pending sy-work, or repo-equivalent focused test name
- Command: `pnpm --silent docs:archive-candidates -- --json` -> pending sy-work after PU-004

Stop conditions:

- Stop if scanner implementation falls back to arbitrary filesystem walking.
- Stop if production git-index proof cannot be made executable.
- Stop if symlink handling can escape the repo root.

Rollback:

- Remove scanner module and package/script wiring from this slice; keep the
  contract if it remains valid and tested.

### PU-003: Classifier and Route Freshness

Goal: classify candidates, protections, repair findings, and ignored files
without turning weak evidence into archive authority.

Steps:

1. Apply lifecycle metadata mapping by surface type.
2. Protect canon, canonical, root-entrypoint, agent-instruction,
   package-distribution, execution-input, current route, retained research, and
   historical evidence surfaces.
3. Protect active-artifact references only when the active index is fresh,
   parseable, route-matched, and points at an existing repo-relative file.
4. Emit repair findings for manifest gaps, lifecycle metadata gaps, stale
   active-artifact references, generated source-link gaps, and archive-index
   gaps.
5. Emit candidates only when no protection or repair-only rule suppresses the
   archive-candidate classification.
6. Prove generated projections and canonical/execution-input files cannot become
   archive candidates solely because metadata or references are missing.

Validation:

- Command: `pnpm test -- src/lib/docs-surface/archive-candidates.test.ts` -> pending sy-work

Stop conditions:

- Stop if stale active-artifacts can protect files or suppress candidates.
- Stop if generated files become archive candidates rather than repair findings.
- Stop if age or low inbound count can create high-confidence candidates alone.

Rollback:

- Revert classifier behavior and fixtures; keep lower-level contract/scanner
  changes only if still passing and useful.

### PU-004: CLI Script and Package Command

Goal: expose the report as a local read-only operator command.

Steps:

1. Add text and `--json` modes.
2. Keep successful advisory candidate/repair-finding runs at exit code 0.
3. Fail scanner/runtime contract errors with nonzero status.
4. Reject destructive options and mutation-shaped aliases with usage exit code 2
   and `destructive_option_unsupported`.
5. Keep a closed destructive-option matrix next to parser metadata.
6. Add `pnpm docs:archive-candidates`.

Validation:

- Command: `pnpm docs:archive-candidates` -> pending sy-work
- Command: `pnpm --silent docs:archive-candidates -- --json` -> pending sy-work
- Command: `pnpm docs:archive-candidates -- --archive` -> pending sy-work, expected exit code 2
- Command: `pnpm docs:archive-candidates -- --apply` -> pending sy-work, expected exit code 2
- Command:
  `pnpm test -- scripts/check-docs-archive-candidates.test.ts -t destructive-option-matrix`
  -> pending sy-work, or repo-equivalent focused CLI test path

Stop conditions:

- Stop if any destructive option mutates the filesystem.
- Stop if unsupported destructive aliases produce success exit code 0.
- Stop if text output implies archive/delete authority.

Rollback:

- Remove the package script and CLI file; keep library modules if tests still
  pass independently.

### PU-005: Advisory Docs-Gate Projection

Goal: surface report evidence through docs-gate without changing required
docs-gate semantics.

Steps:

1. Add advisory rule id `docs_archive_candidates_advisory`.
2. Preserve reason codes, protection codes, suggested actions, evidence refs,
   and advisory-only authority in projection.
3. Keep required docs-gate status passing when only archive candidates or repair
   findings exist.
4. Keep scanner runtime/contract failures separate from advisory findings.
5. Add a noisy-repository fixture proving summary counts, caps, protected/ignored
   suppression, and JSON or artifact access to full details.
6. Document and test any internal disable/flag path if visible projection is too
   noisy to enable immediately.

Validation:

- Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pending sy-work
- Command: `pnpm test -- src/commands/docs-gate.test.ts` -> pending sy-work
- Command:
  `pnpm test -- src/commands/docs-gate.test.ts -t noisy-advisory-archive-candidates`
  -> pending sy-work, or repo-equivalent focused docs-gate fixture path

Stop conditions:

- Stop if advisory candidates can fail required docs-gate.
- Stop if category counts collapse required lifecycle/task-eval errors into
  advisory cleanup counts.
- Stop if text output can swamp required findings with unbounded advisory rows.

Rollback:

- Remove docs-gate projection wiring while preserving the standalone report.

### PU-006: Minimal Docs and Closeout Evidence

Goal: document the non-deletion boundary and record exact proof without starting
progressive-disclosure cleanup.

Steps:

1. Document that archive-candidate reporting is advisory only.
2. Document that archive, delete, move, demotion, manifest update,
   active-artifact update, source-link update, and archive-index repair require
   separate reviewed decisions.
3. Record exact validation command outcomes.
4. Keep downstream templates and generated architecture context unchanged unless
   a validation gate proves a synchronized update is required.

Validation:

- Command: `pnpm docs:lint` -> pending sy-work closeout
- Command: `pnpm docs:lifecycle --json` -> pending sy-work closeout
- Command: `pnpm run test:related` -> pending sy-work closeout

Stop conditions:

- Stop if docs edits drift into JSC-397 progressive-disclosure cleanup.
- Stop if implementation requires downstream template or generated architecture
  context changes that were not proven by a gate.

Rollback:

- Revert minimal docs changes; preserve source/test changes only if their
  behavior remains independently proven.

## Validation Ladder

Run in this order unless a narrower failing command points to the exact defect:

1. Command: `git status --short --branch` -> pending sy-work preflight
2. Command: `pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts` -> pending sy-work
3. Command: `pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts` -> pending sy-work
4. Command: `pnpm test -- src/lib/docs-surface/archive-candidates.test.ts` -> pending sy-work
5. Command: `pnpm docs:archive-candidates` -> pending sy-work
6. Command: `pnpm --silent docs:archive-candidates -- --json` -> pending sy-work
7. Command: `pnpm docs:archive-candidates -- --archive` -> pending sy-work, expected exit code 2
8. Command: `pnpm docs:archive-candidates -- --apply` -> pending sy-work, expected exit code 2
9. Command:
   `pnpm test -- scripts/check-docs-archive-candidates.test.ts -t destructive-option-matrix`
   -> pending sy-work, or repo-equivalent focused CLI test path
10. Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pending sy-work
11. Command: `pnpm test -- src/commands/docs-gate.test.ts` -> pending sy-work
12. Command:
    `pnpm test -- src/commands/docs-gate.test.ts -t noisy-advisory-archive-candidates`
    -> pending sy-work, or repo-equivalent focused docs-gate fixture path
13. Command: `pnpm docs:lint` -> pending sy-work closeout
14. Command: `pnpm docs:lifecycle --json` -> pending sy-work closeout
15. Command: `pnpm run test:related` -> pending sy-work closeout

## Rollback Strategy

- Prefer reverting the latest PU when validation fails.
- Keep lower-level contract changes only when their focused tests still pass and
  they do not expose unfinished command behavior.
- If docs-gate projection creates noisy or blocking behavior, remove projection
  wiring and keep the standalone report path.
- If destructive-option rejection is incomplete, remove the package script until
  parser handling is fail-closed.
- Never repair by deleting, moving, archiving, demoting, or rewriting candidate
  files in this slice.

## External Lanes Not Checked

This stage did not check:

- live Linear state
- GitHub PR state
- CI or required checks
- CodeRabbit or Codex review-thread state
- branch protection or mergeability
- release readiness
- downstream template state

## Evidence Checked

- `.harness/plan/2026-06-05-advisory-stale-document-archive-candidate-reporting-trace-plan.md`
- `.harness/specs/2026-06-05-advisory-stale-document-archive-candidate-reporting-spec.md`
- `CODESTYLE.md`
- `codestyle/04-docs-config-and-release.md`
- `package.json` script inventory
- `git status --short --branch`

## Validation

Validation performed for this sy-execution-plan stage:

- Command: `git status --short --branch` -> pass (current branch and untracked JSC-395 artifacts observed)
- Command: `pnpm docs:lint` -> blocked (local validation runner exited at
  tool-level `-1` after reporting Node v20.11.1 despite repo pin
  Node 24.13.1; no markdownlint summary was emitted)
- Command: `pnpm docs:lifecycle --json` -> blocked (same local validation
  runner issue; no lifecycle JSON summary was emitted)

Validation performed during sy-work implementation:

- Command: `git diff --check` -> pass (no whitespace or patch hygiene errors)
- Command:
  `pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts`
  -> blocked (local validation runner exited at tool-level `-1` after
  reporting Node v20.11.1; Vitest emitted no assertion summary)
- Command:
  `pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts`
  -> blocked (same Node runtime blocker)
- Command: `pnpm test -- src/lib/docs-surface/archive-candidates.test.ts`
  -> blocked (same Node runtime blocker)
- Command: `pnpm test -- src/lib/docs-surface/archive-candidates-cli.test.ts`
  -> blocked (same Node runtime blocker)
- Command: `pnpm test -- src/commands/docs-gate.test.ts -t archive`
  -> blocked (same Node runtime blocker)
- Command: `mise exec -- node --version` -> blocked (tool-level `-1`; no
  version output)
- Command:
  `/Users/jamiecraik/.local/share/mise/installs/node/24.13.1/bin/node --version`
  -> blocked (tool-level `-1`; no version output)
- Command: `pnpm docs:archive-candidates` -> blocked (same Node runtime blocker)
- Command: `pnpm --silent docs:archive-candidates -- --json` -> blocked (same Node
  runtime blocker)
- Command: `pnpm docs:archive-candidates -- --archive` -> blocked (same Node
  runtime blocker before usage handling could execute)
- Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json`
  -> blocked (`node -e` was killed with signal 9 before the gate runner could
  invoke docs-gate)
- Command: `pnpm docs:lint` -> blocked (same Node runtime blocker)
- Command: `pnpm docs:lifecycle --json` -> blocked (same Node runtime blocker)

Validation performed during simplify/architecture cleanup:

- Command: `wc -l src/commands/docs-gate-archive-candidates.ts src/lib/docs-surface/archive-candidates.ts src/lib/docs-surface/archive-candidates-scanner.ts src/lib/docs-surface/archive-candidates-contract.ts src/lib/docs-surface/archive-candidates-cli.ts` -> pass (changed production files remain below the 400-line ratchet target)
- Command: `pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts` -> blocked (mise downloaded and extracted node@24.13.1, then `~/.local/share/mise/installs/node/24.13.1/bin/node` failed its `node -v` verification with no exit status)
- Command: `pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts` -> blocked (same Node 24 binary verification failure)
- Command: `pnpm test -- src/lib/docs-surface/archive-candidates.test.ts` -> blocked (same Node 24 binary verification failure)
- Command: `pnpm test -- src/lib/docs-surface/archive-candidates-cli.test.ts` -> blocked (same Node 24 binary verification failure)
- Command: `pnpm test -- src/commands/docs-gate.test.ts -t archive` -> blocked (same Node 24 binary verification failure)
- Command: `pnpm docs:archive-candidates -- --archive` -> pass (expected usage exit code 2 with `destructive_option_unsupported`)
- Command: `pnpm docs:archive-candidates` -> pass (text report emitted advisory-only summary: 0 candidates, 1 repair finding, 67 protected, 1667 ignored)
- Command: `pnpm --silent docs:archive-candidates -- --json` -> pass (JSON report emitted schema `docs-archive-candidates-report/v1` with `mutationSupported: false`)
- Command: `git diff --check` -> pass (no whitespace or patch hygiene errors after cleanup)

## Open Risks

- The execution plan is local artifact truth only; it does not prove runtime
  implementation behavior.
- The JSC-395 spec and trace plan are currently untracked local artifacts.
- Live Linear, PR, CI, review-thread, mergeability, and release-readiness lanes
  are unchecked.
- The next worker must rerun PU-000 before source edits, especially after
  interruption, checkout, pull, stash pop, branch switch, or dirty-worktree
  changes.

## Next Stage

next_stage: sy-work
