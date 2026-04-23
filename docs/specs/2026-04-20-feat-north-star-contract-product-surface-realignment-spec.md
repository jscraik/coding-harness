---
schema_version: 1
title: North-Star Contract and Product-Surface Realignment
type: feat
status: draft
date: 2026-04-20
deepened: 2026-04-20
origin: docs/roadmap/north-star.md
risk: high
spec_depth: full
ui_required: false
last_validated: 2026-04-20
---

# North-Star Contract and Product-Surface Realignment

## Enhancement Summary

**Deepened on:** 2026-04-20  
**Mode:** targeted-confidence  
**Key areas improved:** lifecycle states, policy-surface admission rules, failure escalation, observability readiness

- Added an explicit alignment state model with blocking transitions so admission
  and drift behavior are deterministic.
- Tightened product-surface governance with class ownership, review cadence, and
  promotion/demotion rules.
- Strengthened failure handling with blocker-class mapping, response
  expectations, and fail-closed recovery constraints.
- Extended acceptance coverage with new SA checks for lifecycle transitions,
  stale registration handling, and metric quality gates.

## Table of Contents

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

## Problem Statement

`coding-harness` now has a strong north-star statement, but contract execution
is still vulnerable to interpretation drift when runtime gates and narrative
surfaces do not enforce the same meaning.

The primary risk is not missing features. The risk is optimizing for policy
surface growth rather than throughput outcomes:

1. Mission/metric can be described in docs without becoming mandatory gate
   inputs.
2. New policy and command surfaces can be added without proving contribution to
   reduced review or rework loop cost.
3. Status reporting can over-index on shipped capabilities while under-reporting
   north-star outcomes.

This specification makes the north star load-bearing and constrains product
surface expansion so default behavior stays codex-first and throughput-oriented.

## Goals

1. Encode mission, primary metric, bottleneck, autonomy boundary, safety floor,
   and non-goals as required runtime contract fields.
2. Require preflight, plan, review, and drift checks to evaluate the same
   canonical north-star fields.
3. Separate product surface into explicit `core`, `adjacent`, and
   `experimental` classes with ownership and review cadence.
4. Block policy-surface growth when manual glue work is not reduced and
   lead-time path impact is not evidenced.
5. Preserve strict safety controls while improving throughput path clarity.
6. Make north-star progress measurable through outcome telemetry, not only
   feature completion.

## Non-Goals

1. Rewriting all existing commands in this stage.
2. Immediate deletion of all adjacent or experimental capabilities.
3. Relaxing review, SHA, evidence, or rollback controls for speed.
4. Defining implementation choreography or sprint task sequencing.
5. Introducing new UI contracts in this stage.

## System Boundary

### Owns

- Canonical north-star contract schema and validation semantics.
- Product-surface classification metadata and lifecycle governance.
- Alignment and drift gate behavior for canonical docs and contract surfaces.
- Admission criteria for new policy/doc/workflow surfaces.
- Metric definitions and reporting requirements for north-star outcomes.

### Does Not Own

- Internal implementation details of every command family.
- Provider-specific CI internals outside existing contracts.
- Org-level staffing and reviewer assignment policy.
- Human team operating models outside repository-visible automation surfaces.

### Governed Surfaces

- `harness.contract.json` (canonical runtime source)
- `docs/roadmap/north-star.md` (canonical narrative source)
- `docs/roadmap/agent-first-status.md` (canonical status source)
- `README.md` (product-facing surface)
- alignment and diagnostics surfaces (`codex-preflight`, plan/review gates,
  drift gate, doctor output)

## Core Domain Model

### Entities

#### `NorthStarContract`

Canonical runtime block under `harness.contract.json`.

Required fields:

- `mission`
- `primaryMetric` (required value: `pr_lead_time`)
- `primaryBottleneck` (required value: `review_rework_loop`)
- `autonomyBoundary`
- `safetyFloor[]`
- `nonGoals[]`
- `decisionQuestions[]` (required order and values shown below)

Required canonical `decisionQuestions[]` order:

1. `lead_time_path`: `Does this reduce PR lead time directly, or strengthen the path to lower PR lead time by reducing review or rework cost?`
2. `manual_glue`: `Does this remove repeated manual glue work rather than normalizing it?`
3. `agent_reliability`: `Does this make acceptable output easier for agents to produce reliably?`
4. `safety_floor`: `Does this preserve strict evidence, SHA discipline, and rollback safety?`

#### `ProductSurfaceClass`

Allowed values:

- `core`
- `adjacent`
- `experimental`

#### `SurfaceRegistration`

Per-surface governance record.

Required fields:

- `surfaceId`
- `surfaceType` (`command`, `document`, `policy`, `workflow`)
- `class`
- `owner`
- `northStarContribution`
- `manualGlueReductionClaim`
- `reliabilityContribution`
- `evidenceReference`
- `reviewCadence`
- `ownedPaths[]`
- `lastReviewedAt`

#### `AlignmentDecision`

Gate output for admission and review checks.

Required fields:

- `scope`
- `metricImpact` (`direct`, `path_strengthening`, `none`)
- `bottleneckImpact`
- `policySurfaceDelta`
- `manualGlueDelta`
- `safetyFloorPreserved`
- `decision` (`admit`, `admit_with_conditions`, `reject`)
- `reasons[]`

#### `DriftFinding`

Canonical mismatch report.

Required fields:

- `findingId`
- `surface`
- `field`
- `expected`
- `actual`
- `severity` (`blocking`, `warning`)
- `remediation`

#### `OverrideAcknowledgement`

Tracked human acknowledgement artifact for blocked override attempts.

Required fields:

- `overrideId`
- `timestampUtc`
- `actor`
- `reason`
- `linkedFindingIds[]`
- `approvedUntilUtc`
- `compensatingControls[]`
- `signatureRef`

#### `OverrideReviewerRegistry`

Canonical trusted-reviewer registry under `harness.contract.json`.

Required fields:

- `trustedReviewers[]`

Each `trustedReviewers[]` entry must contain:

- `reviewerId`
- `reviewerType` (`user`, `team`, `service`)
- `signatureRef`
- `displayName`
- `status` (`active`, `revoked`)

### Identity and Compatibility Rules

1. `NorthStarContract.primaryMetric` and `primaryBottleneck` use strict
   enumerated values.
2. Missing required north-star keys are contract-invalid and block downstream
   gates.
3. `SurfaceRegistration.surfaceId` must be unique and stable across releases.
4. `adjacent` and `experimental` surfaces must include `reviewCadence`; missing
   cadence is contract-invalid.
5. `SurfaceRegistration.ownedPaths[]` is required and is the canonical source
   for deterministic changed-surface detection.
6. `NorthStarContract.decisionQuestions[]` must match the canonical four
   question IDs and order above.
7. `OverrideAcknowledgement.signatureRef` must resolve to exactly one
   `OverrideReviewerRegistry.trustedReviewers[]` entry with `status=active`.

### Canonical Normalization Rules (Required)

Drift checks must compare normalized values, not raw prose literals.

| Field | Normalized value | Accepted narrative aliases |
| --- | --- | --- |
| `primaryMetric` | `pr_lead_time` | `PR lead time`, `pr lead time`, `PR lead time from open to merge` |
| `primaryBottleneck` | `review_rework_loop` | `review or rework loop`, `review/rework loop`, `review and rework loop cost` |

Structured semantic comparison rules:

| Field | Comparison contract |
| --- | --- |
| `mission` | Narrative surface must preserve both clauses: `humans steer and agents execute safely` and `PR lead time as the primary north-star metric`. |
| `autonomyBoundary` | Narrative surface must preserve both clauses: `low and medium-risk autonomy may be automated` and `high-risk changes remain human-mediated`. |
| `safetyFloor[]` | Narrative surface must preserve all canonical controls: deterministic evidence, current-head SHA discipline, bounded auto-remediation, explicit rollback paths for higher-risk automation, and independent review. |

Normalization rules:

1. Case-insensitive comparison.
2. Hyphen, slash, and repeated-whitespace normalization before comparison.
3. For `mission` and `autonomyBoundary`, clause ordering may vary, but all
   required clauses must remain present after normalization.
4. For `safetyFloor[]`, list order may vary, but every canonical control must be
   present after normalization.
5. Drift is blocking only when normalized values differ or required semantic
   clauses are missing.

## Main Flow / Lifecycle

### Alignment State Model

```
A0 UNLOADED
A1 CONTRACT_VALID
A2 PREFLIGHT_SUMMARIZED
A3 ADMISSION_EVALUATED
A4 REVIEW_EVALUATED
A5 DRIFT_CLEAN
A_BLOCKED
A_DONE
A_FAIL
```

### Transition Rules

| Current | Event | Guard | Action | Next |
| --- | --- | --- | --- | --- |
| `A0` | `load_contract` | contract parse succeeds | cache canonical north-star fields | `A1` |
| `A0` | `load_contract` | parse fails or required keys missing | emit blocking contract error | `A_FAIL` |
| `A1` | `run_preflight` | summary fields resolvable | emit north-star summary | `A2` |
| `A1` | `run_preflight` | summary fields missing | emit blocker | `A_BLOCKED` |
| `A2` | `evaluate_admission` | declaration fields complete | compute alignment decision | `A3` |
| `A2` | `evaluate_admission` | fields missing or `metricImpact=none` | emit rejection with reasons | `A_BLOCKED` |
| `A3` | `evaluate_review` | review questions answered with supporting evidence | persist review decision | `A4` |
| `A3` | `evaluate_review` | contradiction or unsupported claim | block with mismatch finding | `A_BLOCKED` |
| `A4` | `run_drift_check` | canonical surfaces agree | emit clean drift report | `A5` |
| `A4` | `run_drift_check` | post-normalization semantic mismatch found | emit blocking drift finding | `A_BLOCKED` |
| `A5` | `complete` | all blocking checks passed | mark alignment done | `A_DONE` |
| `A_BLOCKED` | `remediate` | blocker corrected and `blockedFromState` present | route resume to mapped source state | mapped non-terminal state |
| `A_BLOCKED` | `remediate` | `blockedFromState` missing or invalid | emit deterministic resume-contract error | `A_FAIL` |
| `A_BLOCKED` | `override_attempt` | no tracked human acknowledgement artifact | deny override | `A_FAIL` |

### Surface Classification Lifecycle

1. Register surfaces with class and owner.
2. Evaluate class admission:
   - `core`: default path contribution required.
   - `adjacent`: optional value with explicit scope boundary.
   - `experimental`: time-boxed, cadence-enforced, removable by default.
3. Re-review non-core surfaces on cadence.
4. Promote/demote based on measured contribution.
5. Apply class-specific stale handling when cadence is missed:
   - `adjacent`: block further admission updates until reviewed.
   - `experimental`: disable from default execution surfaces until reviewed.

### Blocked-State Resume Contract

When entering `A_BLOCKED`, runtime must persist:

- `blockedFromState`
- `blockedFailureClass`

Allowed `blockedFromState` values: `A1`, `A2`, `A3`, `A4`.

Deterministic mapping:

- `admission_incomplete`, `admission_unjustified`, `surface_registration_gap`,
  `cadence_breach` -> `A2`
- `review_evidence_contradiction` -> `A3`
- `drift_blocking` -> `A4`
- preflight summary blockers -> `A1`

## Interfaces and Dependencies

### Inputs

- canonical contract: `harness.contract.json`
- canonical narrative surfaces:
  - `docs/roadmap/north-star.md`
  - `docs/roadmap/agent-first-status.md`
  - `README.md`
- gate invocation context from preflight/admission/review/drift surfaces

### Gate Interfaces

- Preflight interface must emit canonical summary directly from contract data.
- Admission interface must receive:
  - `north_star_metric`
  - `primary_bottleneck`
  - `affected_surface_ids[]`
  - `affected_surface_classes[]`
  - `policy_surface_delta`
  - `manual_glue_delta`
  - `metric_impact_declared`
  - `evidence_links[]`
  - `why_this_improves_throughput_or_reliability`
- Review interface must evaluate all four canonical north-star questions in
  `decisionQuestions[]` and the associated evidence links.
- Drift interface must return structured `DriftFinding[]`.

### Surface Change Detection Contract

Changed-surface detection must be deterministic and inventory-backed.

1. Build canonical inventory from `productSurface.surfaces[*].ownedPaths`.
2. Compute changed files from the target diff.
3. Mark a file as governed when it matches any `ownedPaths[]` entry.
4. Emit `surface_registration_gap` when a changed file under governance roots is
   not matched by inventory.

Governance roots:

- `harness.contract.json`
- `docs/roadmap/`
- `README.md`
- `scripts/codex-preflight.sh`
- `scripts/verify-work.sh`
- policy/review gate command surfaces under `src/commands/`

### Output Interfaces

- human-readable gate summaries
- machine-readable JSON artifacts:
  - `alignment-decision.json`
  - `drift-findings.json`
  - `surface-classification-snapshot.json`
  - `.harness/guardrails/north-star/<failure-class>/<guardrail-id>.json`
  - `.harness/overrides/north-star-alignment/<YYYY-MM-DD>/<override-id>.json`

### Dependency Assumptions

1. Contract validation remains authoritative and fail-closed.
2. Gate runners can read canonical docs from repo root.
3. CI/local runners can persist alignment artifacts for audit and trend analysis.
4. Trusted reviewer resolution is sourced only from
   `harness.contract.json.overrideReviewerRegistry.trustedReviewers[]`.
5. Durable guardrail creation is sourced only from the canonical guardrail
   artifact path defined in this spec.

### Durable Guardrail Artifact Contract

Guardrail artifacts must use:

- Path: `.harness/guardrails/north-star/<failure-class>/<guardrail-id>.json`

Required fields:

- `guardrailId`
- `failureClass`
- `triggeredByFindingIds[]`
- `recurrenceCount`
- `createdAtUtc`
- `owner`
- `implementationTarget`
- `status` (`proposed`, `implemented`)

Guardrail creation rule:

1. The second recurrence of the same blocking `failureClass` for the same
   governed surface set must emit one durable guardrail artifact.
2. Further recurrences may update the same artifact but must not create
   duplicate active artifacts for the same failure class and surface set.

### Override Acknowledgement Artifact Contract

Override artifacts must use:

- Path: `.harness/overrides/north-star-alignment/<YYYY-MM-DD>/<override-id>.json`
- Schema: `OverrideAcknowledgement` required fields defined above

Override attempts are valid only when:

1. Artifact exists at the canonical path.
2. `approvedUntilUtc` is in the future at evaluation time.
3. `linkedFindingIds[]` references active blocking findings.
4. `signatureRef` resolves to exactly one active trusted reviewer identity in
   `harness.contract.json.overrideReviewerRegistry.trustedReviewers[]`.

## Invariants / Safety Requirements

1. `PR lead time` is the only primary metric.
2. `review_rework_loop` is the only primary bottleneck category.
3. High-risk autonomy remains human-mediated.
4. Current-head SHA discipline is mandatory.
5. Deterministic evidence is required for automated decisions.
6. Explicit rollback path is required for high-risk automation surfaces.
7. Independent review remains enforced.
8. Policy-surface growth requires measured throughput-path or manual-glue
   reduction evidence.
9. Drift blockers must remain fail-closed until corrected.

## Failure Model and Recovery

### Failure Classes

1. `contract_invalid`
- required fields missing or invalid enumerated values

2. `admission_incomplete`
- required admission declaration fields missing

3. `admission_unjustified`
- declared impact does not support north-star path

4. `review_evidence_contradiction`
- review gate evidence is contradictory or unsupported against declared claim

5. `surface_registration_gap`
- deterministic detector found governed changed file not present in inventory

6. `drift_blocking`
- semantic mismatch across canonical contract/docs/status/readme

7. `safety_floor_violation`
- attempted weakening of evidence/SHA/rollback/review invariants

8. `cadence_breach`
- experimental/adjacent surface missed mandatory review cadence

### Recovery Policy

1. All failures above are blocking unless explicitly marked warning by policy.
2. Blocking failures require corrective change and re-validation from failed
   state.
3. Override requires tracked human acknowledgement artifact; absence of artifact
   at canonical path makes override invalid.
4. `safety_floor_violation` has no auto-remediation path; it requires explicit
   rollback or compensating control.
5. `cadence_breach` defaults to non-core stale handling:
   - `adjacent`: admission freeze
   - `experimental`: default-surface disablement
6. `surface_registration_gap` is resolved only by inventory update with
   canonical `ownedPaths[]` coverage.

### Operator Expectations

- Every blocker must emit a precise reason and a concrete remediation target.
- Gate output must identify the first blocking condition deterministically.
- Re-runs must be idempotent with stable blocker classification for identical
  inputs.

## Observability

### Primary Outcome Metrics

- `pr_lead_time_p50`
- `pr_lead_time_p90`
- `review_rework_retry_rate`
- `manual_interventions_per_agent_change`
- `merge_readiness_block_time`

### Alignment Health Metrics

- `north_star_alignment_pass_rate`
- `blocking_drift_findings_count`
- `surface_class_counts{core,adjacent,experimental}`
- `policy_surface_additions_without_glue_reduction`
- `cadence_breach_count`

### Guardrail Effectiveness Metrics

- `repeated_failure_class_count`
- `durable_guardrail_added_count`
- `post_guardrail_recurrence_rate`

### Readiness and Quality Gates

1. Metric schema validation must fail on missing required keys.
2. Weekly status generation must include metric trends and blocker counts.
3. Status output must include at least one direct tie-back from outcomes to
   north-star fields.

## Acceptance and Test Matrix

| ID | Requirement | Verification |
| --- | --- | --- |
| SA1 | Contract requires all canonical north-star keys. | Schema tests fail when any required key is absent. |
| SA2 | `primaryMetric` and `primaryBottleneck` enforce strict enumerated values. | Contract fixtures with alternate values fail validation. |
| SA3 | Preflight summary is sourced from runtime contract, not hardcoded text. | Snapshot preflight output against multiple contract fixtures. |
| SA4 | Admission rejects missing declaration fields. | Gate fixture tests for each missing declaration key. |
| SA5 | Admission rejects `metricImpact=none` for net-new policy surfaces. | Gate fixture test with policy increase, declared `policy_surface_delta>0`, and no impact evidence. |
| SA6 | Review gate enforces all four canonical north-star questions with evidence-backed responses. | Review fixture tests for contradictory, unsupported, and incomplete responses across all four `decisionQuestions[]`. |
| SA7 | Drift gate blocks mission/metric/boundary/safety-floor contradictions across canonical surfaces after normalization rules are applied. | Multi-file mismatch fixtures include alias cases for metric/bottleneck and clause-presence checks for mission, autonomy boundary, and safety floor. |
| SA8 | New/changed governance surfaces must be classified, owned, and inventory-mapped with `ownedPaths[]`. | Classification coverage test uses deterministic changed-surface detection against `SurfaceRegistration.ownedPaths[]`. |
| SA9 | Safety-floor weakening is always blocking. | Regression fixtures removing each safety-floor control fail closed. |
| SA10 | Repeated failure class triggers durable guardrail workflow on second recurrence. | Simulated repeated findings assert canonical durable guardrail artifact creation on recurrence two. |
| SA11 | Observability payload includes required outcome and health metrics. | Metrics schema tests and snapshot assertions for required keys. |
| SA12 | Status reporting cannot show green-by-feature when throughput-path metrics regress. | Status synthesis fixture fails when features are complete but lead-time outcomes degrade. |
| SA13 | Alignment state transitions are deterministic, including blocked-state resume routing via `blockedFromState`. | State-machine tests assert exact transition sequence and mapped resume target per blocker class. |
| SA14 | Non-core cadence breaches trigger class-specific stale handling. | Cadence fixture tests assert `adjacent` admission freeze and `experimental` default-surface disablement. |
| SA15 | Override attempts without valid canonical acknowledgement artifact are denied. | Override fixture tests assert hard failure for missing path, expired approval, revoked reviewer, or unresolved `signatureRef`. |
| SA16 | Re-run of unchanged blocked inputs returns stable blocker class and message. | Idempotency tests compare two identical blocked runs for classification parity. |
| SA17 | Drift normalization aliases are stable and versioned for metric and bottleneck comparisons. | Alias-map tests assert accepted narrative forms normalize to canonical enumerated values. |
| SA18 | Unmapped changed files under governance roots always emit `surface_registration_gap`. | Fixture tests change governed paths outside inventory and assert deterministic gap finding. |
| SA19 | Every blocked-state resume mapping points to a declared failure class, and every resume-routable failure class is mapped exactly once. | Taxonomy/resume consistency tests assert one-to-one coverage for `blockedFailureClass` routing. |

## Open Questions

1. Should `adjacent` surfaces also enforce explicit expiry when they repeatedly
   miss contribution evidence?
2. Should drift checks run in every fast lane or only in broader verification
   lanes?
3. Do we need a separate reliability-only admission class for surfaces that
   primarily reduce incident recovery time rather than lead-time path directly?
4. Should narrative alias maps be stored directly in contract payload or in a
   dedicated schema-side compatibility table?

## Definition of Done

1. Canonical north-star contract schema is present and enforced.
2. Preflight/admission/review/drift surfaces consume the same canonical fields.
3. Product surfaces are classified with owner, cadence, and evidence references.
4. Blocking failure classes and recovery behavior are deterministic and
   fail-closed.
5. Observability includes outcome, health, and guardrail-effectiveness metrics.
6. Drift checks use canonical normalization before mismatch blocking.
7. Override acknowledgements use one canonical path and schema contract.
8. Acceptance criteria `SA1` through `SA19` are represented by deterministic
   tests or fixture-driven gate checks.
9. Spec is ready for `ce-plan` without requiring planners to invent boundary,
   lifecycle, or blocker semantics.
