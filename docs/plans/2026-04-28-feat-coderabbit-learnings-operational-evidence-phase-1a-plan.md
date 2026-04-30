---
schema_version: 1
title: CodeRabbit Learnings Operational Evidence Phase 1A Plan
type: feat
status: active
date: 2026-04-28
deepened: 2026-04-28
plan_id: feat-coderabbit-learnings-operational-evidence-phase-1a
source_spec: docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md
route: fresh
plan_depth: standard
---

# CodeRabbit Learnings Operational Evidence Phase 1A Plan

## Enhancement Summary

**Planned on:** 2026-04-28  
**Mode:** `standard-plan`  
**Route:** `fresh`  
**Source spec:** [CodeRabbit Learnings as Operational Evidence](../specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md)  
**Implementation slice:** Phase 1A import-only foundation

- Adds the provider-neutral learning data model and CodeRabbit CSV import pipeline.
- Registers the first `harness learnings import` command without implementing gate, promotion, review-context, validation-plan, artifact-provenance, CI-ownership, or north-star dashboard behavior.
- Writes local import artifacts to `.harness/learnings/coderabbit.local.json` by default with deterministic IDs, deterministic ordering, source provenance, summary counts, and warnings.
- Preserves the supplied CodeRabbit CSV as non-live operational evidence so later phases can turn repeated learnings into gates, scaffold defaults, review context, tests, or explicit non-goals.

## Table of Contents

- [Overview](#overview)
- [Problem Frame](#problem-frame)
- [Planning Decision](#planning-decision)
- [Requirements Trace](#requirements-trace)
- [Scope Boundaries](#scope-boundaries)
- [Execution Checkpoints](#execution-checkpoints)
- [Implementation Units](#implementation-units)
- [Validation Plan](#validation-plan)
- [Risks and Mitigations](#risks-and-mitigations)
- [Rollback and Recovery](#rollback-and-recovery)
- [Execution Ledger](#execution-ledger)
- [Deferred Work](#deferred-work)
- [Handoff to HE Work](#handoff-to-he-work)
- [Sources and References](#sources-and-references)

## Overview

Implement the first import-only slice for CodeRabbit learnings as operational evidence. Phase 1A creates the schema, parser, import command, deterministic artifact write, and fixtures needed for later gating and promotion work.

The plan intentionally avoids implementing `harness learnings gate`, `harness learnings promote`, review-context generation, validation-plan generation, artifact provenance enforcement, CI ownership enforcement, and north-star metrics. Those are later slices once imported evidence is stable.

## Problem Frame

The CodeRabbit CSV contains repeated review learnings that currently behave like notes. Agents can still miss them, so the same issues can recur in PR review. The first safe step is to make those learnings structured, deterministic, locally reproducible, and easy for future gates to consume.

The Phase 1A plan supports the north star by reducing repeated review-loop drag without adding premature enforcement. It gives `coding-harness` a reliable evidence ingestion seam before any gate starts failing PR work.

## Planning Decision

### Route

`fresh`

No current implementation plan exists for this exact Phase 1A import-only slice. The source spec is current, deepened, and adversarially corrected.

### Depth

`standard`

This is not a large multi-phase implementation plan, but it touches CLI command registration, data modeling, CSV parsing, file writes, fixtures, and structured JSON contracts. A lightweight checklist would be too thin.

### Interface readiness

Ready.

The source spec defines the caller-facing contract:

```bash
harness learnings import --provider coderabbit-csv --source /path/to/learnings.csv --repo coding-harness --json
```

The repo already supports command-family patterns by registering a top-level command and parsing subcommands inside the command handler. Existing examples include:

- `harness contract ...` via `runContractCLI(args, { json })`.
- `harness brain ...` via `runBrainCLI(args)`.
- `harness remediate run|apply ...` via a top-level command whose handler validates the first positional token.

Therefore Phase 1A should register a top-level `learnings` command and implement only the `import` subcommand in this slice. It should not introduce top-level aliases; if the current registry cannot support the command-family pattern, stop and re-plan the command seam instead.

### Snapshot decision for Phase 1A

Phase 1A should implement the local artifact path by default and reject explicit `.harness/learnings/coderabbit.snapshot.json` output with a clear usage error until snapshot sanitization is planned.

Reason:

- The source spec says Phase 1A must implement the local artifact default and explicitly reject snapshot output until sanitized shareable snapshots are planned.
- Rejecting snapshot output keeps the import slice small while avoiding accidental absolute local path leakage.
- Snapshot support can be a later, isolated task once committed/shareable evidence policy is decided.

## Requirements Trace

- **R1:** Define provider-neutral learning types and CodeRabbit CSV import artifact types.
- **R2:** Parse the CodeRabbit CSV headers and rows into normalized learning items.
- **R3:** Implement deterministic ID generation, including the frontmatter fixture ID `coderabbit.coding-harness.docs-frontmatter-machine-readable`.
- **R4:** Normalize repository filtering, optional fields, `Usage`, `Last Used=Never`, synthesized GitHub URLs, absolute local source paths, and embedded `Applies to <path-or-glob> :` target patterns.
- **R5:** Write `.harness/learnings/coderabbit.local.json` atomically by default.
- **R6:** Emit `LearningImportResult` JSON with schema version `learnings-import-result/v1`.
- **R7:** Register `harness learnings import` through the existing command-registry pattern.
- **R8:** Add fixture tests covering the supplied CodeRabbit CSV shape and Phase 1A edge cases.
- **R9:** Document local CSV provenance and the non-live CodeRabbit limitation.

## Scope Boundaries

In scope:

- TypeScript types for `LearningSourceRef`, `LearningItem`, `LearningImportArtifact`, `LearningImportWarning`, and `LearningImportResult`.
- CodeRabbit CSV header validation.
- CodeRabbit CSV row parsing.
- Repository filtering with skipped-row accounting.
- Optional-field normalization.
- Usage parsing and `Last Used=Never` normalization.
- GitHub PR URL synthesis for `jscraik/<repository>/pull/<pull-request>`.
- Explicit absolute `--source` support for local CSV evidence.
- `targetPatterns` extraction for the deterministic `Applies to <path-or-glob> :` prefix.
- Provisional, non-blocking classification and enforcement defaults.
- Deterministic artifact ordering.
- Atomic artifact write to `.harness/learnings/coderabbit.local.json`.
- CLI registration for `harness learnings import`.
- Unit and command tests for import behavior.
- Minimal docs explaining local import behavior and `live: false`.

Out of scope:

- `harness learnings gate`.
- `harness learnings promote`.
- Review context pack generation.
- Validation plan generation.
- Artifact provenance registry or gate.
- CI ownership schema or gate.
- North-star feedback metrics.
- Live CodeRabbit provider or `coderabbit stats` parsing.
- Snapshot artifact writing or sanitization.
- Override evaluation.
- Enforced docs-surface validation for the frontmatter rule.

## Execution Checkpoints

This plan has four checkpoints. `he-work` should stop at the first failed checkpoint and avoid continuing into downstream steps with uncertain contracts.

### Checkpoint A: Command seam proved before domain work

Exit criteria:

- `harness learnings import --json` reaches the new command handler in tests.
- `harness learnings` without a subcommand returns usage exit code `2`.
- `harness learnings gate` returns usage exit code `2` with a Phase 1B/deferred message.
- No top-level alias is introduced; if the command-family route proves impossible, stop and re-plan the command seam instead of adding `harness learnings-*` aliases.

Stop condition:

- If the registry cannot support `learnings` as a command family with internal subcommands, stop and update this plan before implementing aliases.

### Checkpoint B: Parser and normalization stable before file writes

Exit criteria:

- Header validation, row numbering, repository filtering, optional-field normalization, usage parsing, URL synthesis, `Never` normalization, and `targetPatterns` extraction pass unit tests.
- Filtered non-target repositories increment `summary.skipped` without warning spam.
- The high-usage frontmatter fixture normalizes to the expected file, PR, usage, synthesized URL, and ID inputs.

Stop condition:

- If the real CSV shape requires a column or interpretation not captured in the spec, stop and patch the spec/plan rather than encoding undocumented behavior.

### Checkpoint C: Deterministic artifact generation before CLI success

Exit criteria:

- IDs, warning order, item order, summary ordering, and JSON output are stable across repeated imports.
- The frontmatter fixture produces `coderabbit.coding-harness.docs-frontmatter-machine-readable`.
- The artifact writer uses temp-file plus rename behavior and does not leave partial target files on simulated write failure.
- Explicit snapshot output is rejected with a clear Phase 1A usage error.

Stop condition:

- If deterministic output depends on runtime timestamps in the local artifact, isolate volatile fields from idempotence assertions and document the deterministic subset.

### Checkpoint D: CLI output and docs match the import-only contract

Exit criteria:

- `LearningImportResult` JSON uses `schemaVersion: "learnings-import-result/v1"`.
- Successful imports return exit code `0`; usage errors return `2`; missing/invalid source or write failures return `1`.
- Human-readable output does not include raw full CSV contents.
- Docs say CodeRabbit CSV data is `live: false` and that gate/promotion work is deferred.

Stop condition:

- If docs would imply `harness learnings gate` or promotion is available, stop and correct docs before handoff.

## Implementation Units

- [ ] **P0: Confirm CLI seam and add command registration**
  - Files: `src/lib/cli/registry/command-specs-core.ts`, `src/lib/cli/registry/command-specs.test.ts`, `src/cli-dispatch.test.ts`
  - Requirements: `R7`
  - Work:
    - Import `runLearningsCLI` from a new command module.
    - Add a top-level command spec named `learnings`.
    - Dispatch `harness learnings import ...` to `runLearningsCLI`.
    - Return usage exit code `2` for missing or unsupported subcommands.
    - Add dispatch tests proving `learnings import --json` reaches the new command and `learnings gate` is rejected until Phase 1B.
  - Validation intent:
    - `pnpm vitest run src/lib/cli/registry/command-specs.test.ts src/cli-dispatch.test.ts`
  - Completion criteria:
    - Checkpoint A passes.
    - The command registry exposes `learnings` with an import example.
    - Missing or unsupported subcommands do not fall through to unknown top-level command behavior.
  - Rollback:
    - Remove the `learnings` command spec and related dispatch tests. No data files should exist yet.

- [ ] **P1: Add learning domain types and schema constants**
  - Files: `src/lib/learnings/types.ts`, `src/lib/learnings/index.ts`
  - Requirements: `R1`, `R6`
  - Work:
    - Define the Phase 1A learning source, item, artifact, warning, summary, and import-result types.
    - Add stable schema version constants for `harness-learnings/v1` and `learnings-import-result/v1`.
    - Include `targetPatterns?: string[]` on imported items.
    - Define normalized `lastUsed` as nullable, using `lastUsed?: string | null` or an equivalent typed field that can represent `Last Used=Never` as `null`.
    - Keep `classification`, `enforcement`, and `promotionStatus` provisional and non-blocking.
  - Validation intent:
    - Typecheck through the focused test command and later `pnpm typecheck`.
  - Completion criteria:
    - Types compile without `any` escape hatches for core artifact shapes.
    - Schema version constants are imported by implementation/tests rather than duplicated as string literals.
  - Rollback:
    - Delete `src/lib/learnings` type exports if no downstream implementation has landed yet.

- [ ] **P2: Implement CodeRabbit CSV parser and row normalizer**
  - Files: `src/lib/learnings/coderabbit-csv.ts`, `src/lib/learnings/coderabbit-csv.test.ts`
  - Requirements: `R2`, `R4`
  - Work:
    - Validate required CSV headers.
    - Preserve physical row numbers with header offset.
    - Normalize repository slugs case-insensitively for filtering.
    - Count non-matching repository rows as `summary.skipped`, not warnings.
    - Treat blank `File`, `Pull Request`, and `URL` as absent without warnings.
    - Synthesize GitHub PR URLs when repository and pull request are present.
    - Parse `Usage` as a non-negative integer and blank usage as `0`.
    - Normalize `Last Used=Never` to `null`.
    - Preserve date-like CSV fields as source strings.
    - Extract `targetPatterns` only from the deterministic `Applies to <path-or-glob> :` prefix.
    - Assert that `Last Used=Never` normalizes to `null`.
  - Validation intent:
    - `pnpm vitest run src/lib/learnings/coderabbit-csv.test.ts`
  - Completion criteria:
    - Checkpoint B parser requirements pass.
    - Malformed rows produce warnings unless all rows are invalid.
    - The parser never executes or shells out from learning text.
  - Rollback:
    - Remove parser module and tests; no CLI behavior should depend on it until P5.

- [ ] **P3: Implement deterministic IDs, classification defaults, and artifact ordering**
  - Files: `src/lib/learnings/normalise.ts`, `src/lib/learnings/normalise.test.ts`
  - Requirements: `R3`, `R4`
  - Work:
    - Generate IDs using `coderabbit.<repository-slug>.<topic-slug>`.
    - Ensure the frontmatter fixture produces `coderabbit.coding-harness.docs-frontmatter-machine-readable`.
    - Append a stable short hash on ID collision.
    - Add provisional classification heuristics without making import fail on ambiguous classification.
    - Add provisional enforcement defaults based on usage and classification.
    - Sort items by repository, file, usage descending, then ID.
    - Sort warnings by row, code, then message.
    - Emit summary maps with stable key ordering.
  - Validation intent:
    - `pnpm vitest run src/lib/learnings/normalise.test.ts`
  - Completion criteria:
    - Repeated normalization of the same fixture yields stable IDs and sorted output.
    - Collision handling is covered by at least one synthetic duplicate-topic fixture.
    - Classification ambiguity does not fail import.
  - Rollback:
    - Revert normalizer module/tests independently of the command registry.

- [ ] **P4: Implement local artifact writer**
  - Files: `src/lib/learnings/artifact-io.ts`, `src/lib/learnings/artifact-io.test.ts`
  - Requirements: `R5`
  - Work:
    - Default output path to `.harness/learnings/coderabbit.local.json`.
    - Validate source existence and parseability before creating `.harness/learnings/` or preparing the output path.
    - Use the existing temp-file plus rename pattern from `src/lib/init/migration.ts` or extract a shared atomic write helper if direct import would create an inappropriate dependency.
    - Preserve explicit absolute local source URI only in local artifacts.
    - Canonicalize `--output` before snapshot checks.
    - Reject any output path that resolves to `.harness/learnings/coderabbit.snapshot.json` in Phase 1A with a clear usage error and fix hint.
    - Ensure failed writes do not leave partial target files.
    - Emit `inputFingerprint` in local artifacts.
    - Warn when a new import sharply drops `summary.imported` compared with the previous local artifact; require a future explicit overwrite policy before turning this into a hard fail.
  - Validation intent:
    - `pnpm vitest run src/lib/learnings/artifact-io.test.ts`
  - Completion criteria:
    - Checkpoint C writer requirements pass.
    - Default local output path is covered by test.
    - Explicit snapshot output returns a deterministic usage error and does not create a file.
    - Equivalent snapshot path variants such as `./.harness/learnings/coderabbit.snapshot.json` are rejected.
    - Partial import warnings include enough summary data to spot suspicious drops in imported row count.
  - Rollback:
    - Delete any generated `.harness/learnings/coderabbit.local.json` and revert artifact writer module/tests.

- [ ] **P5: Implement `harness learnings import` command**
  - Files: `src/commands/learnings.ts`, `src/commands/learnings.test.ts`
  - Requirements: `R5`, `R6`, `R7`
  - Work:
    - Parse `import`, `--provider`, `--source`, `--repo`, `--output`, and `--json`.
    - Support only `--provider coderabbit-csv` in Phase 1A.
    - Return exit code `2` for missing required arguments or unsupported providers.
    - Return exit code `2` for deferred subcommands such as `gate`, with error code `learnings.gate_deferred`.
    - Return exit code `1` for missing source files, invalid headers, all rows invalid, or write failures.
    - Return exit code `0` for successful or partial imports with warnings.
    - Print `LearningImportResult` JSON when `--json` is passed.
    - Print concise human-readable output otherwise.
  - Validation intent:
    - `pnpm vitest run src/commands/learnings.test.ts`
  - Completion criteria:
    - Checkpoint D CLI requirements pass.
    - JSON mode suppresses unrelated prose and emits a parseable single result object.
    - Non-JSON mode is concise and includes artifact path, imported/skipped counts, and warning count.
  - Rollback:
    - Remove `src/commands/learnings.ts`, command tests, and registry import/spec from P0.

- [ ] **P6: Add real-shape fixtures**
  - Files: `src/lib/learnings/__fixtures__/coderabbit-learnings.csv`, `src/lib/learnings/__fixtures__/coderabbit-frontmatter-policy.csv`
  - Requirements: `R2`, `R3`, `R4`, `R8`
  - Work:
    - Include a representative subset of the supplied CSV, not the full local export.
    - Cover the high-usage frontmatter row with usage `516`, PR `148`, blank URL, and synthesized GitHub URL.
    - Cover a coding-harness validation-command row with blank PR/URL.
    - Cover an `Applies to <path-or-glob> :` embedded target row.
    - Cover `Usage=0` and `Last Used=Never`.
    - Assert the `Usage=0` and `Last Used=Never` fixture row emits usage `0` and nullable `lastUsed`.
    - Cover a non-coding-harness row filtered by `--repo coding-harness`.
  - Validation intent:
    - Covered by parser, normalizer, and command tests.
  - Completion criteria:
    - Fixtures contain no private tokens or secrets.
    - Fixtures are a minimized representative subset, not the full exported local CSV.
    - Fixture row comments or test names explain which CSV edge case each row represents.
  - Rollback:
    - Delete fixture files with the modules that consume them.

- [ ] **P7: Add minimal documentation**
  - Files: `docs/agents/02-tooling-policy.md`, `docs/agents/04-validation.md`
  - Requirements: `R9`
  - Work:
    - Add a short advisory entry for `harness learnings import`.
    - Explain that CodeRabbit CSV imports are `live: false`.
    - State that Phase 1A artifacts are local and default to `.harness/learnings/coderabbit.local.json`.
    - State that `harness learnings gate` and promotion are later phases.
  - Validation intent:
    - Docs compile through codestyle validation.
  - Completion criteria:
    - Docs mention only `harness learnings import` as implemented in Phase 1A.
    - Docs do not claim snapshot, gate, promotion, or live CodeRabbit support.
    - Docs point to local artifact behavior without encouraging commits of `.local.json`.
  - Rollback:
    - Revert docs-only edits independently if implementation is rolled back.

- [ ] **P8: Run focused then repo-standard validation**
  - Files: no production files unless failures require fixes.
  - Requirements: all
  - Work:
    - Run focused vitest files for the new parser, normalizer, artifact writer, command, and dispatch tests.
    - Run `pnpm typecheck`.
    - Run `bash scripts/validate-codestyle.sh --fast`.
    - Run `bash scripts/run-harness-gate.sh docs-gate --mode required --json` if P7 changes `docs/agents/**` or any repo-facing docs surface covered by docs-gate.
    - Cover stale-import warning behavior with one stale fixture and one fresh no-warning fixture, or explicitly mark staleness checks as deferred if implementation keeps Phase 1A timestamp-free.
    - If behavior or generated artifacts changed beyond import-only code, run the broader repo gate selected by the implementation owner.
  - Validation intent:
    - See [Validation Plan](#validation-plan).
  - Completion criteria:
    - Focused tests pass before broader checks.
    - Any skipped validation has a concrete blocker and nearest meaningful alternative.
    - Handoff records exact command outcomes.
  - Rollback:
    - If focused tests fail after implementation, fix within Phase 1A scope or revert the failing unit before widening validation.

## Validation Plan

Focused validation:

```bash
pnpm vitest run src/lib/learnings/coderabbit-csv.test.ts src/lib/learnings/normalise.test.ts src/lib/learnings/artifact-io.test.ts src/commands/learnings.test.ts src/lib/cli/registry/command-specs.test.ts src/cli-dispatch.test.ts
```

Type and local quality validation:

```bash
pnpm typecheck
bash scripts/validate-codestyle.sh --fast
```

Docs-gate validation when P7 changes `docs/agents/**`:

```bash
bash scripts/run-harness-gate.sh docs-gate --mode required --json
```

Pre-handoff validation:

```bash
bash scripts/verify-work.sh --fast
bash scripts/validate-codestyle.sh
```

Required broader readiness gate for behavior-changing Phase 1A work:

```bash
pnpm check
```

Validation notes:

- Do not run or parse `coderabbit stats` for Phase 1A.
- Do not claim snapshot support unless an explicit snapshot-output path is implemented and tested.
- Do not claim gate behavior is implemented; `harness learnings gate` belongs to Phase 1B.

Validation order:

1. Run the focused unit/command test set.
2. Run `pnpm lint`.
3. Run `pnpm typecheck`.
4. Run `pnpm test`.
5. Run `pnpm audit`.
6. Run `bash scripts/validate-codestyle.sh --fast`.
7. Run `bash scripts/run-harness-gate.sh docs-gate --mode required --json` when P7 changes `docs/agents/**` or another docs-gate-covered repo-facing docs surface.
8. Run `bash scripts/verify-work.sh --fast`.
9. Run `bash scripts/validate-codestyle.sh`.
10. Run `pnpm check` for every behavior-changing PR before merge readiness is claimed.

Failure handling:

- If parser/normalizer tests fail, fix there before touching CLI output.
- If command dispatch tests fail, do not work around by adding aliases unless this plan is updated.
- If docs validation fails, keep docs fixes inside Phase 1A wording and do not add Phase 1B promises.
- If full codestyle is too slow or environment-blocked, record the exact blocker and run the narrowest available completed checks.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| The `learnings` namespace grows into Phase 1B+ during implementation | Keep only `import` accepted; return usage error for `gate` and `promote` until later phases. |
| Imported local artifact leaks machine-specific source paths into committed data | Default to `.local.json`, reject snapshot output in Phase 1A, and document local-only behavior. |
| CSV parser overfits the full local export | Use representative fixtures that cover required edge cases without committing the full exported CSV. |
| Classification becomes a hidden implementation sink | Keep classification provisional and non-blocking; parser correctness and provenance outrank perfect routing. |
| Deterministic IDs drift across implementations | Encode the ID algorithm and frontmatter expected ID in unit tests. |
| Repository filtering creates noisy warnings for other Jamie repos in the export | Count filtered rows as skipped, not warnings. |
| Command registry dispatch tests become brittle | Follow existing `contract`, `brain`, and `remediate` command-family patterns rather than inventing a new registry abstraction. |
| Atomic writer reuse creates an unwanted dependency on init internals | Prefer extracting or wrapping the existing pattern if direct import from `src/lib/init/migration.ts` would create a boundary concern. |

## Rollback and Recovery

Rollback should be possible at three layers:

- Command rollback: remove the `learnings` command registry entry and `src/commands/learnings.ts`.
- Library rollback: remove `src/lib/learnings/**` and fixture tests.
- Artifact rollback: delete generated `.harness/learnings/coderabbit.local.json` if a local import was run during validation.

Recovery rules:

- A failed import must not leave a partial target artifact.
- A failed import must not emit success-like summary metadata or leave stale success diagnostics for the failed target.
- A missing source CSV must not create `.harness/learnings/`.
- A rejected snapshot output must not create `.harness/learnings/coderabbit.snapshot.json`.
- A partial import with malformed rows may write a local artifact only when at least one valid row was imported and warnings are emitted.
- A partial import that sharply reduces imported row count compared with an existing local artifact must emit a clear warning until a later hard overwrite policy exists.
- If implementation discovers that the full local CSV has additional edge cases, add a minimized fixture row and update the parser test before changing production behavior.

## Execution Ledger

STEP_ID | status (pending|in_progress|completed) | owner | evidence
P0 | completed | codex | `learnings` is registered in `src/lib/cli/registry/command-specs-core.ts`; command registry tests cover the command family.
P1 | completed | codex | Learning schema/types exist under `src/lib/learnings`; nullable `lastUsed` is represented for `Last Used=Never`.
P2 | completed | codex | CodeRabbit CSV parser and normalizer tests cover header validation, repository filtering, usage parsing, URL synthesis, and `Never` normalization.
P3 | completed | codex | Deterministic IDs, ordering, and promotion classification behavior are covered by learning normalizer/promote tests.
P4 | completed | codex | Local artifact writer tests cover default `.harness/learnings/coderabbit.local.json`, snapshot rejection, warnings, and gate consumption.
P5 | completed | codex | `src/commands/learnings.test.ts` covers `harness learnings import`, `gate`, and `promote` command behavior.
P6 | completed | codex | Representative CodeRabbit CSV fixtures live under `src/lib/learnings/__fixtures__/`.
P7 | completed | codex | `docs/agents/02-tooling-policy.md`, `docs/agents/04-validation.md`, README, and CLI reference describe the implemented learning evidence surfaces.
P8 | completed | codex | Validated with focused tests, docs-gate, wrapper smokes, and `bash scripts/validate-codestyle.sh --fast` after the artifact-gate reciprocal drift fix.

Closeout evidence:

- `node_modules/.bin/vitest run src/commands/artifact-gate.test.ts` -> pass, 1 file, 5 tests.
- `node scripts/check-public-api-docs.mjs` -> pass, checked 174 files.
- `node_modules/.bin/vitest run src/lib/cli/registry/command-specs.test.ts src/commands/ci-ownership-gate.test.ts src/lib/init/scaffold-default-promotions.test.ts` -> pass, 3 files, 75 tests.
- `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass, 0 errors, 0 warnings, 18 info.
- `bash scripts/validate-codestyle.sh --fast` -> pass, 124 test files, 2,479 passed, 2 skipped.
- `pnpm build && bash scripts/harness-cli.sh artifact-gate --files src/templates/codex-preflight.sh --json` -> build passed; wrapper artifact gate returned the expected failure for source-only drift with `artifact-gate.source_without_generated`.
- `bash scripts/harness-cli.sh artifact-gate --files scripts/codex-preflight.sh,src/templates/codex-preflight.sh --json` -> pass with `artifact-gate.source.synced`.

Post-plan scope note:

- Implementation intentionally continued beyond the original import-only Phase 1A slice after follow-up approval. The current branch includes later operational-evidence surfaces: `harness learnings gate`, `harness learnings promote`, `harness review-context`, `harness validation-plan`, `harness artifact-gate`, `harness ci-ownership-gate`, and scaffold-default promotion regression coverage.
- The CodeRabbit review finding `[P1] Artifact gate misses source-only drift` is resolved by the reciprocal `sourceChanged && !artifactChanged` path in `src/lib/artifact-provenance.ts` and regression coverage in `src/commands/artifact-gate.test.ts`.

## Deferred Work

Completed after the original Phase 1A slice:

- `harness learnings gate`.
- Exact-path matcher against `file` and `targetPatterns`.
- `GateResult` output.
- `harness learnings promote`.
- Promotion candidates.
- Review context pack.
- Validation plan command.
- Artifact provenance registry and gate.
- CI ownership contract and gate.
- Scaffold-default promotion regression coverage for repeated generated-repo defaults.

Still deferred:

- Durable docs-surface validator for the frontmatter metadata learning.
- Promotion status updates that mark implemented learnings as enforced by specific files/tests.
- `operator_skill` promotion recommendations for repeated workflows that should be captured with `$skillify`.
- North-star feedback metrics.
- Live CodeRabbit provider or live companion metadata.
- Sanitized shared snapshot publication for imported learning evidence.
- Mandatory review-gate enforcement of generated review-context artifacts.
- Keyword-only fuzzy matching and blocking.

Skillification candidates should remain advisory until Phase 2 promotion
analysis can distinguish repeatable workflows from atomic rules. Do not
skillify single-rule learnings that are better enforced as validators, tests,
scaffold defaults, or review-context facts.

## Handoff to HE Work

Recommended next stage: `he-work`.

Readiness: ready for `he-work` after this deepen pass.

Execution mode:

- Implement P0 through P8 in order.
- Treat checkpoints A through D as hard gates.
- Stop after Phase 1A import behavior is validated.
- Do not begin Phase 1B gate behavior in the same work slice unless explicitly re-planned.

Implementation constraints:

- Use local ESM imports with `.js` extensions.
- Keep JSON output deterministic.
- Keep source CSV text treated as untrusted input when rendering output.
- Preserve the local/shareable artifact boundary.
- Preserve the existing CodeRabbit CSV export as local evidence; do not commit `/Users/jamiecraik/Downloads/learnings.csv`.
- Treat `$skillify` as a promotion path for repeated operator workflows, not as
  a Phase 1A import requirement.

## Sources and References

- Source spec: [docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md](../specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md)
- Current CLI command registry: `src/lib/cli/registry/command-specs-core.ts`
- Existing command-family parser examples: `src/commands/contract.ts`, `src/commands/brain-core.ts`
- Canonical gate result type for Phase 1B planning: `src/lib/output/types.ts`
- Atomic write pattern reference: `src/lib/init/migration.ts`
- Local CodeRabbit CSV source: `<path-to-csv>`; substitute the local export path or pass it through a `CSV_PATH` environment variable outside committed documentation.
