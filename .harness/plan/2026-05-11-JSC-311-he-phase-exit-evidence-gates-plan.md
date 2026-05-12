---
schema_version: 1
artifact_id: jsc-311-he-phase-exit-evidence-gates-plan
artifact_type: he-plan
canonical_slug: jsc-311-he-phase-exit-evidence-gates
title: JSC-311 HE Phase-Exit Evidence Gates Plan
harness_stage: he-plan
status: ready_for_work
date: 2026-05-11
traceability_required: true
origin: .harness/specs/2026-05-11-jsc-311-he-phase-exit-evidence-gates-spec.md
linear_issue: JSC-311
linear_parent: JSC-300
linear_status: unstarted
linear_project: Harness cockpit routing
risk: lifecycle-gate-evidence-contract
depth: deep
ui: false
linear_mutation_status: already_linked
linear_action_required: none
contract_dependency: JSC-301
post_plan_handoff: explicit_stop
---

# JSC-311 HE Phase-Exit Evidence Gates Plan

## Table Of Contents

- [Plan Decision](#plan-decision)
- [Stage Context](#stage-context)
- [Source Authority](#source-authority)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Scope Guardrails](#scope-guardrails)
- [Implementation Decision Record](#implementation-decision-record)
- [Implementation Units](#implementation-units)
- [Dependency Graph](#dependency-graph)
- [Decision Points](#decision-points)
- [Target File Inventory](#target-file-inventory)
- [Module Contract](#module-contract)
- [Validation Error Contract](#validation-error-contract)
- [Gate Payload Implementation Notes](#gate-payload-implementation-notes)
- [Aggregation Pipeline](#aggregation-pipeline)
- [Unit Plans](#unit-plans)
- [Implementation Checklist](#implementation-checklist)
- [Risk Register](#risk-register)
- [Ownership](#ownership)
- [Phase Admission Rules](#phase-admission-rules)
- [Validation Gates](#validation-gates)
- [Observability And Evidence](#observability-and-evidence)
- [Rollback And Stop Rules](#rollback-and-stop-rules)
- [Review Gates](#review-gates)
- [Technical Review Findings](#technical-review-findings)
- [Linear / Spec / Plan / PR Traceability](#linear--spec--plan--pr-traceability)
- [Acceptance Traceability](#acceptance-traceability)
- [Test Scenarios](#test-scenarios)
- [Assumptions And Unknowns](#assumptions-and-unknowns)
- [Post-Plan Handoff](#post-plan-handoff)
- [Blackboard Delta](#blackboard-delta)

## Plan Decision

This plan admits one bounded implementation slice:

JSC-311 / HE phase-exit evidence gates for skill-backed commit readiness.

The implementation is a pure TypeScript contract slice. It may add one
production module and one focused test module near the existing decision
contracts. It must not wire phase-exit output into harness next, expose a public
CLI command, execute skill prompt bodies, mutate external systems, or refactor
existing route-decision validators.

The smallest proof-producing slice is:

- typed contracts for HeGateResult/v1, HePhaseExitInput/v1, and HePhaseExit/v1;
- deterministic validation errors local to the HE phase-exit module;
- typed gate payload validation for the five initial gates;
- pure aggregation with duplicate rejection, unknown-gate rejection,
  trigger-context checks, missing-gate synthesis, and phase recommendation
  calculation;
- focused tests proving acceptance IDs SA-311-001 through SA-311-024 without
  combinatorial fixture sprawl.

## Stage Context

| Field | Value |
| --- | --- |
| selected_stage | he-plan |
| selected_slice | JSC-311 HE phase-exit evidence gates |
| slice_status | resolved |
| tracker_status | already_linked |
| artifact_identity_status | pass |
| artifact_route_status | pass |
| spec_review_status | pass_after_revision |
| evidence_freshness | live_linear_read_2026-05-11_and_repo_sources_current |
| domain_skill_status | coding_harness |
| steering_status | not_needed |
| validation_status | pass_for_spec_artifacts |
| blocker | none |

## Source Authority

Primary authorities:

| Source | Role |
| --- | --- |
| .harness/specs/2026-05-11-jsc-311-he-phase-exit-evidence-gates-spec.md | Approved behavior contract and acceptance source. |
| .harness/linear/coding-harness-linear-plan.md | Delta-captured queue source identifying JSC-311 as next spec candidate. |
| .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md | Contract dependency and route-label safety boundary. |
| .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md | Future-work source for JSC-311 implementation unit candidates. |
| src/lib/decision/route-decision.ts | Existing route-decision contract and validation style to remain untouched. |
| src/lib/decision/route-decision.test.ts | Existing focused decision-contract test style. |
| src/lib/decision/harness-decision.ts | Existing cockpit decision contract and string-array validation precedent. |

Do not expand scope from secondary context unless the spec is revised first.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Workspace/team | Jscraik / JSC |
| Project | Harness cockpit routing |
| Parent issue | JSC-300 |
| Active child issue | JSC-311 |
| Contract dependency | JSC-301 |
| Execution route | he-work after this plan |
| First active unit | IU-311-001 |
| Linear mutation status | already_linked |
| Linear action required | none |

This plan does not create or update Linear. Refresh live Linear before PR
handoff if implementation continues in a later turn.

## Scope Guardrails

In scope:

- Add src/lib/decision/he-phase-exit.ts.
- Add src/lib/decision/he-phase-exit.test.ts.
- Export constants, types, validators, and pure aggregation helpers.
- Keep validation error objects local to the new HE phase-exit module.
- Add typed gate payloads for simplify, testing_reviewer, he_fix_bugs,
  he_code_review, and autofix.
- Add HePhaseExitInput/v1 with explicit phase_context trigger inputs.
- Add tests for fail-closed behavior, route-label separation, duplicate
  rejection, unknown-gate rejection, conditional triggers, result origin, review
  provenance, and phase recommendation semantics.

Out of scope:

- CLI registry changes.
- harness next integration.
- JSC-302 adapter behavior.
- Public harness he-phase-exit command.
- Runtime invocation of skills or subagents.
- Reading git diff or session state from production validators.
- Importing skill prompt Markdown into TypeScript.
- New schema-validation dependency without plan revision.
- Migrating validateRouteDecision or validateHarnessDecision from string-array
  errors to structured error objects.
- GitHub, Linear, CircleCI, CodeRabbit, or external service mutation.
- Repository-wide default commit policy wiring.

## Implementation Decision Record

| Decision | Choice | Rationale | Revisit trigger |
| --- | --- | --- | --- |
| Module placement | Add src/lib/decision/he-phase-exit.ts and colocated test. | The module is a decision contract, depends on JSC-301 route-label safety, and should be importable by a later JSC-302 adapter without a command dependency. | Revisit only if source inspection during implementation reveals an existing HE contract module. |
| Validation shape | Use local structured ValidationError objects. | JSC-311 needs stable code/path/severity/gate_id/acceptance_id fields, but existing route-decision validators should remain unchanged. | Revisit only if a shared validation-error abstraction already exists and can be reused without broad refactor. |
| Runtime validation dependency | Use hand-written guards and helpers first. | Existing decision contracts use lightweight hand-written validation; adding a dependency would widen scope. | Revisit only with explicit plan revision and validation impact. |
| Gate-specific checks | Use a gate_payload discriminated union keyed by gate_id. | Avoids brittle string heuristics for simplify, review, fix, and autofix semantics. | Revisit only if implementation proves a smaller typed envelope can satisfy all acceptance IDs. |
| Evidence linkage | Require HeEvidenceRef.id and resolve cross-references within the containing HeGateResult. | Makes findings/actions/payload refs deterministic and avoids object duplication ambiguity. | Revisit only if tests show embedded evidence objects are simpler and still deterministic. |
| Missing required gates | Allow missing in input, synthesize as not_run during aggregation, require exactly one per required gate in output. | Resolves the validation-order contradiction found in technical review. | Revisit only if callers need strict input-only validation. |
| Conditional gates | Consume explicit phase_context booleans and refs. | he_fix_bugs and autofix must not infer trigger state from prose. | Revisit when a later adapter owns trigger extraction from live evidence. |
| Review provenance | Require provenance for manual_review and subagent_proxy. | Prevents self-review from being mistaken for independent review evidence. | Revisit when independent review policy becomes a shared gate config. |
| Phase semantics | Add exit_allowed and restrict commit_blocked to closeout. | Keeps heartbeat/lifecycle phase exits distinct from local commit readiness. | Revisit if the contract narrows to commit-only readiness. |
| Execution mode duplication | Preserve not_applicable and not_run in execution_mode. | Live JSC-311 acceptance requires fixture distinction for these modes; validators enforce cross-field consistency. | Revisit only through Linear/spec change. |

## Implementation Units

| Unit | Title | Acceptance IDs | Expected output | Agent-safe | Human review |
| --- | --- | --- | --- | --- | --- |
| IU-311-001 | Contract constants and TypeScript types. | SA-311-001, SA-311-002, SA-311-016, SA-311-019, SA-311-023 | src/lib/decision/he-phase-exit.ts exports schema constants, enums, evidence refs, payloads, provenance, gate result, input, output, and validation result types. | Yes | No |
| IU-311-002 | HeGateResult/v1 validation. | SA-311-003 through SA-311-009, SA-311-013, SA-311-016, SA-311-019, SA-311-023 | Pure validator for gate result shape, evidence ids, gate payload variants, status/mode invariants, provenance, human-judgment signal, and not-applicable rules. | Yes | Review if validator grows beyond local helpers |
| IU-311-003 | HePhaseExitInput/v1 validation and aggregation. | SA-311-010, SA-311-011, SA-311-015, SA-311-017, SA-311-020, SA-311-021, SA-311-022, SA-311-024 | Pure aggregation pipeline that rejects duplicates and unknown gates, validates triggers, synthesizes missing required gates, computes exit_allowed/commit_allowed/recommendation, blockers, and warnings. | Yes | No |
| IU-311-004 | Focused fixture and regression tests. | SA-311-001 through SA-311-024 | src/lib/decision/he-phase-exit.test.ts with must-have fixtures and route-label separation regression. | Yes | No |
| IU-311-005 | Validation and review evidence. | SA-311-014, SA-311-018 | Focused tests, existing route-decision tests, fast codestyle, simplify, testing-reviewer, he-code-review, and conditional he-fix-bugs/autofix accounting before commit. | Yes | Yes before commit |

All units can be implemented in one PR if the diff stays limited to the planned
files and validation remains focused. Split before coding if any unit pressures
src/commands/next.ts, harness next output, public CLI behavior, or external
mutation.

## Dependency Graph

| Unit | Depends on | Unlocks | Dependency rule |
| --- | --- | --- | --- |
| IU-311-001 | Approved spec and current decision-module style. | IU-311-002 and IU-311-003. | Types must land before validators and tests stabilize. |
| IU-311-002 | IU-311-001. | IU-311-004 negative gate fixtures. | Gate-result validation must be pure and independent of phase aggregation. |
| IU-311-003 | IU-311-001 and IU-311-002. | Phase recommendation tests and closeout safety proof. | Aggregation can call validation helpers, but validators must not call aggregation. |
| IU-311-004 | IU-311-001 through IU-311-003. | IU-311-005 validation evidence. | Tests should prove behavior through public helpers, not private implementation details. |
| IU-311-005 | IU-311-004. | Commit readiness. | Review gates cannot substitute for failed focused tests. |

Parallelization policy:

- IU-311-001 and fixture sketching may happen together only if the fixture names
  do not lock unimplemented helper signatures.
- IU-311-002 and IU-311-003 should be sequenced, not parallelized, because
  aggregation semantics depend on gate-result validation output.
- IU-311-005 is terminal and must not start until the implementation diff is
  stable.

## Decision Points

| Decision | Default | Escalate when |
| --- | --- | --- |
| File split | Start with one production module and one test file. | quality:size fails, readability degrades, or validator sections become hard to navigate. |
| Error code naming | Use the plan's required initial codes exactly. | A new acceptance-critical failure appears that cannot map cleanly to existing codes. |
| Unknown extra fields | Follow existing decision-contract tolerance unless tests prove ambiguity. | Unknown fields could be mistaken for valid gate ids, evidence ids, or payload semantics. |
| Runtime schema library | Do not add one. | Hand-written validation cannot satisfy deterministic path/code requirements without risky complexity. |
| Route-label evidence | Treat route labels as source context only. | Any implementation tries to count route metadata as gate-run proof. |
| Review provenance independence | Record self, independent, or unknown. | A required review gate claims independence but lacks provenance evidence. |

## Target File Inventory

Expected created files:

| Path | Purpose |
| --- | --- |
| src/lib/decision/he-phase-exit.ts | Pure HE phase-exit evidence gate contract, validators, and aggregator. |
| src/lib/decision/he-phase-exit.test.ts | Focused tests for all must-have acceptance IDs. |

Expected untouched files unless implementation evidence proves otherwise:

| Path | Reason |
| --- | --- |
| src/lib/decision/route-decision.ts | JSC-301 route contract remains advisory and should not absorb gate execution proof. |
| src/lib/decision/harness-decision.ts | Cockpit contract remains unchanged in this slice. |
| src/commands/next.ts | Public cockpit behavior remains unchanged until adapter work. |
| package.json | Existing test scripts are sufficient. |
| docs/** | No docs-gate surface is needed unless implementation changes public behavior or governance wording. |

## Module Contract

src/lib/decision/he-phase-exit.ts should provide this module contract unless
implementation testing reveals a blocker and this plan is revised before
handoff. Exports are internal package exports for tests and later adapters, not
a public CLI or stable external API.

| Export | Requirement level | Purpose |
| --- | --- | --- |
| HE_GATE_RESULT_SCHEMA_VERSION | Required now | Constant value HeGateResult/v1. |
| HE_PHASE_EXIT_INPUT_SCHEMA_VERSION | Required now | Constant value HePhaseExitInput/v1. |
| HE_PHASE_EXIT_SCHEMA_VERSION | Required now | Constant value HePhaseExit/v1. |
| HE_GATE_IDS | Required now | simplify, testing_reviewer, he_fix_bugs, he_code_review, autofix. |
| HE_GATE_EXECUTION_MODES | Required now | direct_skill, subagent_proxy, manual_review, validation_only, not_applicable, not_run. |
| HE_GATE_STATUSES | Required now | pass, fail, blocked, not_applicable, not_run. |
| HeGateId | Required now | Type derived from HE_GATE_IDS. |
| HeGateExecutionMode | Required now | Type derived from HE_GATE_EXECUTION_MODES. |
| HeGateStatus | Required now | Type derived from HE_GATE_STATUSES. |
| HePhaseExitPhase | Required now | route, lifecycle, or closeout. |
| HePhaseExitRecommendation | Required now | continue, stop, human_review_required, or commit_blocked. |
| HeValidationError | Required now | Structured validation error object. |
| HeValidationResult | Required now | valid, errors, warnings. |
| validateHeGateResult | Required now | Validate unknown value against HeGateResult/v1. |
| validateHePhaseExitInput | Required now | Validate unknown value against HePhaseExitInput/v1. |
| aggregateHePhaseExit | Required now | Produce HePhaseExit/v1 from valid input. |
| validateHePhaseExit | Required now | Validate unknown value against HePhaseExit/v1. |
| createMissingGateResult | Internal helper candidate | Build a synthesized missing-gate HeGateResult/v1; export only if tests or adapter-facing helpers need it. |

The exact object-interface spelling may be refined during implementation, but
the exported contract must preserve the spec semantics and acceptance IDs.

## Validation Error Contract

Validation errors must be deterministic and locally scoped to the HE phase-exit
module.

Required properties:

| Field | Requirement |
| --- | --- |
| code | Stable machine-readable string. |
| path | JSON-style field path. |
| message | Short human-readable explanation. |
| severity | error or warning. |
| gate_id | Gate id when the error belongs to one gate; otherwise null. |
| acceptance_id | Related SA-311 id when applicable; otherwise null. |

Required initial error codes:

| Code | Trigger |
| --- | --- |
| missing_required_gate | Required gate absent from input and synthesized as not_run. |
| duplicate_gate_result | More than one provided result for the same gate id. |
| unknown_gate_id | Provided result, required gate, or optional gate uses an unsupported gate id. |
| invalid_gate_status | status is unsupported or conflicts with execution_mode. |
| missing_evidence_ref | pass, fail, blocked, action, finding, or payload references missing evidence. |
| invalid_not_applicable_reason | not_applicable lacks trigger context, source evidence, or skip rationale. |
| route_label_used_as_gate_evidence | route-decision evidence is used as proof that a gate ran. |
| cross_gate_substitution | testing_reviewer or another gate is used to satisfy he_fix_bugs. |
| missing_gate_payload | gate_payload missing or mismatched for gate_id. |
| missing_review_provenance | manual_review or subagent_proxy lacks review provenance. |
| invalid_phase_recommendation | commit_blocked appears outside closeout or commit_allowed is true outside closeout. |
| invalid_trigger_context | he_fix_bugs or autofix status conflicts with phase_context. |

Tests should assert codes and paths, not entire prose messages.

## Evidence Resolution Contract

Evidence resolution is gate-local in the first slice.

Rules:

- Each HeGateResult owns its source_refs and evidence_refs arrays of HeEvidenceRef
  objects.
- HeEvidenceRef.id values must be unique within one HeGateResult across
  source_refs and evidence_refs.
- Findings, actions, validation refs, and gate_payload refs resolve only against
  the containing gate result's evidence ids.
- HePhaseExitInput phase_context refs may reference ids only when the related
  gate result includes those evidence ids, or may use explicit external refs in
  source_refs before aggregation normalizes them.
- HePhaseExit/v1 aggregate evidence_refs are copied from validated gate results;
  they do not create a second lookup scope for gate-local validation.
- A missing or ambiguous id must produce missing_evidence_ref with a deterministic
  path.

## Gate Payload Implementation Notes

Gate payloads are the critical implementation detail. Do not let the validators
infer gate-specific facts from free-text summaries.

Minimum payload requirements:

| Gate | Required payload fields |
| --- | --- |
| simplify | reuse_review, quality_review, efficiency_review, each with status, evidence_refs, and item_accounting. |
| testing_reviewer | test_adequacy_review with evidence_refs, coverage_gap_findings, edge_case_findings, and validation_refs. |
| he_fix_bugs | failing_evidence_present, failing_evidence_refs, reproduction, root_cause, repair, regression_protection, validation_refs, rollback_note. |
| he_code_review | findings_first, traceability_refs, validation_summary_refs, blocker_classification, safe_to_continue_basis. |
| autofix | review_feedback_present, feedback_inventory, item_accounting, disposition_summary, validation_refs. |

Implementation rules:

- evidence_refs and validation_refs point to HeEvidenceRef.id values.
- source_refs and evidence_refs on the gate result contain HeEvidenceRef objects.
- Findings, actions, and payload entries cross-reference evidence by id.
- status values inside payload entries reuse HeGateStatus.
- fixed item_accounting entries require validation_refs.
- not_applicable he_fix_bugs requires phase_context.failing_evidence_present
  false.
- not_applicable autofix requires phase_context.review_feedback_present false.

## Aggregation Pipeline

Implement aggregation in this exact order:

1. Validate HePhaseExitInput/v1 structural fields.
2. Reject duplicate gate ids in provided gate_results.
3. Reject unknown gate ids in required_gates, optional_gates, and gate_results.
4. Validate provided HeGateResult/v1 records and their gate_payload variants.
5. Validate phase_context trigger consistency for he_fix_bugs and autofix.
6. Synthesize missing required gates as not_run with result_origin
   synthesized_missing_required_gate.
7. Compute blockers, warnings, exit_allowed, commit_allowed, safe_to_continue,
   and recommendation.
8. Validate the final HePhaseExit/v1 output.

Recommendation rules:

| Phase | exit_allowed | commit_allowed | Blocking recommendation |
| --- | --- | --- | --- |
| route | Derived from required gates | Always false | stop or human_review_required |
| lifecycle | Derived from required gates | Always false | stop or human_review_required |
| closeout | Derived from required gates | Derived from required gates | commit_blocked or human_review_required |

Additional rules:

- continue requires exit_allowed true.
- stop is valid only for route or lifecycle phases with exit_allowed false and
  no human-judgment blocker.
- closeout with exit_allowed false must return commit_blocked unless human
  judgment is required.
- human_review_required requires requires_human_judgment true on at least one
  required gate plus supporting blocker or finding.
- commit_blocked is valid only for closeout.
- safe_to_continue can be true only when exit_allowed is true.

## Unit Plans

### IU-311-001 Contract Constants And Types

Steps:

1. Create src/lib/decision/he-phase-exit.ts.
2. Add schema constants, gate id constants, execution mode constants, status
   constants, phase constants, and recommendation constants.
3. Add interfaces for HeEvidenceRef, HeGateFinding, HeGateAction,
   HeReviewProvenance, HeGatePayload variants, HeGateResult,
   HePhaseExitInput, HePhaseExit, HeValidationError, and HeValidationResult.
4. Add JSDoc for exported constants, types, and functions to satisfy
   quality:docstrings.

Acceptance:

- SA-311-001.
- SA-311-002.
- SA-311-016.
- SA-311-019.
- SA-311-023.

Validation:

- TypeScript compile through focused test run or typecheck.
- Public API docs check before commit.

### IU-311-002 Gate Result Validation

Steps:

1. Add local isRecord, validateString, validateBoolean, validateEnum,
   validateArray, and evidence-id helper functions.
2. Validate base gate fields.
3. Validate evidence refs include stable ids and cross-references resolve.
4. Validate result_origin rules.
5. Validate status and execution_mode cross-field invariants.
6. Validate blocker, skipped_items, findings, actions, validation refs, and
   requires_human_judgment.
7. Validate review_provenance for manual_review and subagent_proxy.
8. Validate each gate_payload discriminator.

Acceptance:

- SA-311-003 through SA-311-009.
- SA-311-013.
- SA-311-016.
- SA-311-019.
- SA-311-023.

Validation:

- Focused negative fixture tests for each required gate payload.
- Tests assert error code and path.

### IU-311-003 Phase Exit Input Validation And Aggregation

Steps:

1. Validate HePhaseExitInput/v1 shape.
2. Validate required_gates and optional_gates.
3. Reject duplicate provided gate results before normalization.
4. Reject unknown gate ids.
5. Validate trigger context.
6. Apply he_fix_bugs and autofix trigger rules.
7. Synthesize missing required gates with createMissingGateResult.
8. Compute blockers and warnings.
9. Compute exit_allowed, commit_allowed, safe_to_continue, and recommendation.
10. Validate the final HePhaseExit/v1 output.

Acceptance:

- SA-311-010.
- SA-311-011.
- SA-311-015.
- SA-311-017.
- SA-311-020.
- SA-311-021.
- SA-311-022.
- SA-311-024.

Validation:

- Aggregation tests for missing required gate, duplicate result, unknown gate,
  non-closeout commit_blocked rejection, closeout commit_blocked, and human
  review required.

### IU-311-004 Focused Fixture And Regression Tests

Steps:

1. Create src/lib/decision/he-phase-exit.test.ts.
2. Add small valid fixtures for each gate id.
3. Add negative fixtures for payload omissions.
4. Add route-label separation test proving RouteDecision/v1 route evidence does
   not satisfy gate-run evidence.
5. Add conditional trigger tests for he_fix_bugs and autofix.
6. Add phase recommendation table tests.
7. Avoid full cartesian fixture expansion beyond cases required by acceptance
   IDs.

Acceptance:

- SA-311-001 through SA-311-024.

Validation:

- pnpm vitest run src/lib/decision/he-phase-exit.test.ts.
- pnpm vitest run src/lib/decision/route-decision.test.ts.

### IU-311-005 Validation And Review Evidence

Steps:

1. Run focused he-phase-exit tests.
2. Run existing route-decision regression tests.
3. Run existing harness-decision tests if shared decision helpers are touched.
4. Run bash scripts/validate-codestyle.sh --fast.
5. Run or collect simplify evidence.
6. Run or collect testing-reviewer evidence.
7. Run he-code-review evidence.
8. Run he-fix-bugs only if concrete failing evidence exists; otherwise record
   justified not-applicable.
9. Run autofix only if review feedback exists; otherwise record justified
   not-applicable.
10. Stop before commit unless all required gates are accounted for.

Acceptance:

- SA-311-014.
- SA-311-018.

Validation:

- Exact command outcomes and review-gate status must be recorded in handoff.

## Implementation Checklist

- [ ] Confirm branch and working tree before coding.
- [ ] Re-read src/lib/decision/route-decision.ts and route-decision.test.ts.
- [ ] Add src/lib/decision/he-phase-exit.ts.
- [ ] Add src/lib/decision/he-phase-exit.test.ts.
- [ ] Keep all implementation pure and side-effect free.
- [ ] Use explicit .js extensions for local imports.
- [ ] Add JSDoc for exported public API declarations.
- [ ] Avoid any, double assertions, and ts-ignore.
- [ ] Keep existing route-decision and harness-decision validator APIs unchanged.
- [ ] Run focused tests.
- [ ] Run fast codestyle.
- [ ] Run review gates before commit if implementation proceeds.

## Risk Register

| Risk | Likelihood | Impact | Mitigation | Stop condition |
| --- | --- | --- | --- | --- |
| Validator grows into a generic schema framework. | Medium | High | Keep helpers local and only implement JSC-311 fields. | New dependency or broad shared validation refactor appears. |
| Gate payloads become too prose-driven. | Medium | High | Require typed payload fields and assert error paths in tests. | Tests pass by matching summary text instead of typed fields. |
| Aggregator hides missing evidence by synthesizing pass-like outputs. | Low | Critical | Synthesized gates must be not_run with missing_required_gate evidence. | Missing required gate can produce exit_allowed true. |
| Existing decision contracts are accidentally changed. | Low | High | Keep route-decision and harness-decision files out of target inventory. | Existing validator API changes or next behavior changes. |
| Fixture matrix becomes too large for a focused PR. | Medium | Medium | Prioritize acceptance-critical cases and defer full cartesian expansion. | Implementation adds bulk fixtures without new acceptance coverage. |
| Review gates are mistaken for independent approval. | Medium | Medium | Record provenance and state that coding agent cannot self-approve. | he_code_review result claims external approval without source evidence. |

## Ownership

| Area | Owner |
| --- | --- |
| Product/issue scope | Linear JSC-311 under Harness cockpit routing. |
| Spec authority | .harness/specs/2026-05-11-jsc-311-he-phase-exit-evidence-gates-spec.md. |
| Plan authority | This plan. |
| Implementation | he-work or equivalent coding agent after user authorization. |
| Review | he-code-review plus required simplify/testing-reviewer gates before commit. |
| External approval | User or external reviewer when repo policy requires independent approval. |

## Phase Admission Rules

Admit implementation only when:

- The user authorizes he-work or equivalent implementation.
- The work remains limited to JSC-311.
- The JSC-301 route decision contract is not reopened.
- No public CLI or harness next integration is required.
- No external mutation is required.
- The implementation can stay within the planned target file inventory.

Stop and revise the spec or plan when:

- Implementation requires a public command.
- Implementation requires changing src/commands/next.ts.
- Implementation requires mutating existing route-decision validation APIs.
- Implementation needs a new runtime schema dependency.
- Validation requires external credentials or live service access.
- Acceptance IDs cannot be satisfied without broad framework work.

## Validation Gates

Artifact validation already required for this plan:

| Command | Expected |
| --- | --- |
| pnpm exec markdownlint-cli2 .harness/plan/2026-05-11-JSC-311-he-phase-exit-evidence-gates-plan.md | pass |
| python3 Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/plan/2026-05-11-JSC-311-he-phase-exit-evidence-gates-plan.md | pass |
| python3 Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/plan/2026-05-11-JSC-311-he-phase-exit-evidence-gates-plan.md | pass |

Implementation validation required before commit:

| Command | Required when |
| --- | --- |
| pnpm vitest run src/lib/decision/he-phase-exit.test.ts | Always for JSC-311 implementation. |
| pnpm vitest run src/lib/decision/route-decision.test.ts | Always, to preserve route-label separation. |
| pnpm vitest run src/lib/decision/harness-decision.test.ts | If shared decision helpers or types are touched. |
| pnpm run quality:docstrings | Before commit because production exports are added. |
| pnpm run quality:size | Before commit because production source changes. |
| pnpm run test:related | Before commit per repo policy for changed production source. |
| bash scripts/validate-codestyle.sh --fast | Before commit. |
| bash scripts/validate-codestyle.sh | Before PR handoff if implementation is committed. |
| bash scripts/verify-work.sh --fast | Before push/PR handoff if implementation proceeds. |

Review gates before commit:

| Gate | Required behavior |
| --- | --- |
| simplify | Account for reuse, quality, and efficiency findings. |
| testing-reviewer | Account for test adequacy independently from bug repair. |
| he-code-review | Findings-first technical review with file-line evidence. |
| he-fix-bugs | Required only when concrete failing evidence exists. |
| autofix | Required only when review feedback exists. |

## Observability And Evidence

Implementation should leave these observable artifacts:

- Deterministic validation error codes and paths in test assertions.
- Fixture names that encode the gate and failure mode.
- Aggregation output showing blockers, warnings, exit_allowed, commit_allowed,
  recommendation, and safe_to_continue.
- Missing required gates showing result_origin synthesized_missing_required_gate.
- Review provenance for manual_review and subagent_proxy fixtures.
- Handoff notes with exact command outcomes.

No fake dashboards, fake metrics, inferred skill execution, or inferred external
review approval.

## Rollback And Stop Rules

Rollback strategy:

- Revert src/lib/decision/he-phase-exit.ts and
  src/lib/decision/he-phase-exit.test.ts.
- Run pnpm vitest run src/lib/decision/route-decision.test.ts.
- Run bash scripts/validate-codestyle.sh --fast.
- Record exact pass, fail, or blocked outcomes for rollback proof.
- Leave JSC-301 route-decision contract intact.
- Do not revert unrelated .harness/linear updates unless explicitly requested.
- If a new dependency was added despite the plan, remove it and revise the plan
  before continuing.

Stop immediately if:

- A required gate can pass from route label evidence alone.
- not_applicable he_fix_bugs passes while failing_evidence_present is true.
- not_applicable autofix passes while review_feedback_present is true.
- duplicate gates resolve by array order.
- unknown gate ids are silently preserved as valid v1 gates.
- commit_blocked appears for route or lifecycle phase.
- commit_allowed can become true outside closeout phase.
- validators import skill prompt Markdown, read git state, or call external
  services.
- implementation changes existing route-decision or harness-decision APIs.

## Review Gates

Before local commit, the implementation handoff must include:

- simplify status and evidence.
- testing-reviewer status and evidence.
- he-code-review status and evidence.
- he-fix-bugs status: pass, blocked, or not_applicable with failing-evidence
  rationale.
- autofix status: pass, blocked, or not_applicable with review-feedback
  rationale.
- exact validation commands and outcomes.
- residual risk and safe_to_continue decision.

The coding agent cannot self-approve independent CodeRabbit or repository review
requirements.

## Technical Review Findings

Plan-level review targets before implementation:

| Finding | Status in plan | Follow-up |
| --- | --- | --- |
| Traceability table must satisfy HE lint columns. | Addressed by Linear / Spec / Plan / PR Traceability table. | Re-run he_linear_traceability_lint.py after every plan edit. |
| Implementation could overreach into harness next or route-decision APIs. | Guarded by scope, target inventory, rollback, and stop rules. | Review diff before commit for touched files outside target inventory. |
| Validation error model could leak into existing validators. | Guarded by local-module-only decision and out-of-scope rule. | Tests should import only he-phase-exit helpers for structured errors. |
| Gate payload validation could become string-heuristic based. | Guarded by typed payload implementation notes, gate-local evidence resolution, and test scenarios. | Review tests for typed field assertions and evidence-id resolution. |
| First-slice fixture load could become too broad. | Guarded by first-slice and risk-register guidance. | Prefer acceptance-critical fixtures over cartesian expansion. |

Open review risks:

- Exact code size cannot be known until implementation.
- Whether a helper split is needed depends on quality:size and readability.
- Independent review evidence cannot be claimed until an implementation review
  actually runs.
- Plan technical review found and patched aggregation ordering, closeout
  recommendation semantics, module-contract wording, evidence resolution scope,
  and rollback proof.

## Linear / Spec / Plan / PR Traceability

| Linear issue | Source acceptance IDs | Plan units | Acceptance IDs | PR evidence |
| --- | --- | --- | --- | --- |
| JSC-311 | SA-311-001, SA-311-002, SA-311-016, SA-311-019, SA-311-023 | IU-311-001 | SA-311-001, SA-311-002, SA-311-016, SA-311-019, SA-311-023 | pending implementation PR |
| JSC-311 | SA-311-003 through SA-311-009, SA-311-013, SA-311-016, SA-311-019, SA-311-023 | IU-311-002 | SA-311-003 through SA-311-009, SA-311-013, SA-311-016, SA-311-019, SA-311-023 | pending implementation PR |
| JSC-311 | SA-311-010, SA-311-011, SA-311-015, SA-311-017, SA-311-020 through SA-311-022, SA-311-024 | IU-311-003 | SA-311-010, SA-311-011, SA-311-015, SA-311-017, SA-311-020 through SA-311-022, SA-311-024 | pending implementation PR |
| JSC-311 | SA-311-001 through SA-311-024 | IU-311-004 | SA-311-001 through SA-311-024 | pending implementation PR |
| JSC-311 | SA-311-014, SA-311-018 | IU-311-005 | SA-311-014, SA-311-018 | pending implementation PR |

## Acceptance Traceability

| Linear issue | Acceptance IDs |
| --- | --- |
| JSC-311: Define HeGateResult/v1 required fields and gate result semantics. | SA-311-001, SA-311-016 |
| JSC-311: Distinguish execution modes including direct_skill, subagent_proxy, manual_review, validation_only, not_applicable, and not_run. | SA-311-002 |
| JSC-311: Validate simplify reuse, quality, and efficiency accounting. | SA-311-003, SA-311-019 |
| JSC-311: Prevent testing_reviewer from satisfying he_fix_bugs. | SA-311-004 |
| JSC-311: Make he_fix_bugs conditional on concrete failing evidence. | SA-311-005, SA-311-006, SA-311-021 |
| JSC-311: Validate he_code_review findings-first evidence and blocker classification. | SA-311-007, SA-311-023 |
| JSC-311: Validate autofix inventory and accounting. | SA-311-008, SA-311-009, SA-311-021 |
| JSC-311: Refuse commit when required configured gates fail, block, or do not run. | SA-311-010, SA-311-011, SA-311-022, SA-311-024 |
| JSC-311: Keep RouteDecision/v1 route labels separate from gate-run evidence. | SA-311-012 |
| JSC-311: Separate source refs from outcome evidence refs. | SA-311-013 |
| JSC-311: Avoid external mutation and repo-wide gate policy in the first slice. | SA-311-014, SA-311-018 |
| JSC-311: Reject duplicate and unknown gates. | SA-311-015, SA-311-017 |
| JSC-311: Make gate-specific requirements typed and deterministic. | SA-311-019, SA-311-020 |

## Test Scenarios

| ID | Input | Action | Expected outcome | Acceptance |
| --- | --- | --- | --- | --- |
| TS-311-001 | Valid simplify gate payload with reuse, quality, and efficiency reviews. | validateHeGateResult. | valid true, no errors. | SA-311-003 |
| TS-311-002 | simplify payload missing efficiency_review. | validateHeGateResult. | invalid with missing_gate_payload path to gate_payload.efficiency_review. | SA-311-003, SA-311-019 |
| TS-311-003 | testing_reviewer result present, he_fix_bugs required but absent. | aggregateHePhaseExit closeout. | he_fix_bugs synthesized not_run, commit_allowed false, commit_blocked. | SA-311-004, SA-311-011 |
| TS-311-004 | he_fix_bugs not_applicable while failing_evidence_present true. | aggregateHePhaseExit. | invalid_trigger_context error. | SA-311-006, SA-311-021 |
| TS-311-005 | autofix not_applicable while review_feedback_present true. | aggregateHePhaseExit. | invalid_trigger_context error. | SA-311-008, SA-311-021 |
| TS-311-006 | duplicate simplify gate results. | aggregateHePhaseExit. | duplicate_gate_result error before normalization. | SA-311-015, SA-311-020 |
| TS-311-007 | unknown gate id in required_gates. | validateHePhaseExitInput. | unknown_gate_id error. | SA-311-017 |
| TS-311-008 | route-decision ref listed without gate-run evidence. | validateHeGateResult or aggregateHePhaseExit. | route_label_used_as_gate_evidence or missing_evidence_ref. | SA-311-012 |
| TS-311-009 | manual_review he_code_review without review_provenance. | validateHeGateResult. | missing_review_provenance error. | SA-311-023 |
| TS-311-010 | lifecycle phase with failed required gate. | aggregateHePhaseExit. | exit_allowed false, commit_allowed false, recommendation stop or human_review_required, never commit_blocked. | SA-311-024 |
| TS-311-011 | closeout phase with failed required gate and no human judgment. | aggregateHePhaseExit. | exit_allowed false, commit_allowed false, recommendation commit_blocked. | SA-311-010 |
| TS-311-012 | closeout phase with blocked required gate requiring human judgment. | aggregateHePhaseExit. | human_review_required with blocker evidence. | SA-311-024 |
| TS-311-013 | pass gate with source_refs only and no outcome evidence. | validateHeGateResult. | missing_evidence_ref error. | SA-311-013 |
| TS-311-014 | valid closeout with required gates pass or validly not_applicable. | aggregateHePhaseExit. | exit_allowed true, commit_allowed true, recommendation continue. | SA-311-010 |

## Assumptions And Unknowns

Assumptions:

- src/lib/decision is the correct home for this pure contract.
- Hand-written validation is acceptable because current decision contracts use
  hand-written validators.
- The first implementation can keep all required behavior in one production
  module and one test module.
- Full cartesian fixture expansion is hardening scope unless required to prove a
  listed acceptance ID.

Unknowns to resolve during he-work:

- Whether existing test helpers can reduce fixture boilerplate without creating
  an abstraction that hides gate-specific meaning.
- Whether quality:size flags the new module as too large, requiring a split into
  a helper module.
- Whether a later JSC-302 adapter should expose HePhaseExit metadata under
  HarnessDecision.meta.

Blocked decisions:

- Public CLI exposure is blocked until a separate spec/plan admits it.
- Repository-wide commit gate policy is blocked until a later adapter/governance
  slice admits it.
- External reviewer approval remains outside this plan.

## Post-Plan Handoff

| Field | Value |
| --- | --- |
| state | explicit_stop |
| reason | Plan artifact created; implementation requires a separate he-work authorization. |
| next_recommended_skill | he-work |
| next_safe_action | Implement IU-311-001 through IU-311-004, then run IU-311-005 validation and review gates before commit. |
| safe_to_continue | true |
| blocked_reason | none |

## Blackboard Delta

New facts to carry forward:

- JSC-311 implementation should target src/lib/decision/he-phase-exit.ts and
  src/lib/decision/he-phase-exit.test.ts.
- Existing route-decision and harness-decision validators must remain unchanged.
- JSC-311 introduces a local structured validation error model only for HE
  phase-exit helpers.
- Gate-specific acceptance must be enforced through typed gate_payload fields,
  not prose summaries.
- HePhaseExitInput/v1 and HePhaseExit/v1 are separate because missing required
  gates are allowed in input but not output.
- closeout is the only phase where commit_allowed can be true or commit_blocked
  can be returned.
