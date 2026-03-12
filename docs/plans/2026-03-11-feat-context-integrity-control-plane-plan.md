---
title: feat: Context Integrity Control Plane
type: feat
status: completed
date: 2026-03-11
plan_id: feat-context-integrity-control-plane
origin: docs/brainstorms/2026-03-11-context-integrity-control-plane-brainstorm.md
spec: docs/specs/2026-03-11-feat-context-integrity-control-plane-spec.md
---

# feat: Context Integrity Control Plane

## Table of Contents

- [Enhancement Summary](#enhancement-summary)
- [Overview](#overview)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Scope and Non-Goals](#scope-and-non-goals)
- [Planning Inputs](#planning-inputs)
- [Implementation Phases](#implementation-phases)
- [Dependencies and Risks](#dependencies-and-risks)
- [Test and Validation Strategy](#test-and-validation-strategy)
- [Rollout / Migration / Monitoring](#rollout--migration--monitoring)
- [Acceptance Checklist](#acceptance-checklist)
- [Sources & References](#sources--references)

## Enhancement Summary

**Deepened on:** 2026-03-11  
**Closed on:** 2026-03-12  
**Key areas improved:** bootstrap and migration detail, checkpoint ownership, context-health execution splits, cross-run join integrity, and rollout/demotion readiness.

- Splits planning cleanly between implementation-complete delivery and promotion-ready rollout evidence so advisory telemetry does not get mistaken for enforcement readiness.
- Gives `context-health` separate `current_checkout` and `recent_artifacts` execution lanes with their own validation duties.
- Makes bootstrap and `init --update` migration work first-class rather than a late wiring task.
- Keeps retrieval expansion additive while preserving the existing CP4b boundary for degraded lexical fallback.
- Treats contradiction handling as a `docs-gate` extension rather than inventing a second governance engine.
- Reuses the repo's existing control-plane patterns for typed `artifactRefs`, measurement windows, fail-closed joins, and promotion/demotion evidence.
- Leaves broader graph/memory-platform work out of scope for this slice.

## Overview

Implement the context-integrity feature as one additive control-plane lane, using [2026-03-11-feat-context-integrity-control-plane-spec.md](../specs/2026-03-11-feat-context-integrity-control-plane-spec.md) as the authoritative contract.

The plan is intentionally ordered to avoid policy drift and partial truths:

1. land bootstrap-safe contract and migration wiring first,
2. land the shared producer artifact vocabulary before downstream consumers depend on it,
3. expand retrieval corpus discovery and authority metadata,
4. layer authority-aware retrieval output behavior on top of the new metadata,
5. extend `docs-gate` with contradiction evaluation plus a durable contradiction ledger,
6. implement `context-health` in separate current-checkout and recent-artifacts slices,
7. verify cross-run artifact joins and rollback posture before rollout evidence is trusted,
8. wire docs and operator workflows after the machine-readable behavior is settled.

Release expectation for v1:

- the harness repo adopts the new `contextIntegrityPolicy` surface and supporting command/report behavior first,
- contradiction findings remain bounded by existing `docsGatePolicy.mode` merge-authoritative ceilings,
- `context-health` ships as advisory telemetry only,
- downstream adoption follows explicit scaffold/update paths rather than implicit runtime fallback.

Completion model for this plan:

- **Implementation complete** means contract, command, artifact, and upgrade-path work through Phase 7 has landed and passed the required validation slices.
- **Promotion ready** means shadow or advisory evidence proves the rollout thresholds, downgrade path, and demotion controls described by the linked spec and rollout docs.

## Problem Statement / Motivation

The spec already resolves what the feature must own. The planning problem is how to land it without breaking retrieval contracts, overreaching past `docs-gate`, or producing scorecards from non-reproducible evidence.

Three current implementation gaps drive the sequence:

- `index-context` and retrieval metadata are still scoped to brainstorms, plans, and an absent `docs/solutions` corpus instead of the repo's authoritative guidance surfaces.
- `docs-gate` already has the right report envelope and outcome vocabulary, but `contradiction_count` and contradiction categories are still placeholder-only.
- no existing command yet emits the full persisted producer artifact family that `context-health` needs in order to compute windowed, artifact-bound scorecards safely.

The execution plan therefore needs to preserve these invariants while implementation grows:

- additive command/report evolution,
- fail-soft telemetry where allowed and fail-closed joins where required,
- stable typed artifact references,
- no silent retrieval-fallback broadening beyond the spec,
- no second governance system parallel to `docs-gate`.

## Scope and Non-Goals

### In scope

- Add `contextIntegrityPolicy` to the contract typing, defaults, validation, and upgrade path.
- Expand retrieval discovery and indexing to the authoritative source inventory named in the spec.
- Add authority/staleness-aware retrieval metadata and deterministic ranking tie-breaks to `context` and `search`.
- Extend `docs-gate` with contradiction-category evaluation, stable `finding_id` generation, contradiction counts, and contradiction-history persistence.
- Add a new `context-health` command that consumes persisted typed producer artifacts and emits a `ContextHealthReport`.
- Materialize the required producer artifacts for retrieval, stale-doc, contradiction-history, source inventory, and memory metrics.
- Update governed docs and rollout guidance after the implementation surfaces are stable.

### Non-goals

- Replacing `search`, `context`, `docs-gate`, `memory-gate`, or `gardener` with a new orchestrator.
- Promoting `context-health` into a merge-blocking gate in v1.
- Shipping a broad note-graph, meeting-mining, or company-memory platform.
- Renaming the docs corpus into a graph-native taxonomy.
- Solving contradiction detection for every prose surface in the repo.

## Planning Inputs

### Authoritative contract and source artifacts

- [2026-03-11-feat-context-integrity-control-plane-spec.md](../specs/2026-03-11-feat-context-integrity-control-plane-spec.md)
- [2026-03-11-context-integrity-control-plane-brainstorm.md](../brainstorms/2026-03-11-context-integrity-control-plane-brainstorm.md)

### Existing implementation patterns to follow

- retrieval discovery and degraded-fallback seams in [src/commands/index-context.ts](/Users/jamiecraik/dev/coding-harness/src/commands/index-context.ts) and [src/lib/context-compound/lexical-fallback.ts](/Users/jamiecraik/dev/coding-harness/src/lib/context-compound/lexical-fallback.ts)
- hybrid search output and warning behavior in [src/commands/search.ts](/Users/jamiecraik/dev/coding-harness/src/commands/search.ts)
- governed-report envelopes and outcome handling in [src/commands/docs-gate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/docs-gate.ts)
- stale/freshness normalization in [src/lib/gardener/stale-detector.ts](/Users/jamiecraik/dev/coding-harness/src/lib/gardener/stale-detector.ts)
- typed contract and validator patterns in [src/lib/contract/types.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types.ts) and [src/lib/contract/validator.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.ts)
- typed artifact-ref and join-integrity patterns in [src/lib/contract/run-records.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/run-records.ts), [src/lib/pilot-evaluation/metrics-capture.ts](/Users/jamiecraik/dev/coding-harness/src/lib/pilot-evaluation/metrics-capture.ts), and [src/lib/pilot-evaluation/control-plane.ts](/Users/jamiecraik/dev/coding-harness/src/lib/pilot-evaluation/control-plane.ts)
- rollout evidence patterns in [docs/agents/14-docs-gate-rollout.md](../agents/14-docs-gate-rollout.md)

### Local research conclusions that the plan must honor

- `docs/solutions/` does not currently exist in this repo, so retrieval expansion should not assume a populated solutions corpus.
- the cleanest additive seam for retrieval work is metadata-first expansion in `src/lib/context-compound/types.ts` and indexing-scope expansion in `src/commands/index-context.ts`
- contradiction handling should extend `docs-gate` rather than become a separate gate
- scorecard/reporting work should reuse existing typed artifact, measurement-window, and join-integrity patterns rather than introduce a bespoke telemetry substrate

### Human and operational dependencies

- maintainer-owned contract edits remain the only allowed posture mutation path for `contextIntegrityPolicy.mode`
- any downstream migration expectations depend on `init --update` shipping in the same release slice as the new contract surface
- rollout promotion or demotion requires maintainer review of contradiction false positives, join-integrity failures, and downgrade-proof evidence rather than automatic posture writes
- CI/workflow owners must review any required-check or job-name changes that become contributor-facing contract surfaces

### SpecFlow / gap-analysis items to explicitly cover

- path-scoped instruction-stack evaluation for `instruction_precedence_conflict`
- stable contradiction history and lifecycle transitions across runs
- explicit producer artifacts and metric-to-input bindings for `context-health`
- denominator guards, dedupe rules, and recent-artifact window semantics
- rollout/migration behavior when `contextIntegrityPolicy` is missing or partially wired

## Implementation Phases

### Checkpoint model

Progression is hard-stop. If a checkpoint fails, stop, fix the root cause, and rerun from the first failed gate forward.

- **CP0:** bootstrap-safe contract, migration path, and shared artifact vocabulary are locked.
- **CP1:** authoritative retrieval discovery and source inventory are stable.
- **CP2:** authority-aware retrieval output and ranking are stable without fallback drift.
- **CP3:** contradiction evaluation, scoped precedence handling, and contradiction-history persistence are stable.
- **CP4A:** `context-health` current-checkout mode is stable on persisted snapshot inputs.
- **CP4B:** `context-health` recent-artifacts mode is stable on governed, deduped, persisted evidence.
- **CP5:** cross-run join-integrity and retention-safety behavior is stable.
- **CP6:** docs, rollout wiring, and downgrade-path verification are complete.
- **CP7:** full validation and rollout-evidence packaging are complete.

### Cross-phase execution rules

The phases below should be treated as bounded slices with explicit handoff checks:

1. Land bootstrap-safe contract surfaces and migration wiring before normal command rollout.
2. Freeze the shared artifact vocabulary before adding command logic that depends on it.
3. Land retrieval source discovery and metadata before ranking/output changes.
4. Land contradiction normalization and ledger persistence before rollout metrics depend on contradiction history.
5. Land producer artifacts before `context-health` computes any multi-run scorecard.
6. Update docs and rollout workflows only after the machine-readable behavior is stable.
7. Keep `context-health` advisory-only throughout this plan unless the spec changes.

### Phase 0 - Bootstrap, contract shape, and shared artifact vocabulary

Goal: establish `contextIntegrityPolicy`, bootstrap-safe migration behavior, and typed producer-artifact vocabulary before command behavior changes.

Primary files:

- [src/lib/contract/types.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types.ts)
- [src/lib/contract/validator.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.ts)
- [src/lib/contract/validator.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.test.ts)
- [harness.contract.json](/Users/jamiecraik/dev/coding-harness/harness.contract.json)
- [src/commands/init.ts](/Users/jamiecraik/dev/coding-harness/src/commands/init.ts)
- [src/commands/init.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/init.test.ts)
- [src/lib/context-compound/types.ts](/Users/jamiecraik/dev/coding-harness/src/lib/context-compound/types.ts)
- [src/lib/contract/run-records.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/run-records.ts)

Tasks:

- add typed `contextIntegrityPolicy` support with:
  - `enabled`
  - `mode`
  - `ruleCatalog[]`
  - `truthSources[]`
  - `healthSampling`
- encode compatibility and bootstrap rules so missing `contextIntegrityPolicy` maps to the correct `policy_error` or `bootstrap_gap` posture
- extend retrieval-domain types for:
  - `ContextSource.kind`
  - `authority`
  - `staleness_state`
  - source inventory records
  - retrieval/report warning enums
- make bootstrap and migration behavior first-class by adding `init --update` support for:
  - scaffolding `contextIntegrityPolicy` defaults
  - keeping coupled contract and wiring changes together
  - treating v1 downstream enablement wiring as `harness.contract.json` plus any required `.github/workflows/pr-pipeline.yml` posture or artifact-persistence updates, while leaving repo-local operator-doc refresh to Phase 6
  - preserving older-contract behavior for repos that have not adopted this lane yet
- define or reuse typed artifact-ref helpers needed by:
  - `context_index_inventory`
  - `context_retrieval_report`
  - `search_retrieval_report`
  - `context_integrity_contradiction_history`
  - `stale_doc_report`
  - `memory_metrics_snapshot`
- add harness defaults in `harness.contract.json` without changing existing `docsGatePolicy` ownership boundaries

Phase dependencies:

- depends on the current spec remaining authoritative for mode ordering, bootstrap behavior, and metric inputs
- should finish before retrieval/indexing, contradiction, or scorecard command work begins

Verification slice:

- targeted contract validator tests for valid/invalid `contextIntegrityPolicy` shapes
- fixture coverage for older contracts without `contextIntegrityPolicy`
- init/update fixtures for new repos, upgraded repos, and idempotent reruns
- typed artifact-ref validation tests for new context-integrity artifact types
- compatibility tests proving older commands still load on older contracts

Exit criteria:

- valid contracts load with `contextIntegrityPolicy`
- invalid policy shapes fail deterministically with actionable errors
- supported bootstrap/update paths can scaffold the new policy and any required downstream workflow posture wiring without inventing defaults at runtime
- new artifact families have one canonical typed reference contract

Checkpoint gate:

- CP0 passes only when both harness-repo and downstream-bootstrap paths are proven by fixtures, not just the local contract loader.

### Phase 1 - Retrieval corpus expansion and source inventory

Goal: broaden discovery/indexing to the authoritative source inventory and persist enough metadata to support coverage and freshness accounting.

Primary files:

- [src/commands/index-context.ts](/Users/jamiecraik/dev/coding-harness/src/commands/index-context.ts)
- [src/commands/index-context.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/index-context.test.ts)
- [src/lib/context-compound/indexer.ts](/Users/jamiecraik/dev/coding-harness/src/lib/context-compound/indexer.ts)
- [src/lib/context-compound/store.ts](/Users/jamiecraik/dev/coding-harness/src/lib/context-compound/store.ts)
- [src/lib/context-compound/types.ts](/Users/jamiecraik/dev/coding-harness/src/lib/context-compound/types.ts)

Tasks:

- preserve the existing indexed corpus inside the v1 source inventory:
  - `docs/brainstorms`
  - `docs/plans`
  - `docs/solutions` when present
- expand discovery scope to add the spec’s authoritative source inventory:
  - `docs/adr`
  - `docs/specs`
  - `docs/agents`
  - `README.md`
  - `CONTRIBUTING.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `AI/context/diagram-context.md`
- normalize every discovered file into a `ContextSource` plus `AuthorityDescriptor`
- persist `artifacts/context-integrity/index-source-inventory.json`
- preserve repo-root-only path eligibility and symlink/path-escape rejection
- encode required/conditional/optional authoritative source family handling so coverage denominators remain deterministic
- keep CP4b fallback posture unchanged:
  - `index-context` remains explicit-fail unless the existing degraded lexical gate is enabled

Phase dependencies:

- requires Phase 0 source metadata and artifact vocabulary
- should finish before retrieval ranking/output changes

Verification slice:

- indexing fixtures for every source family
- missing-source fixtures for required and conditional authoritative surfaces
- repo-root safety tests for path escapes and invalid discovery roots
- artifact snapshot tests for `index-source-inventory.json`

Exit criteria:

- `index-context` discovers the scoped source inventory
- inventory artifacts are persisted and referenceable
- no broadened fallback behavior is introduced accidentally

Checkpoint gate:

- CP1 passes only when the authoritative source inventory and coverage denominator behavior are reproducible from the emitted inventory artifact alone.

### Phase 2 - Authority-aware retrieval outputs and ranking

Goal: expose authority, staleness, and degraded-mode metadata through `context` and `search` without breaking existing required output fields.

Primary files:

- [src/commands/context.ts](/Users/jamiecraik/dev/coding-harness/src/commands/context.ts)
- [src/commands/context.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/context.test.ts)
- [src/commands/search.ts](/Users/jamiecraik/dev/coding-harness/src/commands/search.ts)
- [src/commands/search.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/search.test.ts)
- [src/lib/context-compound/lexical-fallback.ts](/Users/jamiecraik/dev/coding-harness/src/lib/context-compound/lexical-fallback.ts)
- [src/lib/gardener/stale-detector.ts](/Users/jamiecraik/dev/coding-harness/src/lib/gardener/stale-detector.ts)

Tasks:

- add retrieval result fields for:
  - `authority`
  - `staleness_state`
  - `authority_reason`
  - stable warning enums
- implement the spec’s ranking and tie-break rules using explicit comparators:
  - similarity first
  - authority second
  - freshness third
  - fixed source-family priority fourth
  - stable path sort last
- derive staleness by source class, including:
  - gardener semantics for frontmatter-backed docs
  - `unknown` handling for canonical files without freshness metadata
- emit persisted governed retrieval artifacts for sampling runs:
  - `artifacts/context-integrity/retrieval-evals/context-<runId>.json`
  - `artifacts/context-integrity/retrieval-evals/search-<runId>.json`
- preserve backward-compatible JSON outputs and existing command semantics

Phase dependencies:

- requires Phase 1 source inventory and metadata
- should finish before `context-health` consumes retrieval artifacts

Verification slice:

- ranking fixtures where canonical/governed/supporting sources match the same query
- stale-vs-unknown-vs-fresh ordering fixtures
- additive JSON-contract snapshots for `context` and `search`
- degraded semantic-backend fixtures proving warnings and status remain accurate

Exit criteria:

- `context` and `search` expose authority-aware outputs
- persisted retrieval reports exist for governed sampling workflows
- retrieval commands still honor the pre-existing CP4b fallback boundary

Checkpoint gate:

- CP2 passes only when additive retrieval metadata is present in JSON output and legacy command semantics remain unchanged under the existing fallback posture.

### Phase 3 - Contradiction evaluation and contradiction-history ledger

Goal: make contradiction handling a machine-readable `docs-gate` responsibility with stable lifecycle tracking.

Primary files:

- [src/commands/docs-gate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/docs-gate.ts)
- [src/commands/docs-gate.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/docs-gate.test.ts)
- new shared helpers under `src/lib/cli/` or `src/lib/docs-gate/` for:
  - contradiction normalizers
  - truth-source loading
  - path-scoped instruction-stack evaluation
  - stable `finding_id` generation
- [src/lib/contract/loader.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/loader.ts) if shared policy loading changes are needed

Tasks:

- load contradiction rule catalogs, truth-source definitions, and severities from `contextIntegrityPolicy`
- implement scoped contradiction evaluators for the v1 categories:
  - `command_contract_conflict`
  - `required_check_conflict`
  - `instruction_precedence_conflict`
  - `workflow_policy_conflict`
  - `source_truth_missing`
- evaluate instruction precedence using:
  - target path
  - applicable instruction stack
  - normalized governed statement
- replace placeholder `contradiction_count: 0` behavior with normalized category counts
- persist `artifacts/context-integrity/contradiction-history.jsonl`
- encode stable lifecycle transitions:
  - `open`
  - `resolved`
  - `not_applicable`
- keep `unknown_governance_change` as governed drift, not contradiction, unless a comparator exists

Phase dependencies:

- requires Phase 0 policy typing
- benefits from Phase 2 source-of-truth and retrieval/staleness metadata, but must not depend on `context-health`

Verification slice:

- rule-by-rule contradiction fixtures against real repo-like surfaces
- path-scoped override fixtures for valid lower-scope instruction overrides
- protected-truth split-brain fixtures that produce `trust_mismatch`
- contradiction-ledger fixtures proving stable `finding_id` transitions across runs
- report snapshots proving contradiction summaries remain embedded in the existing `docs-gate` report

Exit criteria:

- `docs-gate` emits non-placeholder contradiction counts
- contradiction-history persists stable lifecycle state across eligible runs
- contradiction outcomes remain bounded by existing `docsGatePolicy.mode` ceilings

Checkpoint gate:

- CP3 passes only when same-scope conflicts, valid lower-scope overrides, and protected-truth split-brain cases are all distinguished correctly by fixtures.

### Phase 4A - Context-health current-checkout mode

Goal: implement advisory scorecard reporting for `current_checkout` mode, including any allowed snapshot materialization, before tackling cross-run aggregation.

Primary files:

- new [src/commands/context-health.ts](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.ts)
- new [src/commands/context-health.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.test.ts)
- new shared modules under `src/lib/context-integrity/` or equivalent for:
  - measurement-window resolution
  - artifact-family loading
  - evaluation normalization and dedupe
  - scorecard calculation
- [src/lib/pilot-evaluation/metrics-capture.ts](/Users/jamiecraik/dev/coding-harness/src/lib/pilot-evaluation/metrics-capture.ts) if shared artifact/window helpers should be reused
- [src/lib/memory/metrics-tracker.ts](/Users/jamiecraik/dev/coding-harness/src/lib/memory/metrics-tracker.ts)
- [src/lib/gardener/stale-detector.ts](/Users/jamiecraik/dev/coding-harness/src/lib/gardener/stale-detector.ts)

Tasks:

- implement `context-health` report envelope aligned with the spec:
  - `schemaVersion`
  - `compatibilityMajor`
  - `producerVersion`
  - `measurement_window`
  - `inputs`
  - `summary`
  - `scorecard`
  - typed `artifactRefs`
- materialize persisted producer artifacts for current-checkout mode when allowed:
  - `stale-doc-report.json`
  - `memory-metrics-snapshot.json`
- ensure current-checkout mode still scores from persisted snapshot artifacts rather than raw transient process state
- enforce metric-to-input binding:
  - coverage from index inventory
  - contradiction counts and consistency from contradiction history plus eligible `docs-gate` artifacts
  - degraded retrieval from persisted governed retrieval artifacts
  - memory questions from persisted memory snapshots
- implement null-versus-zero and minimum-sample behavior for current-checkout scoring
- fail soft for incomplete evidence where the spec allows it and fail closed on bad joins, wrong repo roots, or invalid measurement-window configuration

Phase dependencies:

- requires Phases 1 through 3 producer artifacts
- should finish before recent-artifacts scoring or rollout automation depends on the scorecard

Verification slice:

- current-checkout fixtures with full inputs and missing inputs
- snapshot-materialization fixtures for stale-doc and memory families
- missing-artifact and unsupported-schema fixtures
- null-vs-zero fixtures for insufficient evidence

Exit criteria:

- `context-health` emits a deterministic current-checkout advisory report from persisted typed artifacts
- scorecard semantics remain correct when snapshot families are materialized locally
- missing or degraded inputs are reported explicitly

Checkpoint gate:

- CP4A passes only when current-checkout scoring proves null-versus-zero behavior and never reads transient process state as historical evidence.

### Phase 4B - Context-health recent-artifacts mode and metrics integrity

Goal: add artifact-windowed scoring with explicit eligibility, dedupe, and governed-sampling rules before any rollout evidence is trusted.

Primary files:

- [src/commands/context-health.ts](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.ts)
- [src/commands/context-health.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.test.ts)
- shared measurement-window and dedupe helpers introduced in Phase 4A
- [src/lib/pilot-evaluation/metrics-capture.ts](/Users/jamiecraik/dev/coding-harness/src/lib/pilot-evaluation/metrics-capture.ts) if shared artifact-window helpers are reused

Tasks:

- implement `recent_artifacts` loading bounded by:
  - trailing `30` eligible evaluations, or
  - trailing `7` days
- enforce governed sampling rules from `contextIntegrityPolicy.healthSampling`
- normalize `ContextHealthEvaluation` records and latest-eligible-evaluation dedupe by `dedupe_key`
- exclude:
  - ad hoc retrieval queries
  - console-only evidence
  - reruns over the same artifact set that do not produce a new eligible evaluation
- compute denominator-based metrics only from eligible, deduped persisted artifacts

Phase dependencies:

- requires Phase 4A report and scoring helpers
- requires stable producer artifacts from Phases 1 through 3

Verification slice:

- recent-artifacts window-bounding fixtures
- retry and CI-rerun dedupe fixtures
- ad hoc query exclusion fixtures
- denominator and insufficient-evidence fixtures for low-sample windows
- mixed eligible/ineligible artifact fixtures for governed sampling

Exit criteria:

- `context-health` recent-artifacts mode produces reproducible scorecards from eligible persisted artifacts only
- reruns and ad hoc queries do not inflate or pollute scorecard denominators

Checkpoint gate:

- CP4B passes only when governed-sampling eligibility, dedupe keys, and ad hoc exclusion all hold under fixtures that simulate retries and CI reruns.

### Phase 5 - Cross-run artifact join integrity and retention safety

Goal: prove that artifact-bound scoring and contradiction history remain trustworthy across retention, stale-reference, and cross-run loader scenarios.

Primary files:

- [src/commands/context-health.ts](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.ts)
- [src/commands/context-health.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/context-health.test.ts)
- shared artifact-loader helpers introduced in earlier phases
- [src/lib/pilot-evaluation/control-plane.ts](/Users/jamiecraik/dev/coding-harness/src/lib/pilot-evaluation/control-plane.ts) if shared join-integrity helpers are reused

Tasks:

- enforce load-or-degrade/load-or-block rules when referenced artifacts:
  - no longer exist
  - point outside the repo root
  - fall outside the declared measurement window
  - fail schema or compatibility checks
- prove contradiction-history and scorecard loaders behave correctly when upstream artifacts age out or are regenerated
- keep retention/loader behavior explicit rather than silently recomputing from replacement local state

Phase dependencies:

- requires Phases 3 and 4 producer and consumer behavior

Verification slice:

- stale-reference fixtures
- wrong-repo-root fixtures
- out-of-window artifact fixtures
- schema-version mismatch fixtures
- regenerated-artifact join fixtures

Exit criteria:

- scorecard and contradiction loaders never silently ignore broken references
- join-integrity failures produce explicit degraded or blocked behavior

Checkpoint gate:

- CP5 passes only when stale, missing, out-of-window, and wrong-root references all fail in the expected explicit posture.

### Phase 6 - Docs, rollout wiring, and downgrade-path verification

Goal: propagate stable defaults, operator guidance, and rollback-control evidence only after the command/report behavior is real.

Primary files:

- [README.md](/Users/jamiecraik/dev/coding-harness/README.md)
- [CONTRIBUTING.md](/Users/jamiecraik/dev/coding-harness/CONTRIBUTING.md)
- [AGENTS.md](/Users/jamiecraik/dev/coding-harness/AGENTS.md)
- [.github/workflows/pr-pipeline.yml](/Users/jamiecraik/dev/coding-harness/.github/workflows/pr-pipeline.yml)
- [docs/agents/05-contradictions-and-cleanup.md](../agents/05-contradictions-and-cleanup.md)
- [docs/agents/14-docs-gate-rollout.md](../agents/14-docs-gate-rollout.md)

Tasks:

- document:
  - authoritative retrieval scope
  - contradiction categories and operator expectations
  - advisory-only `context-health` posture
  - remediation paths for `bootstrap_gap`, `policy_error`, and join-integrity failures
- wire workflow-owned rollout surfaces so `.github/workflows/pr-pipeline.yml` stays aligned with:
  - `contextIntegrityPolicy.mode`
  - contradiction/report artifact upload or persistence expectations
  - downgrade-safe posture reconciliation
- extend rollout docs with:
  - contradiction-enforcement promotion criteria
  - demotion triggers
  - required evidence packets
  - measurement-window expectations for `context-health`
- verify the downgrade path explicitly:
  - maintainer-owned posture changes only
  - no auto-mutation by `context-health`
  - contract and workflow posture can return safely to `advisory`
- keep docs updates sequenced after the true command/report surfaces are final

Phase dependencies:

- requires prior phases to stabilize CLI/report vocabulary and artifact paths
- should finish before any downstream release note or adoption push

Verification slice:

- docs lint/markdown validation on updated docs
- spot checks that public command/help references match `package.json` and CLI output
- workflow spot checks that required-check posture and artifact upload references still match the implemented rollout lane
- downgrade-path proof for posture reconciliation and demotion triggers

Exit criteria:

- operator-facing docs describe the real implementation rather than the intended one
- workflow-owned rollout posture and artifact references are updated in the same CP6 slice rather than left implicit
- downgrade and demotion controls are proven before rollout evidence is used for promotion decisions

Checkpoint gate:

- CP6 passes only when a maintainer-owned downgrade path back to `advisory` is documented, testable, free of automatic posture mutation, and reflected consistently across workflow-owned rollout surfaces.

### Phase 7 - Full-gate closure and rollout evidence package

Goal: close the implementation slice with the repo’s standard validation bundle and explicit rollout evidence.

Primary files and artifacts:

- `artifacts/context-integrity/index-source-inventory.json`
- `artifacts/context-integrity/retrieval-evals/*`
- `artifacts/context-integrity/contradiction-history.jsonl`
- `artifacts/context-integrity/stale-doc-report.json`
- `artifacts/context-integrity/memory-metrics-snapshot.json`
- `artifacts/context-integrity/context-health-report.json`
- rollout summary artifacts under the repo’s existing control-plane evidence lanes if adopted

Tasks:

- run targeted tests for each phase from first failure forward
- run the repo’s broader validation bundle once implementation behavior is complete
- collect a promotion-readiness starter packet for the new lane:
  - authoritative coverage rate
  - contradiction counts by category
  - decision-consistency proxy trend
  - degraded-input counts
  - insufficient-evidence rate
  - join-integrity failures
  - downgrade-path evidence
- document any follow-up work that is deliberately left for a post-v1 rollout lane

Phase dependencies:

- requires all earlier phases

Verification slice:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm audit`
- `pnpm check`
- `pnpm test:deep`
- any new targeted command/report tests added by this feature

Exit criteria:

- the feature passes the agreed validation bundle
- artifact outputs are reproducible and join-clean
- rollout evidence is sufficient to keep the lane in `shadow` or promote to `advisory` without guessing

Checkpoint gate:

- CP7 passes only when implementation-complete evidence and promotion-ready evidence are recorded separately, with any remaining rollout unknowns called out explicitly.

## Dependencies and Risks

### Key dependencies

- stable `contextIntegrityPolicy` contract shape and validator semantics
- existing CP4b retrieval boundary staying authoritative unless changed by a separate spec
- typed `artifactRefs` and join-integrity helpers staying reusable for the new artifact families
- `docs-gate` continuing to own merge-authoritative governance posture
- persisted producer artifacts being available before scorecard math is trusted
- maintainer availability for contract posture updates, rollout sign-off, and downgrade verification

### Key risks

- **Retrieval-contract drift**
  - Risk: authority-aware ranking accidentally broadens degraded fallback behavior for `context` or `index-context`
  - Mitigation: phase-gate retrieval fallback assertions and keep CP4b guard tests in place

- **Contradiction false positives**
  - Risk: instruction-precedence or source-of-truth rules produce noisy findings
  - Mitigation: path-scoped evaluation fixtures, advisory-first rollout, and category-level tuning before any stronger posture

- **Scorecard evidence inflation**
  - Risk: `context-health` counts ad hoc runs, duplicate reruns, or unbound local state
  - Mitigation: typed producer artifacts only, explicit dedupe keys, denominator guards, and join-integrity checks

- **Migration gaps**
  - Risk: upgraded repos or older contracts lack `contextIntegrityPolicy`
  - Mitigation: bootstrap-aware validator behavior plus `init --update` scaffolding in the same slice

- **Docs and behavior drift**
  - Risk: operator docs update before command/report behavior is final
  - Mitigation: push docs updates to Phase 6 only after vocabulary and artifact paths are stable

### Likely blockers to surface early

- any ambiguity in the existing run-record artifact-ref types that prevents reuse
- unexpected coupling between `docs-gate` and current `docsGatePolicy` validator assumptions
- missing test seams for path-scoped instruction stacks
- repo validation failures unrelated to this plan or future implementation slice

## Test and Validation Strategy

### Phase-targeted validation

- contract and type tests for `contextIntegrityPolicy`, retrieval metadata, and artifact-ref families
- indexing tests for source discovery, path safety, and source-inventory artifact emission
- retrieval tests for authority/staleness ranking and degraded warnings
- `docs-gate` tests for contradiction categories, source-of-truth mapping, stable `finding_id`, and contradiction-history transitions
- `context-health` tests for:
  - current-checkout mode
  - recent-artifacts mode
  - insufficient-evidence windows
  - join-integrity failures
  - null-vs-zero semantics

### End-to-end validation

- command-level integration tests proving:
  - `index-context` -> retrieval artifact flow
  - `docs-gate` -> contradiction-history flow
  - persisted artifact family -> `context-health` scorecard flow
- upgrade/idempotency tests for `init --update`
- regression coverage that existing JSON consumers of `context`, `search`, and `docs-gate` still receive their required fields

### Manual and operational verification

- verify shadow-mode runs produce the expected artifact family without changing merge outcomes
- verify downgrade-path steps reconcile contract posture and workflow posture together rather than in isolation
- verify rollout evidence packets identify:
  - the measurement window used
  - the artifact set used
  - any insufficient-evidence metrics
  - any join-integrity or truth-loading regressions

### Full repo gates for implementation closure

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm audit`
- `pnpm check`
- `pnpm test:deep`

### Documentation-plan validation for this planning artifact

- `pnpm markdownlint docs/plans/2026-03-11-feat-context-integrity-control-plane-plan.md`

## Rollout / Migration / Monitoring

### Rollout posture

- start in `shadow` for harness-repo tuning
- promote to `advisory` only after contradiction categories, producer artifacts, and `context-health` reports are stable
- do not promote `context-health` itself into merge-authoritative behavior in v1
- any contradiction-driven merge posture remains capped by `docsGatePolicy.mode`

### Promotion and demotion readiness

- treat rollout evidence as a separate readiness lane after implementation-complete validation
- use the spec-owned promotion bar before stronger contradiction posture:
  - at least `30` evaluated harness PRs across `7` consecutive days
  - false-positive rate below `5%` for promoted contradiction categories
  - no unresolved truth-loading or join-integrity regressions
  - verified downgrade path back to `advisory`
  - recorded maintainer sign-off
- preserve the spec-owned demotion triggers as first-class monitoring inputs:
  - verified false-positive blocking events
  - unresolved protected-truth loading regressions
  - repeated required-input join-integrity failures
  - contradiction-category churn that makes decision-consistency untrustworthy

### Migration posture

- `contextIntegrityPolicy` is introduced as a backward-compatible contract extension
- older repos without that surface continue to support existing commands, but cannot claim full context-integrity behavior
- `init --update` must be the supported upgrade path for downstream repos adopting this lane

### Monitoring and operator evidence

- track:
  - authoritative coverage rate
  - contradiction counts by category
  - degraded retrieval rate
  - insufficient-evidence rate
  - join-integrity failure count
  - decision-consistency proxy
- preserve audit-friendly artifacts for:
  - source inventory
  - retrieval evaluations
  - contradiction history
  - stale-doc snapshots
  - memory snapshots
  - `context-health` reports
- use the existing advisory-first rollout style from `docs-gate` and provider-neutral control-plane work when preparing promotion or demotion evidence

## Acceptance Checklist

- [x] `contextIntegrityPolicy` is typed, validated, defaulted, and bootstrap-safe. Refs: `src/lib/contract/types.ts`, `src/lib/contract/validator.ts`, `src/commands/init.ts`, `src/commands/init.test.ts`
- [x] retrieval discovery covers the authoritative source inventory named in the spec. Refs: `src/lib/context-integrity/sources.ts`, `src/commands/index-context.ts`, `src/commands/context-integrity-acceptance.test.ts`
- [x] `context` and `search` expose authority-aware additive metadata without breaking existing required fields. Refs: `src/lib/context-compound/types.ts`, `src/lib/context-compound/lexical-fallback.ts`, `src/commands/context.ts`, `src/commands/search.ts`, `src/commands/context-integrity-acceptance.test.ts`
- [x] `docs-gate` emits real contradiction findings, non-placeholder contradiction counts, and contradiction-history records. Refs: `src/commands/docs-gate.ts`, `src/commands/docs-gate.test.ts`, `artifacts/context-integrity/contradiction-history.jsonl`
- [x] `context-health` computes scorecards only from persisted typed producer artifacts. Refs: `src/commands/context-health.ts`, `src/commands/context-health.test.ts`
- [x] measurement-window, dedupe, and denominator rules are covered by automated tests. Refs: `src/commands/context-integrity-acceptance.test.ts`, `src/commands/context-health.test.ts`
- [x] join-integrity failures degrade or block explicitly rather than being silently ignored. Refs: `src/lib/pilot-evaluation/control-plane.ts`, `src/lib/pilot-evaluation/control-plane.test.ts`
- [x] `init --update` can scaffold or migrate `contextIntegrityPolicy` safely. Refs: `src/commands/init.ts`, `src/commands/init.test.ts`, `harness.contract.json`
- [x] operator docs and rollout guidance describe the shipped behavior accurately. Refs: `docs/agents/04-validation.md`, `docs/agents/08-release-and-change-control.md`, `docs/agents/14-docs-gate-rollout.md`, `docs/agents/15-context-integrity-compact.md`, `FORJAMIE.md`
- [x] downgrade and demotion controls are verified before any promotion decision. Refs: `src/lib/pilot-evaluation/control-plane.test.ts`, `docs/agents/08-release-and-change-control.md`
- [x] the implementation passes targeted tests plus the full validation bundle. Refs: `pnpm test src/commands/docs-gate.test.ts src/commands/context-health.test.ts src/commands/context-integrity-acceptance.test.ts src/lib/pilot-evaluation/control-plane.test.ts src/commands/init.test.ts`, `pnpm test:deep`

## Sources & References

- [2026-03-11-feat-context-integrity-control-plane-spec.md](../specs/2026-03-11-feat-context-integrity-control-plane-spec.md)
- [2026-03-11-context-integrity-control-plane-brainstorm.md](../brainstorms/2026-03-11-context-integrity-control-plane-brainstorm.md)
- [2026-03-10-feat-docs-gate-governance-parity-plan.md](./2026-03-10-feat-docs-gate-governance-parity-plan.md)
- [2026-02-24-context-compound-implementation-plan.md](./2026-02-24-context-compound-implementation-plan.md)
- [docs/agents/00-architecture-bootstrap.md](../agents/00-architecture-bootstrap.md)
- [docs/agents/04-validation.md](../agents/04-validation.md)
- [docs/agents/05-contradictions-and-cleanup.md](../agents/05-contradictions-and-cleanup.md)
- [docs/agents/14-docs-gate-rollout.md](../agents/14-docs-gate-rollout.md)
- [.github/workflows/pr-pipeline.yml](/Users/jamiecraik/dev/coding-harness/.github/workflows/pr-pipeline.yml)
- [src/commands/index-context.ts](/Users/jamiecraik/dev/coding-harness/src/commands/index-context.ts)
- [src/commands/context.ts](/Users/jamiecraik/dev/coding-harness/src/commands/context.ts)
- [src/commands/search.ts](/Users/jamiecraik/dev/coding-harness/src/commands/search.ts)
- [src/commands/docs-gate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/docs-gate.ts)
- [src/lib/context-compound/types.ts](/Users/jamiecraik/dev/coding-harness/src/lib/context-compound/types.ts)
- [src/lib/gardener/stale-detector.ts](/Users/jamiecraik/dev/coding-harness/src/lib/gardener/stale-detector.ts)
- [src/lib/contract/run-records.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/run-records.ts)
- [src/lib/pilot-evaluation/metrics-capture.ts](/Users/jamiecraik/dev/coding-harness/src/lib/pilot-evaluation/metrics-capture.ts)
- [src/lib/pilot-evaluation/control-plane.ts](/Users/jamiecraik/dev/coding-harness/src/lib/pilot-evaluation/control-plane.ts)
