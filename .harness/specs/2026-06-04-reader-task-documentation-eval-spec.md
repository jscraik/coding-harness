---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: reader-task-documentation-eval-spec
artifact_type: he-spec
canonical_slug: reader-task-documentation-eval
title: Reader-Task Documentation Eval Spec
harness_stage: he-spec
status: proposed
date: 2026-06-04
origin: user-requested he-spec for JSC-394 from the documentation architecture comparison plan
source_type: spec
authority: execution-input
lifecycle_status: execution-input
canonical_destination: src/lib/docs-surface
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: event-driven
validated_by:
  - pnpm docs:lint
  - pnpm docs:lifecycle
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
  - .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
  - .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md
linear_issue: JSC-394
linear_issue_url: https://linear.app/jscraik/issue/JSC-394/coding-harness-add-deterministic-reader-task-documentation-evals
linear_parent: JSC-392
linear_project: Harness control-loop hardening
linear_status_source: .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
linear_mutation_status: not_needed
linear_action_required: false
safe_to_continue: true
blocked_reason: null
traceability_required: true
risk: documentation-routing-and-agent-authority
depth: bounded-eval-contract
ui: false
lifecycle_scope: spec_for_next_execution_slice
planning_only_delivery_allowed: true
acceptance_ids:
  - SA-001
  - SA-002
  - SA-003
  - SA-004
  - SA-005
  - SA-006
  - SA-007
  - SA-008
---

# Reader-Task Documentation Eval Spec

## Table of Contents

- [Command Summary](#command-summary)
- [Purpose](#purpose)
- [Problem Statement](#problem-statement)
- [User / Operator Scenarios](#user--operator-scenarios)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Current State / Evidence](#current-state--evidence)
- [Authority and Scope Boundary](#authority-and-scope-boundary)
- [Proposed Behavior](#proposed-behavior)
- [Requirements](#requirements)
- [Interfaces](#interfaces)
- [Data / Domain Contract](#data--domain-contract)
- [Enforcement Contract](#enforcement-contract)
- [Proof and Runtime Boundary](#proof-and-runtime-boundary)
- [Coding and Testing Lenses](#coding-and-testing-lenses)
- [Security, Privacy, and Safety](#security-privacy-and-safety)
- [Accessibility and Operator Ergonomics](#accessibility-and-operator-ergonomics)
- [Failure and Recovery](#failure-and-recovery)
- [Validation Plan](#validation-plan)
- [Acceptance Criteria](#acceptance-criteria)
- [Visual References / Diagrams](#visual-references--diagrams)
- [Implementation Notes](#implementation-notes)
- [Open Questions](#open-questions)
- [Decision](#decision)
- [Evidence and References](#evidence-and-references)
- [Appendix A. Harness Metadata / Traceability](#appendix-a-harness-metadata--traceability)
- [Appendix B. Review Outcomes](#appendix-b-review-outcomes)
- [Appendix C. he-plan Handoff](#appendix-c-he-plan-handoff)

## Command Summary

BLUF: This spec defines the reader-task documentation eval lane for Coding Harness so maintainers can prove that an agent chooses the right canonical document, validation command, stop condition, and forbidden claim for common delivery scenarios. The work matters because the current docs gates prove markdown shape, metadata, and required surfaces, but they do not prove that a real agent or reader can route from a messy prompt to the correct source of truth. The decision is to build a deterministic fixture runner first, keep it advisory until fixtures are stable, and defer mandatory docs-gate enforcement until later approval. The main risk is turning this into a subjective documentation-quality grader, so every fixture must assert concrete source paths, commands, stop rules, and claims that must not be made. The next action is for he-plan to split implementation into a small fixture schema, runner, tests, package script, and optional advisory docs-gate projection.

Decision Needed: approve this spec as the behavior contract for JSC-394 before implementing the reader-task eval runner.

Top Risks:

- Subjective prose ratings could make the eval flaky and unactionable.
- Mandatory docs-gate enforcement could block unrelated work before fixtures are stable.
- Eval fixtures could encode stale documentation routes if they are not tied to canonical source files and validation commands.

Next Action: route this spec through he-plan for PU-004 implementation units.

## Purpose

Define a deterministic documentation task eval that answers one practical
question: when a user or agent needs to perform a real Coding Harness task, can
the documentation route them to the correct source of truth without allowing a
false delivery claim?

The eval is not a readability score. It is a route-truth and claim-safety check.
Each fixture presents a task prompt and asserts:

- the canonical source path or paths the agent should use;
- the validation command or blocked validation reason the agent should report;
- the stop condition that prevents unsafe continuation;
- the claim or evidence shortcut the agent must not make; and
- the expected advisory or required severity once the fixture is promoted.

## Problem Statement

Coding Harness already has documentation lifecycle metadata, a docs lifecycle
manifest, docs-gate required surfaces, and progressive-disclosure routing. Those
checks prove that documents exist, carry expected metadata, and stay connected
to governance rules. They do not prove that a reader can complete a task.

The documentation architecture audit identified this as a P0 gap: a document can
lint cleanly and still send an agent to the wrong authority, treat research as
canon, claim green PR state from local tests, or update downstream templates
from a source-only document. Without a reader-task eval, future README or
AGENTS compression could look cleaner while silently weakening route truth.

JSC-394 closes that gap by specifying the first deterministic eval lane before
JSC-397 moves or compresses progressive-disclosure documentation.

## User / Operator Scenarios

| Scenario | Reader Need | Required Eval Behavior |
| --- | --- | --- |
| PR checks are green but review threads may remain open | Keep CI, review state, mergeability, and local validation separate | Fixture must expect review-state docs and forbid merge-ready or done claims from checks alone. |
| Raw research conflicts with a governed doc | Know which source can route implementation | Fixture must expect the governed doc or admitted spec/plan and forbid treating raw research as current doctrine. |
| Generated architecture context is stale | Avoid editing generated orientation as source truth | Fixture must expect source docs or regeneration command and forbid patching generated context as canonical source. |
| Downstream scaffold needs a docs update | Preserve source-only distribution boundaries | Fixture must expect distribution-impact docs and forbid copying source-only docs into templates without a packaging decision. |
| PR closeout misses lifecycle impact | Record docs, validation, review, and SemVer impact separately | Fixture must expect PR closeout/template docs and forbid a generic "docs not needed" claim when governed surfaces changed. |
| README or AGENTS feels too large | Prove routing before compression | Fixture must expect progressive-disclosure and instruction-map sources and forbid moving binding rules without eval proof. |

## Goals

- Specify the fixture shape for deterministic reader-task documentation evals.
- Specify the result schema for JSON output suitable for later docs-gate
  projection.
- Define initial fixture categories for the JSC-394 source plan.
- Keep the first implementation advisory until fixture stability is proven.
- Ensure each fixture asserts canonical source, validation, stop condition, and
  forbidden claim.
- Preserve traceability to VAC-003 and VAC-005.
- Make future progressive-disclosure cleanup testable before JSC-397 changes
  README, AGENTS, or deep routing docs.

## Non-Goals

- Do not implement an LLM judge as the first eval mechanism.
- Do not add network-bound evals.
- Do not make docs-gate fail on reader-task evals in the first implementation
  unless a later plan and user approval promote the gate.
- Do not compress README.md, AGENTS.md, or docs indexes in JSC-394.
- Do not rewrite downstream templates in JSC-394.
- Do not claim live Linear, PR, CI, review-thread, or merge-readiness truth from
  this local spec.
- Do not score prose beauty, brand polish, or documentation taste.

## Current State / Evidence

Verified current surfaces:

- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md maps
  PU-003 to this spec and PU-004 to implementation.
- .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
  maps JSC-394 to PU-003, PU-004, VAC-003, and VAC-005.
- The same Linear plan records JSC-394 as Now and says the future command is
  pnpm docs:task-eval.
- .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
  recommends reader-task evals as a P0 gap.
- package.json currently has docs:lint, docs:lifecycle, docs:style:changed, and
  docs:ubiquitous:guard, but no docs:task-eval script.
- src/lib/docs-surface currently owns docs lifecycle validation and is the
  smallest existing module family for documentation-surface checks.
- docs-gate is the aggregation point for docs-governance findings, but the plan
  forbids mandatory docs-gate integration before eval design proves stable.

Evidence not refreshed in this turn:

- Live Linear issue field state for JSC-394. The local he-linear-plan artifact
  records the live issue URL and creation receipt, but this spec does not claim
  current tracker status.

## Authority and Scope Boundary

requested_depth: bounded_spec

approved_execution_boundary: The user requested the next he-spec for the next
Linear issue suggested by the documentation architecture plan, using docs-expert
and improve-codebase-architecture.

downscope_authority: source_artifact. The source plan limits JSC-394 to PU-003
and PU-004: reader-task eval design and the smallest deterministic runner.

external_mutation_boundary: none. Do not mutate Linear, GitHub, CI, release
settings, branch protection, or downstream projects from this spec.

freshness_required: validation_time for repo files. Tracker state must be
refreshed separately before tracker closeout or mutation claims.

human_acceptance_boundary: required before promoting reader-task evals from
advisory to required docs-gate enforcement.

## Proposed Behavior

Coding Harness should gain a deterministic reader-task eval surface that can run
locally without network access or model judging. The runner reads a small fixture
set, checks each fixture against the current repository files and configured
expectations, and emits a JSON report.

The first runner should be advisory. A passing advisory result may support
future progressive-disclosure cleanup; a failing advisory result should explain
which route, command, stop condition, or forbidden claim is unsafe. Mandatory
docs-gate integration should wait until the fixture schema and initial fixtures
have passed locally and a later plan explicitly promotes the gate.

### Fixture Categories

| Category | Purpose | Example Expected Source |
| --- | --- | --- |
| review-state-truth | Separate PR checks from unresolved review threads and merge readiness | docs/guardrails/review-state.md, .github/PULL_REQUEST_TEMPLATE.md |
| research-vs-canon | Prevent raw or historical research from overriding admitted canon | .harness/README.md, docs/architecture/documentation-layers.md |
| generated-context-boundary | Prevent edits to generated orientation as source truth | ARCHITECTURE.md, docs/agents/00-architecture-bootstrap.md |
| downstream-distribution | Prevent source-only docs leaking into templates | docs/doc-lifecycle-manifest.json, docs/architecture/documentation-layers.md |
| pr-closeout-lifecycle-impact | Force docs, validation, review, and SemVer impact to be classified | .github/PULL_REQUEST_TEMPLATE.md, docs/agents/04-validation.md |
| progressive-disclosure-safety | Prove canonical routing before README or AGENTS compression | AGENTS.md, docs/agents/01-instruction-map.md |

## Requirements

### Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-001 | The eval MUST define fixtures with a stable id, prompt, expected canonical sources, expected validation, expected stop condition, forbidden claims, severity, and acceptance trace. |
| FR-002 | The eval MUST fail a fixture when an expected source path is missing from the repository. |
| FR-003 | The eval MUST fail a fixture when it has no expected validation command or explicit blocked-validation reason. |
| FR-004 | The eval MUST fail a fixture when it has no stop condition. |
| FR-005 | The eval MUST fail a fixture when it has no forbidden claim. |
| FR-006 | The eval MUST emit machine-readable JSON with per-fixture status, findings, evidence refs, and summary counts. |
| FR-007 | The first implementation MUST run without network access and without LLM judging. |
| FR-008 | The first implementation MUST be advisory unless a later approved plan promotes it to required docs-gate enforcement. |
| FR-009 | The fixture set MUST include at least one case for each category named in this spec. |
| FR-010 | The eval MUST distinguish missing fixture configuration from failed repository evidence. |
| FR-011 | The eval SHOULD provide a compact text fallback for humans when JSON is not requested. |
| FR-012 | The eval MUST preserve VAC-003 and VAC-005 traceability in fixture metadata or result output. |

### Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-001 | The eval should be deterministic across machines when run from the same git tree. |
| NFR-002 | The eval should add minimal context load: fixtures should be compact and source-path based. |
| NFR-003 | The eval should use existing docs-surface module patterns before adding a new architecture. |
| NFR-004 | The eval should keep false positives explainable with a single missing source, command, stop condition, or forbidden claim. |
| NFR-005 | The eval should be cheap enough to run inside related tests and docs-gate advisory mode. |

## Interfaces

### Package Script

JSC-394 implementation should add this package script only after the runner
exists:

    {
      "docs:task-eval": "tsx scripts/check-docs-task-eval.ts"
    }

### Script Interface

The command should support:

    pnpm docs:task-eval
    pnpm docs:task-eval -- --json

If the implementation uses a repo wrapper instead of a package script, it must
preserve the planned command name or update the plan and validation docs in the
same change.

### TypeScript Module Interface

The docs-surface module should expose a small public runner boundary, for
example:

    type DocsTaskEvalReport = {
      schema: "docs-task-eval-report/v1";
      status: "pass" | "fail";
      fixtures: DocsTaskEvalFixtureResult[];
      summary: {
        total: number;
        passed: number;
        failed: number;
        advisory: number;
        required: number;
      };
    };

The exact names may change during implementation, but the public boundary must
remain report-oriented rather than exposing internal parser details to callers.

## Data / Domain Contract

### Fixture Schema

A fixture must contain:

| Field | Required | Meaning |
| --- | --- | --- |
| id | yes | Stable kebab-case fixture id. |
| title | yes | Human-readable task name. |
| prompt | yes | The realistic user or agent task prompt. |
| expected_sources | yes | Repo-relative canonical source paths. |
| expected_validation | yes | Commands or blocked-validation reason. |
| expected_stop_condition | yes | Condition that prevents unsafe continuation. |
| forbidden_claims | yes | Claims the agent must not make from the available evidence. |
| severity | yes | advisory or required. Initial fixtures should be advisory. |
| acceptance_ids | yes | VAC or SA IDs proved by the fixture. |
| notes | no | Short implementation hint or source trace. |

Unknown fixture fields should fail closed until the implementation intentionally
supports extensibility. This keeps fixture drift visible.

### Report Schema

The report must contain:

| Field | Meaning |
| --- | --- |
| schema | docs-task-eval-report/v1. |
| status | pass when all required fixtures pass; fail when any required fixture fails. |
| advisory_status | pass, warn, or not_applicable for advisory fixtures. |
| fixtures | Per-fixture result objects. |
| findings | Machine-readable findings with id, severity, message, path, and fix. |
| summary | Counts by status and severity. |
| evidence_ref | Source paths and commands used by the report. |

Initial advisory-only runs may return top-level status pass while reporting
advisory_status warn. Required promotion must be a separate implementation
decision.

### Conformance Rules

- Required fields: fixture id, title, prompt, expected_sources,
  expected_validation, expected_stop_condition, forbidden_claims, severity, and
  acceptance_ids must be present.
- Optional fields: notes may be omitted without changing fixture meaning.
- Enum fields: severity must be advisory or required; report status must be
  pass or fail; advisory_status must be pass, warn, or not_applicable.
- Unknown-field behavior: fixture validation should fail closed on unknown
  fields until compatibility and versioning rules intentionally allow them.
- Compatibility and versioning: the first report schema is
  docs-task-eval-report/v1; later schema versions must preserve consumer
  behavior for status, findings, summary, and evidence_ref or document the
  breaking change before promotion.

## Enforcement Contract

essential_decisions:

- The first eval lane is deterministic and local, not LLM-judged.
- Fixtures assert route truth and forbidden claims, not prose quality.
- Advisory mode is the initial enforcement posture.
- Required docs-gate integration needs later approval after fixture stability.
- Fixture results must separate required failures from advisory warnings.

fillable_gaps:

- Exact TypeScript type names.
- Whether fixtures live as JSON, TypeScript constants, or Markdown-backed data,
  as long as they remain deterministic and testable.
- Exact CLI text output, provided JSON stays stable.
- Additional fixture categories that follow the same schema.

guardrails:

- Focused test for fixture schema validation.
- Focused test for missing source path failure.
- Focused test for missing validation, stop condition, and forbidden claim.
- Focused test for advisory-only report status.
- docs-gate test only if advisory projection is added.
- pnpm docs:lint for the spec and any documentation updates.
- pnpm docs:lifecycle for governed metadata health.

refusal_triggers:

- A fixture requires subjective model judgment to determine pass/fail.
- A fixture cannot name a deterministic expected source.
- A fixture cannot name a stop condition.
- A proposed implementation makes docs-gate required before advisory proof.
- A proposed implementation claims live PR, CI, Linear, or review-thread truth
  from local docs-task eval output.

durable_memory:

- Put durable fixture semantics in this spec.
- Put implementation plan units in the follow-up he-plan artifact.
- Put repeated route mistakes into docs-task eval fixtures, not scattered prose.

professional_output:

- Handoff must report changed files, exact validation commands, pass/fail or
  blocked outcomes, advisory warnings, rollback, and whether docs-gate
  integration is advisory, required, or not implemented.

## Proof and Runtime Boundary

proof_boundary: This spec proves the intended eval contract only. Completion of
JSC-394 requires implementation, fixture tests, docs:task-eval execution, and
related validation.

non_proof_sources:

- chat_summary
- stale_session
- unrefreshed_live_linear
- raw_research_without_plan_admission
- generated_context_without_source_refresh

runtime_state: spec artifact created for JSC-394; implementation not started in
this slice.

resumption_key:
.harness/specs/2026-06-04-reader-task-documentation-eval-spec.md#jsc-394

runtime_invocation_receipt: Codex Desktop session on 2026-06-04; no external
mutation.

artifact_chain_key: reader-task-documentation-eval

persistent_artifacts:

- .harness/specs/2026-06-04-reader-task-documentation-eval-spec.md
- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
- .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
- .harness/research/audits/2026-06-04-documentation-architecture-comparison.md

live_state_refresh: required before Linear mutation, PR closeout, or tracker
status claims.

session_evidence_status: historical_after_handoff

## Coding and Testing Lenses

coding_lens:

- Keep the first implementation inside src/lib/docs-surface plus one script and
  package script.
- Reuse existing docs-surface report and finding patterns where practical.
- Keep the public interface report-oriented and JSON-friendly.
- Do not expose internal fixture parsing as the command contract.
- Do not modify generated architecture context as source truth.
- Do not add LLM, network, or external tracker dependencies.

testing_lens:

- Test observable fixture behavior: pass, required fail, advisory warning,
  missing source, missing validation, missing stop condition, missing forbidden
  claim, and JSON output shape.
- Inspect existing docs lifecycle tests before adding new patterns.
- Use pnpm test -- src/lib/docs-surface/docs-task-eval.test.ts as the focused
  implementation gate.
- Use pnpm docs:task-eval after the script exists.
- Use docs-gate only for advisory projection unless promotion is approved.
- Use pnpm test:related when TypeScript behavior changes.

## Security, Privacy, and Safety

- Fixtures must use repo-relative paths only.
- The runner must not read secrets, environment files, private logs, or external
  services.
- The runner must not mutate files, Linear, GitHub, CI, or review threads.
- The runner must not infer merge readiness, review readiness, or tracker state.
- If future fixtures need private evidence, they must be represented as blocked
  validation reasons, not as embedded private content.

## Accessibility and Operator Ergonomics

This is not a UI feature, but the command output is operator-facing. Text output
should use compact statuses, stable fixture ids, clear fixes, and non-color-only
pass/fail labels. JSON output is the canonical automation interface.

## Failure and Recovery

| Failure | Required Recovery |
| --- | --- |
| Fixture expected source missing | Report failed fixture with missing path and fix. |
| Fixture lacks validation | Report configuration error and block promotion. |
| Fixture lacks stop condition | Report configuration error and block promotion. |
| Fixture lacks forbidden claim | Report configuration error and block promotion. |
| Fixture requires subjective judgment | Reject or redesign fixture before implementation. |
| docs-gate integration blocks unrelated work | Roll back required integration to advisory mode. |
| Runner grows beyond docs-surface ownership | Split only after public report contract and tests exist. |

Rollback:

- Remove docs:task-eval script and advisory docs-gate projection.
- Keep this spec as design evidence if implementation is reverted.
- Do not delete fixture source history unless an archive decision approves it.

## Validation Plan

Spec artifact validation:

    pnpm docs:lint
    pnpm docs:lifecycle
    git diff --check

Optional independent artifact-shape validation:

    Run the harness-engineering he-spec artifact validators only when their
    scripts are discoverable from the active plugin installation. If the plugin
    runtime is unavailable, record the check as blocked with the discovery
    failure instead of hardcoding a workstation-local plugin-cache path.

Implementation validation after PU-004:

    pnpm test -- src/lib/docs-surface/docs-task-eval.test.ts
    pnpm docs:task-eval -- --json
    pnpm docs:lint
    pnpm docs:lifecycle
    bash scripts/run-harness-gate.sh docs-gate --mode required --json
    pnpm test:related

Blocked until implementation:

- pnpm docs:task-eval -- --json

Reason: the command does not exist before PU-004.

## Acceptance Criteria

| ID | Acceptance Criterion | Trace |
| --- | --- | --- |
| SA-001 | Spec exists at .harness/specs/2026-06-04-reader-task-documentation-eval-spec.md and passes HE spec artifact checks. | JSC-394, PU-003 |
| SA-002 | Fixture contract requires prompt, canonical sources, validation, stop condition, forbidden claims, severity, and acceptance trace. | VAC-003 |
| SA-003 | Spec names initial fixture categories for review-state truth, research-vs-canon, generated context, downstream distribution, PR closeout lifecycle impact, and progressive disclosure safety. | VAC-003, VAC-005 |
| SA-004 | Spec requires deterministic local execution without LLM judge, network calls, or external tracker mutation. | VAC-003 |
| SA-005 | Spec separates advisory fixture warnings from required failures. | VAC-003 |
| SA-006 | Spec blocks mandatory docs-gate enforcement until fixture stability and later approval. | VAC-005 |
| SA-007 | Spec defines JSON report fields suitable for later docs-gate projection. | VAC-003 |
| SA-008 | Spec hands implementation to he-plan and preserves validation commands for PU-004. | PU-004 |

## Visual References / Diagrams

| Step | Input / Output | Safety Meaning |
| --- | --- | --- |
| 1 | Task prompt fixture | Start from a realistic user or agent task. |
| 2 | Expected canonical sources | Prove route truth with repo-relative source paths. |
| 3 | Expected validation or blocked reason | Prevent vague confidence claims. |
| 4 | Expected stop condition | Stop unsafe continuation when proof is missing. |
| 5 | Forbidden claims | Reject shortcuts such as merge-ready from local tests. |
| 6 | docs-task-eval-report/v1 | Emit deterministic JSON for later advisory docs-gate projection. |
| 7 | Progressive disclosure cleanup proof | Let JSC-397 move docs only after route behavior is tested. |

The flow shows the safety boundary: fixtures prove route and claim behavior
before docs-gate enforcement or documentation compression.

## Implementation Notes

Recommended first implementation shape:

- Add fixture data near src/lib/docs-surface or under a small docs-surface
  fixture module.
- Add src/lib/docs-surface/docs-task-eval.ts for runner behavior.
- Add src/lib/docs-surface/docs-task-eval.test.ts for focused tests.
- Add scripts/check-docs-task-eval.ts as the package-script entrypoint.
- Add package.json docs:task-eval only when the script exists.
- Add docs-gate advisory projection only after focused tests pass.

Architecture rationale from improve-codebase-architecture:

- agent_safe_boundary: risky until the public report contract and focused tests
  exist; safe after deterministic fixtures, report schema tests, and advisory
  command output are proven.
- patch_design: add one script and fixture assertions directly in tests.
- interface_design: create a small docs-surface runner that returns a stable
  report object; keep the command as presentation only.
- selected_design_decision: use interface_design because future docs-gate
  projection needs a tested report boundary and should not parse command text.

Docs-expert claim map:

| Claim | Evidence | Status |
| --- | --- | --- |
| Reader-task eval is P0 | .harness/research/audits/2026-06-04-documentation-architecture-comparison.md | verified local file |
| JSC-394 owns PU-003 and PU-004 | .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md | verified local file |
| docs:task-eval does not exist yet | package.json scripts inspected | verified local file |
| docs-surface is current docs validation module family | src/lib/docs-surface file inventory | verified local file |
| Live Linear current status | not refreshed in this turn | unclaimed |

## Open Questions

| Question | Current Decision |
| --- | --- |
| Should docs:task-eval become required in docs-gate immediately? | No. Advisory first; required promotion needs later approval. |
| Should fixtures be JSON or TypeScript constants? | Implementation may choose; report behavior and schema are binding. |
| Should an LLM judge score route quality? | No for the first implementation. Deterministic assertions first. |
| Should JSC-397 wait for docs:task-eval proof? | Yes. The source plan explicitly says progressive disclosure needs reader-task eval proof. |

## Decision

Approve the advisory deterministic reader-task eval contract for JSC-394. The
implementation should build the smallest local fixture runner and tests, expose
a stable JSON report, and avoid required docs-gate enforcement until a later
promotion decision.

## Evidence and References

- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
- .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
- .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
- .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md
- CODESTYLE.md
- codestyle/04-docs-config-and-release.md
- package.json
- src/lib/docs-surface
- docs/architecture/documentation-layers.md
- docs/agents/01-instruction-map.md

## Appendix A. Harness Metadata / Traceability

selection_evidence:

- selected_issue: JSC-394
- source_plan_units: PU-003, PU-004
- source_acceptance: VAC-003, VAC-005
- selected_stage: he-spec
- route: standard-spec
- next_stage: he-plan

authority_scope_boundary:

- requested_depth: bounded_spec
- approved_execution_boundary: user request plus source plan naming JSC-394 as
  the next Now issue after JSC-393
- downscope_authority: source_artifact
- external_mutation_boundary: none
- freshness_required: validation_time
- human_acceptance_boundary: required before required gate promotion

proof_runtime_boundary:

- proof_boundary: spec artifact checks only until implementation exists
- runtime_state: spec artifact created; implementation not started
- resumption_key: .harness/specs/2026-06-04-reader-task-documentation-eval-spec.md
- live_state_refresh: required before tracker or PR claims

## Appendix B. Review Outcomes

reviewer_coverage:

- docs-expert: applied to claim map, reader task, validation, and stale-command
  boundaries.
- improve-codebase-architecture: applied to module boundary, interface design,
  agent-safe boundary, and advisory-first enforcement.
- he-spec: applied to acceptance IDs, authority boundary, proof boundary,
  runtime persistence, coding lens, and testing lens.

confidence:

- medium-high for repo-local evidence and source-plan traceability.
- medium for implementation shape because PU-004 has not been built.
- low for live tracker current status because Linear was not refreshed in this
  turn.

## Appendix C. he-plan Handoff

handoff_target: he-plan

recommended_scope: PU-004 implementation for JSC-394.

allowed_paths_or_areas:

- src/lib/docs-surface
- scripts/check-docs-task-eval.ts
- package.json
- src/commands/docs-gate-core.ts only if advisory projection is intentionally
  included
- src/commands/docs-gate.test.ts only if advisory projection is intentionally
  included
- docs/agents/04-validation.md only if documenting the new advisory command

blocked_paths_or_areas:

- README.md and AGENTS.md compression
- mandatory docs-gate enforcement
- network-bound or LLM-judged evals
- downstream template rewrites
- external tracker mutation

handoff_validation:

- pnpm test -- src/lib/docs-surface/docs-task-eval.test.ts
- pnpm docs:task-eval -- --json
- pnpm docs:lint
- pnpm docs:lifecycle
- bash scripts/run-harness-gate.sh docs-gate --mode required --json
- pnpm test:related
