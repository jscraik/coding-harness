---
schema_version: 1
artifact_id: jsc-288-governance-trust-repair-spec
artifact_type: he-spec
canonical_slug: jsc-288-governance-trust-repair
title: JSC-288 Governance Trust Repair Spec
harness_stage: he-spec
status: draft
date: 2026-05-08
traceability_required: true
origin: .harness/linear/coding-harness-linear-plan.md
linear_issue: JSC-288
linear_milestone: Governance Trust Repair Slice
linear_status: Triage
---

# JSC-288 Governance Trust Repair Spec

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
- [Classification Rules](#classification-rules)
- [Required Inventory Seed](#required-inventory-seed)
- [Lifecycle](#lifecycle)
- [Interfaces](#interfaces)
- [Invariants](#invariants)
- [Failure And Recovery](#failure-and-recovery)
- [Observability](#observability)
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

Spec mode: Linear-backed parent issue.

Selected slice:

- Type: parent issue.
- Linear issue: `JSC-288`.
- Title: `[coding-harness] Resolve memory and governance truth ownership`.
- Linear project: `coding-harness`.
- Linear milestone: `Governance Trust Repair Slice`.
- Source: `.harness/linear/coding-harness-linear-plan.md`.

Selected refactor source:

- `.harness/refactors/governance-contract-memory-simplification.md`.

Reasoning:

- The Linear Delta Capture Gate marks `JSC-282` and `JSC-283` as locally
  complete and stale in Linear, not implementation scope to reopen.
- The approved next queue promotes one slice only: governance, memory, and
  contract truth ownership.
- The tracker gate resolved the missing Linear objects by creating the
  `Governance Trust Repair Slice` milestone, reusable `Governance` and
  `Context` issue labels, and parent issue `JSC-288`.

## Problem

Coding Harness has intentionally strong governance, but some governance and
memory surfaces no longer clearly communicate whether they are executable
policy, generated projection, reference guidance, fixture data, or stale
placeholder material.

That ambiguity creates three operational risks:

- Future agents may treat placeholder memory as trust evidence.
- Contributors may add governance prose instead of executable gates or generated
  projections.
- The published contract can become a policy junk drawer unless internal
  bounded contexts and ownership are explicit.

This slice must repair trust and ownership. It must not start a broad contract
rewrite.

## Goals

- Create an inventory of governance truth surfaces with owner, status,
  enforcement path, freshness, and deletion/revisit condition.
- Decide the status of memory surfaces that participate in governance or review
  evidence: operational, generated, fixture-only, reference-only, deprecated, or
  removed.
- Define contract bounded-context ownership for the existing published aggregate
  contract without changing the aggregate shape.
- Identify duplicated governance prose that should be deleted, linked, or
  generated from a canonical source.
- Define the eval evidence required before `JSC-288` can close.

## Non-Goals

- Do not implement CI migration boundary recovery.
- Do not implement `JSC-178` command-registry or contract modularization.
- Do not migrate the contract schema into fragments before ownership design is
  accepted.
- Do not reopen `JSC-282` or `JSC-283` implementation scope.
- Do not create one issue per governance document.
- Do not weaken CI ownership, independent review, required-check, or published
  contract compatibility rules.

## Linear Contract

Workspace/team: `Jscraik` / `JSC`.

Project: `coding-harness`.

Initiative: `Dev Portfolio`.

Milestone: `Governance Trust Repair Slice`.

Parent issue: `JSC-288`.

Priority: High.

Labels:

- `Governance`
- `Reliability`
- `Context`
- `Drift-Risk`

Dependencies:

- Depends on local closure proof for `JSC-282` and `JSC-283`.
- Linear cleanup for stale `JSC-282` and `JSC-283` statuses may run separately.
- Blocks CI migration boundary work only insofar as CI work relies on governance
  and contract truth ownership.

Execution route:

- Agent-assisted.
- Human review required for ownership decisions, memory trust classification,
  and contract bounded-context acceptance.

## Linear Work Item Contract

`JSC-288` owns one bounded requirements slice. It may create child issues during
`he-plan` only when the child issue is independently verifiable.

Recommended child issue shape:

- Inventory governance truth surfaces.
- Decide memory surface ownership.
- Design contract bounded-context ownership.
- Compress repeated governance prose after source ownership is known.
- Define or add governance admission checks only after the inventory proves the
  enforcement target.

Do not split by document path. Split by decision and validation boundary.

## Boundary

In scope:

- `harness.contract.json`
- `src/lib/contract/types-core.ts`
- contract validators and generated contract projections, if inspected
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.harness/memory/**`
- `.harness/knowledge/**`
- `.harness/decisions/**`
- `.harness/review-log.md`
- `memory.json` when present
- `AGENTS.md`
- `docs/agents/**`
- packaged skill references that describe governance or memory behavior
- docs-gate, policy-gate, and memory/context checks when used as evidence

Out of scope:

- CircleCI/GitHub Actions provider migration.
- Full contract fragmentation implementation.
- Unrelated Project Brain feature work.
- General docs cleanup.
- Broad command-surface refactoring.

## Baseline

Known source evidence:

- `.harness/refactors/governance-contract-memory-simplification.md` identifies
  contract breadth, placeholder memory, and repeated governance prose as one
  connected trust-drift problem.
- `ADR-003` requires governance policy to be executable, generated, or marked
  reference-only.
- `ADR-004` preserves the published aggregate contract while requiring bounded
  internal ownership.
- `.harness/core/governance-invariants.md` requires governance to reduce
  ambiguity and forbids symbolic or placeholder evidence in required paths.
- `.harness/core/cognition-principles.md` treats stale, placeholder, or unowned
  memory as worse than absent memory.
- `.harness/core/execution-invariants.md` requires observable validation before
  closure and forbids claiming behavior that did not run.

Current tracker state:

- `JSC-288` exists in Linear.
- `Governance Trust Repair Slice` exists as the milestone.
- Required labels are applied.
- `JSC-282` and `JSC-283` remain stale in Linear but have local eval closure
  proof.

Live repo evidence checked during spec deepening:

- `.github/PULL_REQUEST_TEMPLATE.md` now requires
  `bash scripts/run-harness-gate.sh tooling-audit --path . --json` as part of
  local PR evidence.
- `memory.json` still exists and contains bootstrap placeholder values:
  `repo: replace-with-repo-name`, `session_id: bootstrap/init`, and the entry
  content `Harness memory baseline initialized. Replace with task-specific
  observations.` It is legacy/sample evidence, not the required PR trust proof.
- `.harness/memory/LEARNINGS.md` exists and is distinct from `memory.json`.
- `.harness/knowledge/**` exists with domain files for `ci`, `cli`,
  `governance`, and `tooling`.

## Domain Model

Governance surface:

- Any file, schema, template, command, gate, skill reference, or doc that tells
  humans or agents what they must do, must not do, or must prove.

Executable policy:

- A rule enforced by code, CI, a gate, a validator, or a generated contract.

Generated projection:

- A human or agent-facing surface derived from executable or canonical source
  data and checked for drift.

Reference-only guidance:

- Non-binding context that helps humans or agents understand intent but does not
  define required behavior.

Memory surface:

- Any local, tracked, imported, generated, or fixture data source used to inform
  future actions, repeated-failure handling, review context, or Project Brain
  behavior.

Published aggregate contract:

- `harness.contract.json` as the compatibility-facing contract shape for
  installed repositories.

Bounded contract context:

- A named internal contract ownership area with an owner, validation path,
  compatibility rule, and projection strategy.

## Classification Rules

Every inspected surface must be assigned exactly one primary role:

- Executable policy: enforced by a command, validator, CI check, hook, gate, or
  runtime path.
- Generated projection: derived from an executable or canonical source and
  checked for drift.
- Canonical human guidance: authoritative prose that remains necessary because
  the rule cannot be fully expressed as a gate yet.
- Reference-only context: useful explanation with no binding force.
- Fixture or sample: test/scaffold data that must never satisfy required trust
  or PR evidence paths.
- Deprecated or stale: retained temporarily only with an owner, reason, and
  removal condition.

Classification constraints:

- A surface cannot be both required trust evidence and placeholder/fixture data.
- A required instruction must name the executable or generated surface that
  proves it, or explicitly state that it is human-review-only.
- Generated projections must name their canonical source and drift check.
- Reference-only docs must not be listed as required proof in PR templates,
  gates, or closure criteria.
- Deprecated surfaces need a tracked deletion/revisit condition. "Keep because
  it exists" is not an accepted disposition.

## Required Inventory Seed

`he-plan` may discover more surfaces, but it must start with this seed set so
the slice cannot accidentally avoid the highest-risk truth paths:

| Surface | Initial reason for inclusion | Minimum classification evidence |
| --- | --- | --- |
| `harness.contract.json` | Published aggregate contract and machine-readable governance authority. | Contract domain, owner, validation command, compatibility rule. |
| `src/lib/contract/types-core.ts` | Typed mirror/defaults for the aggregate contract. | Matching contract domains, generated/default status, drift check. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Requires local gates and wrapper-backed `tooling-audit` proof in PR evidence. | Whether each required checkbox maps to executable proof or symbolic evidence. |
| `memory.json` | Legacy/sample memory file still exists with bootstrap placeholder values. | Operational, fixture-only, deprecated, or removed-from-required-path decision. |
| `.harness/memory/LEARNINGS.md` | Repo-local learned-fixes memory surface named by AGENTS. | Required/optional status, owner, freshness signal, and closeout rule. |
| `.harness/knowledge/**` | Project Brain governance and learned-rule surfaces. | Operational status, generated/manual status, freshness and rule-ID policy. |
| `.harness/review-log.md` | Review/governance history and Project Brain update ledger. | Evidence role, owner, required/optional status. |
| `AGENTS.md` | Binding repo instruction surface and Project Brain contract. | Required governance claims mapped to gates/docs/contract fields. |
| `docs/agents/02-tooling-policy.md` | Tooling/runtime contract guidance and Project Brain enforcement wording. | Canonical/reference status and matching contract fields. |
| `docs/agents/03-local-memory.md` | Memory operating model and LEARNINGS policy. | Memory-source truth map and required validation path. |
| `docs/agents/04-validation.md` | Validation and closeout guidance, including learning-loop evidence. | Required command truth and no-placeholder evidence status. |
| `docs/agents/06-security-and-governance.md` | Governance/security authority and Project Brain scope. | Canonical/reference status and drift relationship to contract. |
| `docs/agents/07b-agent-governance.md` | Agent governance synchronization requirements. | Required docs-gate relationship and ownership. |
| `docs/agents/12-ai-review-governance.md` | Independent review governance. | Required review evidence and CodeRabbit ownership mapping. |
| `docs/agents/20-project-brain-memory-extension-rollout.md` | Project Brain rollout guidance. | Reference-only, canonical rollout guide, or generated projection decision. |
| packaged skill references under `.agents/skills/coding-harness/**` | Downstream agent-facing governance and command guidance. | Whether packaged guidance is generated, copied, or manually owned. |

The seed is a minimum, not a completion claim. Any inventory that omits one of
these surfaces must record a blocker or explicit out-of-scope reason.

## Lifecycle

1. Inventory governance and memory surfaces.
2. Classify each surface by source-of-truth role.
3. Decide memory ownership and required-trust status.
4. Define contract bounded contexts and compatibility rules.
5. Identify duplicated prose and propose delete/link/generate handling.
6. Define acceptance gates and eval proof for implementation.
7. Hand off to `he-plan` with phases small enough to validate independently.

The spec does not authorize implementation until `he-plan` turns these
requirements into an ordered migration plan.

## Interfaces

Inventory output:

- A durable artifact or plan section listing surface path, category, owner,
  status, enforcement path, freshness signal, deletion condition, and confidence.

Memory ownership output:

- A table naming each memory surface as operational, generated, fixture-only,
  reference-only, deprecated, or removed.
- Each retained required surface must include provenance and validation.

Contract ownership output:

- A bounded-context map for the published aggregate contract.
- Each context must include owner, validation command, compatibility rule, and
  whether it can move to internal fragments later.

Governance compression output:

- A deletion/link/generation recommendation for repeated governance prose.
- No deletion may remove the only discoverable instruction for a required
  workflow.

Eval output:

- `.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`.

Plan output:

- `.harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md`.
- The plan must preserve the spec acceptance IDs in phase criteria.
- The plan must not introduce behavior-changing implementation before the
  inventory and ownership decisions are reviewed.

## Invariants

- Governance must reduce ambiguity, review rework, or safety risk.
- Governance cannot outrank execution reality.
- New governance requires owner, repeated-failure or safety reason,
  enforcement/projection path, validation command, and deletion/revisit
  condition.
- Required governance surfaces must not lie.
- Placeholder memory must not satisfy required trust checks.
- The published aggregate contract must remain compatible unless a later ADR
  and migration explicitly change it.
- Review gates must remain independent; agents cannot self-approve.
- Do not add instructions when a deterministic check is feasible.

## Failure And Recovery

Stop and return to human review if:

- A critical governance surface has no clear owner.
- Memory classification would weaken required trust evidence without a
  replacement.
- The published aggregate contract compatibility rule is unclear.
- A deletion candidate is the only discoverable instruction for a required
  workflow.
- A proposed governance admission check would block unrelated docs-only work.

Rollback strategy:

- Keep behavior unchanged during inventory and ownership design.
- If implementation later begins, preserve the published aggregate contract and
  mark any generated or reference-only transitions explicitly.

## Observability

The implementation plan must define observable evidence for:

- number of governance surfaces inventoried
- number of memory surfaces classified
- number of required trust surfaces with provenance/freshness
- contract contexts named and mapped
- duplicate prose candidates identified
- docs or gates that are explicitly reference-only
- validation commands run and their outcomes

Do not count artifact existence alone as success.

## Validation Plan

Spec validation required before handoff:

- HE artifact identity lint on this spec.
- HE frontmatter safety lint on this spec.
- HE Linear traceability lint on this spec.
- Markdown lint on this spec and the Linear plan.
- `git diff --check` scoped to this spec and the Linear plan.

Plan validation required before implementation starts:

- Confirm `JSC-288` still exists and remains the tracker of record.
- Confirm `JSC-282` and `JSC-283` closure evidence remains dependency evidence,
  not reopened implementation scope.
- Confirm the first phase is inventory-only and has no behavior-changing file
  edits.
- Confirm each proposed child issue maps to one independently verifiable
  decision or validation boundary.

Implementation validation to be defined by `he-plan`:

- Contract validation for `harness.contract.json` and any typed/default mirrors
  that are touched.
- Memory/provenance validation for any memory surface retained in required
  trust paths.
- Docs-gate or policy-gate validation for any governance wording or required
  surface change.
- Review-context or learning-loop validation when CodeRabbit/imported learning
  evidence remains part of closure.
- Final eval artifact at
  `.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`.

## Review Gate

Technical review must block the plan if any of these are true:

- The spec lets a placeholder or fixture memory surface satisfy required trust.
- The first implementation phase includes behavior changes before inventory
  review.
- The plan can delete, demote, or mark reference-only a required instruction
  without preserving a discoverable replacement.
- Contract bounded contexts are named without compatibility and validation
  rules.
- New governance admission checks can block unrelated docs-only or reference
  changes.
- A child issue is split by document path rather than by independently
  verifiable decision or validation boundary.
- The eval proves only artifact existence instead of operational trust repair.

## Acceptance Matrix

| ID | Acceptance Criterion | Evidence Required | Validation |
| --- | --- | --- | --- |
| SA-288-001 | Governance truth surfaces are inventoried with path, owner, role, enforcement path, freshness, deletion/revisit condition, and confidence. | Inventory artifact or plan section. | Docs lint plus reviewer spot-check. |
| SA-288-002 | Memory surfaces used by governance, review, Project Brain, or context loading are classified as operational, generated, fixture-only, reference-only, deprecated, or removed. | Memory ownership table. | Memory health/provenance check or documented blocker. |
| SA-288-003 | Required trust paths cannot be satisfied by placeholder memory. | Explicit before/after rule or validation result. | Focused validation for affected PR template, memory gate, or docs gate. |
| SA-288-004 | Contract bounded contexts are named without changing the published aggregate contract shape. | Contract ownership map. | Contract validation or no-behavior-change proof. |
| SA-288-005 | Repeated governance prose has delete, link, generate, or keep-with-owner disposition. | Compression table. | Docs lint and no-orphan-required-guidance review. |
| SA-288-006 | New governance admission criteria are specified with repeated-failure/safety reason, owner, enforcement/projection path, validation command, and deletion/revisit condition. | Admission criteria section or gate proposal. | Fixture/gate validation if implemented, otherwise plan-ready requirement. |
| SA-288-007 | `JSC-288` closure requires a governance drift eval artifact. | Eval file path reserved and acceptance mapped. | `.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md` before closure. |
| SA-288-008 | Scope does not absorb CI migration, `JSC-178`, broad contract fragmentation, or general docs cleanup. | Out-of-scope list preserved in spec and plan. | `he-plan` review. |
| SA-288-009 | The required inventory seed is covered or each omission has a documented blocker/out-of-scope reason. | Inventory coverage table. | Technical review against the seed table. |
| SA-288-010 | Each retained required governance surface is classified as executable policy, generated projection, or canonical human guidance with an owner. | Classification table. | No required path classified as reference-only, fixture, deprecated, or stale. |
| SA-288-011 | First implementation phase is inventory-only and behavior-preserving. | Plan phase 1 scope and changed-file rules. | `he-plan` technical review before `he-work`. |
| SA-288-012 | Any child Linear issue maps to an independently verifiable decision or validation boundary, not a document path. | Linear mapping table. | Linear traceability review. |

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Notes |
| --- | --- | --- |
| JSC-288 | SA-288-001, SA-288-002, SA-288-003, SA-288-004, SA-288-005, SA-288-006, SA-288-007, SA-288-008, SA-288-009, SA-288-010, SA-288-011, SA-288-012 | Parent issue for the approved Governance Trust Repair Slice. |
| JSC-282 | dependency evidence | Source-command proof complete; do not reopen implementation scope. |
| JSC-283 | dependency evidence | Packaged skill behavior proof complete; do not reopen implementation scope. |
| JSC-178 | out of scope | Separate modularization lane; only contract ownership findings may inform later work. |

## First Slice

The first implementation slice for `he-plan` should be inventory-only:

- produce the governance truth surface inventory
- classify memory surfaces enough to identify decision points
- make no behavior changes
- identify the smallest set of human ownership decisions required before edits

This keeps the migration reversible and prevents governance cleanup from
starting as speculative deletion.

## Open Questions

- Which memory surfaces are intended to be operational evidence versus imported
  local evidence or fixture data?
- Should `memory.json` remain in any required PR or review path after this
  slice, or should required evidence move to `.harness/memory/**` and imported
  learning artifacts?
- Which contract domains are safe to split internally first after ownership is
  accepted?
- Which governance docs are authoritative enough to generate projections from,
  and which should become reference-only?

## Done

The spec is done when:

- `JSC-288` is the resolved Linear tracker.
- The spec has traceable artifact identity frontmatter.
- Acceptance criteria are tied to source evidence and Linear traceability.
- Scope explicitly excludes adjacent migration lanes.
- Validation and eval expectations are clear enough for `he-plan`.

The implementation issue is done later only when the eval artifact exists and
all accepted criteria are proven.

## he-plan Handoff

Plan from this spec into a staged migration with these constraints:

- Phase 1 must be inventory-only.
- Phase 2 must decide memory ownership before changing required validation.
- Phase 3 must design contract bounded contexts before any schema movement.
- Prose compression must wait until authoritative sources are known.
- Any enforcement must include fixtures and a bypass/rollback condition.
- Keep the active Linear child issue set small.

Expected plan path:

`.harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md`

Expected eval path:

`.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`

## Blackboard Delta

- `linear_status_tracker`: resolved
- `linear_issue`: `JSC-288`
- `linear_milestone`: `Governance Trust Repair Slice`
- `label_status`: resolved
- `selected_slice`: `Governance Trust Repair Slice`
- `next_stage`: `he-plan`
- `scope_guard`: Do not include CI migration, JSC-178 implementation, or broad
  contract fragmentation.

## Evidence

Facts:

- `.harness/linear/coding-harness-linear-plan.md` admits the Governance Trust
  Repair Slice as the approved current slice after JSC-282/JSC-283 local
  closure.
- Linear tracker resolution created `JSC-288` in project `coding-harness`,
  milestone `Governance Trust Repair Slice`, with labels `Governance`,
  `Reliability`, `Context`, and `Drift-Risk`.
- `.harness/refactors/governance-contract-memory-simplification.md` defines the
  structural migration pressure and staged refactor shape.
- ADR-003 requires executable/generated/reference-only governance.
- ADR-004 requires bounded internal contract contexts while preserving the
  published aggregate.
- `.harness/core/governance-invariants.md`,
  `.harness/core/cognition-principles.md`, and
  `.harness/core/execution-invariants.md` define the non-negotiable operating
  rules for this slice.

Interpretation:

- Governance trust repair is now higher leverage than another command-cockpit
  slice because command truth and packaged skill behavior already have local
  closure evidence.

Assumptions:

- `JSC-282` and `JSC-283` will be cleaned up in Linear without reopening their
  implementation scope.
- The published aggregate contract remains required for downstream
  compatibility.
