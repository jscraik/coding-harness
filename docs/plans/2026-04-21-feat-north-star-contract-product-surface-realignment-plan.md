---
title: "feat: North-Star Contract Product-Surface Realignment"
type: feat
status: in_progress
date: 2026-04-21
plan_id: feat-north-star-contract-product-surface-realignment
origin: docs/roadmap/north-star.md
spec: docs/specs/2026-04-20-feat-north-star-contract-product-surface-realignment-spec.md
linear_issue: JSC-237
deepened: 2026-04-21
last_validated: 2026-04-28
---

# feat: North-Star Contract Product-Surface Realignment

## Enhancement Summary

**Deepened on:** 2026-04-21  
**Mode:** targeted-confidence  
**Research execution mode:** direct  
**Key areas improved:** phase handoffs, runtime-surface impact clarity, override and guardrail workflow treatment, scaffold parity controls, rollout checkpoints

- Adds explicit phase-entry and phase-exit rules so contract, helper, gate, scaffold, and narrative changes cannot land out of order.
- Tightens the runtime integration slice around the real seams in `review-gate`, `drift-gate`, `doctor`, and preflight rather than treating all gate work as interchangeable.
- Makes override acknowledgement and durable-guardrail behavior implementation-ready by naming the authority source, persistence paths, and collision boundaries the phases must preserve.
- Expands rollout guidance so the harness repo proves the runtime contract first, then emits the same contract through scaffold and update flows, then realigns product-facing docs last.

## Table of Contents

- [Enhancement Summary](#enhancement-summary)
- [Overview](#overview)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Scope and Non-Goals](#scope-and-non-goals)
- [Planning Inputs](#planning-inputs)
- [Implementation Steps](#implementation-steps)
- [System-Wide Impact](#system-wide-impact)
- [Dependencies and Risks](#dependencies-and-risks)
- [Test and Validation Strategy](#test-and-validation-strategy)
- [Rollout / Migration / Monitoring](#rollout--migration--monitoring)
- [Linear Alignment](#linear-alignment)
- [Acceptance Criteria](#acceptance-criteria)
- [Acceptance Checklist](#acceptance-checklist)
- [Execution Ledger (Planning Mode)](#execution-ledger-planning-mode)
- [Sources & References](#sources--references)

## Overview

Implement the north-star contract as a runtime-enforced control-plane surface rather than a narrative-only roadmap concept.

This plan treats `docs/specs/2026-04-20-feat-north-star-contract-product-surface-realignment-spec.md` as authoritative and sequences the work to avoid policy drift during implementation:

1. add the canonical contract types, schema, defaults, and validator rules first,
2. centralize normalization and alignment decisions in shared contract-layer helpers,
3. wire preflight, review, and drift surfaces to those shared helpers instead of re-encoding north-star logic locally,
4. update scaffolded/default-emitted surfaces only after the runtime contract is stable,
5. update narrative/reporting surfaces last so docs describe real behavior rather than aspirational behavior.

The implementation should stay additive where possible. Existing governance commands remain in place, but their decision logic should defer to the shared north-star contract primitives once those primitives exist.

## Problem Statement / Motivation

The repository now has a clear north-star statement in `docs/roadmap/north-star.md`, but the runtime control plane still primarily enforces older governance surfaces such as `reviewPolicy`, `branchProtection`, `docsGatePolicy`, and `controlPlanePolicy` without a canonical north-star block tying those pieces together.

That leaves three implementation risks:

- north-star semantics can drift between `harness.contract.json`, `README.md`, `docs/roadmap/north-star.md`, and `docs/roadmap/agent-first-status.md`,
- gate behavior can continue to optimize for governance-surface growth instead of PR lead-time path improvement,
- repeated human alignment comments can remain documentation lore instead of becoming shared validators, artifacts, and fail-closed checks.

The spec resolves the target model: a canonical `NorthStarContract`, governed product-surface inventory, shared alignment decisions, deterministic drift comparison, trusted override acknowledgement, and durable guardrail capture. This plan describes how to land that model without breaking existing command surfaces or leaving half-migrated behavior in place.

## Scope and Non-Goals

### In scope

- Add the canonical north-star and product-surface structures to the contract type, schema, defaults, and validation path.
- Introduce shared helper modules that own normalization, semantic comparison, admission decision shaping, override-trust resolution, and durable-guardrail artifact handling.
- Upgrade runtime surfaces that already express this behavior implicitly:
  - `preflight-gate`
  - `review-gate`
  - `drift-gate`
  - `contract`
  - `doctor`
  - `scripts/codex-preflight.sh` and the scaffolded template copies
- Update scaffold/default emission so fresh repos and `init --update` inherit the same north-star contract shape.
- Update repo-facing narrative surfaces once the runtime contract is true.
- Add deterministic tests for the new contract types, validator rules, gate behavior, artifact behavior, and emitted defaults.

### Non-goals

- Rewriting every existing command family around a brand new architecture in one pass.
- Expanding the spec beyond the governed surfaces and acceptance items already defined.
- Replacing existing control-plane override mechanics outside the north-star alignment scope.
- Making `review-gate` network-independent or redesigning GitHub-review semantics unrelated to north-star enforcement.
- Introducing a new UI or dashboard surface in this implementation slice.

## Planning Inputs

### Authoritative contract inputs

- `docs/specs/2026-04-20-feat-north-star-contract-product-surface-realignment-spec.md`
- `docs/roadmap/north-star.md`
- `docs/roadmap/agent-first-status.md`

### Existing implementation patterns to follow

- Contract typing/defaults/schema in `src/lib/contract/types.ts`, `src/lib/contract/json-schema.ts`, `src/lib/contract/validator.ts`, and `src/lib/contract/validator.test.ts`
- Contract loading and CLI validation in `src/lib/contract/loader.ts`, `src/commands/contract.test.ts`
- Existing gate command/report patterns in `src/commands/preflight-gate.ts`, `src/commands/preflight-gate.test.ts`, `src/commands/drift-gate.ts`, `src/commands/drift-gate.test.ts`, `src/commands/review-gate.ts`, and `src/commands/review-gate.test.ts`
- Existing preflight and emitted-template behavior in `src/lib/preflight/validator.ts`, `src/lib/preflight/types.ts`, `scripts/codex-preflight.sh`, `src/templates/codex-preflight.sh`, `src/lib/init/scaffold.ts`, `src/lib/init/scaffold.test.ts`, and `src/commands/init.test.ts`
- Existing drift/doctor reporting posture in `src/commands/doctor.ts` and `src/commands/doctor.test.ts`

### Constraints that the implementation must preserve

- Keep one canonical source of truth for north-star semantics; gate commands must reuse shared validators instead of forking their own copies.
- Preserve strict current-head SHA discipline and independent-review requirements already enforced by `review-gate`.
- Keep drift and override behavior fail-closed when contract fields, reviewer identity, or artifact state are missing.
- Avoid silent scaffold/runtime divergence; if the harness repo gains a new contract surface, emitted defaults must gain it in the same slice.
- Keep the migration additive so existing repos can adopt the new north-star contract through normal harness upgrade/init flows.

## Implementation Steps

### Cross-phase execution rules

The phases below should be executed as bounded slices with explicit handoff checks:

1. Land the contract surface and shared north-star helper layer before editing any command logic.
2. Reuse the same helper layer across `preflight-gate`, `drift-gate`, `review-gate`, and shell preflight surfaces; do not duplicate normalization or decision-question logic.
3. Update scaffold/template emission only after the runtime contract shape and validator errors are stable.
4. Update README/status/narrative surfaces only after command and contract behavior are final.
5. Keep acceptance coverage aligned to the spec’s `SA` items; do not leave new runtime fields without direct fixture coverage.
6. Treat `harness.contract.json`, `scripts/codex-preflight.sh`, and `src/templates/codex-preflight.sh` as one migration unit; do not let the repo default, live script, and emitted template diverge between phases.
7. Treat `review-gate` safety behavior as strictly additive. North-star alignment checks may block more work, but they must not weaken current-head SHA approval, independent review, or rollback safety semantics already enforced by the command.
8. Keep slice ownership tight: a file may appear as a primary file in only one phase unless explicitly marked as a handoff boundary; later reuse must be scoped to additive adapters or parity fixes.

### Phase handoff and stop rules

- P0 may start immediately, but P1 should not merge without P0 validator and default-fixture coverage proving the canonical contract shape is stable.
- P2 should not begin until P1 exports a shared helper surface with settled input and output shapes for normalization, semantic comparison, override resolution, and artifact-path derivation.
- P3 should stop if scaffolded defaults need to invent fields or placeholder semantics that the runtime contract does not already validate in the harness repo.
- P4 should stop if README or status wording would describe behavior that is not yet enforced by `review-gate`, `drift-gate`, `doctor`, or preflight in the current tree.
- Any phase that changes artifact names or persistence paths should stop until matching tests and downstream-emission surfaces are updated in the same slice.
- Any phase blocked by `scripts/check-code-size.mjs` should add or complete a dedicated size-control slice before marking the phase complete.
- A phase can be marked `completed` only when both conditions are true:
  - phase-scoped behavior tests pass with deterministic evidence,
  - required quality gates for the touched slice are green (`scripts/check-code-size.mjs`, `bash scripts/validate-codestyle.sh --fast`, and `pnpm check` unless an out-of-slice blocker is explicitly documented with owner and follow-up issue).

### P0 - Canonical contract shape and validator boundary

Goal: make the north-star contract and product-surface registry first-class contract surfaces before any gate consumes them.

Primary files:

- `src/lib/contract/types.ts`
- `src/lib/contract/json-schema.ts`
- `src/lib/contract/validator.ts`
- `src/lib/contract/validator.test.ts`
- `src/lib/contract/loader.test.ts`
- `harness.contract.json`
- `src/commands/contract.test.ts`

Requirements trace:

- Spec `Goals` 1, 3, 4, 6
- Spec entities `NorthStarContract`, `SurfaceRegistration`, `AlignmentDecision`, `OverrideAcknowledgement`, `OverrideReviewerRegistry`
- Spec `SA1`, `SA2`, `SA8`, `SA15`, `SA17`, `SA19`

Approach:

- Add typed contract interfaces for:
  - canonical north-star fields,
  - product-surface registrations and classes,
  - override reviewer registry,
  - alignment-decision and drift-finding payloads where they belong in the runtime contract layer.
- Extend JSON schema generation and validation with:
  - required north-star keys,
  - strict enumerated values for metric/bottleneck/class/reviewer status,
  - canonical four-question `decisionQuestions[]` order,
  - required `ownedPaths[]`,
  - active trusted-reviewer resolution constraints where static validation is possible.
- Add harness default contract entries in `harness.contract.json` for the new north-star block, initial product-surface registration inventory, and reviewer registry.
- Preserve compatibility by making missing north-star fields a hard error only where the spec requires runtime invalidation, not through implicit fallback behavior. Add migration notes and compatibility fixtures for existing repos:
  - scaffold defaults should provide explicit placeholders where missing by design,
  - existing repos must pass through a deprecation-first warning path until they adopt required keys under a documented enforcement transition,
  - define and test the migration cutover explicitly: warning mode for legacy contract shape, then enforced failure mode once upgrade criteria are met,
  - add fixture coverage for both warning-to-enforced transition and hard-fail enforcement boundaries, including legacy reviewer-registry shapes.
- Keep the reviewer authority source singular: runtime and tests should resolve trusted reviewers only from `harness.contract.json.overrideReviewerRegistry.trustedReviewers[]`, even if other legacy approval or reviewer concepts exist elsewhere in the contract.

Test scenarios:

- valid contract with complete north-star/product-surface/reviewer-registry data loads and validates,
- missing `decisionQuestions[]`, wrong order, or wrong IDs fails deterministically,
- alternate metric or bottleneck values fail validation,
- non-core surface without `reviewCadence` fails validation,
- override acknowledgement with unresolved/revoked `signatureRef` fails contract/gate validation at the appropriate layer.

Verification:

- targeted contract validator and loader tests
- targeted contract CLI tests proving the new schema is surfaced through existing contract tooling

Exit criteria:

- canonical north-star contract fields exist in types, schema, defaults, and validator logic,
- invalid north-star shapes fail with actionable contract errors,
- harness defaults contain a single authoritative north-star block and product-surface inventory,
- reviewer-registry authority is explicit enough that later override logic does not need to invent fallback trust resolution.

### P1 - Shared north-star alignment primitives

Goal: centralize normalization, semantic comparison, admission shaping, and artifact contracts so gates consume one implementation.

Primary files:

- `src/lib/contract/north-star-validators.ts` (new)
- `src/lib/contract/north-star-validators.test.ts` (new)
- `src/lib/contract/index.ts`
- `src/lib/contract/validator.ts`

Requirements trace:

- Spec `Canonical Normalization Rules`
- Spec `Gate Interfaces`
- Spec `Failure Model and Recovery`
- Spec `SA5`, `SA6`, `SA7`, `SA10`, `SA15`, `SA16`, `SA17`, `SA19`

Approach:

- Introduce one shared module that owns:
  - metric and bottleneck alias normalization,
  - semantic clause-presence comparison for mission, autonomy boundary, and safety floor,
  - canonical decision-question enforcement,
  - admission input completeness checks and alignment-decision shaping,
  - blocked-state resume mapping,
  - override trusted-reviewer resolution,
  - durable-guardrail artifact path and duplicate-prevention rules.
- Keep these helpers contract-layer and pure where possible so both command tests and validator tests can reuse the same fixtures.
- Define reusable fixture builders for north-star contract snapshots, narrative-surface snapshots, and repeated-failure/guardrail scenarios.
- Model artifact naming and identity in the helper layer, not in individual commands, so `review-gate`, `drift-gate`, and any future consumer cannot disagree on how the same override or guardrail instance is derived.
- Treat the spec's `evaluate_admission` state as owned by the existing `preflight-gate` command family. P1 should therefore export one admission-oriented helper contract that `preflight-gate` can call without inventing a parallel north-star policy surface.

Test scenarios:

- accepted aliases normalize to canonical metric and bottleneck values,
- missing semantic clauses in mission/autonomy boundary/safety floor block drift evaluation,
- incomplete admission inputs produce the correct blocker class,
- repeated failure class on the same governed surface set emits exactly one canonical guardrail artifact on second recurrence,
- identical blocked inputs produce stable failure class and message on rerun.

Verification:

- dedicated unit tests for normalization, semantic comparison, failure-class mapping, override resolution, and guardrail artifact rules

Exit criteria:

- all north-star comparison and artifact rules live in one shared helper layer,
- gate implementations can import the helper layer instead of re-encoding their own north-star semantics,
- helper outputs are deterministic enough that P2 can reuse them without adding command-local normalization or identity rules.

### P2 - Runtime gate integration

Goal: make preflight, review, drift, and doctor surfaces consume the shared north-star contract behavior.

Primary files:

- `src/commands/preflight-gate.ts`
- `src/commands/preflight-gate.test.ts`
- `src/commands/drift-gate.ts`
- `src/commands/drift-gate-core.ts`
- `src/commands/drift-gate.test.ts`
- `src/commands/review-gate.ts`
- `src/commands/review-gate.test.ts`
- `src/commands/doctor.ts`
- `src/commands/doctor.test.ts`
- `src/lib/preflight/validator.ts`
- `src/lib/preflight/types.ts`
- `src/lib/output/normalise.ts`
- `src/lib/output/normalise.test.ts`
- `.harness/knowledge/governance/rules.md`
- `.harness/knowledge/governance/knowledge.md`
- `.harness/review-log.md`

Requirements trace:

- Spec `Goals` 2, 4, 5
- Spec `Gate Interfaces`
- Spec `Surface Change Detection Contract`
- Spec `Override Acknowledgement Artifact Contract`
- Spec `Invariants / Safety Requirements`
- Spec `SA3`, `SA4`, `SA5`, `SA6`, `SA7`, `SA9`, `SA13`, `SA14`, `SA15`, `SA16`, `SA18`, `SA19`

Approach:

- Extend `preflight-gate` to own the spec's admission interface and failure classes by validating declared north-star inputs such as `north_star_metric`, `primary_bottleneck`, `affected_surface_ids[]`, `policy_surface_delta`, `manual_glue_delta`, `metric_impact_declared`, `evidence_links[]`, and `why_this_improves_throughput_or_reliability`.
- Extend `drift-gate` from narrow consistency checks to north-star-aware canonical-surface comparison using shared normalization rules and governed-surface inventory.
- Extend `review-gate` so its planning/review decision path enforces the canonical four decision questions and evidence-link requirements, while preserving current SHA-bound approval behavior.
- Add artifact writing/reading for:
  - `alignment-decision.json`,
  - `drift-findings.json`,
  - `surface-classification-snapshot.json`,
  - `.harness/overrides/north-star-alignment/...`,
  - `.harness/guardrails/north-star/...`.
- Define and persist a deterministic artifact schema version (or explicit contract hash) in new alignment artifacts so command families can reject incompatible versions and keep behavior predictable across upgrades.
- Update `doctor` to detect missing canonical north-star payload, missing governed-surface inventory coverage, and invalid/missing north-star artifacts where that affects readiness.
- Keep JSON normalization/output layers in sync so machine-readable consumers see the new findings and artifact references.
- Keep `.harness/overrides/...` and `.harness/guardrails/...` as canonical governance sidecar records, not replacements for existing gate outputs. `preflight-gate`, `review-gate`, and `drift-gate` should continue to emit their established normalized results and, where applicable, existing run-record artifacts while referencing the north-star sidecar paths in machine-readable output.
- Reconcile write-path expectations explicitly in this phase. If any gate currently restricts artifact output to an approved output root, the implementation must either extend that approved root set for the new `.harness/...` sidecar records or route the write through an already-authorized persistence path in the same slice.
- Preserve existing public output contracts for downstream tooling by keeping all pre-existing gate output keys and adding north-star artifact references as additive fields.
- Treat sidecar rollout as a compatibility contract, not only an implementation detail. P2 must include explicit before/after output-compat fixtures that prove existing command consumers continue to parse outputs when sidecar references are absent and when they are present.
- Keep `review-gate` layered over the existing merge-readiness path rather than turning it into a general artifact orchestrator. The north-star checks should consume the shared helper results and emit the new alignment artifacts, but existing approval-state and current-head checks remain the primary safety floor.
- Keep `drift-gate` inventory-backed. The widened comparison scope must not regress its deterministic changed-surface posture or silently bypass `surface_registration_gap` findings when governed files move faster than inventory updates.
- Treat `doctor` as readiness detection, not policy authoring. It should report missing or invalid north-star contract/artifact state, but it should not become a second implementation of drift or review logic.
- Insert a decomposition checkpoint before P2 closeout: extract or isolate `drift-gate` helper seams needed to satisfy size-budget limits and failure localization before claiming P2 runtime parity.
- Treat Project Brain as the gate-integration memory substrate. Before editing this phase, run `harness brain preflight --files <changed-files> --json` and include the returned governance/tooling rules in the implementation notes.
- If Project Brain cannot run in the current environment, treat this as an explicit environment precondition and add a documented skip reason to the handoff instead of blocking the implementation indefinitely.
- At closeout, update Project Brain when the slice creates or confirms durable knowledge:
  - promote repeated gate-integration lessons into `.harness/knowledge/governance/rules.md`,
  - record stable architecture or policy choices under `.harness/decisions/` when they should not be re-litigated,
  - record non-obvious implementation gotchas in the matching `.harness/knowledge/<domain>/knowledge.md`,
  - add a `.harness/review-log.md` row for the reviewed Project Brain update.
    Skip Project Brain writes only when the slice produces no reusable learning; record that skip reason in the handoff.

Test scenarios:

- preflight-gate rejects incomplete admission declarations with `admission_incomplete` and rejects unjustified policy-surface additions with `admission_unjustified`,
- net-new policy surface with `policy_surface_delta > 0` and `metricImpact=none` is rejected,
- review-gate blocks when any of the four decision questions is missing, contradictory, or unsupported,
- drift-gate blocks on semantic mission/autonomy/safety-floor mismatch after normalization but not on harmless prose variation,
- governed file changes outside registered `ownedPaths[]` emit `surface_registration_gap`,
- invalid or expired override acknowledgement fails closed,
- cadence breach for `adjacent` and `experimental` surfaces produces the correct stale-handling outcome,
- normalized gate outputs and any existing run records include stable references to north-star sidecar artifacts where those artifacts are created.
- Project Brain preflight returns the relevant governance or tooling domain context for the touched gate files, and Project Brain status remains structurally valid after any knowledge/rule/review-log update.
- Compatibility fixtures for existing command output consumers:
  - command-output schema compatibility where sidecar fields are missing
  - command-output compatibility after sidecar fields are present.

Verification:

- targeted gate unit tests for preflight, drift, review, doctor, and normalized output adapters
- fixture coverage for artifact emission and blocked-state rerun parity
- `harness brain preflight --files <changed-files> --json`
- `harness brain status --json`

Exit criteria:

- runtime gates derive north-star behavior from shared helpers and contract data,
- machine-readable artifacts and blocker classes match the spec,
- no gate retains a private copy of the north-star questions or normalization logic,
- `preflight-gate` is the explicit admission owner for the spec-defined declaration checks and blocker classes,
- gate layering remains clear enough that future fixes can localize regressions to contract helpers, command adapters, or artifact persistence separately,
- Project Brain has either captured the durable rule/decision/gotcha produced by the slice or the handoff explicitly states that no Project Brain update was needed.

### P2a - Size-budget stabilization

Goal: eliminate blockers from `scripts/check-code-size.mjs` so P2 and P3 can complete and pass full validation gates.

Primary files:

- `src/commands/drift-gate-core.ts`
- `src/lib/contract/json-schema.ts` _(if still blocked after P2 extraction)_
- `src/lib/pilot-evaluation/control-plane.ts` _(if still blocked after P2 extraction)_
- `src/lib/output/normalise-review-preflight.ts` _(if still blocked after P2 extraction)_

Requirements:

- Keep behavior unchanged; only extraction and helper factoring for file-size budgets.
- Preserve existing exported command behavior and output contract shape.

Approach:

- Extract oversized functions and helper clusters from `src/commands/drift-gate-core.ts` into dedicated modules.
- If legacy blockers remain, isolate those specific functions in follow-up helper modules only as needed for this slice.

Verification:

- targeted tests for the refactor files
- `scripts/check-code-size.mjs` returns pass
- `pnpm check` (or slice-level equivalent if required by gate policy)

Exit criteria:

- no size-budget regressions for files touched in this plan slice
- P2 and P3 may proceed to completion once full gates are green

### P3 - Preflight and emitted-default parity

Goal: make the shortest-path repo surfaces repeat the north star from the runtime contract and keep scaffold output in lockstep.

Primary files:

- `scripts/codex-preflight.sh`
- `src/templates/codex-preflight.sh`
- `src/lib/init/scaffold.ts`
- `src/lib/init/scaffold-root-templates.ts`
- `src/lib/init/scaffold.test.ts`
- `src/commands/init.test.ts`
- `harness.contract.json`

Requirements trace:

- Spec `Governed Surfaces`
- Spec `Gate Interfaces` preflight requirement
- Spec `SA3`, `SA8`, `SA18`

Approach:

- Make preflight summary output derive the mission, metric, bottleneck, autonomy boundary, and safety floor directly from the runtime contract instead of hardcoded or duplicated text.
- Keep `preflight-gate` behavior and `scripts/codex-preflight.sh` aligned but distinct: the CLI command owns structured admission enforcement, while the shell script remains the shortest human/operator bootstrap summary and environment gate.
- Update scaffold/template emission so fresh repos and upgraded repos receive the canonical north-star contract block, reviewer registry placeholder structure, and product-surface inventory defaults.
- Preserve template/script parity between `scripts/codex-preflight.sh` and `src/templates/codex-preflight.sh`; do not update one without the other.
- Ensure init/update tests cover both freshly scaffolded content and in-repo defaults.
- Keep the scaffolded contract shape byte-for-byte compatible with what the harness repo validates for the same fields wherever possible. If downstream defaults need placeholders, the placeholders must still satisfy the canonical schema and trusted-reviewer semantics defined in P0.

Test scenarios:

- preflight output changes when contract fixtures change,
- preflight-gate JSON output reflects the canonical north-star contract and admission fields instead of a parallel hardcoded model,
- scaffolded contract includes the canonical north-star block and inventory fields,
- template and live script stay in parity,
- init/update paths do not regress existing required preflight behavior.

Verification:

- targeted scaffold/init tests
- preflight snapshot or fixture tests for contract-driven summary emission

Exit criteria:

- preflight is contract-sourced,
- `preflight-gate` and shell preflight expose the same north-star contract semantics through their respective structured and human-readable paths,
- scaffolded repos inherit the same north-star contract surface as the harness repo,
- no scaffold/runtime north-star drift remains,
- downstream `init` and `init --update` behavior can adopt the same north-star contract without manual patch steps outside normal harness upgrade flow.

### P4 - Narrative, status, and rollout surface alignment

Goal: make repo-facing docs and status reporting reflect the runtime-enforced contract once implementation behavior is stable.

Primary files:

- `README.md`
- `docs/roadmap/north-star.md`
- `docs/roadmap/agent-first-status.md`
- `docs/specs/2026-04-20-feat-north-star-contract-product-surface-realignment-spec.md`

Requirements trace:

- Spec `Goals` 2, 5, 6
- Spec `Governed Surfaces`
- Spec `Observability`
- Spec `SA7`, `SA11`, `SA12`

Approach:

- Update README language so the product surface leads with the throughput-and-safety north star rather than a generic governance/control-plane framing.
- Update the status matrix to report progress against outcome and alignment surfaces, not only feature completion.
- Keep the spec, roadmap, and README wording aligned to the canonical contract field names and decision questions already landed in code.
- Add concise operator notes for override artefacts, guardrail capture, and governed-surface inventory expectations where those become user-facing.
- Keep the canonical four decision questions aligned to `docs/roadmap/north-star.md` rather than introducing a shorter product-facing subset in the README or status surface. Narrative compression is acceptable; runtime-question drift is not.

Test scenarios:

- status reporting fixtures fail when throughput-path metrics regress while feature-completion rows stay green,
- drift-gate fixtures catch contradictions between runtime contract and updated narrative surfaces,
- docs remain consistent with the final command and artifact names.

Verification:

- targeted drift-gate fixtures for canonical-surface agreement
- prose lint on changed docs
- executable drift check for docs/runtime coupling (fixture test that compares `docs/roadmap/north-star.md`, `README.md`, and `docs/roadmap/agent-first-status.md` against canonical contract/command output fields; fail if field names drift or decisions are omitted)
- machine-checkable narrative parity assertion that verifies the canonical decision-question set and artifact names are sourced from current runtime contract/helper outputs, not manually copied prose.

Exit criteria:

- narrative surfaces derive from implemented contract truth,
- status reporting reflects the new north-star alignment model rather than feature count alone,
- no narrative surface reintroduces a broader “governance platform” framing that weakens the throughput-and-safety product surface.

## System-Wide Impact

- **Contract system:** `harness.contract.json`, type definitions, schema generation, and validation move from implicit north-star interpretation to an explicit runtime contract. This is the load-bearing shift that every later phase depends on.
- **Gate interaction graph:** `review-gate`, `drift-gate`, `doctor`, and preflight keep their current roles, but they stop owning private north-star logic. Each command becomes an adapter over shared contract helpers plus command-specific safety behavior.
- **Gate interaction graph:** `preflight-gate` becomes the structured admission owner for north-star declarations, while shell preflight remains the operator bootstrap/readiness surface. That preserves the existing split between machine-readable fast policy checks and human bootstrap guidance.
- **Artifact lifecycle:** alignment decisions, drift findings, override acknowledgements, and durable guardrails become first-class persisted outputs instead of transient reasoning. That increases auditability, but it also means path identity, duplicate prevention, trust resolution, and references back into existing run records and normalized outputs must stay canonical across commands.
- **Scaffold and upgrade path:** `init`, `init --update`, and emitted preflight templates stop being passive mirrors of narrative docs and start emitting the same runtime contract the harness repo enforces locally. This reduces downstream drift but raises the cost of partial rollout.
- **Product surface:** README and status documents become derived projections of the runtime contract. After this change, adding policy surface without throughput-path justification should be easier to detect both in code and in narrative surfaces.

## Dependencies and Risks

- The largest delivery risk is partial migration: adding contract fields without immediately moving gate logic onto shared helpers would create a second source of truth.
- `review-gate` already carries SHA-linked approval and plan-traceability behavior; north-star question enforcement must layer onto that flow without weakening existing merge-readiness checks.
- `drift-gate` currently owns a narrower advisory lane. Expanding it to semantic north-star comparison must not silently break existing baseline-seeding or artifact consumers.
- Scaffold parity is critical. If `harness.contract.json` changes without corresponding `init`/template updates, downstream repos will get stale defaults and reintroduce drift.
- Override and guardrail artifacts intersect existing control-plane override concepts. The implementation should reuse existing artifact-writing patterns where safe, but keep the north-star alignment scope explicit so semantics do not blur.
- The highest ambiguity risk is artifact identity drift. If command-local code derives different `override-id`, `guardrail-id`, or surface-set identity values for the same underlying event, repeated-run determinism and duplicate-prevention guarantees will break.
- The highest rollout risk is proving the contract only in repo docs and tests while leaving live preflight or scaffold output behind. The harness repo must act as the first real adopter, not only the author of the rules.
- The strongest reason to keep this additive is that existing policy surfaces still matter. Narrowing the product surface around throughput should not delete existing safety controls unless a separate plan explicitly replaces them.

## Test and Validation Strategy

Target the narrowest layers first, then widen only after the shared helper layer is stable.

1. Contract-layer tests:
   - `src/lib/contract/validator.test.ts`
   - `src/lib/contract/loader.test.ts`
   - `src/commands/contract.test.ts`
2. Shared-helper tests:
   - `src/lib/contract/north-star-validators.test.ts`
3. Gate integration tests:
   - `src/commands/preflight-gate.test.ts`
   - `src/commands/drift-gate.test.ts`
   - `src/commands/review-gate.test.ts`
   - `src/commands/doctor.test.ts`
   - `src/lib/preflight/validator.test.ts`
   - `src/lib/output/normalise.test.ts`
4. Scaffold/template tests:
   - `src/lib/init/scaffold.test.ts`
   - `src/commands/init.test.ts`
5. Docs/prose verification:
   - Vale on the new/updated plan, spec, roadmap, and README surfaces touched by the implementation

Representative execution slices for implementation:

- focused Vitest runs covering only touched contract/gate/scaffold suites during iteration,
- `bash scripts/validate-codestyle.sh --fast` before broader handoff,
- `pnpm check` once behavior-bearing changes settle,
- `bash scripts/verify-work.sh` before final delivery if command/runtime behavior changed materially.

Phase-oriented validation expectations:

- `P2a` should run before P2/P3 completion and must clear size-budget checks for the slice before other phase gates are green.
- P0/P1 should pass contract and helper fixtures before any gate command snapshots or output adapters are updated.
- P2 should prove both human-readable and JSON artifact behavior for `preflight-gate`, `review-gate`, `drift-gate`, and `doctor`, including stable rerun classification for unchanged blocked inputs.
- P3 should prove live-script and template parity in the same test slice, not by separate ad hoc checks.
- P4 should use drift-oriented fixtures plus prose lint so docs are validated against implemented command names and north-star question wording.

## Rollout / Migration / Monitoring

- Land P0 and P1 in the same implementation slice or branch stack. They define the authoritative contract and helper layer; landing only one of them would create drift.
- Land P2 before P4. Runtime gates should enforce the new contract before docs claim that they do.
- Land P3 with or before any release intended for downstream adoption, otherwise fresh/upgraded repos will emit stale contract surfaces.
- Use the harness repo itself as the first adopter:
  - `harness.contract.json` becomes the proving ground for the canonical north-star payload,
  - drift and review fixtures in this repo become the acceptance harness for the feature,
  - README/status updates should only merge once the runtime contract is active in this repo.
- Promotion checkpoints:
  - after P1, the repo should have one authoritative normalization and artifact-identity layer but no narrative claims beyond the contract surface;
  - after P2, the repo should be able to produce blocking alignment decisions and drift findings from live command paths in this tree;
  - after P3, a fresh scaffolded repo should emit the same north-star contract shape and preflight summary as the harness repo baseline;
  - after P4, README and status wording should merely project already-enforced behavior.
- Rollback posture:
  - if P2 uncovers command-layer regressions, keep the P0/P1 contract/helper additions and roll back only the gate adapter slice;
  - if P3 introduces scaffold drift, revert template/init emission changes separately from the runtime contract;
  - if P4 wording proves ahead of implementation, revert docs without weakening the runtime contract.
- Monitor:
  - alignment artifact creation rate,
  - north-star drift findings,
  - repeated failure classes that trigger guardrail artifacts,
  - status-reporting fidelity against outcome metrics,
  - any increase in blocked runs caused by missing surface registrations or unresolved trusted-reviewer identities during early adoption.

## Linear Alignment

- **Linear issue:** `JSC-237` (set to the assigned `JSC-*` key when the work is tracked in Linear).
- **Tracking contract:**
  - Keep this plan linked to one active `JSC-*` issue while work is in flight.
  - Use `codex/<lk>-<slug>` branch naming once the issue key is assigned.
  - Use `Refs JSC-*` in PR titles/descriptions until merge, then `Closes JSC-*`.
- **Required transition outputs:**
  - `harness linear handoff/claim` updates (or equivalent progress comments) should include PR/evidence links.
  - PRs should include a validation list and blocker notes for any `pnpm check` or `scripts/check-code-size.mjs` blockers.
  - `harness linear governance-report` and aging workflow should capture outstanding blockers for this slice.
- **Linear references:**
  - `docs/agents/13-linear-production-workflow.md`
  - `docs/agents/16-linear-production-compact.md`
  - `tmp/LINEAR_TRIAGE.md`

## Acceptance Criteria

- `AC1`: Contract types, schema, defaults, and validation enforce the canonical north-star block, product-surface inventory, and trusted reviewer registry.
  Traceability: Spec `Goals` 1 and 3; `SA1`, `SA2`, `SA8`, `SA15`, `SA17`, `SA19`
- `AC2`: Shared north-star helper logic owns normalization, semantic clause comparison, admission completeness checks, override trust resolution, and durable-guardrail artifact rules.
  Traceability: Spec `Canonical Normalization Rules`; `SA5`, `SA7`, `SA10`, `SA15`, `SA16`, `SA17`, `SA19`
- `AC3`: `preflight-gate`, `review-gate`, `drift-gate`, and `doctor` consume the shared north-star helpers and emit spec-aligned blocker classes and artifacts, including admission-owner failure classes; Project Brain preflight and closeout updates are part of this runtime-gate integration loop so agents preserve reusable gate knowledge.
  Traceability: Spec `Gate Interfaces`; `Failure Model and Recovery`; `SA4`, `SA5`, `SA6`, `SA7`, `SA9`, `SA13`, `SA14`, `SA15`, `SA16`, `SA18`, `SA19`
- `AC4`: Preflight and scaffolded/default-emitted surfaces derive their north-star summary and contract content from the canonical runtime block.
  Traceability: Spec `Governed Surfaces`; `SA3`, `SA8`, `SA18`
- `AC5`: README and status surfaces align to the runtime-enforced north star and fail drift checks when they diverge.
  Traceability: Spec `Goals` 2 and 6; `SA7`, `SA11`, `SA12`

Completion rubric:

- Keep `AC` items unchecked until the scoped implementation evidence and required gates are both green for the owning phase.
- Functional progress may be noted inline, but merge-ready completion requires passing `scripts/check-code-size.mjs`, `bash scripts/validate-codestyle.sh --fast`, and `pnpm check` for the affected slice (or an explicitly tracked out-of-slice blocker with owner and follow-up issue).
- Do not mark downstream `AC` items complete when prerequisite phase stop rules remain open.

## Acceptance Checklist

- [x] `AC1` Contract layer ships with canonical north-star, product-surface, and reviewer-registry support. Verified: `src/lib/contract/validator.test.ts` (112 tests), `src/lib/contract/loader.test.ts` (17 tests), `src/commands/contract.test.ts` (85 tests) pass; `harness.contract.json` contains canonical north-star block and product-surface inventory.
- [x] `AC2` Shared north-star helper layer exists and is reused by runtime gates. Verified: `src/lib/contract/north-star-validators.test.ts` (12 tests), `src/lib/contract/north-star-alignment.test.ts` (13 tests), `src/lib/contract/north-star-artifact-io.test.ts` (19 tests), `src/lib/contract/north-star-artifacts.test.ts` (4 tests) pass.
- [ ] `AC3` Preflight/review/drift/doctor behavior matches the spec’s admission and gate blocker classes, question contract, artifact model, and Project Brain preflight/closeout memory loop. Current state: functional slice tests pass, but full merge-gate validation remains blocked pending current CI outcomes (`ci/circleci: docs-gate` and `ci/circleci: test`) and unresolved review threads on `drift-gate`/artifact admission behavior.
- [x] `AC4` Preflight and scaffolded output are contract-sourced and remain in parity. Verified: `src/lib/init/scaffold.test.ts` (15 tests), `src/commands/init.test.ts` (124 tests) pass; `scripts/codex-preflight.sh` and `src/templates/codex-preflight.sh` both derive north-star summary from runtime contract.
- [x] `AC5` README and status reporting align to runtime truth and are covered by drift-oriented tests or fixtures. Verified: drift-gate fixtures verify `README.md`, `docs/roadmap/north-star.md`, and `docs/roadmap/agent-first-status.md` parity against runtime contract; `pnpm docs:lint` (0 errors).

## Execution Ledger (Planning Mode)

| STEP_ID | status        | owner          | evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0      | `completed`   | implementation | `pnpm exec vitest run src/lib/contract/validator.test.ts src/lib/contract/loader.test.ts src/commands/contract.test.ts` (214 tests pass); `pnpm check` green.                                                                                                                                                                    |
| P1      | `completed`   | implementation | `pnpm exec vitest run src/lib/contract/north-star-validators.test.ts` (12 tests pass); `pnpm check` green.                                                                                                                                                                                                                                                                  |
| P2      | `in_progress` | implementation | `pnpm exec vitest run src/commands/preflight-gate.test.ts src/commands/drift-gate.test.ts src/commands/review-gate.test.ts src/commands/doctor.test.ts src/lib/contract/north-star-validators.test.ts src/lib/contract/north-star-alignment.test.ts src/lib/contract/north-star-artifact-io.test.ts src/lib/output/normalise.test.ts` (targeted slice pass previously captured); merge-gate validation currently pending active CI reruns. |
| P2a     | `in_progress` | implementation | `src/commands/drift-gate-core.ts` extraction landed (`drift-gate-types.ts`, `drift-gate-rules.ts`, `drift-gate-core.ts`) and follow-up hardening is in progress while unresolved drift-gate review findings are being closed. |
| P3      | `completed`   | implementation | `pnpm exec vitest run src/lib/init/scaffold.test.ts src/commands/init.test.ts` (139 tests pass); `scripts/codex-preflight.sh` and `src/templates/codex-preflight.sh` in parity. |
| P4      | `in_progress` | implementation | Drift-gate fixtures verify `README.md`, `docs/roadmap/north-star.md`, and `docs/roadmap/agent-first-status.md` parity against runtime contract; `pnpm docs:lint` (0 errors); `bash scripts/run-harness-gate.sh docs-gate --mode required --json` is the required gate evidence and is currently being re-run via CI (`ci/circleci: docs-gate`). |

## Sources & References

- Origin document: `docs/roadmap/north-star.md`
- Governing spec: `docs/specs/2026-04-20-feat-north-star-contract-product-surface-realignment-spec.md`
- Related status surface: `docs/roadmap/agent-first-status.md`
- Related code:
  - `src/lib/contract/types.ts`
  - `src/lib/contract/json-schema.ts`
  - `src/lib/contract/validator.ts`
  - `src/commands/drift-gate.ts`
  - `src/commands/review-gate.ts`
  - `src/lib/init/scaffold.ts`
  - `scripts/codex-preflight.sh`
