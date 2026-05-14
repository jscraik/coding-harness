---
schema_version: 1
artifact_id: jsc-311-he-phase-exit-evidence-gates-spec
artifact_type: he-spec
canonical_slug: jsc-311-he-phase-exit-evidence-gates
title: JSC-311 HE Phase-Exit Evidence Gates Spec
harness_stage: he-spec
status: ready_for_plan
date: 2026-05-11
traceability_required: true
origin: Linear JSC-311 plus JSC-301 RouteDecision future-work evidence
linear_issue: JSC-311
linear_parent: JSC-300
linear_status: unstarted
linear_project: Harness cockpit routing
risk: lifecycle-gate-evidence-contract
depth: full
ui: false
linear_mutation_status: not_needed
linear_action_required: none
contract_dependency: JSC-301
---

# JSC-311 HE Phase-Exit Evidence Gates Spec

## Table Of Contents

- [Mode Decision](#mode-decision)
- [Problem](#problem)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Linear Contract](#linear-contract)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Boundary](#boundary)
- [Baseline](#baseline)
- [Domain Model](#domain-model)
- [Gate Payload Contract](#gate-payload-contract)
- [Phase Input Contract](#phase-input-contract)
- [HeGateResult/v1 Contract](#hegateresultv1-contract)
- [HePhaseExit/v1 Contract](#hephaseexitv1-contract)
- [Gate Mapping](#gate-mapping)
- [Configuration Policy](#configuration-policy)
- [Implementation Placement](#implementation-placement)
- [Safety Contract](#safety-contract)
- [Cross-Field Invariants](#cross-field-invariants)
- [Lifecycle](#lifecycle)
- [Interfaces](#interfaces)
- [Validation Error Contract](#validation-error-contract)
- [Fixture Contract](#fixture-contract)
- [Failure And Recovery](#failure-and-recovery)
- [Observability](#observability)
- [Review Findings From Spec Deepening](#review-findings-from-spec-deepening)
- [Validation Plan](#validation-plan)
- [Review Gate](#review-gate)
- [Acceptance Matrix](#acceptance-matrix)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [First Slice](#first-slice)
- [Open Questions](#open-questions)
- [Done](#done)
- [he-plan Handoff](#he-plan-handoff)
- [Blackboard Delta](#blackboard-delta)
- [Evidence](#evidence)

## Mode Decision

Spec mode: Linear-backed standard behavior contract.

Spec depth: full, because the slice defines agent-execution evidence, closeout
state, blocker semantics, and commit-readiness safety rules.

Selected slice:

- Linear issue: JSC-311.
- Parent issue: JSC-300.
- Title: [coding-harness] Add HE phase-exit evidence gates for skill-backed commit readiness.
- Project: Harness cockpit routing.
- Contract dependency: JSC-301 RouteDecision/v1 contract and cockpit compatibility mapping.
- Source artifacts:
  - .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md.
  - .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md.
  - .harness/linear/coding-harness-linear-plan.md.

This spec owns the evidence contract for phase-exit gates. It does not implement
a public command surface and does not grant route labels authority to prove that
a skill or reviewer actually ran.

## Problem

RouteDecision/v1 can classify lifecycle intent, but it does not prove that a
required closeout gate ran with enough evidence to permit a phase exit, heartbeat
continuation, or local commit. The current operating language names gates such as
$simplify, @testing-reviewer, $he-fix-bugs, $he-code-review, and $autofix, but
without a typed evidence result an agent can accidentally treat prompt-memory
claims, route labels, or prose summaries as execution proof.

That creates three material risks:

- Commit-readiness gates become ceremonial because there is no machine-readable
  distinction between required evidence, skipped evidence, and narrative claims.
- @testing-reviewer can be incorrectly treated as a bug-repair gate even though
  it is only test-adequacy evidence.
- $he-fix-bugs can be incorrectly required when no failing evidence exists, or
  incorrectly passed when failing evidence exists without reproduction, repair,
  and validation proof.

The missing contract is a small, typed, internal evidence layer between lifecycle
routing and closeout decisions.

## Goals

- Define HeGateResult/v1 for one phase-exit gate result.
- Define HePhaseExit/v1 for aggregating configured gate results into a safe
  phase-exit recommendation.
- Define deterministic validation-error output so failing gates are testable and
  useful to agents.
- Define typed gate payloads so gate-specific acceptance criteria are
  machine-checkable without summary-string heuristics.
- Define explicit phase input signals for conditional gates such as he_fix_bugs
  and autofix.
- Model the first gate set from $simplify, @testing-reviewer, $he-fix-bugs,
  $he-code-review, and $autofix.
- Preserve the distinction between a route recommendation and evidence that a
  gate ran.
- Preserve the distinction between test adequacy review and bug fixing.
- Make missing, blocked, failed, and not-applicable gate states explicit.
- Require evidence references for gates that claim pass, fail, blocked, or
  skipped outcomes.
- Keep the first implementation internal and fixture-driven so later CLI or
  cockpit integration can be mechanical.
- Provide acceptance criteria that can be implemented as focused TypeScript
  tests before any public runtime surface exists.

## Non-Goals

- Do not expose a public harness he-phase-exit or equivalent CLI command in the
  first implementation slice.
- Do not execute arbitrary skill prompt bodies from TypeScript.
- Do not infer that a skill ran from prose that merely resembles the skill's
  output.
- Do not make @testing-reviewer satisfy $he-fix-bugs.
- Do not make $he-fix-bugs mandatory when no concrete failing evidence exists.
- Do not mutate Git, Linear, GitHub, CodeRabbit, CircleCI, or external services.
- Do not replace RouteDecision/v1 or HarnessDecision/v1.
- Do not change normal harness next --json behavior in the first slice.
- Do not make gate evaluation merge-blocking until an explicit adapter or
  governance slice promotes it.

## Linear Contract

- linear_mutation_status: not_needed.
- linear_action_required: none.
- Linear issue: JSC-311.
- Parent: JSC-300.
- Project: Harness cockpit routing.
- Labels observed on the live issue: Drift-Risk, Routing, Eval, Agent-Native,
  Reliability.
- Git branch suggested by Linear: jscraik/jsc-311-coding-harness-add-he-phase-exit-evidence-gates-for-skill.

This spec is the durable local contract for the selected slice. No Linear update
is required to create the spec because the live issue already contains objective,
scope, out-of-scope, acceptance, validation, and rollback language.

## Linear Work Item Contract

JSC-311 objective:

- Add typed, testable HE phase-exit evidence gates so commit readiness and
  heartbeat stop rules can distinguish actual gate evidence from prompt-memory
  claims.

JSC-311 required first-gate set:

- $simplify.
- @testing-reviewer.
- $he-fix-bugs.
- $he-code-review.
- $autofix.

JSC-311 core safety rule:

- A configured required gate with status fail, blocked, or not_run must prevent
  a commit-ready phase-exit decision.
- Duplicate results for the same required gate must be rejected instead of
  allowing last-write-wins behavior.

## Boundary

In scope:

- TypeScript type contracts for HeGateResult/v1, HePhaseExitInput/v1, and
  HePhaseExit/v1.
- Pure validation and aggregation helpers.
- Deterministic validation-error objects for structural and semantic failures.
- Fixture cases for gate-result classification and phase-exit aggregation.
- Focused tests proving route labels are not gate-run evidence.
- Internal exports where needed by tests or later adapter work.

Out of scope:

- Public CLI commands.
- Runtime invocation of skills or subagents.
- Local commit, push, PR, or Linear mutation.
- Automatic CodeRabbit, GitHub, CircleCI, or Linear API access.
- Modifying RouteDecision/v1 beyond compatibility fixtures if needed.
- Coupling phase-exit gates to live session state before an adapter contract is
  approved.
- Defining repository-wide default required gates outside fixture or helper
  inputs.
- Migrating existing route-decision validators from string-array errors to the
  new HE validation error contract.

## Baseline

Verified from local and live evidence:

- JSC-301 defines route-decision future work for skill-modelled gate contracts.
- JSC-301 plan names JSC-311 as the future work issue for skill-backed simplify,
  review, autofix, bug-fix, and testing gates.
- Live Linear issue JSC-311 is unarchived, high priority, under project Harness
  cockpit routing, parented by JSC-300.
- .harness/linear/coding-harness-linear-plan.md identifies JSC-311 as the next
  spec candidate after the Linear delta capture gate.

Assumptions that remain:

- The first implementation will live in the existing TypeScript contract or
  decision modules rather than a new command family.
- The repo's existing fixture/test patterns for decision contracts are the right
  implementation style for this slice.
- Skill-backed gates will initially be represented by evidence artifacts and
  structured results, not by direct skill execution from code.
- Required-gate configuration for the first slice can be fixture-local or helper
  input; repository-wide policy wiring belongs to a later adapter slice.
- The implementation can validate JSON-shaped objects without introducing a new
  runtime schema dependency unless the existing codebase already has a preferred
  schema validator in the relevant module boundary.
- The new validation error shape is local to JSC-311 HE phase-exit helpers and
  does not require changing existing route-decision validator return types.

## Domain Model

### Gate Identity

HeGateId is the canonical id for a configured phase-exit gate.

Initial values:

- simplify.
- testing_reviewer.
- he_fix_bugs.
- he_code_review.
- autofix.

### Execution Mode

HeGateExecutionMode describes how the evidence was produced.

Allowed values:

- direct_skill: the named skill workflow was directly invoked and produced
  evidence.
- subagent_proxy: a bounded subagent or reviewer role produced evidence that
  explicitly maps to the gate contract.
- manual_review: a human or agent performed the review manually and recorded
  structured evidence.
- validation_only: the result is based only on command/test output and does not
  claim skill or reviewer execution.
- not_applicable: the gate is intentionally not required for the current
  evidence state.
- not_run: the gate was required or considered but has no execution evidence.

### Gate Status

HeGateStatus describes the result of one gate.

Allowed values:

- pass: required evidence exists and no blocking issue remains.
- fail: the gate found a blocking issue that remains unresolved.
- blocked: the gate could not complete because required evidence, permission,
  runtime, or external state is unavailable.
- not_applicable: the gate is not required for this phase because the trigger
  condition is absent.
- not_run: the gate has no evidence and no valid not-applicable reason.

### Evidence Reference

HeEvidenceRef points to the artifact, command, file, reviewer output, or runtime
observation supporting a gate claim.

Required fields:

- id: stable local evidence id unique within one gate or phase result.
- kind: command, file, artifact, review, linear, github, coderabbit, circleci,
  or note.
- ref: path, command text, issue key, PR URL, check name, or artifact id.
- summary: short factual explanation of what the evidence proves.
- outcome: pass, fail, blocked, warning, or informational.

### Evidence Resolution

Evidence resolution is gate-local in v1.

Rules:

- Each HeGateResult owns its source_refs and evidence_refs arrays of HeEvidenceRef
  objects.
- HeEvidenceRef.id values must be unique within one HeGateResult across
  source_refs and evidence_refs.
- Findings, actions, validation refs, and gate_payload refs resolve only against
  the containing gate result's evidence ids.
- HePhaseExit/v1 aggregate evidence_refs are copied from validated gate results
  and do not create a second lookup scope for gate-local validation.
- A missing or ambiguous id must produce missing_evidence_ref with a deterministic
  path.

### Finding

HeGateFinding records a gate-discovered issue or explicit non-issue.

Required fields:

- severity: critical, high, medium, low, or informational.
- title: concise finding title.
- evidence_refs: one or more HeEvidenceRef ids.
- status: open, fixed, deferred, false_positive, not_applicable, or blocked.
- remediation: short remediation or skip rationale.

### Action

HeGateAction records work performed or intentionally skipped.

Required fields:

- kind: fix, test, review, skip, defer, or escalate.
- summary: what happened.
- evidence_refs: supporting HeEvidenceRef ids.
- validation_refs: validation evidence ids when the action claims a fix or pass.

### Review Provenance

ReviewProvenance records who or what produced review evidence.

Required fields when execution_mode is manual_review or subagent_proxy:

- reviewer_kind: agent, subagent, human, external_service, or unknown.
- reviewer_id: stable local identifier or external reviewer reference.
- independence: self, independent, or unknown.
- artifact_ref: evidence artifact or review output reference.
- evidence_refs: HeEvidenceRef ids that prove the review occurred.

Rules:

- he_code_review cannot claim independent review when independence is self or
  unknown.
- manual_review can satisfy structural evidence only when reviewer provenance is
  present.
- A later policy layer may require independence independent for specific gates.

## Gate Payload Contract

Gate-specific requirements must be represented by typed payload fields instead
of inferred from free-text summaries.

HeGatePayload is a discriminated union keyed by gate_id.

Required payload variants:

- simplify: requires reuse_review, quality_review, and efficiency_review. Each
  review entry must include status, evidence_refs, and item_accounting.
- testing_reviewer: requires test_adequacy_review with evidence_refs,
  coverage_gap_findings, edge_case_findings, and validation_refs.
- he_fix_bugs: requires failing_evidence_present, failing_evidence_refs,
  reproduction, root_cause, repair, regression_protection, validation_refs, and
  rollback_note. When failing_evidence_present is false, reproduction, repair,
  and regression protection may be not_applicable only with source evidence.
- he_code_review: requires findings_first, traceability_refs,
  validation_summary_refs, blocker_classification, and safe_to_continue_basis.
- autofix: requires review_feedback_present, feedback_inventory,
  item_accounting, disposition_summary, and validation_refs.

Shared payload entry rules:

- status fields use pass, fail, blocked, not_applicable, or not_run.
- evidence_refs and validation_refs reference HeEvidenceRef ids.
- item_accounting entries must include item, disposition, evidence_refs, and
  validation_refs when disposition is fixed.
- Payload validation must not inspect arbitrary prose to infer missing booleans
  or statuses.

## Phase Input Contract

HePhaseExitInput/v1 is the input to aggregation.

Required fields:

- schema_version: exactly 1.
- contract: exactly HePhaseExitInput/v1.
- phase: route, lifecycle, or closeout.
- required_gates: ordered list of HeGateId values.
- optional_gates: ordered list of HeGateId values.
- phase_context: explicit trigger context.
- gate_results: caller-provided HeGateResult/v1 records.

Required phase_context fields:

- failing_evidence_present: boolean.
- failing_evidence_refs: HeEvidenceRef ids.
- review_feedback_present: boolean.
- review_feedback_refs: HeEvidenceRef ids.
- route_decision_refs: HeEvidenceRef ids.
- changed_scope_refs: HeEvidenceRef ids.
- commit_readiness_requested: boolean.

Rules:

- he_fix_bugs may be not_applicable only when failing_evidence_present is false.
- autofix may be not_applicable only when review_feedback_present is false.
- closeout is the only phase where commit_allowed can be true.
- route and lifecycle phases evaluate exit_allowed but always return
  commit_allowed false.
- commit_readiness_requested without phase closeout is a validation error.

## HeGateResult/v1 Contract

HeGateResult/v1 represents the result of one phase-exit gate.

Required top-level fields:

- schema_version: exactly 1.
- contract: exactly HeGateResult/v1.
- gate_id: HeGateId.
- required: boolean.
- execution_mode: HeGateExecutionMode.
- status: HeGateStatus.
- result_origin: provided or synthesized_missing_required_gate.
- gate_payload: gate-specific payload matching gate_id.
- review_provenance: nullable review provenance object.
- requires_human_judgment: boolean.
- source_refs: HeEvidenceRef objects that show where the gate input came from.
- evidence_refs: HeEvidenceRef objects that support the gate outcome.
- findings: list of HeGateFinding.
- actions: list of HeGateAction.
- skipped_items: explicit list of skipped checks with rationale.
- validation: list of validation refs or structured validation outcomes.
- blocker: nullable blocker object.
- safe_to_continue: boolean.

Required blocker fields when status is blocked or fail:

- reason: factual blocker reason.
- owner: agent, user, external_service, reviewer, or unknown.
- required_next_action: concrete action needed to unblock.
- evidence_refs: supporting HeEvidenceRef ids.

Required skip item fields:

- item: skipped check, finding, or action.
- reason: why it was skipped.
- risk: residual risk.
- owner: who can accept or resolve the skip.

Rules:

- pass requires at least one evidence ref.
- fail requires at least one finding with status open or blocked.
- blocked requires a blocker.
- not_applicable requires execution_mode not_applicable, at least one source
  ref, and a reason in skipped_items.
- not_run requires execution_mode not_run and safe_to_continue false when the
  gate is required.
- safe_to_continue must be false for required gates with status fail, blocked,
  or not_run.
- source_refs prove input scope. evidence_refs prove the outcome. They are not
  interchangeable.
- result_origin must be provided for caller-supplied results and
  synthesized_missing_required_gate only for missing required gates created by
  aggregation.
- synthesized_missing_required_gate requires validation error code
  missing_required_gate and status not_run.
- review_provenance is required when execution_mode is manual_review or
  subagent_proxy.
- requires_human_judgment true requires a blocker or finding that explains the
  judgment needed.

## HePhaseExit/v1 Contract

HePhaseExitInput/v1 is the caller-provided aggregation input. HePhaseExit/v1 is
post-normalization output after duplicate checks, unknown-gate checks, trigger
checks, and missing-gate synthesis.

HePhaseExit/v1 aggregates configured HeGateResult/v1 records into a single
phase-exit recommendation.

Required fields:

- schema_version: exactly 1.
- contract: exactly HePhaseExit/v1.
- phase: route, lifecycle, or closeout phase being evaluated.
- required_gates: ordered list of required HeGateId values.
- optional_gates: ordered list of optional HeGateId values.
- gate_results: list of post-normalization HeGateResult/v1 records.
- phase_context: normalized trigger context copied from input.
- recommendation: continue, stop, human_review_required, or commit_blocked.
- exit_allowed: boolean.
- commit_allowed: boolean.
- summary: short factual summary.
- blockers: aggregated blockers.
- warnings: non-blocking residual risks.
- evidence_refs: aggregate evidence refs.
- safe_to_continue: boolean.

Rules:

- Input gate results may omit required gates.
- Duplicate gate results for the same gate id are invalid before normalization.
- Unknown gate ids are invalid before normalization.
- Missing required gate results are synthesized as not_run during aggregation.
- Output gate results must contain exactly one result for each configured
  required gate.
- A required gate with fail, blocked, or not_run forces exit_allowed false.
- A required gate with fail, blocked, or not_run forces commit_allowed false.
- For phase closeout, a required gate with fail, blocked, or not_run forces
  recommendation commit_blocked unless requires_human_judgment is true, in which
  case human_review_required is allowed.
- For phase route or lifecycle, commit_allowed is always false and
  recommendation must not be commit_blocked.
- Optional gate failures may create warnings but must not silently override
  required-gate blockers.
- Unknown gate ids are invalid unless they are explicitly admitted through a
  later versioned extension field.
- RouteDecision/v1 route labels may be source refs, but they are never
  sufficient evidence that a gate ran.
- safe_to_continue and exit_allowed can be true only when all required gates are
  pass or validly not applicable.

### Phase Recommendation Table

| Phase | exit_allowed | commit_allowed | Allowed blocking recommendation |
| --- | --- | --- | --- |
| route | Derived from required gates | Always false | stop or human_review_required |
| lifecycle | Derived from required gates | Always false | stop or human_review_required |
| closeout | Derived from required gates | Derived from required gates | commit_blocked or human_review_required |

Recommendation rules:

- continue requires exit_allowed true.
- stop requires exit_allowed false for route or lifecycle phases when no human
  judgment is required.
- closeout with exit_allowed false must return commit_blocked unless human
  judgment is required.
- commit_blocked is valid only for closeout.
- human_review_required requires at least one required gate with
  requires_human_judgment true and a blocker or finding explaining the judgment.

### Aggregation Pipeline

Aggregation order is normative:

1. Validate HePhaseExitInput/v1 structural fields.
2. Reject duplicate gate ids in provided gate_results.
3. Reject unknown gate ids.
4. Validate provided HeGateResult/v1 records and their gate_payload variants.
5. Validate phase_context trigger consistency for he_fix_bugs and autofix.
6. Synthesize missing required gates as not_run with result_origin
   synthesized_missing_required_gate.
7. Compute blockers, warnings, exit_allowed, commit_allowed, safe_to_continue,
   and recommendation.
8. Validate the final HePhaseExit/v1 output.

This ordering resolves the difference between input permissiveness and output
cardinality: missing required gates are allowed in input, but not in output.

## Gate Mapping

### simplify

Purpose:

- Review changed code for behavior-preserving simplification, reuse, quality,
  efficiency, duplication, naming, and maintainability cleanup.

Required evidence:

- Scope evidence showing the changed files or diff under review.
- Reuse review accounting.
- Quality review accounting.
- Efficiency review accounting.
- Fixed, skipped, deferred, or false-positive disposition for each material
  finding.

Special rules:

- direct_skill means $simplify was invoked and produced evidence.
- subagent_proxy is allowed only when the reviewer output explicitly covers
  reuse, quality, and efficiency.
- A prose claim that code is simple is not sufficient evidence.

### testing_reviewer

Purpose:

- Review test adequacy, missing edge cases, weak assertions, brittle tests, and
  coverage gaps.

Required evidence:

- Scope evidence showing changed behavior under review.
- Test adequacy findings or explicit no-finding rationale.
- Validation commands or explanation of why validation could not run.

Special rules:

- testing_reviewer is test-coverage evidence only.
- testing_reviewer cannot satisfy $he-fix-bugs.
- Passing tests do not prove the testing-reviewer gate ran unless reviewer
  evidence exists.

### he_fix_bugs

Purpose:

- Repair concrete failing evidence, validated bugs, or reproducible behavior
  defects.

Required evidence when failing evidence exists:

- Failing evidence or bug report.
- Reproduction or explicit reproduction blocker.
- Root-cause explanation.
- Patch summary.
- Regression protection or explicit blocker.
- Validation evidence.
- Rollback note.

Special rules:

- Use not_applicable when no concrete failing evidence exists.
- A required he_fix_bugs gate blocks when failing evidence exists but
  reproduction, repair proof, or validation evidence is missing.
- testing_reviewer cannot substitute for he_fix_bugs.

### he_code_review

Purpose:

- Provide findings-first technical review with exact evidence and closeout
  classification.

Required evidence:

- Severity-ranked findings or explicit no-finding statement.
- Exact file-line evidence for actionable findings.
- Traceability to changed files or artifacts.
- Validation summary.
- Blocker classification.
- safe_to_continue decision.

Special rules:

- Review summaries without findings-first structure are insufficient.
- Self-approval is not independent review evidence when independent review is
  required by repo policy.

### autofix

Purpose:

- Inventory, classify, and resolve current unresolved CodeRabbit threads and
  Codex P1-P3 findings.

Required evidence:

- Review-feedback source inventory.
- Accounting for each unresolved item.
- Disposition for each item: fixed, reviewed, deferred, stale, blocked, or
  false positive.
- Validation evidence for fixed items.

Special rules:

- autofix is tied to review feedback, not generic cleanup.
- Use not_applicable when no review-feedback source exists and no unresolved
  findings are in scope.
- Block when review feedback exists but inventory or accounting is missing.

## Configuration Policy

First-slice configuration is intentionally narrow.

Allowed:

- Tests and helpers may pass required_gates and optional_gates explicitly.
- Fixtures may define scenario-local required gates.
- A later adapter may translate RouteDecision/v1 phases into required-gate sets
  after a separate spec or plan admits that behavior.

Not allowed in the first slice:

- A repository-wide default commit policy.
- A public CLI flag or config file for HE phase-exit gates.
- Automatic required-gate selection from unvalidated prompt text.
- Treating skill names found in prose as configured gates.

Versioning rule:

- HeGateResult/v1, HePhaseExitInput/v1, and HePhaseExit/v1 must reject unknown
  v1 fields only when the
  surrounding repo contract normally rejects unknown fields. If existing
  contract helpers preserve additive fields, this contract may preserve unknown
  fields under a namespaced extension object, but unknown gate ids remain
  invalid.

## Implementation Placement

Preferred placement:

- Put pure contract types and validators near the existing route-decision or
  decision-contract modules so JSC-302 adapter work can import them without
  introducing a command dependency.
- Keep fixtures beside the focused tests that exercise the contract.
- Export only the stable contract helpers needed by tests and future adapters.

Avoid:

- Adding a new command module.
- Adding IO, process, git, network, or Linear dependencies to validators.
- Reading the current git diff inside the contract module.
- Importing skill prompt Markdown into runtime TypeScript.

Dependency rule:

- If the implementation needs runtime validation, prefer existing repo patterns
  over adding a new dependency. A new schema dependency requires explicit plan
  justification and validation impact.

## Safety Contract

- Gate contracts classify evidence; they do not execute skills.
- The implementation must not evaluate arbitrary prompt text as code, shell, or
  runtime instructions.
- External system mutation is disallowed in the first slice.
- Gate results must preserve source evidence and outcome evidence separately.
- A route recommendation can trigger which gates are required, but cannot prove
  that those gates ran.
- Commit-readiness must fail closed when required gate evidence is missing.
- Not-applicable states must be justified; they cannot be used as generic pass
  states.
- Human-review recommendations must identify the missing judgment or authority.

## Cross-Field Invariants

- contract HeGateResult/v1 requires schema_version 1.
- contract HePhaseExit/v1 requires schema_version 1.
- status pass requires safe_to_continue true unless an aggregate phase policy
  overrides it.
- Required gates with status fail, blocked, or not_run require safe_to_continue
  false.
- execution_mode not_applicable requires status not_applicable.
- execution_mode not_run requires status not_run.
- status blocked requires a blocker.
- status fail requires at least one open or blocked finding.
- recommendation continue requires exit_allowed true.
- commit_allowed true is valid only for closeout phase and requires every
  configured required gate to be pass or validly not_applicable.
- A gate result cannot claim direct_skill without evidence that the named skill
  workflow was invoked.
- A duplicate gate result cannot be resolved by array order; callers must remove
  ambiguity before aggregation.

## Lifecycle

1. Collect phase context, changed-file scope, route decision, and configured
   required gates.
2. Convert each gate's evidence into HeGateResult/v1.
3. Validate each gate result against structural and semantic invariants.
4. Aggregate required and optional gate results into HePhaseExit/v1.
5. Compute recommendation and commit allowance.
6. Return blockers, warnings, and evidence refs.
7. Stop before commit if any required gate is missing, failed, blocked, or not
   run.
8. Defer external mutation and public command exposure to later slices.

## Interfaces

Initial implementation interface should be pure TypeScript:

- validateHeGateResult(result): ValidationResult.
- normalizeHeGateResult(input): HeGateResult.
- validateHePhaseExitInput(input): ValidationResult.
- aggregateHePhaseExit(input): HePhaseExit.
- validateHePhaseExit(result): ValidationResult.
- createMissingGateResult(gateId, phase, error): HeGateResult.

The exact file placement is a planning decision, but the preferred area is near
existing contract or decision helpers so route-decision tests can import the gate
contract without creating a new CLI module.

Output JSON must be deterministic enough for tests:

- Stable enum strings.
- Stable blocker and validation paths.
- Stable validation error codes.
- Stable result_origin values for provided and synthesized results.
- No timestamps required in fixture results.
- No live external IDs required except explicit source refs such as JSC-311.

## Validation Error Contract

Validation failures should return deterministic error objects rather than prose
only.

Required fields:

- code: stable machine-readable identifier such as missing_required_gate,
  duplicate_gate_result, invalid_gate_status, missing_evidence_ref,
  invalid_not_applicable_reason, route_label_used_as_gate_evidence, or
  cross_gate_substitution.
- path: JSON-style field path such as gate_results[0].evidence_refs.
- message: short human-readable explanation.
- severity: error or warning.
- gate_id: gate id when the error belongs to one gate; otherwise null.
- acceptance_id: related SA-311 acceptance id when applicable.

Rules:

- Error order must be deterministic for fixture tests.
- Structural errors should be reported before semantic aggregation errors.
- Input validation errors should be reported before synthesized missing-gate
  output errors.
- A validation result can include warnings, but warnings must not make
  commit_allowed true when a required error exists.
- Tests should assert codes and paths, not entire prose messages.

## Fixture Contract

Fixtures must cover:

- All gate ids.
- All execution modes.
- All gate statuses.
- Validation error codes and paths.
- Required gate pass.
- Required gate fail.
- Required gate blocked.
- Required gate missing and normalized as not_run.
- Required gate validly not applicable.
- Optional gate fail warning.
- Route label present without gate-run evidence.
- Duplicate gate result for one required gate.
- Missing required gate synthesized with result_origin
  synthesized_missing_required_gate.
- testing_reviewer present while he_fix_bugs remains unsatisfied.
- autofix with review-feedback inventory present.
- autofix with review-feedback source missing and valid not-applicable
  rationale.
- simplify missing one of reuse, quality, or efficiency accounting.
- he_code_review missing findings-first evidence.
- Unknown gate id rejected by v1 validation.
- Conditional he_fix_bugs and autofix trigger inputs.

## Failure And Recovery

Failure mode: route label treated as gate-run evidence.

- Recovery: reject the result or aggregate as not_run; require source and
  outcome evidence refs.

Failure mode: required gate missing.

- Recovery: synthesize not_run with result_origin
  synthesized_missing_required_gate, set safe_to_continue false, set
  exit_allowed false, and return commit_blocked only for closeout phase.

Failure mode: failing validation evidence exists but he_fix_bugs is marked not
applicable.

- Recovery: reject the gate result and require reproduction or explicit
  reproduction blocker.

Failure mode: testing_reviewer is used as bug-fix evidence.

- Recovery: reject cross-gate substitution and require a separate he_fix_bugs
  result.

Failure mode: review-feedback exists but autofix inventory is absent.

- Recovery: block autofix and aggregate commit_blocked when required.

Failure mode: public CLI behavior changes unexpectedly.

- Recovery: revert first-slice integration to pure internal exports and tests.

## Observability

Required observability for the first slice:

- Test fixture names must identify the gate and failure mode.
- Validation errors must identify the field path, stable error code, and
  invariant that failed.
- Aggregated phase-exit results must include blockers and warnings in JSON.
- Handoff summaries must report which gates passed, failed, were blocked, were
  not run, or were not applicable.
- No fake metrics, fake dashboards, or inferred reviewer execution claims.
- Phase-exit summaries should be sufficient for a heartbeat runner to report why
  it stopped without reading the full raw gate evidence.

Future observability candidates:

- A later harness next --json adapter may expose phase-exit metadata under an
  additive meta field.
- A later heartbeat workflow may persist phase-exit summaries as bounded
  collector evidence.

## Review Findings From Spec Deepening

Findings addressed in this revision:

- Required-gate configuration was under-specified. The spec now limits first
  slice configuration to helper inputs and fixtures, leaving repository-wide
  policy wiring for a later adapter slice.
- Duplicate gate results were under-specified. The spec now rejects duplicate
  gate ids instead of allowing array-order behavior.
- Validation errors were too prose-dependent. The spec now requires stable error
  codes, paths, severity, gate id, and related acceptance id where applicable.
- Implementation placement was too open. The spec now prefers pure contract
  helpers near existing decision-contract modules and forbids command, IO, git,
  network, Linear, and skill-prompt imports in the first slice.

Remaining review targets:

- Exact module path remains an he-plan decision after inspecting the current
  source tree.
- Whether to preserve unknown non-gate fields depends on existing repo contract
  helper behavior and must be verified during implementation.
- Review swarm findings added typed gate payloads, explicit phase input signals,
  input/output aggregation phases, review provenance, result origin, and
  exit_allowed semantics.
- Review swarm questioned whether not_applicable and not_run should remain in
  execution_mode. This spec intentionally preserves them because the live JSC-311
  acceptance requires fixture distinction across those modes; validators must
  enforce the cross-field invariants rather than letting the duplication drift.

## Validation Plan

Focused validation for implementation:

- TypeScript tests for HeGateResult/v1 validation.
- TypeScript tests for HePhaseExitInput/v1 validation.
- TypeScript tests for HePhaseExit/v1 aggregation.
- Existing route-decision regression tests to prove route labels remain separate
  from gate evidence.
- Existing harness-decision and next regression tests if integration touches
  shared decision modules.
- bash scripts/validate-codestyle.sh --fast.

Before local commit for an implementation slice:

- Run focused route-decision and phase-exit tests.
- Run existing harness-decision and next regression tests if touched.
- Run bash scripts/validate-codestyle.sh --fast.
- Run simplify review evidence.
- Run HE code-review evidence.
- Run testing-reviewer evidence or explicitly classify it as blocked with a
  reason.
- Run he-fix-bugs only when concrete failing evidence exists; otherwise record a
  justified not-applicable result.
- Run autofix only when review feedback exists; otherwise record a justified
  not-applicable result.

## Review Gate

Required review posture:

- Findings first.
- Exact file-line evidence for actionable code findings.
- Explicit distinction between blockers and non-blocking improvements.
- Explicit validation evidence.
- Explicit residual risk.
- Explicit safe_to_continue decision.

Independent review note:

- The coding agent cannot self-approve independent CodeRabbit or repository
  review requirements. If independent review is required, this gate can prepare
  evidence but must not claim external approval.

## Acceptance Matrix

| ID | Requirement | Validation Method | Source |
| --- | --- | --- | --- |
| SA-311-001 | HeGateResult/v1 defines gate id, required flag, execution mode, status, source refs, evidence refs, findings, actions, skipped items, validation, blocker, and safe_to_continue. | Type-level checks and fixture validation tests. | JSC-311 scope |
| SA-311-002 | Gate fixtures distinguish direct_skill, subagent_proxy, manual_review, validation_only, not_applicable, and not_run. | Fixture tests for each execution mode. | JSC-311 acceptance |
| SA-311-003 | simplify requires reuse, quality, and efficiency review accounting. | Negative fixture missing one lane fails validation. | JSC-311 acceptance |
| SA-311-004 | testing_reviewer cannot satisfy he_fix_bugs. | Aggregation test with testing reviewer present and bug-fix gate absent blocks commit. | JSC-311 acceptance |
| SA-311-005 | he_fix_bugs is not_applicable when no concrete failing evidence exists. | Fixture test with no failing evidence validates not-applicable result. | JSC-301 future work |
| SA-311-006 | he_fix_bugs blocks when failing evidence exists without reproduction, repair proof, or validation. | Negative fixture with failing evidence and missing repair proof blocks. | JSC-311 acceptance |
| SA-311-007 | he_code_review requires findings-first evidence, traceability, validation, blocker classification, and safe_to_continue. | Negative fixture missing findings-first or traceability fails. | JSC-311 acceptance |
| SA-311-008 | autofix blocks when review feedback exists but inventory/accounting is missing. | Negative fixture with feedback source and missing inventory blocks. | JSC-311 acceptance |
| SA-311-009 | autofix can be not_applicable only when no review-feedback source or unresolved findings are in scope. | Fixture test for justified not-applicable result. | JSC-301 future work |
| SA-311-010 | HePhaseExit/v1 refuses commit when a configured required gate is fail, blocked, or not_run. | Aggregation tests for each blocking state. | JSC-311 acceptance |
| SA-311-011 | Missing required gates are normalized as not_run and block commit. | Aggregation test with omitted required gate. | JSC-311 safety |
| SA-311-012 | RouteDecision/v1 route labels are not treated as gate-run evidence. | Regression test with route label but no gate evidence blocks. | JSC-311 acceptance |
| SA-311-013 | Gate result validation separates source refs from outcome evidence refs. | Negative fixture with only source refs for pass fails. | JSC-311 safety |
| SA-311-014 | First implementation does not mutate Git, Linear, GitHub, CodeRabbit, CircleCI, or external services. | Code review and tests use pure fixtures; no external mutation command required. | JSC-311 out-of-scope |
| SA-311-015 | Duplicate gate results for the same gate id are rejected rather than resolved by array order. | Aggregation test with duplicate required gate results fails with duplicate_gate_result. | Spec deepening review |
| SA-311-016 | Validation failures expose deterministic code, path, severity, gate_id, and acceptance_id fields. | Validation tests assert error codes and paths. | Spec deepening review |
| SA-311-017 | Unknown gate ids are rejected by v1 unless admitted through a later versioned extension. | Negative fixture with unknown gate id fails validation. | Spec deepening review |
| SA-311-018 | Required-gate policy is passed as helper input or fixture config in the first slice, not hardcoded as repo-wide commit policy. | Code review verifies no global policy wiring in first slice. | Spec deepening review |
| SA-311-019 | Gate-specific requirements are represented by typed gate_payload fields, not inferred from prose summaries. | Fixture tests validate each gate payload discriminator and required fields. | Technical review |
| SA-311-020 | Phase aggregation has explicit input validation, missing-gate synthesis, and output validation order. | Aggregation pipeline tests assert duplicate, unknown, missing, and post-normalization outcomes. | Technical review |
| SA-311-021 | he_fix_bugs and autofix conditional behavior consumes explicit phase_context trigger inputs. | Tests cover failing_evidence_present and review_feedback_present true and false cases. | Technical review |
| SA-311-022 | Synthesized missing gates carry result_origin synthesized_missing_required_gate and missing_required_gate validation evidence. | Missing-gate aggregation test asserts origin and error code. | Technical review |
| SA-311-023 | manual_review and subagent_proxy results include review_provenance with independence classification. | Validation test rejects missing provenance for manual and subagent results. | Technical review |
| SA-311-024 | Non-closeout phases use exit_allowed and cannot return commit_blocked. | Route and lifecycle phase tests assert commit_allowed false and no commit_blocked recommendation. | Technical review |

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs |
| --- | --- |
| JSC-311: Gate fixtures distinguish execution modes. | SA-311-002 |
| JSC-311: simplify requires reuse, quality, and efficiency review accounting. | SA-311-003 |
| JSC-311: testing-reviewer cannot satisfy $he-fix-bugs. | SA-311-004 |
| JSC-311: he-fix-bugs blocks when failing evidence exists without reproduction and repair proof. | SA-311-006 |
| JSC-311: he-code-review requires findings-first evidence, traceability, validation, and safe_to_continue. | SA-311-007 |
| JSC-311: autofix blocks when review feedback exists but inventory/accounting is missing. | SA-311-008 |
| JSC-311: Phase exit refuses commit when any required configured gate is fail, blocked, or not_run. | SA-311-010, SA-311-011 |
| JSC-311: Tests prove RouteDecision/v1 route labels are not treated as gate-run evidence. | SA-311-012 |
| JSC-311: Gate aggregation remains deterministic when duplicate, unknown, or malformed gate results are provided. | SA-311-015, SA-311-016, SA-311-017 |
| JSC-311: First-slice implementation stays internal and does not install repository-wide gate policy. | SA-311-018 |
| JSC-311: Gate-specific evidence is machine-checkable rather than inferred from prose. | SA-311-019 |
| JSC-311: Conditional gate triggers and missing-gate synthesis are deterministic. | SA-311-020, SA-311-021, SA-311-022 |
| JSC-311: Review provenance and phase recommendation semantics are explicit. | SA-311-023, SA-311-024 |

## First Slice

Recommended first implementation slice for he-plan:

Must-have first-slice acceptance:

- SA-311-001 through SA-311-024 are required where they protect fail-closed
  behavior, typed evidence, trigger-input determinism, review provenance, and
  route-label separation.
- Full cartesian expansion across every mode, status, and gate is useful
  hardening, but the first PR should avoid combinatorial fixture bulk beyond the
  cases needed to prove the listed acceptance IDs.

1. Add internal TypeScript enums/types for HeGateResult/v1 and HePhaseExit/v1.
2. Add pure validators for gate-result and phase-exit invariants.
3. Add aggregation helper that validates input, rejects duplicates and unknown
   gates, applies trigger checks, synthesizes missing required gates as not_run,
   and validates output.
4. Add fixtures for the five initial gates and the core failure modes.
5. Add focused tests for must-have acceptance IDs SA-311-001 through
   SA-311-024, prioritizing fail-closed, route-label separation, typed payload,
   trigger-input, provenance, and normalization-order cases.
6. Treat full cartesian fixture expansion across every mode and status as
   hardening scope when it exceeds the minimal cases needed to prove the
   acceptance IDs.
7. Run focused tests and bash scripts/validate-codestyle.sh --fast.
7. Stop before commit unless simplify, testing-reviewer, he-code-review, and
   conditional he-fix-bugs/autofix evidence are accounted for.

## Open Questions

- Should HeGateResult/v1 live under the existing route-decision contract module,
  a new HE contract module, or a broader decision-contract module?
- Which later slice should expose phase-exit evidence through harness next
  --json metadata, if any?
- Should future heartbeat collector bundles persist raw gate evidence or only
  normalized HePhaseExit/v1 summaries?
- Should manual_review be allowed for all gates, or should some gates require
  direct skill or subagent evidence once the runtime surface exists?
- What is the exact independent-review source for he-code-review when CodeRabbit
  or an external reviewer is unavailable?

## Done

This spec is complete when:

- The JSC-311 scope is represented as a durable .harness/specs artifact.
- Goals, non-goals, assumptions, boundaries, risks, validation, rollback, and
  acceptance criteria are explicit.
- Every Linear acceptance item maps to one or more stable spec acceptance IDs.
- The first implementation slice is small enough to plan without pulling in
  public CLI, heartbeat, or external mutation scope.
- Remaining unknowns are listed as open questions instead of embedded as hidden
  assumptions.

## he-plan Handoff

Recommended plan target:

- .harness/plan/2026-05-11-JSC-311-he-phase-exit-evidence-gates-plan.md.

Plan must preserve:

- Internal first-slice scope.
- No public CLI exposure.
- No arbitrary skill-prompt execution from TypeScript.
- No external mutation.
- Route labels are source context only, not gate-run proof.
- testing_reviewer remains test adequacy only.
- he_fix_bugs is conditional on concrete failing evidence.
- autofix is tied to review-feedback inventory.
- Commit readiness fails closed for required gates that fail, block, or do not
  run.

Suggested implementation units:

- IU-311-001: Define HeGateResult/v1, HePhaseExitInput/v1, HePhaseExit/v1,
  phase context, review provenance, evidence ids, and typed gate payloads.
- IU-311-002: Implement pure validation helpers, validation error objects, and
  semantic invariants.
- IU-311-003: Implement phase-exit input validation, duplicate detection,
  unknown-gate rejection, trigger checks, missing-gate synthesis, and output
  validation.
- IU-311-004: Add fixtures and focused tests for initial gate mapping.
- IU-311-005: Run validation and review gates before commit.

## Blackboard Delta

New facts to carry forward:

- JSC-311 is the approved next spec candidate after the Linear delta capture
  gate.
- The first implementation must be evidence-contract work, not command execution
  work.
- The highest-risk loophole is treating a lifecycle route, prompt-shaped prose,
  reviewer summary, or untyped evidence summary as proof that a required gate
  ran.
- @testing-reviewer, $he-fix-bugs, and $autofix have separate trigger semantics
  and must not be collapsed into one generic review gate.

## Evidence

- Live Linear issue JSC-311: objective, scope, out-of-scope, acceptance,
  validation gates, rollback conditions, labels, project, and parent were read
  during spec creation.
- .harness/linear/coding-harness-linear-plan.md: identifies JSC-311 as the
  approved next spec candidate after delta capture.
- .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md: defines the
  RouteDecision/v1 contract dependency and future-work gate semantics.
- .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md: defines
  JSC-311 implementation-unit candidates and stop-before-commit evidence gates.
