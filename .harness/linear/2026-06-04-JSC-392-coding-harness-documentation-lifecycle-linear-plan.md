---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: jsc-392-documentation-lifecycle-linear-plan
selected_stage: he-linear-plan
source_type: linear-tracker
authority: execution-input
lifecycle_status: execution-input
canonical_destination: .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
source_plan: .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
source_audit: .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
parent_issue: JSC-392
linear_mutation_status: created
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
  - .harness/research/audits/2026-06-04-documentation-architecture-comparison.md
---

# Documentation Lifecycle Linear Plan

## Command Summary

BLUF: Linear tracking now gives the operator and future agents one parent issue
and five sequenced child issues for the documentation lifecycle plan, so the
repo plan no longer depends on an unlinked local artifact to drive execution.
This matters because documentation lifecycle, progressive disclosure, stale
cleanup, and downstream distribution work can otherwise splinter into backlog
items that lose source-truth and validation boundaries. The main risk is
treating the new Linear issues as implementation proof; they only prove live
tracking and must be closed by child validation, PR evidence, and release
evidence where applicable.

Decision Needed: start execution with JSC-393 and JSC-394, or reprioritize the
child issue order in Linear before implementation begins.

Top Risks:

- Linear issue creation may be mistaken for implementation proof.
- Progressive disclosure cleanup can weaken binding instructions if run before
  reader-task eval proof exists.
- Stale-document cleanup can destroy useful research unless archive decisions
  remain separate from advisory reporting.

Next Action: route JSC-393 through he-spec for the research/document lifecycle
metadata contract.

## Executive Linear Routing Summary

Linear tracking was created for the documentation architecture lifecycle plan as
one parent issue and five child execution issues. The source plan stays the
technical contract; Linear now tracks execution state, issue dependencies,
project routing, labels, and current-cycle intent. The active set is JSC-392
through JSC-397, routed to the Jscraik team, Harness control-loop hardening
project, current Cycle 5, and the coding-harness repo label.

## Target Linear Destination

- Team: Jscraik, key JSC.
- Project: Harness control-loop hardening.
- Project evidence: live Linear project 6be91342-5fb3-444e-b495-00816dba2656.
- Cycle: Cycle 5, current at mutation time.
- Repo/location label: coding-harness.

## Existing Project Match

existing_project_match:

- project: Harness control-loop hardening.
- live_evidence_source: Linear project list query for Harness.
- status: active.
- duplicate_or_canceled_alternatives: none selected.
- mutation_safety: verified enough for repo-specific control-loop work.

live_linear_setup_status: verified

label_status: verified

template_status: selected_description_template

The connector did not expose a template-ID field on save_issue, so each issue
description was written with the closest Linear issue-template shape: Objective,
Source Artifacts, Why This Matters, Scope, Out of Scope, Execution Notes,
Validation Gates, Rollback Conditions, and Linear Routing.

## ADR / Decision Artifact Readiness

decision_artifact_status: not_applicable

No new ADR is required to create the tracker. Future implementation slices may
need specs before contract-bearing code or governance changes.

## Core / Invariant Artifact Readiness

core_artifact_status: present

- Source plan: .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
- Source audit: .harness/research/audits/2026-06-04-documentation-architecture-comparison.md

## Proposed Milestones

No Linear milestones were created. The child issue tree carries sequencing.

## Proposed Parent Issues

| Issue | Title | URL |
| --- | --- | --- |
| JSC-392 | [coding-harness] Implement documentation lifecycle architecture plan | https://linear.app/jscraik/issue/JSC-392/coding-harness-implement-documentation-lifecycle-architecture-plan |

## Proposed Sub-Issues

| Issue | Plan Units | Title | Priority | Route |
| --- | --- | --- | --- | --- |
| JSC-393 | PU-001, PU-002 | [coding-harness] Spec and enforce research lifecycle metadata | High | Now |
| JSC-394 | PU-003, PU-004 | [coding-harness] Add deterministic reader-task documentation evals | High | Now |
| JSC-395 | PU-005 | [coding-harness] Add advisory stale-document archive candidate reporting | Medium | Next |
| JSC-396 | PU-006 | [coding-harness] Classify SemVer distribution impact and source-only template guard | Medium | Next |
| JSC-397 | PU-007, PU-008 | [coding-harness] Prove progressive disclosure cleanup and automation runbook standard | Medium | Next |

## Now / Next / Later / Do Not Create

Now:

- JSC-393: metadata spec and checker integration.
- JSC-394: deterministic reader-task documentation evals.

Next:

- JSC-395: advisory stale-document reporting after metadata contract proof.
- JSC-396: SemVer/distribution impact and source-only template guard.
- JSC-397: progressive disclosure and runbook standardization after eval and
  distribution proof.

Later:

- Promote docs-task evals from advisory to required after fixture stability.

Do Not Create:

- One issue per audit observation.
- New Linear projects or labels.
- Archive/delete issues before advisory report evidence exists.

## Dependency Map

| From | To | Reason |
| --- | --- | --- |
| JSC-393 | JSC-395 | Archive reporting depends on metadata authority states. |
| JSC-394 | JSC-397 | Progressive disclosure needs reader-task eval proof. |
| JSC-396 | JSC-397 | Cleanup must preserve distribution/source-only boundaries. |

## Eval Gate Map

| Gate | Issues | Purpose |
| --- | --- | --- |
| pnpm docs:lint | JSC-392 through JSC-397 | Markdown validity and skimmability. |
| pnpm docs:lifecycle | JSC-393, JSC-396, JSC-397 | Governed metadata and lifecycle manifest health. |
| pnpm test:related | TypeScript-changing children | Related test coverage for docs-surface, docs-gate, PR template, and scaffolding behavior. |
| bash scripts/run-harness-gate.sh docs-gate --mode required --json | All children when docs-gate surfaces change | Aggregated docs-governance health. |
| future pnpm docs:task-eval | JSC-394, JSC-397 | Canonical-source selection and forbidden-claim proof. |

## Human vs Agent Execution Map

| Issue | Human Route | Agent Route |
| --- | --- | --- |
| JSC-393 | Accept metadata contract boundaries. | Draft spec, implement checker, validate. |
| JSC-394 | Approve eval promotion from advisory to required. | Build deterministic fixtures and runner. |
| JSC-395 | Approve archive decisions separately. | Produce advisory report only. |
| JSC-396 | Approve release-behavior changes if needed. | Add matrix and guards without version change. |
| JSC-397 | Confirm README/AGENTS moves preserve intent. | Apply progressive disclosure after eval proof. |

## Story / Value Basis

This work protects Coding Harness from documentation drift as the repository
grows more agent-native. A human or agent can know which document is source
truth, which artifact is research, which cleanup is safe, and whether downstream
projects receive only the docs intended for them.

## Recommended Labels

- coding-harness
- Governance
- Policy
- Docs
- Agent-Native
- Eval
- Automation
- Feature
- Roadmap: Now
- Roadmap: Next

## Repo / Location Label

repo_location_label: coding-harness

The preferred Repo > coding-harness label is not present; the live workspace has
legacy repo label coding-harness, which was applied.

## Priority Mapping

- Parent: High.
- Metadata and reader-task evals: High.
- Archive report, distribution matrix, progressive disclosure/runbooks: Medium.

## Project / Cycle Justification

project_assignment_reason: The work is repo-specific Harness control-loop
hardening with multiple child issues and dependency sequencing.

cycle_assignment_reason: The user explicitly requested live issue creation and
mutation for the accepted plan in the current execution lane.

## Project Reactivation Recommendation

No project reactivation is required.

## Portfolio Ops Items

None. This is repo-specific coding-harness work.

## Dev Portfolio Impact

The selected project is under Dev Portfolio. No initiative mutation was
performed.

## GitHub PR Tracking

github_tracking_rule: Future implementation branches and PRs should reference
the matching child issue identifier, with JSC-392 as the parent coordination
issue.

## Delivery Evidence

delivery_evidence_rule: Do not close JSC-392 from local validation alone.
Closure requires child issue state plus PR, merge, and release evidence where
applicable.

## Evidence & Traceability Matrix

| Linear Issue | Source Plan Units | Acceptance IDs |
| --- | --- | --- |
| JSC-393 | PU-001, PU-002 | VAC-001, VAC-002 |
| JSC-394 | PU-003, PU-004 | VAC-003, VAC-005 |
| JSC-395 | PU-005 | VAC-007 |
| JSC-396 | PU-006 | VAC-004 |
| JSC-397 | PU-007, PU-008 | VAC-005, VAC-006 |

## Visual References / Diagrams

The dependency map table is the visual reference for this tracker.

## Mutation Receipt

linear_mutation_status: created

Created:

- JSC-392: https://linear.app/jscraik/issue/JSC-392/coding-harness-implement-documentation-lifecycle-architecture-plan
- JSC-393: https://linear.app/jscraik/issue/JSC-393/coding-harness-spec-and-enforce-research-lifecycle-metadata
- JSC-394: https://linear.app/jscraik/issue/JSC-394/coding-harness-add-deterministic-reader-task-documentation-evals
- JSC-395: https://linear.app/jscraik/issue/JSC-395/coding-harness-add-advisory-stale-document-archive-candidate-reporting
- JSC-396: https://linear.app/jscraik/issue/JSC-396/coding-harness-classify-semver-distribution-impact-and-source-only
- JSC-397: https://linear.app/jscraik/issue/JSC-397/coding-harness-prove-progressive-disclosure-cleanup-and-automation

Updated:

- JSC-392 parent description with child issue map, dependency map, validation
  gates, and related historical issues JSC-122 and JSC-128.

## Stage Arc Boundary

stage_arc_boundary:

- left_arc:
  - source_of_truth: approved plan and explicit user request to create and
    mutate Linear issues.
  - entry_authority: explicit.
  - freshness_required: fresh.
  - not_proof: local plan and Linear issue creation do not prove implementation,
    validation, PR state, or release state.
- active_arc:
  - owned_stage: he-linear-plan.
  - allowed_actions: read source artifacts, verify Linear state, create/update
    Linear issues, and write local Linear routing artifact.
  - forbidden_actions: implementation, commit, push, merge, release, GitHub
    mutation, document deletion, and archive moves.
  - mutation_boundary: external_mutation.
- right_arc:
  - handoff_target: JSC-393 and JSC-394 as first execution issues.
  - handoff_artifact:
    .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md.
  - proof_required: child issue validation gates and future PR evidence.
  - closure_boundary: live_ready.
  - resume_key: JSC-392.
- persona_lenses:
  - coding_lens: required.
  - testing_lens: required.
  - coverage_parity_required: yes.
