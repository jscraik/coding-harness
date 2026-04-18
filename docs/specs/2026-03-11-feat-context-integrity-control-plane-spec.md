---
title: Context Integrity Control Plane
type: feat
status: draft
date: 2026-03-11
origin: docs/brainstorms/2026-03-11-context-integrity-control-plane-brainstorm.md
risk: medium
spec_depth: full
last_validated: 2026-04-18
---

# Context Integrity Control Plane

## Table of Contents

- [Enhancement Summary](#enhancement-summary)
- [Problem Statement](#problem-statement)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [System Boundary](#system-boundary)
- [Core Domain Model](#core-domain-model)
- [Main Flow / Lifecycle](#main-flow--lifecycle)
- [Interfaces and Dependencies](#interfaces-and-dependencies)
- [Invariants / Safety Requirements](#invariants--safety-requirements)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Observability](#observability)
- [Acceptance and Test Matrix](#acceptance-and-test-matrix)
- [Open Questions](#open-questions)
- [Definition of Done](#definition-of-done)

## Enhancement Summary

**Deepened on:** 2026-03-11  
**Key areas improved:** authority-aware retrieval, contradiction classification, context-health report semantics, measurement-window discipline, fail-soft scoring, and additive integration with existing harness commands.

- Defines a focused context-integrity layer for `coding-harness` that makes canonical repo guidance retrievable, machine-checkable for contradiction, and observable over time.
- Extends the current context-compound feature from a brainstorm/plan search utility into a broader authoritative retrieval surface that can rank governed documents ahead of supporting notes.
- Makes contradiction handling a runtime concern for governed surfaces instead of a documentation-only workflow.
- Introduces a dedicated context-health scorecard so maintainers can observe whether agent context quality is improving across repeated runs.
- Defines explicit report-envelope, measurement-window, and denominator-guard rules so health telemetry stays machine-legible and does not drift into hand-tuned interpretation.
- Reuses existing harness shapes where possible: additive command surfaces, machine-readable artifacts, advisory-first rollout, and fail-soft telemetry that never replaces primary command outcomes.

This spec is a behavior contract, not an implementation plan.

## Problem Statement

`coding-harness` already has the components of a context-aware control plane, but they currently operate as separate lanes rather than one trusted system:

1. context retrieval exists through `index-context`, `context`, and `search`, but the indexed corpus omits several of the repo's most authoritative guidance surfaces;
2. contradiction handling exists as governance intent in docs and specs, but contradiction findings are not yet fully emitted as machine-readable runtime outcomes for the key governed surfaces;
3. memory and rollout metrics exist, but they do not yet provide a compact answer to whether the code factory is reducing repeated lookup, stale context exposure, and cross-session inconsistency.

This creates three operational problems:

- an agent can search successfully and still miss the most authoritative document for the topic,
- a governed mismatch can exist in the repo without being reflected as a first-class contradiction signal,
- maintainers cannot easily tell whether the context system is compounding value or only accumulating more artifacts.

The repository therefore needs a focused context-integrity layer that answers:

1. Which sources are authoritative, retrievable, and rank-preferred for a given query?
2. Which contradiction classes matter for governed behavior, and how are they surfaced?
3. Which context-health metrics are stable enough to guide rollout and tuning decisions?

## Goals

1. Expand context indexing and retrieval so canonical repo guidance is part of the retrievable corpus rather than a manual-only lookup path.
2. Introduce explicit authority metadata that allows retrieval results to prefer canonical sources over supporting notes when relevance is otherwise similar.
3. Detect contradiction conditions across high-value governed surfaces and emit machine-readable findings instead of placeholder zero-state reporting.
4. Add a dedicated context-health scorecard that summarizes retrieval integrity and contradiction hygiene without overloading merge-critical commands.
5. Preserve the staged retrieval contract already documented in the repo: `search` keeps its existing lexical, semantic, and hybrid behavior, while `context` and `index-context` only use degraded lexical fallback when the existing CP4b gate is explicitly enabled.
6. Keep merge-authoritative behavior grounded in existing governance commands rather than inventing a second merge policy engine.
7. Make the feature additive and repo-local first, with a clear path for downstream adoption if the harness repo proves the pattern.

## Non-Goals

1. Building a company-wide knowledge graph, meeting-mining system, or general organizational memory platform.
2. Renaming the documentation corpus into claim-style or graph-native note structures as part of this milestone.
3. Solving contradiction detection for all prose in the repository; v1 is limited to governed, high-value surfaces.
4. Replacing `docs-gate`, `memory-gate`, or `search` with a new orchestration engine.
5. Making context-health metrics directly merge-authoritative in v1.
6. Requiring a specific model vendor, hosted embedding provider, or online service.
7. Auto-writing durable memory from every session without an explicit policy contract.

## System Boundary

### Owns

- The authority-aware retrieval contract for indexed context sources.
- The governed contradiction model and contradiction artifact fields for in-scope surfaces.
- The dedicated context-health artifact and scorecard semantics.
- Ranking and normalization rules that distinguish authoritative sources from supporting notes.
- The repo-local `contextIntegrityPolicy` contract surface that owns contradiction catalog definitions, rollout posture, and health-sampling defaults for this lane.
- Additive command behavior for the commands that participate in the feature:
  - `index-context`
  - `context`
  - `search`
  - `docs-gate`
  - a new `context-health` scorecard command
- Repo-local rollout posture for contradiction and scorecard behavior, while reusing `docsGatePolicy` for existing merge-authoritative governance posture.

### Does Not Own

- General documentation formatting or content quality outside the scoped governed surfaces.
- Global repo merge policy outside the existing governance commands and CI checks.
- Rich note-authoring workflows, transcript ingestion, or external knowledge systems.
- Automatic resolution of contradictions; v1 owns detection and reporting, not autonomous correction.
- Full durable memory authoring policy; this feature consumes memory signals where useful but does not redefine memory governance.

### Relationship to Existing Commands and Specs

- `index-context`, `context`, and `search` remain the retrieval entry points.
- `docs-gate` remains the merge-authoritative governance-drift command for documentation parity.
- `memory-gate` remains the validator for memory discipline and closeout workflow.
- The context-integrity feature adds a dedicated `context-health` scorecard layer rather than turning `memory-gate` into a general operational dashboard.
- [Docs Gate for Governance Parity](./2026-03-10-feat-docs-gate-governance-parity-spec.md) remains the authority for documentation-parity ownership and merge-critical policy posture.
- This spec adds a separate `contextIntegrityPolicy` contract surface in `harness.contract.json` for contradiction rule catalogs, source-of-truth mappings, health sampling, and rollout posture.
- `docsGatePolicy.mode` continues to bound merge-authoritative docs-gate behavior; `contextIntegrityPolicy.mode` cannot promote contradiction handling beyond what `docsGatePolicy` already allows.

### Trust Boundaries

- **Canonical repo guidance:** root docs, governance docs, ADRs, specs, and architecture context packs are trusted only according to explicit authority metadata and source-of-truth rules.
- **Supporting notes:** brainstorms, plans, and future solution notes are useful retrieval inputs but must not outrank canonical sources by default when both are relevant.
- **Generated or derived artifacts:** health reports, lexical indexes, and contradiction summaries are derived outputs and must always reference the source files they summarize.
- **Degraded retrieval backends:** semantic unavailability is tolerated, but the system must disclose degraded mode rather than pretending semantic ranking occurred.

## Core Domain Model

### 1) ContextSource

Normalized record for any file that participates in retrieval.

Required fields:

- `source_id`
- `path`
- `kind` (`governance_doc|root_doc|architecture_context|adr|spec|brainstorm|plan|solution`)
- `authority` (`canonical|governed|supporting`)
- `status`
- `topic`
- `date`
- `indexed_at`
- `content_hash`
- optional `last_validated`
- optional `source_of_truth_reason`

Normative v1 source classes:

- `canonical`
  - `README.md`
  - `CONTRIBUTING.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `AI/context/diagram-context.md`
- `governed`
  - `docs/agents/*`
  - `docs/adr/*`
  - `docs/specs/*`
- `supporting`
  - `docs/brainstorms/*`
  - `docs/plans/*`
  - `docs/solutions/*`

Normative rule:

- A `canonical` source must never be ranked below a `supporting` source when both match the command's configured minimum threshold and the canonical source is not stale or invalid.
- Source discovery must remain repo-root-scoped; files outside the current repository root, symlink escapes, or unvalidated paths are ineligible even if they match a configured pattern.

Normative v1 authoritative source inventory:

| Source family | Presence policy | Counts in coverage denominator | Absence behavior |
|---------------|-----------------|-------------------------------|------------------|
| `README.md` | required | always | warning plus coverage miss |
| `AGENTS.md` | required | always | warning plus coverage miss |
| `CONTRIBUTING.md` | conditional on contributor-workflow policy being enabled | when active | warning plus coverage miss when active |
| `CLAUDE.md` | conditional on repo shipping Claude-facing guidance | when active | warning plus coverage miss when active |
| `AI/context/diagram-context.md` | conditional on architecture-artifact bootstrap being enabled | when active | warning plus coverage miss when active |
| `docs/agents/*` | conditional on root guidance routing to repo-local agent docs | active files only | warning when routed file missing |
| `docs/adr/*` | optional corpus family | discovered files only | no direct warning when directory absent |
| `docs/specs/*` | optional corpus family | discovered files only | no direct warning when directory absent |

### 2) AuthorityDescriptor

Metadata used to rank and explain retrieval results.

Required fields:

- `authority`
- `authority_rank`
- `source_reason`
- `governed_by`
- `staleness_state` (`fresh|stale|unknown`)

Normative v1 ranking order:

1. `canonical`
2. `governed`
3. `supporting`

Normative v1 staleness behavior:

- `fresh` may receive full ranking weight.
- `unknown` may rank, but must be labeled.
- `stale` may still appear for transparency, but must not outrank a non-stale source of equal or greater authority.
- Staleness derivation by source class:
  - markdown docs with `last_validated` reuse the existing stale-detector semantics,
  - markdown docs with missing or invalid `last_validated` are treated as `stale`,
  - canonical files that do not carry freshness frontmatter default to `unknown` unless a later contract defines a stronger freshness signal.
- `unknown` must not be counted inside `stale_authoritative_source_count`; v1 surfaces it separately as an explicit coverage/freshness gap rather than treating it as stale evidence.

### 3) ContradictionFinding

Machine-readable contradiction record for governed surfaces.

Required fields:

- `finding_id`
- `category`
- `severity`
- `source_paths[]`
- `source_of_truth`
- `message`
- `normalization_rule`
- `status` (`open|resolved|not_applicable`)

Minimum v1 contradiction categories:

- `command_contract_conflict`
- `required_check_conflict`
- `instruction_precedence_conflict`
- `workflow_policy_conflict`
- `source_truth_missing`

Normative rule:

- A contradiction finding must always name at least two conflicting surfaces or one governed surface plus one missing/expected source-of-truth surface.
- Contradiction findings are rule-level records, not terminal command outcomes by themselves. Terminal command outcome remains owned by the command that evaluated them.
- Category-to-outcome mapping in v1:
  - contradictory contributor-facing guidance against a successfully loaded protected truth source -> `drift_detected`
  - contradictory protected truth sources or protected truth that cannot be loaded after bounded retry -> `trust_mismatch`
  - contradiction rule declared by policy but missing a required source-of-truth definition or normalizer -> `policy_error`

Normative v1 persistence and state model:

- Contradiction findings are emitted in the current `docs-gate` report and normalized into an append-only ledger at `artifacts/context-integrity/contradiction-history.jsonl`.
- `finding_id` must be stable across runs for the same normalized contradiction and should be derived from:
  - contradiction category,
  - normalized statement key,
  - effective target path scope,
  - sorted source paths,
  - source-of-truth reference when present.
- State transitions:
  - `open` when the contradiction is present in the current eligible evaluation,
  - `resolved` when a later eligible evaluation for the same `finding_id` proves the surfaces are back in parity,
  - `not_applicable` when policy, repo profile, or source inventory no longer places the statement in scope.
- `contradiction_open_count`, false-positive rate, contradiction-resolution lead time, and rollout demotion logic must read from the ledger or a deterministic projection of it rather than recounting ad hoc current-run findings only.

### 4) ContextIntegrityPolicy

Typed contract surface that owns contradiction-policy definition and rollout posture for this feature lane.

Required fields:

- `enabled`
- `mode` (`shadow|advisory|required`)
- `ruleCatalog[]`
- `truthSources[]`
- `healthSampling`

Normative mode ordering:

- `shadow < advisory < required`

Each `ruleCatalog[]` entry must include:

- `ruleId`
- `docsGateRuleIds[]`
- `category`
- `statement_key`
- `normalizer`
- `truth_source_ids[]`
- `severity`
- `counts_as_contradiction`

Required `healthSampling` fields:

- `fixtureSetPath`
- `fixtureSetId`
- `allowedTriggers[]`
- `maxEvaluationsPerWindow`
- `dedupeScope`

Normative rules:

- The canonical storage location is `harness.contract.json#contextIntegrityPolicy`.
- `docs-gate` owns evaluation and terminal posture for contradiction findings, but it must load contradiction definitions, truth-source mappings, and severities from `contextIntegrityPolicy` rather than from hardcoded local comparators only.
- `contextIntegrityPolicy.mode` is the authoritative rollout posture for contradiction and `context-health` behavior in this lane.
- `docsGatePolicy.mode` remains the authoritative ceiling for merge-authoritative enforcement. If the two policy surfaces differ, the stricter posture for merge behavior is the lower of the two modes; `contextIntegrityPolicy` cannot force required-mode blocking while `docsGatePolicy.mode` remains `advisory`.
- `context-health` is read-only telemetry in v1. It may emit recommended promotion or demotion signals, but it must not mutate `harness.contract.json` or any rollout mode by itself.
- Rollout posture changes must occur through an explicit maintainer-owned contract edit or equivalent `init --update` contract migration path that updates `harness.contract.json` and any coupled workflow wiring together.
- The feature introduces `contextIntegrityPolicy` as a backward-compatible contract-schema extension in the next minor contract version that carries this lane.
- If context-integrity behavior is enabled but `contextIntegrityPolicy` is missing:
  - harness repo required-mode workflows treat it as `policy_error`,
  - downstream advisory or bootstrap repos emit `bootstrap_gap`,
  - downstream required-mode repos fail closed with `bootstrap_gap`.
- `init --update` must scaffold `contextIntegrityPolicy` defaults and any coupled workflow or docs wiring in the same change that enables this feature surface.
- Repos on older contract versions remain supported for existing commands, but contradiction enforcement and `context-health` cannot claim full contract-backed behavior until `contextIntegrityPolicy` is present.
- `healthSampling.fixtureSetPath` is the canonical repository-local source for governed retrieval queries that may count toward retrieval-rate metrics.
- `healthSampling.fixtureSetId` identifies the versioned sampling set used to compute eligible retrieval evaluations.
- `healthSampling.allowedTriggers[]` defines which trigger classes may contribute to metric denominators, and ad hoc operator queries remain ineligible unless explicitly listed there.
- `healthSampling.maxEvaluationsPerWindow` bounds how many eligible retrieval evaluations may be counted from one window.
- `healthSampling.dedupeScope` defines the stable scope used to collapse reruns of the same governed sampling evaluation.

### 5) ContextHealthSnapshot

Advisory health artifact that summarizes the state of the context-integrity system.

Required fields:

- `generated_at`
- `repo_root`
- `retrieval_summary`
- `contradiction_summary`
- `memory_summary`
- `scorecard`
- `artifactRefs[]`

Artifact reference contract:

- `artifactRefs[]` must use the repo-standard typed artifact-ref shape: `{ type, path, checksum }`.
- Input requiredness, compatibility posture, and producer-family semantics must be carried by the surrounding input family definition, not by inventing a second artifact-ref schema in this spec.

Required scorecard metrics:

- `authoritative_coverage_rate`
- `contradiction_open_count`
- `stale_authoritative_source_count`
- `unknown_authoritative_source_count`
- `degraded_retrieval_rate`
- `memory_unresolved_question_count`
- `decision_consistency_proxy`

Normative v1 decision-consistency proxy:

- Defined as the rate at which governed evaluations across the measurement window produce stable category-level outcomes for the same policy surface rather than alternating between contradictory interpretations.
- It is a proxy signal, not a semantic guarantee of model behavior.
- Any derived rate metric in the scorecard must retain:
  - metric name,
  - `value`
  - `numerator`
  - `denominator`
  - `insufficient_evidence`
- `insufficient_evidence=true` must be used when the measurement window is too small or degraded to support an operator-trustworthy percentage.
- Normative v1 metric definitions:
  - `authoritative_coverage_rate = indexed authoritative sources / discovered authoritative sources`
  - `degraded_retrieval_rate = degraded retrieval evaluations / eligible retrieval evaluations`
  - `decision_consistency_proxy = repeated governed evaluations with stable category outcomes / eligible repeated governed evaluations for the same surface`
- Normative v1 minimum-sample rules:
  - `authoritative_coverage_rate` requires `denominator >= 1`; otherwise `value = null` and `insufficient_evidence = true`
  - `degraded_retrieval_rate` requires `denominator >= 10`; otherwise `value = null` and `insufficient_evidence = true`
  - `decision_consistency_proxy` requires `denominator >= 10`; otherwise `value = null` and `insufficient_evidence = true`

### 6) ContextHealthReport

Top-level machine-readable artifact emitted by `context-health`.

Normative persistence rule:

- `ContextHealthReport` is the only canonical persisted v1 artifact at `artifacts/context-integrity/context-health-report.json`.
- `ContextHealthSnapshot` is a logical substructure inside the report that summarizes scorecard-ready state; it is not written as a second standalone file in v1 unless a later contract explicitly promotes it.

Required fields:

- `schemaVersion`
- `compatibilityMajor`
- `producerVersion`
- `command`
- `status` (`success|partial|blocked`)
- `outcome` (`ok|degraded|runtime_error|policy_error`)
- `generated_at`
- `repo_root`
- `rollout_posture`
- `measurement_window`
- `inputs`
- `summary`
- `scorecard`
- `artifactRefs[]`
- optional `warnings[]`

Required `measurement_window` fields:

- `mode` (`current_checkout|recent_artifacts`)
- `evaluated_at`
- `lookback_runs`
- `lookback_days`
- `eligible_evaluations`

Required `inputs` fields:

- `indexArtifacts[]`
- `contradictionHistoryArtifacts[]`
- `retrievalArtifacts[]`
- `docsGateArtifacts[]`
- `memoryMetricSnapshots[]`
- `staleDocArtifacts[]`
- `degradedInputs[]`

Normative v1 producer artifact contracts:

- Index and source-inventory producer artifacts must persist the discovery set needed for authoritative coverage metrics:
  - `index-context` emits `artifacts/context-integrity/index-source-inventory.json`
  - eligible runs bind that artifact through `artifactRefs` entries of type `context_index_inventory`
- Retrieval producer artifacts must be persisted, machine-readable reports rather than ad hoc command output or live DB inspection:
  - governed `context` sampling runs emit `artifacts/context-integrity/retrieval-evals/context-<runId>.json`
  - governed `search` sampling runs emit `artifacts/context-integrity/retrieval-evals/search-<runId>.json`
  - canonical run manifests must reference those files through `artifactRefs` entries of type `context_retrieval_report` or `search_retrieval_report`
- `docs-gate` producer artifacts remain the canonical reports under `artifacts/consistency-gate/docs-gate-report.json`, and eligible runs must bind them through manifest `artifactRefs` entries of type `docs_gate_report`
- contradiction-history input remains the append-only ledger at `artifacts/context-integrity/contradiction-history.jsonl`, referenced through `artifactRefs` type `context_integrity_contradiction_history`
- stale-doc input must come from a persisted report at `artifacts/context-integrity/stale-doc-report.json`, referenced through `artifactRefs` type `stale_doc_report`
- memory input must come from a persisted snapshot at `artifacts/context-integrity/memory-metrics-snapshot.json`, referenced through `artifactRefs` type `memory_metrics_snapshot`; `context-health` may materialize that snapshot from `.memory-metrics.json` for the current checkout, but recent-artifact mode must consume the persisted snapshot artifact rather than reading historical repo state directly

Normative rules:

- `context-health` must emit one top-level report envelope even when one or more upstream inputs are degraded.
- `status=partial` is reserved for cases where the report is structurally valid but one or more required inputs are missing, degraded, or stale.
- `status=blocked` is reserved for contract-level problems that prevent a trustworthy scorecard, such as invalid measurement-window configuration or unreadable required artifacts in strict mode.
- `schemaVersion`, `compatibilityMajor`, and `producerVersion` should follow the existing control-plane artifact style rather than introducing a third versioning scheme.
- In `current_checkout` mode, each array may contain a single artifact snapshot.
- In `recent_artifacts` mode, arrays may contain multiple eligible artifacts and must be bounded by the declared measurement window.
- If a metric depends on a producer artifact family that has no persisted artifacts for the window, that metric must be `null` with `insufficient_evidence=true`; the report must not invent a single-artifact substitute.
- `context-health` must calculate scorecards from persisted producer artifacts plus the contradiction ledger; it must not mix in unbound local filesystem reads, vector-store state, or transient command stdout as if they were equivalent historical evidence.
- Metric-to-input mapping in v1:
  - `authoritative_coverage_rate` reads from `indexArtifacts[]`
  - `contradiction_open_count` reads from `contradictionHistoryArtifacts[]`
  - `stale_authoritative_source_count` reads from `staleDocArtifacts[]` plus the authoritative source inventory declared by `indexArtifacts[]`
  - `unknown_authoritative_source_count` reads from `indexArtifacts[]`
  - `degraded_retrieval_rate` reads from `retrievalArtifacts[]` using the governed sampling rules in `contextIntegrityPolicy.healthSampling`
  - `memory_unresolved_question_count` reads from `memoryMetricSnapshots[]`
  - `decision_consistency_proxy` reads from `contradictionHistoryArtifacts[]` and eligible contradiction evaluations bound through `docsGateArtifacts[]`

### 7) ContextHealthEvaluation

Normalized evaluation record used to compute scorecard denominators and dedupe repeated runs.

Required fields:

- `evaluation_id`
- `evaluation_type` (`retrieval|contradiction|memory|staleness`)
- `source_artifact_ref`
- `repo_root`
- `scope_key`
- `dedupe_key`
- `trigger`
- `evaluated_at`
- `eligible`

Normative v1 dedupe rules:

- Windowed metrics count the latest eligible evaluation per `dedupe_key`.
- `dedupe_key` should collapse identical reruns of the same logical evaluation, using a stable combination of command/report type, repo root, effective scope, and source artifact identity.
- Ad hoc retrieval queries do not count toward rate metrics unless they come from the explicit governed health-sampling workflow or fixture set defined by `contextIntegrityPolicy.healthSampling`.
- CI reruns or local retries over the same artifact set must not multiply denominators.

### 8) RetrievalOutcome

Result contract returned by `context` and `search`.

Required fields:

- `query`
- `mode`
- `count`
- `results[]`
- optional `warnings[]`

Each result must include:

- `path`
- `score`
- `source`
- `authority`
- `staleness_state`
- optional `metadata`
- optional `authority_reason`

Normative rule:

- Retrieval results must disclose whether the answer came from lexical, semantic, or degraded fallback pathways.
- Warning enums in v1 should be stable and machine-readable:
  - `semantic_backend_unavailable`
  - `lexical_fallback_used`
  - `authoritative_source_missing`
  - `stale_authoritative_result`
  - `measurement_scope_limited`

## Main Flow / Lifecycle

### 1) Indexing lifecycle

1. Operator or automation runs `index-context`.
2. Command discovers in-scope source paths.
3. Each source is normalized into a `ContextSource` with an `AuthorityDescriptor`.
4. Indexing stores semantic records when the backend is available.
5. If the semantic backend is unavailable and degraded lexical indexing is enabled through the existing CP4b gate, the command writes a degraded lexical index artifact.
6. If the semantic backend is unavailable and degraded lexical indexing is not enabled, `index-context` retains explicit-fail behavior rather than silently changing retrieval posture.
7. Output reports which sources were indexed, skipped, or degraded.
8. Re-index decisions are based on source discovery plus `content_hash`; unchanged sources may be skipped, but changed authority metadata must invalidate prior index entries for that source.

Normative v1 indexing scope:

- `docs/brainstorms`
- `docs/plans`
- `docs/solutions`
- `docs/adr`
- `docs/specs`
- `docs/agents`
- `README.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `CLAUDE.md`
- `AI/context/diagram-context.md`

### 2) Retrieval lifecycle

1. Operator or agent runs `context` or `search`.
2. Query executes in semantic, lexical, or hybrid mode.
3. Result ranking is adjusted by authority and staleness rules.
4. Returned results expose authority metadata and degraded-mode warnings where applicable.
5. Retrieval outcome may be consumed by humans, future automation, or scorecard sampling.
6. `search` continues to support lexical, semantic, and hybrid execution as its canonical interface.
7. `context` keeps its existing explicit-fail default when semantic retrieval is unavailable unless the CP4b lexical-fallback gate is explicitly enabled for that run or environment.
8. If two results remain tied after similarity scoring, v1 tie-breaking order is:
   - higher authority,
   - fresher staleness state,
   - fixed source-family priority order (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `AI/context/diagram-context.md`, `docs/agents/*`, `docs/adr/*`, `docs/specs/*`, `docs/brainstorms/*`, `docs/plans/*`, `docs/solutions/*`),
   - stable path sort for deterministic JSON output.

Normative v1 retrieval policy:

- `search` remains the general hybrid search interface.
- `context` remains the narrower context-compound retrieval interface.
- Both must expose source authority in machine-readable output.
- This feature does not independently promote CP4b degraded fallback to a universal baseline for `context` or `index-context`; any broader fallback promotion must come from the retrieval-substrate contract that already owns that decision.

### 3) Contradiction evaluation lifecycle

1. `docs-gate` evaluates governed surfaces for the current change context.
2. Existing required-surface and parity logic runs first.
3. Trusted truth sources are loaded according to existing docs-gate posture, trigger context, and `contextIntegrityPolicy.truthSources`.
4. Contradiction validators run for scoped contradiction categories using the evaluation unit `target path + applicable instruction stack + normalized governed statement`.
5. Findings are normalized into `ContradictionFinding` records.
6. Each finding is mapped into `drift_detected`, `trust_mismatch`, or `policy_error` according to the category-to-outcome rules defined above.
7. `docs-gate` report summary includes non-placeholder contradiction counts and categorized findings.
8. Eligible findings are appended to the contradiction-history ledger with the rollout posture read from `contextIntegrityPolicy.mode`.

Normative v1 contradiction scope:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `CONTRIBUTING.md`
- `package.json` script truth
- required-check and workflow-governance surfaces already modeled by `docs-gate` policy

Normative v1 mapping from existing `docs-gate` behavior:

| Existing rule/surface shape | `ContradictionFinding.category` | Increments `contradiction_count` | Default outcome contribution |
|----------------------------|----------------------------------|----------------------------------|------------------------------|
| contributor-facing command docs disagree with script or CLI truth | `command_contract_conflict` | yes | `drift_detected` |
| required-check guidance disagrees with protected workflow or contract truth | `required_check_conflict` | yes | `drift_detected` when protected truth loads, `trust_mismatch` when protected truth conflicts or cannot load |
| `AGENTS.md` versus `CLAUDE.md` or equivalent governed instruction-surface precedence mismatch | `instruction_precedence_conflict` | yes | `drift_detected` when source of truth is available |
| workflow-governance prose disagrees with protected workflow truth | `workflow_policy_conflict` | yes | `drift_detected` when protected truth loads, `trust_mismatch` when protected truth conflicts or cannot load |
| governed statement expected by policy lacks a source-of-truth definition, normalizer, or loadable source ref | `source_truth_missing` | yes | `policy_error` |
| `docs.gate.unknown_governance_change` or unmatched governance-sensitive change without a contradiction comparator | no contradiction category in v1 | no | `drift_detected` only |

Normative implementation rule:

- `contradiction_count` counts only findings normalized into one of the five contradiction categories above.
- `unknown_governance_change` remains a governed drift signal, but it is not treated as a contradiction unless a later rule adds an explicit comparator.
- Path-scoped instruction precedence rule:
  - a lower-scope instruction file may validly override a higher-scope one for a target path when the discovery stack makes that override effective,
  - differences across instruction surfaces become contradictions only when the same normalized statement applies to the same target-path scope after precedence resolution.

### 4) Context-health lifecycle

1. Operator or automation runs `context-health`.
2. Command resolves a measurement window from either current-checkout artifacts or recent repository-local artifacts.
3. Command resolves persisted producer artifacts and contradiction ledger entries through canonical typed `artifactRefs` plus the declared canonical file paths above.
4. In `current_checkout` mode, the command may first materialize required snapshot artifacts for stale-doc and memory families before scoring them, but the scorecard must still read the persisted snapshot artifacts rather than raw transient process state.
5. Command applies denominator guards so missing inputs cannot silently inflate healthy-looking rates.
6. Command normalizes eligible evaluations and collapses reruns using the dedupe rules above.
7. Command generates a `ContextHealthReport` containing the nested `ContextHealthSnapshot`.
8. Report is written to a stable artifact path and summarized for operators.
9. Snapshot remains advisory in v1 and does not change merge outcomes by itself.

Normative v1 measurement window:

- local runs may use current checkout data only,
- CI or scheduled health runs may include recent artifacts from the current repository state,
- scorecard logic must disclose the measurement scope in the artifact.
- if `eligible_evaluations = 0`, percentage metrics must be `null` plus an explanatory warning rather than `0` or `100`.
- if recent-artifact mode is used, v1 defaults should be bounded to the smaller of:
  - trailing `30` eligible evaluations, or
  - trailing `7` days of repository-local artifacts.
- recent-artifact mode is valid only for metric families whose producer artifacts are persisted and declared in the `inputs` arrays above.

### 5) Rollout posture lifecycle

1. Feature begins in `shadow` posture for repo-local tuning.
2. Retrieval expansion and scorecard emission are verified against real artifacts before any stronger contradiction posture is promoted.
3. Feature may enter `advisory` posture once contradiction findings, health artifacts, and degraded-input reporting are stable in the harness repo.
4. Only contradiction categories already owned by `docs-gate` may contribute to merge-authoritative behavior in later rollout stages.
5. `context-health` remains advisory in v1 even if contradiction signaling is later promoted.
6. The canonical posture source of truth is `harness.contract.json#contextIntegrityPolicy.mode`.
7. Only explicit maintainer-owned contract updates or equivalent `init --update` migrations may change posture; `context-health` may report demotion recommendations but cannot mutate posture itself.

Normative v1 rollout postures:

- `shadow`
  - local or CI artifact generation is allowed,
  - health artifacts and contradiction findings are collected for tuning,
  - no new merge-blocking behavior is introduced.
- `advisory`
  - harness repo emits contradiction findings and `context-health` artifacts in normal workflows,
  - findings are visible and tracked, but enforcement remains limited to already-approved `docs-gate` behavior.
- `required`
  - contradiction categories that already map through `docs-gate` may contribute to merge-authoritative outcomes,
  - `context-health` still does not block merge by itself.

Promotion criteria for v1 contradiction enforcement:

- at least `30` evaluated harness PRs across `7` consecutive days,
- false-positive rate below `5` percent for promoted contradiction categories,
- no unresolved truth-loading or join-integrity regression,
- verified downgrade path back to `advisory`,
- recorded maintainer sign-off.

Automatic demotion triggers:

- `2+` verified false-positive blocking events in `24` hours,
- unresolved protected-truth loading regression,
- repeated artifact join-integrity failure for required scorecard inputs,
- contradiction category churn that makes decision-consistency proxy untrustworthy.

## Interfaces and Dependencies

### Command interfaces

- `index-context`
  - gains broader source discovery and authority metadata output
- `context`
  - gains authority-aware result metadata
- `search`
  - gains authority-aware result metadata and ranking normalization
- `docs-gate`
  - gains contradiction-finding output for scoped categories
- `context-health`
  - new advisory command that emits a scorecard artifact
  - must support JSON output aligned to the `ContextHealthReport` envelope

### Internal modules and artifacts

- `src/commands/index-context.ts`
- `src/commands/context.ts`
- `src/commands/search.ts`
- `src/commands/docs-gate.ts`
- `src/lib/context-compound/*`
- `src/lib/cli/doc-parity.ts`
- `src/lib/memory/*`
- `src/lib/gardener/stale-detector.ts`
- `harness.contract.json`
- `AI/context/diagram-context.md`
- `.memory-metrics.json`
- `memory.json`

### External/runtime dependencies

- local filesystem access for repo documents and artifacts
- optional local Ollama backend for semantic embeddings
- ripgrep-based lexical retrieval fallback

### Artifact paths

Normative v1 artifact locations:

- context index artifacts remain under the harness directory
- governed retrieval sampling artifacts live under `artifacts/context-integrity/retrieval-evals/`
- index/source inventory artifact lives at `artifacts/context-integrity/index-source-inventory.json`
- contradiction fields remain inside the existing docs-gate report at `artifacts/consistency-gate/docs-gate-report.json`
- contradiction history lives at `artifacts/context-integrity/contradiction-history.jsonl`
- stale-doc producer artifact lives at `artifacts/context-integrity/stale-doc-report.json`
- memory metrics producer snapshot lives at `artifacts/context-integrity/memory-metrics-snapshot.json`
- new health artifacts live under `artifacts/context-integrity/context-health-report.json`
- future helper artifacts derived from the scorecard may live alongside the report, but the report path above is the canonical machine-readable entrypoint

### Compatibility decisions

- Existing consumers of `context` and `search` JSON output may receive additive fields but must not lose existing required fields.
- Existing `docs-gate` exit behavior must remain stable except where contradiction findings intentionally contribute to already-defined drift outcomes.
- If `context-health` cannot produce a scorecard, that failure must not replace the outcome of unrelated commands.
- The feature must reuse existing envelope conventions where practical (`schemaVersion`, `command`, `status`, `outcome`, `generated_at`, `summary`, typed artifact references) so downstream tooling can ingest it without bespoke parsing rules.
- New scorecard/report artifacts should follow the existing compatibility pattern (`schemaVersion`, `compatibilityMajor`, `producerVersion`) used by newer control-plane artifacts.
- `artifactRefs` in this feature must reuse the existing typed `{ type, path, checksum }` contract used by canonical run records rather than introducing a parallel reference schema.

## Invariants / Safety Requirements

1. Authority-aware retrieval must never silently treat supporting notes as the default source of truth when canonical or governed sources are available.
2. Degraded retrieval must always be disclosed.
3. Contradiction counts must reflect real evaluated findings and must not use placeholder zero values once the feature is enabled.
4. Any contradiction finding that contributes to a governed outcome must name its source surfaces.
5. Health metrics must be advisory in v1 unless a later policy explicitly promotes them.
6. Scorecard generation must not override the primary exit status of the command that produced the source artifact.
7. Missing authoritative sources must produce explicit warnings or findings, not silent omission.
8. Additive metadata changes must preserve backward-compatible machine readability for existing JSON consumers where feasible.
9. Health-score percentages must never divide by zero or silently substitute denominator guesses.
10. `context-health` must not claim repository improvement when the report is based only on degraded or incomplete inputs.
11. Contradiction rules must be deterministic for the same artifact set and evaluation mode.
12. Path discovery and artifact loading must remain within validated repository roots.
13. Every artifact reference named by `context-health` must be loadable, scoped to the declared measurement window, or explicitly called out as degraded or blocking evidence.

## Failure Model and Recovery

### Retrieval/indexing failures

- **Semantic backend unavailable**
  - Behavior: `search` keeps its existing lexical or hybrid options; `context` and `index-context` fall back to degraded lexical mode only when the CP4b gate is enabled, otherwise they retain explicit-fail behavior.
  - Recovery: operator can start the semantic backend and re-run indexing.
  - Safety rule: degraded mode must be visible in output and artifacts.

- **Authoritative source file missing**
  - Behavior: indexing records partial success and emits warnings.
  - Recovery: restore or regenerate the missing source, then re-index.
  - Safety rule: missing authoritative sources must count against health reporting.

- **Index metadata schema gap**
  - Behavior: command fails for invalid schema or marks partial success when the affected source can be skipped safely.
  - Recovery: fix schema mismatch and re-run indexing.

- **Authority metadata drift**
  - Behavior: command treats the affected source as changed and re-indexes it even when content body is unchanged.
  - Recovery: refresh the source metadata definition and re-run indexing.
  - Safety rule: stale authority assignments must not persist only because file content hash was unchanged.

### Contradiction-evaluation failures

- **Trusted truth source cannot be loaded**
  - Behavior: `docs-gate` retries within bounded limits, then emits the existing policy-driven failure posture (`trust_mismatch`, `bootstrap_gap`, or `policy_error`) rather than silently suppressing contradiction evaluation.
  - Recovery: restore trusted source loading or contract wiring before re-running.

- **Contradiction normalizer cannot compare surfaces**
  - Behavior: emit a machine-readable evaluation error tied to the affected rule.
  - Recovery: refine normalizer or narrow the rule scope.
  - Safety rule: evaluator errors must not be collapsed into "no contradiction found."

- **Protected truth sources disagree after normalization**
  - Behavior: emit `trust_mismatch` plus contradiction findings that identify both protected sources and the normalized statement class.
  - Recovery: resolve the split-brain source of truth before continuing rollout or promotion.
  - Safety rule: contributor-facing documentation must not be used to break ties between protected truth sources.

### Health-scorecard failures

- **One input artifact missing**
  - Behavior: produce a degraded scorecard if enough inputs remain to explain the gap.
  - Recovery: re-run the missing upstream command and regenerate the report.
  - Safety rule: raw command stdout, live vector-store state, or historical repo files that were not materialized into typed producer artifacts must not be substituted as hidden replacements for the missing artifact family.

- **Health report generation fails completely**
  - Behavior: `context-health` exits non-zero, but unrelated upstream command outcomes remain unchanged.
  - Recovery: fix report generation and re-run the scorecard command.

- **No eligible evaluations in measurement window**
  - Behavior: emit a structurally valid report with `null` rate fields, `status=partial`, and an explicit warning that the window is informational only.
  - Recovery: widen the window or wait for more eligible artifacts.

- **Input artifact schema version unsupported**
  - Behavior: treat the affected input as degraded if backward-compatible reading is possible; otherwise emit `policy_error` for `context-health`.
  - Recovery: upgrade readers or regenerate the artifact from a supported command version.

- **Referenced upstream artifact fails join-integrity checks**
  - Behavior: if a referenced artifact no longer loads, points to the wrong repo root, or falls outside the declared measurement window, `context-health` must degrade or block explicitly rather than silently dropping the reference.
  - Recovery: regenerate the upstream artifact set and rerun the scorecard.

- **Rollout posture disagreement**
  - Behavior: if `contextIntegrityPolicy.mode` and `docsGatePolicy.mode` disagree about enforcement posture, the stricter merge-authoritative ceiling remains the lower-permission state and the report must emit an explicit warning.
  - Recovery: reconcile the two contract surfaces through a maintainer-owned contract update or `init --update` migration.

### Memory-signal failures

- **`memory.json` missing or bootstrap-only**
  - Behavior: scorecard records limited memory signal availability instead of pretending memory quality is healthy.
  - Recovery: improve memory capture via normal repo workflows; no forced backfill is required for v1.

### Boundary and trust failures

- **Artifact path escapes repository root**
  - Behavior: reject the artifact, record a bounded loader error, and do not ingest the escaped path.
  - Recovery: repair path generation or root validation and re-run the affected command.

- **Current-checkout-only evidence used in a merge-authoritative interpretation**
  - Behavior: `context-health` may still emit an advisory report, but it must mark the scope as non-authoritative and must not be used to promote required enforcement.
  - Recovery: re-run from CI or against trusted repository-local artifacts that satisfy the measurement-window contract.

## Observability

### Required outputs

- `index-context` output must disclose:
  - indexed count,
  - skipped count,
  - errors,
  - mode,
  - authoritative source counts by class,
  - degraded sources,
  - source discovery warnings

- retrieval outputs must disclose:
  - authority level for each result,
  - staleness state for each result when known,
  - degraded-mode warnings

- `docs-gate` output must disclose:
  - contradiction counts,
  - contradiction categories,
  - affected surfaces,
  - whether contradiction findings contributed to drift detection or error posture,
  - source-of-truth references used for contradiction normalization when available

- `context-health` output must disclose:
  - effective `contextIntegrityPolicy.mode`,
  - measurement scope,
  - scorecard values,
  - degraded inputs,
  - referenced upstream artifacts,
  - denominator values for any derived rate,
  - null-versus-zero distinction for unavailable metrics

### Recommended operator-facing metrics

- authoritative source coverage by indexed corpus
- contradiction count by category
- degraded retrieval rate over the measurement window
- stale authoritative source count
- unknown authoritative source count
- unresolved question count from memory metrics
- decision-consistency proxy trend
- authoritative retrieval hit rate for governed queries
- contradiction-resolution lead time for open findings

### Artifact retention

- context-health artifacts should be kept alongside other harness artifacts so they can be compared over time.
- contradiction findings should remain embedded in existing docs-gate artifacts rather than duplicating a second contradiction artifact in v1.
- when recent-artifact mode is used, the scorecard should reference exactly which upstream artifact files contributed to the window so later audits can reproduce the calculation.
- when current-checkout mode materializes memory or stale-doc snapshots, those snapshots should be retained long enough to let operators reproduce the immediately preceding scorecard calculation.

### Rollout signals

- promotion readiness for contradiction enforcement
- automatic demotion trigger count
- join-integrity failure count for referenced artifacts
- insufficient-evidence rate for scorecard windows

## Acceptance and Test Matrix

1. **Authoritative source indexing**
   - Setup: repo contains root docs, ADRs, specs, governance docs, and architecture context packs.
   - Expectation: `index-context` discovers and indexes all scoped source classes.

2. **Authority-aware retrieval ranking**
   - Setup: query matches both a brainstorm and an authoritative governance doc.
   - Expectation: authoritative result ranks ahead of supporting note when relevance threshold is met.

3. **Degraded semantic fallback**
   - Setup: semantic backend unavailable and degraded mode enabled.
   - Expectation: retrieval succeeds in degraded mode and explicitly reports degraded status.

4. **Missing authoritative source**
   - Setup: one canonical file expected by the indexing policy is missing.
   - Expectation: indexing and/or health reporting surfaces the gap; silent success is forbidden.

5. **Command contract contradiction**
   - Setup: governed docs and script truth disagree on a command or required check.
   - Expectation: `docs-gate` emits a contradiction finding with named surfaces and non-zero contradiction count.

6. **Instruction precedence contradiction**
   - Setup: `AGENTS.md` and `CLAUDE.md` disagree on an in-scope governed rule.
   - Expectation: evaluator emits the correct contradiction category or source-truth finding according to policy.

7. **Health scorecard generation**
   - Setup: retrieval, contradiction, stale-doc, and memory inputs are available.
   - Expectation: `context-health` emits a stable machine-readable report with the required scorecard fields.

8. **Partial health input availability**
    - Setup: one upstream artifact missing.
    - Expectation: scorecard reports degraded input state rather than failing silently.

9. **Windowed input aggregation**
    - Setup: recent-artifact mode contains multiple eligible retrieval and docs-gate artifacts inside the window.
    - Expectation: the report loads arrays of upstream artifacts, dedupes reruns, and computes denominators from eligible evaluations rather than from raw file count.

10. **Exit-status preservation**
    - Setup: an upstream command produces a primary outcome and scorecard/secondary telemetry generation fails.
    - Expectation: primary command outcome remains authoritative; secondary telemetry failure is reported separately.

11. **Backward-compatible retrieval output**
    - Setup: existing consumer reads retrieval JSON output.
    - Expectation: additive authority/staleness fields do not remove previously required fields.

12. **Protected truth split-brain contradiction**
    - Setup: two protected truth sources define the same governed statement differently after normalization.
    - Expectation: contradiction finding is emitted and terminal posture is `trust_mismatch`, not plain `drift_detected`.

13. **No eligible measurement-window evaluations**
    - Setup: `context-health` runs with recent-artifact mode but finds no eligible evaluations.
    - Expectation: report is still emitted with `status=partial`, `null` rate metrics, and explicit denominator warnings.

14. **Unknown-versus-stale authoritative freshness**
    - Setup: a canonical root doc has no freshness frontmatter while another authoritative markdown doc has an invalid `last_validated` field.
    - Expectation: the root doc contributes to `unknown_authoritative_source_count`, while the invalid-frontmatter doc contributes to `stale_authoritative_source_count`.

15. **Unsupported input schema version**
    - Setup: one upstream artifact uses an unsupported schema version.
    - Expectation: `context-health` degrades or blocks according to compatibility rules and never reports a false healthy score.

16. **Instruction-stack scoped contradiction**
    - Setup: a lower-scope instruction file intentionally overrides a higher-scope instruction for one path, while another path still inherits the higher-scope statement.
    - Expectation: the valid override is not flagged as a contradiction, but the same conflicting statement on the same effective target-path scope is.

17. **Repository-root path safety**
    - Setup: an artifact reference points outside the validated repository root.
    - Expectation: loader rejects the path and records the trust/safety failure without ingesting the escaped file.

18. **Referenced-artifact join integrity**
    - Setup: `context-health` references an upstream artifact that no longer loads or falls outside the declared measurement window.
    - Expectation: report degrades or blocks explicitly and never silently recomputes as if the missing reference never existed.

19. **Contradiction lifecycle resolution**
    - Setup: a finding appears in one eligible evaluation and later disappears because the governed surfaces return to parity.
    - Expectation: the same stable `finding_id` transitions from `open` to `resolved` in the contradiction history ledger, enabling lead-time and open-count metrics.

20. **Rollout demotion trigger**
    - Setup: promoted contradiction categories produce repeated false-positive blocking or repeated join-integrity failures.
    - Expectation: rollout posture returns to `advisory` and the emitted artifact records the triggering condition and posture change.

21. **Policy-owned contradiction catalog**
    - Setup: contradiction evaluation runs with `docsGatePolicy` present but `contextIntegrityPolicy` missing required truth-source mappings.
    - Expectation: the run emits `policy_error` rather than silently evaluating with implicit defaults.

22. **Artifact-bound scorecard inputs**
    - Setup: a prior retrieval or stale-doc evaluation exists only as console output and not as a persisted typed producer artifact.
    - Expectation: `context-health` excludes it from the measurement window and records insufficient evidence rather than counting the ad hoc signal.

23. **Rollout posture source of truth**
    - Setup: `context-health` recommends demotion while `harness.contract.json#contextIntegrityPolicy.mode` still says `required`.
    - Expectation: the report records the recommendation and the mismatch, but posture remains unchanged until a maintainer-owned contract update occurs.

## Open Questions

- None that block planning.

Review clarifications resolved in this spec:

- `ContextHealthReport` is the only canonical persisted v1 health artifact; `ContextHealthSnapshot` is the logical nested summary model inside that report.
- `context-health` consumes persisted producer artifacts and the contradiction ledger, all referenced via standard typed `artifactRefs`; it does not treat ad hoc command output or live historical repo state as equivalent evidence.
- `context-health` now declares explicit producer-input families for coverage and contradiction history, so scorecard metrics no longer depend on implied sources.
- `unknown` authoritative freshness is distinct from `stale`; root canonical files without frontmatter count as `unknown` until a stronger freshness signal is defined.
- `contradiction_count` is reserved for normalized contradiction categories only; `unknown_governance_change` remains a drift signal, not a contradiction in v1.
- Derived scorecard rates must carry denominator and `insufficient_evidence` semantics, and low-sample windows produce `null` values rather than optimistic percentages.
- Recent-artifact scorecards use explicit arrays of upstream artifacts plus deduped eligible evaluations; they do not infer a multi-run window from singular artifact fields.
- Instruction-precedence contradictions are evaluated against `target path + applicable instruction stack + normalized statement`, so valid scoped overrides are not treated as whole-repo conflicts.
- Cross-run contradiction metrics read from a stable contradiction-history ledger rather than from isolated current-run counts.
- `contextIntegrityPolicy` in `harness.contract.json` is the source of truth for contradiction catalogs, truth-source mappings, and rollout posture, while `docsGatePolicy.mode` remains the merge-authoritative enforcement ceiling.
- `contextIntegrityPolicy.healthSampling` now defines the governed retrieval fixture set, eligible triggers, and dedupe scope that bound retrieval-rate metrics.
- `search` keeps its existing lexical, semantic, and hybrid contract, while `context` and `index-context` retain explicit-fail semantics unless the existing CP4b degraded lexical fallback is explicitly enabled.
- Rollout posture changes are maintainer-owned contract updates, not automatic writes by `context-health`; the command can recommend demotion, but it cannot mutate posture itself.

## Definition of Done

- A full spec-backed contract exists for authority-aware retrieval, contradiction findings, and context-health scorecards.
- The spec clearly assigns ownership across retrieval commands, docs-gate, and the new health-reporting layer.
- Failure posture, degraded modes, and exit-status preservation are explicit.
- Measurement-window semantics, denominator guards, and category-to-outcome mapping are explicit enough for implementation without policy guesswork.
- Rollout posture, promotion criteria, demotion triggers, and artifact join-integrity rules are explicit enough for operators to tune the feature safely.
- The spec is detailed enough for `/prompts:workflow-plan` to derive implementation phases without inventing behavior.
