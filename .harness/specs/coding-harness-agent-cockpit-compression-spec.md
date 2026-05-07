---
schema_version: 1
title: Coding Harness Agent Cockpit Compression Spec
type: he-spec
status: draft
date: 2026-05-07
origin: he-spec
repo: coding-harness
risk: high
depth: bounded-milestone
ui: false
linear_workspace: Jscraik
linear_team: JSC
linear_project: coding-harness
linear_parent_initiative: Dev Portfolio
linear_milestone: Agent Cockpit Compression Slice
linear_issue: JSC-282
linear_status: triage
linear_parent_issues:
  - "JSC-282: [coding-harness] Reconcile command truth for PR-loop cockpit"
  - "JSC-283: [coding-harness] Prove packaged skill behavior for cockpit commands"
linear_priority: 2
linear_labels:
  - Developer Experience
  - Reliability
  - Architecture
  - Routing
  - Drift-Risk
  - Agent-Native
  - Eval
traceability_required: true
---

# Coding Harness Agent Cockpit Compression Spec

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
- [Lifecycle](#lifecycle)
- [Interfaces](#interfaces)
- [Invariants](#invariants)
- [Failure And Recovery](#failure-and-recovery)
- [Observability](#observability)
- [Acceptance Matrix](#acceptance-matrix)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [First Slice](#first-slice)
- [Open Questions](#open-questions)
- [Done](#done)
- [he-plan Handoff](#he-plan-handoff)
- [Blackboard Delta](#blackboard-delta)
- [Evidence](#evidence)

## Mode Decision

Spec mode: Linear-backed execution slice.

Selected slice:

- Type: milestone.
- Name: `Agent Cockpit Compression Slice`.
- Source: `.harness/linear/coding-harness-linear-plan.md`.

Selected refactor sources:

- `.harness/refactors/command-cockpit-truth-reconciliation.md`.
- `.harness/refactors/packaged-skill-behavior-assurance.md`.

Reasoning:

- The accepted Linear plan makes `Agent Cockpit Compression Slice` the `Now`
  slice and explicitly limits it to two parent issues.
- The milestone is intentionally narrow: reconcile command truth and prove
  packaged skill behavior for the cockpit path.
- The user referenced a singular selected refactor path, but the selected
  milestone routes two coupled refactor programs. This spec treats both as the
  bounded source of implementation truth and rejects unrelated refactors.

Linear object status:

- Linear names are specified by the approved plan.
- Live Linear milestone and parent issue IDs have been created from the
  approved plan.
- Implementation planning may proceed from this spec; issue closure still
  requires eval artifacts and intentional Linear status updates.

## Problem

The harness claims to be an agent-native PR-loop cockpit, but the command truth
and packaged skill proof are not yet strong enough to carry that claim.

The command problem:

- Command truth is split across CLI dispatch, command registry, capability
  metadata, help output, README examples, docs, packaged skill references, and
  drift gates.
- Prior architecture artifacts record baseline warnings where README-documented
  commands are missing dispatch support.
- For an agent-facing CLI, a documented command without a real or explicitly
  deprecated runtime path is not harmless documentation drift. It is false
  operating instruction.

The packaged skill problem:

- The packaged `coding-harness` skill is a product API for downstream repos.
- Existing static validation is useful, but string/reference validation does
  not prove that a clean downstream repo can install, update, or resolve the
  cockpit commands successfully.
- A skill that validates lexically but fails behaviorally creates false agent
  confidence.

The milestone exists to make the cockpit trustworthy before deeper governance,
CI migration, or validation-orchestration programs begin.

## Goals

- Reconcile command truth for the chosen cockpit command set across dispatch,
  registry, capabilities, help, README/docs, packaged skill references, and
  gates.
- Define command tiers for the selected surface: cockpit, domain, plumbing, and
  legacy.
- Classify each mismatch as dispatch bug, docs bug, alias, generated-only
  command, planned command, or legacy candidate.
- Establish a generated or validated projection path so future command docs and
  skill references cannot drift silently.
- Prove packaged skill behavior in downstream-like fixtures for the cockpit
  command path.
- Preserve fast lexical skill validation while adding behavior assurance.
- Produce eval artifacts that prove operational improvement before any Linear
  parent issue or milestone is treated as complete.
- Keep the active Linear set small: one milestone, two parent issues, and only
  independently verifiable sub-issues.

## Non-Goals

- No broad command cleanup outside the selected cockpit path.
- No full CLI rewrite.
- No new plugin system, skill framework, or governance layer.
- No new Linear initiative or project.
- No issue per command.
- No release-blocking fixture gate until fixture determinism is proven.
- No promotion of optional tooling breadth as core product value.
- No changes to CI migration, memory/governance ownership, or typed validation
  orchestration beyond references needed to keep this milestone coherent.
- No claim that packaged skill readiness is complete before downstream-like
  behavior proof exists.

## Linear Contract

| Field | Value |
| --- | --- |
| Workspace | `Jscraik` |
| Team key | `JSC` |
| Initiative | `Dev Portfolio` |
| Project | `coding-harness` |
| Milestone | `Agent Cockpit Compression Slice` |
| Priority | `2 High` |
| Parent issue 1 | `JSC-282: [coding-harness] Reconcile command truth for PR-loop cockpit` |
| Parent issue 2 | `JSC-283: [coding-harness] Prove packaged skill behavior for cockpit commands` |
| Labels | `Developer Experience`, `Reliability`, `Architecture`, `Routing`, `Drift-Risk`, `Agent-Native`, `Eval` |
| Execution route | Agent-assisted, human-review required for tier/admission and behavior-confidence boundaries |
| Dependency | Skill behavior proof is blocked by identifying the cockpit command set |
| Tracker | `JSC-282` blocks `JSC-283` |

Parent issue 1 should own:

- command truth inventory
- command mismatch classification
- command tier/admission rules
- command projection or validation
- first cockpit command dispatch/demotion batch

Parent issue 2 should own:

- packaged skill fixture matrix
- clean install/init fixture
- update and idempotence fixture
- packaged skill command reference resolution
- fixture-backed eval proof

## Linear Work Item Contract

Tracking status:

- Required tracker state: real Linear milestone plus real parent issue keys
  before tracked closure.
- Current repository state: Linear milestone and parent issue keys are attached
  to this spec.
- Current spec state: draft, traceable, ready for `he-plan` against the first
  parent issue.

Required live objects:

| Object | Required key/status | Current status |
| --- | --- | --- |
| Milestone | `Agent Cockpit Compression Slice` in project `coding-harness` | Created in Linear |
| Parent issue | `[coding-harness] Reconcile command truth for PR-loop cockpit` with concrete `JSC-N` key | `JSC-282` |
| Parent issue | `[coding-harness] Prove packaged skill behavior for cockpit commands` with concrete `JSC-N` key | `JSC-283` |

Closure rule:

- No implementation, eval, or handoff may claim Linear-tracked completion until
  `JSC-282` and `JSC-283` have eval proof and the matching Linear status is
  updated intentionally.
- `JSC-282` is the first planning target and blocks `JSC-283`.

## Boundary

In scope:

- `harness init`
- `harness next --json`
- `harness verify`
- `harness review-gate`
- any command required to support the selected PR-loop cockpit
- command registry and capability metadata for selected commands
- README/help/docs projections for selected commands
- packaged skill references for selected commands
- skill validation and fixtures needed to prove selected command behavior
- eval artifacts for this milestone

Out of scope:

- every documented command
- every legacy alias
- all migration commands
- UI or dashboard work
- portfolio-level Linear hygiene
- broad governance/memory cleanup
- CI migration decomposition
- replacement of existing shell validation wrappers

## Baseline

Known facts from prior artifacts:

- The Linear plan selects `Agent Cockpit Compression Slice` as the only `Now`
  milestone.
- The plan recommends exactly two parent issues for the slice.
- ADR-001 defines the PR-loop cockpit as the core product.
- ADR-002 requires command truth and a command surface budget.
- ADR-007 requires downstream-like proof for the packaged skill.
- Routing invariants require CLI dispatch, registry, capabilities, help,
  README, docs, packaged skill, and gates not to disagree.
- Execution invariants require observable evidence before completion and eval
  artifacts before moat-critical closure.

Known interpretation:

- Command truth drift is a cognition defect, not only documentation debt.
- Packaged skill behavior proof is required because the skill is a trust-bearing
  product API.

Known assumption:

- The repo can build deterministic local fixtures for the first behavior matrix
  without external credentials.

## Domain Model

Cockpit command:

- A small public command that directly supports the agent-authored PR loop.
- Admission requires a clear effect on init, next action selection, validation,
  PR readiness, review confidence, or learned-failure promotion.

Domain command:

- A command supporting a bounded workflow that is discoverable from the cockpit
  but is not itself a primary front door.

Plumbing command:

- A support command used by wrappers, gates, or internal workflows.
- It should be discoverable for maintainers but not promoted as product surface.

Legacy command:

- A compatibility alias or historical command.
- It requires owner, validation, and sunset condition.

Command truth source:

- The operational source from which docs, help, skill references, and gates are
  generated or validated.
- The implementation may choose registry-first or dispatch-first, but it must
  make the hierarchy explicit.

Projection:

- A generated or validated representation of command truth in README, docs,
  help output, packaged skill references, or drift-gate expectations.

Skill fixture:

- A deterministic downstream-like repo state used to prove packaged skill
  behavior.

Static validator:

- A fast lexical or reference check that proves shape, required files, and known
  strings.

Behavior fixture:

- A runnable test that proves a documented skill workflow or command reference
  behaves in a downstream-like environment.

Eval artifact:

- A durable `.harness/evals/**.md` proof file that records the operational
  improvement and validation evidence for Linear closure.

## Lifecycle

1. Inventory command truth.
   - Compare selected README/docs commands, CLI dispatch, registry,
     capabilities, help output, packaged skill references, and gates.
   - Produce a deterministic mismatch artifact before changing behavior.

2. Classify mismatches.
   - Classify each mismatch as dispatch bug, docs bug, alias, generated-only
     command, planned command, or legacy candidate.
   - Stop if aliases and missing dispatch cannot be distinguished.

3. Define tier and admission policy.
   - Assign selected commands to cockpit, domain, plumbing, or legacy tiers.
   - Require owner, validation path, and sunset condition for legacy aliases.
   - Require human review for public command classification.

4. Establish command projection.
   - Generate or validate selected command docs/help/skill references from the
     chosen source of truth.
   - Keep manual docs only where validation proves alignment.

5. Dispatch or demote the first cockpit batch.
   - Implement missing runtime paths only when they are true cockpit commands.
   - Demote or deprecate docs/aliases when runtime behavior is not justified.

6. Design packaged skill fixture matrix.
   - Cover clean repo, existing harness repo, customized environment, and
     credential-blocked remote checks.
   - Keep lexical validation as the fast guard.

7. Add behavior fixtures for the selected command path.
   - Prove install/init guidance, update/idempotence behavior, action-sync
     ownership, and command reference resolution where applicable.

8. Produce eval proof and closure evidence.
   - Write eval artifacts before closing Linear parents.
   - Do not treat artifact existence alone as success; record observed behavior.

## Interfaces

Likely affected implementation surfaces:

- `src/cli.ts`.
- `src/lib/cli/command-registry.ts`.
- `src/lib/cli/registry/command-capabilities.ts`.
- `src/commands/**`.
- README command documentation.
- CLI help output.
- drift-gate command-surface checks and fixtures.
- `.agents/skills/coding-harness/**`.
- `scripts/validate-packaged-skill.cjs`.
- `.agents/skills/coding-harness/scripts/validate_reference_contracts.py`.
- fixture tests or helper scripts introduced for packaged skill behavior.
- `.harness/evals/coding-harness-command-cockpit-truth-reconciliation-eval.md`.
- `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md`.

Interfaces that must remain stable unless an explicit ADR supersedes them:

- `harness next --json`.
- `HarnessDecision` shape and semantics.
- command exit-code contracts.
- packaged skill capability boundaries around credentials and secrets.
- `harness init` ownership semantics for managed/adaptable files.
- repo wrapper validation entrypoints.

## Invariants

- `harness next --json` remains the primary agent-facing routing surface.
- Command truth must be deterministic, explainable, and inspectable from repo
  artifacts.
- README/docs/help/registry/capabilities/dispatch/skill/gates must not silently
  disagree for selected cockpit commands.
- No selected command may enter the cockpit tier without observable validation.
- Legacy aliases require owner, validation, and sunset rule.
- Packaged skill readiness requires downstream-like behavior proof.
- String-level skill validation is not semantic assurance.
- Moat-critical closure requires eval artifacts with observed behavior, not only
  file creation.
- Do not add abstraction before identifying what old ambiguity it removes.
- Keep the Linear active set intentionally small.

## Failure And Recovery

Stop conditions:

- The command inventory cannot distinguish aliases from missing dispatch.
- Tier/admission rules conflict with public compatibility and no migration note
  is accepted.
- Generated command projections increase mismatch count.
- Fixture setup requires non-portable local state.
- Fixture failures cannot distinguish implementation failure from environment,
  credential, or contract failure.
- A proposed change weakens `harness next --json` or `HarnessDecision` without a
  superseding ADR.

Rollback strategy:

- Inventory and classification artifacts are additive and should remain.
- Projection changes must be reversible by restoring manual docs while keeping
  the mismatch artifact.
- Runtime command changes must be isolated to the selected cockpit batch.
- Behavior fixtures should remain advisory until deterministic enough to block
  release confidence.
- If fixture determinism fails, keep static validators blocking and record the
  fixture blocker in the eval artifact.

## Observability

Required evidence:

- Command inventory artifact with mismatch classifications.
- Before/after count of selected command mismatches.
- CLI command tests or direct command invocations for changed cockpit paths.
- Static skill validation output.
- Behavior fixture output for downstream-like states.
- Eval artifacts with exact commands, outcomes, and blockers.

Recommended metrics:

- Number of selected cockpit commands with aligned dispatch, registry,
  capabilities, help, docs, skill reference, and gate status.
- Number of legacy aliases with owner and sunset condition.
- Number of packaged skill command references resolved in behavior fixtures.
- Fixture pass/fail/blocked status by downstream state.
- Context cost reduction evidence when available, such as fewer docs needed to
  identify the next safe command.

## Acceptance Matrix

| ID | Acceptance Criterion | Validation | Source |
| --- | --- | --- | --- |
| SA-001 | Scope remains bounded to `Agent Cockpit Compression Slice` with two parent issues and no new initiative or project. | Review final Linear mapping in this spec and implementation plan. | `.harness/linear/coding-harness-linear-plan.md` |
| SA-010 | A deterministic command truth inventory exists for selected cockpit commands across dispatch, registry, capabilities, help, README/docs, packaged skill references, and gates. | Inventory artifact exists and lists source, status, and mismatch class for each selected command. | ADR-002; command refactor |
| SA-011 | Every selected command mismatch is classified as dispatch bug, docs bug, alias, generated-only command, planned command, or legacy candidate. | Classification table reviewed; unclassified mismatches block parent closure. | command refactor |
| SA-012 | Selected commands have assigned tiers: cockpit, domain, plumbing, or legacy. | Tier table exists; public cockpit classifications receive human review. | ADR-001; ADR-002 |
| SA-013 | Legacy aliases in the selected set have owner, validation path, and sunset condition. | Legacy table exists; missing owner/validation/sunset blocks closure. | ADR-002; routing invariants |
| SA-014 | README/docs/help/skill command projections for selected cockpit commands are generated or validated from the chosen command truth source. | Projection validation passes or generated fragments are checked in with source markers. | routing invariants |
| SA-015 | The first selected cockpit command batch is either dispatched with focused runtime tests or demoted/deprecated with an explicit migration note. | Focused CLI tests or direct invocations pass; deprecations include owner and removal condition. | ADR-001; ADR-002 |
| SA-020 | A packaged skill fixture matrix exists for clean repo, existing harness repo, customized environment, and credential-blocked remote checks. | Matrix records scenario, expected proof, required credentials, and closure status. | ADR-007; skill refactor |
| SA-021 | Static packaged skill validation remains active and is not replaced by fixture tests. | Existing validators still run in the relevant gate or focused command. | ADR-007 |
| SA-022 | Clean install/init packaged skill behavior is proven in a deterministic downstream-like fixture or explicitly blocked with concrete reason. | Fixture command output is recorded in eval artifact. | skill refactor |
| SA-023 | Update/idempotence packaged skill behavior is proven in a downstream-like fixture or explicitly blocked with concrete reason. | Fixture command output is recorded in eval artifact. | skill refactor |
| SA-024 | Packaged skill command references for selected cockpit commands resolve against real command truth. | Behavior fixture or validator proves reference resolution. | ADR-002; ADR-007 |
| SA-030 | `.harness/evals/coding-harness-command-cockpit-truth-reconciliation-eval.md` exists before closing the command truth parent. | Eval artifact contains exact commands, outcomes, blockers, and before/after drift evidence. | execution invariants |
| SA-031 | `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md` exists before closing the skill behavior parent. | Eval artifact contains exact commands, outcomes, blockers, and fixture evidence. | execution invariants |
| SA-032 | No parent issue or milestone is marked complete without eval proof and live Linear tracker linkage. | Closure checklist includes eval path and Linear IDs `JSC-282`, `JSC-283`, and the milestone. | execution invariants; Linear plan |
| SA-033 | Rollback conditions are documented for command projection, runtime dispatch, and fixture gate changes. | Implementation plan includes rollback conditions before edits. | execution invariants |
| SA-034 | `harness next --json`, `HarnessDecision`, and stable command exit-code contracts are not weakened. | Focused tests or direct command checks cover touched paths. | ADR-001; routing invariants |

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Notes |
| --- | --- | --- |
| Milestone: `Agent Cockpit Compression Slice` | SA-001, SA-030, SA-031, SA-032, SA-033, SA-034 | Milestone closure requires both parent eval artifacts and tracker linkage. |
| Parent: `JSC-282 [coding-harness] Reconcile command truth for PR-loop cockpit` | SA-010, SA-011, SA-012, SA-013, SA-014, SA-015, SA-030, SA-033, SA-034 | Blocks packaged skill command-reference confidence. |
| Parent: `JSC-283 [coding-harness] Prove packaged skill behavior for cockpit commands` | SA-020, SA-021, SA-022, SA-023, SA-024, SA-031, SA-033, SA-034 | Blocked by selected cockpit command set. |
| Sub-issue: `Inventory command truth across dispatch, registry, docs, and skill` | SA-010, SA-011 | First command-truth work item. |
| Sub-issue: `Tier cockpit, domain, plumbing, and legacy command surfaces` | SA-012, SA-013 | Human review required for public command classification. |
| Sub-issue: `Generate or validate command truth projections` | SA-014, SA-033 | Projection must be reversible. |
| Sub-issue: `Dispatch or demote first cockpit command batch` | SA-015, SA-034 | Runtime behavior requires focused validation. |
| Sub-issue: `Design packaged skill fixture matrix` | SA-020 | Can begin after command inventory starts, but cannot finalize command refs until cockpit set is identified. |
| Sub-issue: `Add clean install and update/idempotence skill fixtures` | SA-021, SA-022, SA-023, SA-033 | Fixture proof is additive before release blocking. |
| Sub-issue: `Validate packaged skill command reference resolution` | SA-024, SA-031 | Depends on command truth source. |

## First Slice

First implementation slice:

- Parent issue: `JSC-282 [coding-harness] Reconcile command truth for PR-loop cockpit`.
- Sub-issue: `[coding-harness] Inventory command truth across dispatch, registry, docs, and skill`.

Objective:

- Produce a deterministic command truth inventory for the selected cockpit path
  without changing runtime behavior.

Expected output:

- A committed inventory artifact or generated report location.
- A mismatch classification schema.
- A short recommendation for which mismatches become dispatch fixes, docs
  fixes, aliases, planned commands, or legacy candidates.

Validation:

- Inventory generation command passes.
- No behavior changes are introduced.
- The report is reproducible from repo state.

Parallel work:

- The packaged skill fixture matrix may be drafted in parallel, but it must not
  finalize command-reference assertions until the cockpit command set is
  identified.

## Open Questions

- Where should the command truth inventory artifact live: `.harness/evals/**`,
  `.harness/reports/**`, or a generated fixture path under tests?
- Should the canonical command truth source be the registry, dispatch, or a
  generated command contract consumed by both?
- Which exact command set is the first cockpit batch beyond `init`, `next`,
  `verify`, and `review-gate`?
- Are the recommended labels already present in Linear, or must label creation
  be approved before issue creation?
- Which fixture harness path should own downstream-like skill behavior tests so
  the repo avoids permanent fixture bloat?

## Done

This spec is complete when:

- All acceptance IDs are either satisfied or explicitly re-scoped by a newer
  approved spec or ADR.
- Both parent issues have eval artifacts with exact validation evidence.
- Live Linear issue or milestone IDs are attached before tracked closure.
- Command truth for selected cockpit commands is deterministic and inspectable.
- Packaged skill command behavior is proven in downstream-like fixtures or
  blocked with concrete, durable reasons.
- `harness next --json` remains the primary agent-facing routing surface.

## he-plan Handoff

Next command:

- Run `he-plan` against this spec for `JSC-282` only:
  `[coding-harness] Reconcile command truth for PR-loop cockpit`.

Planner constraints:

- Start with SA-010 and SA-011.
- Do not implement dispatch changes before inventory and classification.
- Do not create a new Linear project or initiative.
- Do not expand into unrelated refactor programs.
- Require human review before public command tier/admission decisions.
- Require eval artifact paths before parent closure.

## Blackboard Delta

- Selected execution slice: `Agent Cockpit Compression Slice`.
- Selected refactors: command cockpit truth reconciliation and packaged skill
  behavior assurance.
- Current safest first move: command truth inventory with no behavior changes.
- Main risk: turning a bounded command cockpit repair into broad CLI cleanup.
- Main dependency: packaged skill behavior proof depends on identifying the
  selected cockpit command set.
- Tracker: `JSC-282` blocks `JSC-283` inside `Agent Cockpit Compression Slice`.

## Evidence

Facts:

- `.harness/linear/coding-harness-linear-plan.md` selects `Agent Cockpit
  Compression Slice` as `Now`.
- The same plan routes the slice to the existing `coding-harness` project under
  `Dev Portfolio` and recommends two parent issues.
- `.harness/refactors/command-cockpit-truth-reconciliation.md` identifies
  command truth drift as a routing, cognition, anti-drift, and moat risk.
- `.harness/refactors/packaged-skill-behavior-assurance.md` identifies
  string-level packaged skill validation as insufficient semantic assurance.
- `.harness/decisions/ADR-001-pr-loop-cockpit-core.md` accepts the PR-loop
  cockpit as the core product.
- `.harness/decisions/ADR-002-command-truth-and-surface-budget.md` accepts
  command truth reconciliation and command tiers.
- `.harness/decisions/ADR-007-portable-skill-and-memory-proof.md` accepts that
  packaged skill and memory surfaces require proof.
- `.harness/core/routing-invariants.md` requires command truth and skill routing
  to remain deterministic and behavior-backed.
- `.harness/core/execution-invariants.md` requires observable validation and
  eval closure for moat-critical migrations.

Interpretation:

- The selected milestone is the narrowest high-leverage execution slice because
  command truth blocks agent confidence across deeper architecture work.
- Packaged skill fixture proof should follow command truth because fixtures must
  know which cockpit commands are authoritative.

Assumptions:

- The first behavior fixtures can be run locally without credentials.
- Linear milestone and parent issues were created from the approved plan.
- Future implementation will preserve the existing repo wrapper validation
  contract unless a separate ADR supersedes it.
