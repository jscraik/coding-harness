---
schema_version: 1
artifact_id: jsc-288-governance-trust-repair-plan
artifact_type: he-plan
canonical_slug: jsc-288-governance-trust-repair
title: JSC-288 Governance Trust Repair Plan
harness_stage: he-plan
type: architecture
status: draft
date: 2026-05-08
plan_id: jsc-288-governance-trust-repair
origin: .harness/specs/2026-05-08-jsc-288-governance-trust-repair-spec.md
repo: coding-harness
linear_issue: JSC-288
linear_issue_url: https://linear.app/jscraik/issue/JSC-288/coding-harness-resolve-memory-and-governance-truth-ownership
linear_project: coding-harness
linear_milestone: Governance Trust Repair Slice
linear_status: Triage
linear_depends_on:
  - JSC-282
  - JSC-283
source_spec: .harness/specs/2026-05-08-jsc-288-governance-trust-repair-spec.md
source_review: .harness/review/2026-05-08-JSC-288-governance-trust-repair-spec-technical-review.md
source_refactor: .harness/refactors/governance-contract-memory-simplification.md
traceability_required: true
---

# JSC-288 Governance Trust Repair Plan

## Table Of Contents

- [Plan Summary](#plan-summary)
- [Authority And Scope](#authority-and-scope)
- [Live Linear State](#live-linear-state)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Verified Source Cross-Check](#verified-source-cross-check)
- [Planning Decisions](#planning-decisions)
- [Loophole Closure Rules](#loophole-closure-rules)
- [Execution Safety Rules](#execution-safety-rules)
- [Governance Surface Classification Model](#governance-surface-classification-model)
- [Required Inventory Seed](#required-inventory-seed)
- [Implementation Steps](#implementation-steps)
- [Implementation Units](#implementation-units)
- [IU-288-001 - Inventory Governance Truth Surfaces](#iu-288-001---inventory-governance-truth-surfaces)
- [IU-288-002 - Decide Memory Surface Ownership](#iu-288-002---decide-memory-surface-ownership)
- [IU-288-003 - Design Contract Bounded-Context Ownership](#iu-288-003---design-contract-bounded-context-ownership)
- [IU-288-004 - Repair Required Trust Evidence](#iu-288-004---repair-required-trust-evidence)
- [IU-288-005 - Compress Governance Prose](#iu-288-005---compress-governance-prose)
- [IU-288-006 - Add Eval And Closure Evidence](#iu-288-006---add-eval-and-closure-evidence)
- [Acceptance Criteria](#acceptance-criteria)
- [Validation Plan](#validation-plan)
- [Rollback Plan](#rollback-plan)
- [Technical Review Gate](#technical-review-gate)
- [Linear Child Issue Shape](#linear-child-issue-shape)
- [Human Review Points](#human-review-points)
- [Out Of Scope](#out-of-scope)
- [Traceability Matrix](#traceability-matrix)
- [Linear / Spec / Plan / PR Traceability](#linear--spec--plan--pr-traceability)
- [he-work Handoff](#he-work-handoff)
- [Post-Plan Handoff](#post-plan-handoff)
- [Blackboard Delta](#blackboard-delta)

## Plan Summary

JSC-288 repairs governance trust, memory ownership, and contract ownership
clarity without starting a broad governance rewrite.

The first implementation unit is inventory-only. It must classify the required
truth surfaces and identify ownership decisions before any PR-template change,
memory validation change, contract movement, or governance prose compression.

The plan intentionally treats `memory.json` as an unresolved trust question, not
as an implementation target. The live repo currently has a PR-template
`memory.json` shape check and a placeholder bootstrap `memory.json`; this is the
trust mismatch the slice exists to resolve.

## Authority And Scope

Selected execution slice:

- Linear issue: `JSC-288`.
- Linear title:
  `[coding-harness] Resolve memory and governance truth ownership`.
- Milestone: `Governance Trust Repair Slice`.
- Project: `coding-harness`.
- Priority: `2 High`.
- Labels: `Governance`, `Context`, `Drift-Risk`, `Reliability`.
- Route: agent-assisted; human review required for memory ownership, governance
  authority, and contract bounded-context decisions.

Authoritative inputs:

- `.harness/linear/coding-harness-linear-plan.md`.
- `.harness/specs/2026-05-08-jsc-288-governance-trust-repair-spec.md`.
- `.harness/review/2026-05-08-JSC-288-governance-trust-repair-spec-technical-review.md`.
- `.harness/refactors/governance-contract-memory-simplification.md`.
- `.harness/decisions/ADR-003-executable-governance-or-delete.md`.
- `.harness/decisions/ADR-004-bounded-contract-contexts.md`.
- `.harness/decisions/ADR-007-portable-skill-and-memory-proof.md`.
- `.harness/core/governance-invariants.md`.
- `.harness/core/cognition-principles.md`.
- `.harness/core/execution-invariants.md`.

Scope rule:

JSC-288 may inventory, classify, and repair trust ownership for governance,
memory, and contract authority surfaces. It must not implement CI migration,
JSC-178 contract modularization, full contract fragmentation, broad command
cleanup, or generic docs cleanup.

## Live Linear State

Linear was refreshed during planning:

- `JSC-288` exists and remains the tracker of record.
- Status: `Triage`.
- Priority: `High`.
- Project: `coding-harness`.
- Milestone: `Governance Trust Repair Slice`.
- Labels: `Governance`, `Context`, `Drift-Risk`, `Reliability`.
- Related issues: `JSC-282`, `JSC-283`, and `JSC-178`.
- No live blocking or blocked-by relations are currently set.

Plan implication:

- Planning can proceed without a tracker or label blocker.
- `JSC-282` and `JSC-283` remain dependency evidence only. They must not reopen
  implementation scope.
- `JSC-178` remains out of scope. JSC-288 may produce contract ownership input
  for a later JSC-178 lane, but it must not implement JSC-178.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-288` |
| Project | `coding-harness` |
| Milestone | `Governance Trust Repair Slice` |
| Parent initiative | `Dev Portfolio` |
| Priority | `2 High` |
| Current status | `Triage` |
| Execution route | Agent-assisted with human review for ownership decisions. |
| Active unit | None; `IU-288-001` through `IU-288-006` are complete pending human review. |
| Completion evidence | Accepted implementation-unit evidence plus governance drift eval. |
| Closure rule | Do not close `JSC-288` until required trust evidence is executable, generated, or explicitly human-owned with validation. |

## Verified Source Cross-Check

The plan is grounded in these verified sources:

| Source | Verified fact | Plan consequence |
| --- | --- | --- |
| `.github/PULL_REQUEST_TEMPLATE.md` | The required local gate currently accepts a `memory.json` shape check. | `memory.json` trust cannot be treated as solved by file existence or JSON shape. |
| `memory.json` | The file contains bootstrap placeholder values such as `replace-with-repo-name` and `bootstrap/init`. | Placeholder memory must be rejected, demoted, or replaced before it remains in required evidence. |
| `.harness/specs/2026-05-08-jsc-288-governance-trust-repair-spec.md` | The first slice must be inventory-only and behavior-preserving. | `IU-288-001` may not change behavior or governed docs. |
| `.harness/review/2026-05-08-JSC-288-governance-trust-repair-spec-technical-review.md` | No blocking findings remain, but ownership decisions are residual risks. | Human review remains mandatory for memory, contract, and required-guidance demotions. |
| `.harness/refactors/governance-contract-memory-simplification.md` | The root problem is connected governance trust drift, not isolated docs cleanup. | Work is split by ownership and validation boundary, not by document count. |
| `.harness/decisions/ADR-003-executable-governance-or-delete.md` | Governance must be executable, generated, or explicitly reference-only. | New or retained governance requires owner, enforcement/projection, validation, and revisit/deletion rule. |
| `.harness/decisions/ADR-004-bounded-contract-contexts.md` | `harness.contract.json` remains the published aggregate while internal ownership is clarified. | No aggregate-shape change or fragment migration is allowed in this plan. |
| `.harness/decisions/ADR-007-portable-skill-and-memory-proof.md` | Memory validity requires provenance, freshness, and ownership. | Memory surfaces cannot remain required trust evidence without proof. |
| Live Linear milestone | `Governance Trust Repair Slice` exists in `coding-harness`. | The plan may route to the existing milestone; it must refresh issue status again before implementation. |

## Planning Decisions

| Decision | Plan value | Why |
| --- | --- | --- |
| First work slice | `IU-288-001` only | The spec and review require inventory before behavior changes. |
| Inventory artifact | Add `.harness/review/2026-05-08-JSC-288-governance-truth-inventory.md` in the first work slice | The inventory is evidence, not product behavior; the path must be deterministic. |
| `memory.json` posture | Demote from required PR evidence unless future ownership adds provenance, freshness, and placeholder rejection. | The current file is placeholder-shaped; accepted replacement proof is Project Brain, `.harness/memory/LEARNINGS.md`, and learning-loop evidence. |
| Contract movement | Forbidden until `IU-288-003` is reviewed | ADR-004 preserves the published aggregate until compatibility is explicit. |
| PR-template changes | Blocked until memory ownership is decided | Changing required PR evidence without replacement can weaken trust. |
| Governance prose compression | Blocked until source authority is known | Deleting prose before classification can remove discoverability. |
| Child issue creation | Defer unless a unit becomes independently verifiable and active | Avoid Linear issue explosion. |
| Closure proof | Governance drift eval plus acceptance evidence | Artifact existence alone cannot close the issue. |

## Loophole Closure Rules

- Live Linear state in this plan is a snapshot. `he-work` must refresh `JSC-288`
  and the milestone before starting a unit.
- Required inventory seed rows may be blocked, but they may not be silently
  marked out of scope. Removing a seed row requires updating this plan and
  recording human review.
- `IU-288-002` and `IU-288-003` are decision/design units. They may propose
  implementation changes, but they must not change required evidence,
  PR-template commands, contract schema, or validation behavior.
- Any alternate inventory path is a plan change, not an implementation choice.
- A retained required memory surface must have provenance, freshness, owner, and
  validation. Shape-only JSON is not validation.
- A retained required governance instruction must be executable, generated, or
  canonical human guidance with owner and human-review reason.
- Child issues are optional execution aids only. They cannot weaken acceptance
  IDs, validation gates, or the one-unit-at-a-time rule.
- Closure requires a technical review artifact or review evidence after the eval,
  not only self-attestation by the implementing agent.

## Execution Safety Rules

- Implement only one unit at a time.
- `IU-288-001` was the only authorized first `he-work` slice and is now
  complete.
- `IU-288-005` is complete.
- `IU-288-006` is complete.
- Do not change runtime behavior in completed inventory or decision artifacts
  while executing `IU-288-005`.
- Do not edit `.github/PULL_REQUEST_TEMPLATE.md`, `memory.json`,
  `harness.contract.json`, or `src/lib/contract/**` until the relevant
  ownership decision unit has passed review.
- Preserve the published aggregate contract shape unless a later accepted
  migration explicitly changes it.
- Do not classify any required trust path as reference-only, fixture-only,
  deprecated, or stale without naming the replacement executable/generated
  evidence path.
- Stop if a required governance surface has no owner and no safe interim owner.
- Stop if a proposed change makes memory validation weaker without replacement.

## Governance Surface Classification Model

Every inventory row must assign exactly one primary role:

- `executable_policy`
- `generated_projection`
- `canonical_human_guidance`
- `reference_only_context`
- `fixture_or_sample`
- `deprecated_or_stale`

Every row must include:

- path
- surface family
- primary role
- current owner or `unknown`
- required or optional
- enforcement path
- freshness signal
- known drift risk
- proposed disposition
- deletion or revisit condition
- confidence

Classification guardrails:

- `required=true` is incompatible with `fixture_or_sample`,
  `reference_only_context`, or `deprecated_or_stale` unless a replacement proof
  path is named in the same row.
- `generated_projection` requires a canonical source and drift check.
- `executable_policy` requires an actual command, gate, hook, test, or runtime
  path.
- `canonical_human_guidance` requires a human-review reason explaining why the
  rule cannot be fully enforced yet.

## Required Inventory Seed

`IU-288-001` must cover these surfaces or record a concrete blocker. None of
these seed surfaces may be marked out of scope without updating this plan and
recording human review:

| Surface | Minimum evidence |
| --- | --- |
| `harness.contract.json` | Contract domain, owner, validation command, compatibility rule. |
| `src/lib/contract/types-core.ts` | Matching contract domains, generated/default status, drift check. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Every required checkbox mapped to executable proof or symbolic evidence. |
| `memory.json` | Operational, fixture-only, deprecated, or removed-from-required-path decision options. |
| `.harness/memory/LEARNINGS.md` | Required/optional status, owner, freshness signal, closeout rule. |
| `.harness/knowledge/**` | Operational status, generated/manual status, freshness and rule-ID policy. |
| `.harness/review-log.md` | Evidence role, owner, required/optional status. |
| `AGENTS.md` | Required governance claims mapped to gates/docs/contract fields. |
| `docs/agents/02-tooling-policy.md` | Canonical/reference status and matching contract fields. |
| `docs/agents/03-local-memory.md` | Memory-source truth map and required validation path. |
| `docs/agents/04-validation.md` | Required command truth and no-placeholder evidence status. |
| `docs/agents/06-security-and-governance.md` | Canonical/reference status and drift relationship to contract. |
| `docs/agents/07b-agent-governance.md` | Required docs-gate relationship and ownership. |
| `docs/agents/12-ai-review-governance.md` | Required review evidence and CodeRabbit ownership mapping. |
| `docs/agents/20-project-brain-memory-extension-rollout.md` | Reference-only, canonical rollout guide, or generated projection decision. |
| `.agents/skills/coding-harness/**` governance/memory references | Generated, copied, or manually owned packaged guidance decision. |

## Implementation Steps

1. Complete `IU-288-001` as an inventory-only governance truth surface pass.
2. Review the inventory and resolve unknown ownership decisions before editing
   behavior or required evidence surfaces.
3. Decide memory surface ownership in `IU-288-002`.
4. Design contract bounded-context ownership in `IU-288-003` without changing
   the published aggregate contract.
5. Repair required trust evidence in `IU-288-004` only after ownership
   decisions are accepted.
6. Compress governance prose in `IU-288-005` only where authority and
   replacement evidence are explicit.
7. Produce the closure eval in `IU-288-006` before claiming `JSC-288` complete.

## Implementation Units

| Unit | Name | Type | Can start now | Behavior changes | Human review |
| --- | --- | --- | --- | --- | --- |
| IU-288-001 | Inventory governance truth surfaces | evidence/inventory | Completed, review accepted for memory decision | No | Completed for memory path |
| IU-288-002 | Decide memory surface ownership | decision/design | Completed | No | Accepted by user |
| IU-288-003 | Design contract bounded-context ownership | decision/design | Completed | No | Accepted for implementation sequencing |
| IU-288-004 | Repair required trust evidence | implementation | Completed | Yes | Required before merge |
| IU-288-005 | Compress governance prose | implementation | Completed | Docs/projection changes | Required before deletion |
| IU-288-006 | Add eval and closure evidence | eval/closure | Completed | No product behavior | Required |

## IU-288-001 - Inventory Governance Truth Surfaces

Objective:

Produce a durable governance truth inventory covering the required seed surfaces.
No behavior-changing edits are allowed.

Expected outputs:

- Inventory artifact with the classification columns from
  [Governance Surface Classification Model](#governance-surface-classification-model).
- List of unknown owners.
- List of required paths that currently rely on placeholder or symbolic
  evidence.
- List of human decisions required before implementation.

Allowed files:

- `.harness/review/2026-05-08-JSC-288-governance-truth-inventory.md`
  as the deterministic inventory artifact.
- `.harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md`
  if status or handoff notes need updating.

Forbidden in this unit:

- `.github/PULL_REQUEST_TEMPLATE.md`
- `memory.json`
- `harness.contract.json`
- `src/lib/contract/**`
- `docs/agents/**`
- `.agents/skills/coding-harness/**`

Validation:

- HE artifact identity lint on the inventory artifact.
- HE frontmatter safety lint on the inventory artifact.
- HE Linear traceability lint on the inventory artifact if it declares
  `traceability_required: true`.
- Markdown lint on the inventory artifact and this plan.
- `git diff --check` scoped to the inventory artifact and this plan.
- Reviewer spot-check that every required seed row is covered or blocked.

Rollback:

- Delete the inventory artifact or revert the inventory-only plan update.
- No runtime rollback should be needed because behavior must not change.

Acceptance IDs:

- `SA-288-001`
- `SA-288-002`
- `SA-288-009`
- `SA-288-011`

Agent-safe:

Yes, with human review at unit close.

## IU-288-002 - Decide Memory Surface Ownership

Objective:

Decide whether `memory.json`, `.harness/memory/LEARNINGS.md`,
`.harness/knowledge/**`, `.harness/review-log.md`, and imported learning
artifacts are operational, generated, fixture-only, reference-only, deprecated,
or removed from required workflows.

Entry criteria:

- `IU-288-001` inventory is complete and reviewed.
- Required trust paths involving memory are known.

Expected outputs:

- Memory ownership table.
- Decision on `memory.json`: operational, fixture-only, deprecated, or removed
  from required PR evidence.
- Replacement trust path if `memory.json` is demoted or removed.
- Freshness/provenance rule for retained required memory surfaces.

Allowed implementation after review:

- Update memory ownership documentation.
- Record a proposed PR-template or validation replacement only if replacement
  trust evidence is explicit.
- Do not edit `.github/PULL_REQUEST_TEMPLATE.md`, `memory.json`, validators, or
  required evidence commands in this unit.

Validation:

- Focused markdown lint for changed docs.
- Focused memory/provenance check if an existing command supports it.
- No-behavior-change proof showing required evidence commands were not changed.

Rollback:

- Restore previous PR-template evidence path if replacement trust evidence is
  weaker or unavailable.
- Keep `memory.json` unchanged until the replacement is validated.

Acceptance IDs:

- `SA-288-002`
- `SA-288-003`
- `SA-288-010`

Agent-safe:

Agent-assisted only. Human review required.

Decision status:

- Accepted in
  `.harness/review/2026-05-08-JSC-288-memory-ownership-decision.md`.
- `memory.json` is classified as `fixture_or_sample` unless a later owner adds
  provenance, freshness, and placeholder rejection.
- The replacement trust path is Project Brain, `.harness/memory/LEARNINGS.md`,
  and north-star learning-loop evidence with explicit `n.a.` reasons when the
  imported learning artifact is absent or out of scope.
- `IU-288-004` is authorized to replace the PR-template `memory.json` proof, but
  the PR template itself remains unchanged in this decision unit.

## IU-288-003 - Design Contract Bounded-Context Ownership

Objective:

Name bounded contract contexts for the existing published aggregate without
moving schema or changing compatibility.

Entry criteria:

- `IU-288-001` inventory is complete and reviewed.
- Memory ownership dependencies that affect contract fields are known.

Expected outputs:

- Contract ownership map covering at least:
  - CI ownership
  - required checks
  - docs gate
  - policy gate
  - review gate
  - memory and Project Brain
  - command surface
  - init/update scaffolding
  - release readiness
- Owner, validation command, compatibility rule, and later-fragment eligibility
  for each context.
- Explicit statement that `harness.contract.json` remains the published
  aggregate.

Forbidden in this unit:

- Moving fields into fragments.
- Changing the published aggregate schema.
- Implementing JSC-178.

Validation:

- `jq empty harness.contract.json`.
- `pnpm exec tsx src/cli.ts policy-gate --contract harness.contract.json --json`
  if contract ownership or policy-gate evidence is touched.
- No-behavior-change proof when only a design artifact changes.
- Technical review against ADR-004.

Rollback:

- Revert ownership map only; no runtime rollback should be needed.

Acceptance IDs:

- `SA-288-004`
- `SA-288-010`

Agent-safe:

Agent-assisted only. Human review required.

Decision status:

- Accepted in
  `.harness/review/2026-05-08-JSC-288-contract-ownership-map.md`.
- `harness.contract.json` remains the published aggregate.
- Bounded contexts are named for CI ownership, required checks, docs gate,
  policy gate, review gate, memory and Project Brain, command surface,
  init/update scaffolding, release readiness, north-star/product surfaces,
  runtime/context integrity, and Linear issue tracking.
- No schema movement, contract fragmentation, source edits, or JSC-178
  implementation is authorized by this unit.

## IU-288-004 - Repair Required Trust Evidence

Objective:

Make required trust checks stop accepting placeholder or symbolic evidence.

Entry criteria:

- `IU-288-002` memory ownership decision is accepted.
- Replacement trust evidence is named for every demoted required surface.
- If contract fields change, `IU-288-003` ownership map is accepted.

Possible implementation targets:

- `.github/PULL_REQUEST_TEMPLATE.md`
- memory/provenance validator or gate
- docs-gate or policy-gate configuration
- `harness.contract.json` only when compatibility remains stable
- focused tests or fixtures proving placeholder rejection

Validation:

- Exact replacement memory/provenance command.
- `bash scripts/validate-codestyle.sh --fast` if code or governed docs change.
- `pnpm check` if source behavior changes.
- `pnpm exec tsx src/cli.ts memory-gate --json` if retained memory evidence is
  part of required trust.
- `pnpm exec tsx src/cli.ts policy-gate --files <changed-files> --contract harness.contract.json --json`
  if policy or contract-backed governance changes.
- Focused tests for any validator/gate touched.
- `git diff --check` on changed files.

Rollback:

- Restore previous required evidence path if new validation is flaky or cannot
  distinguish placeholder from operational memory.
- Keep the ownership decision artifact even if implementation rolls back.

Acceptance IDs:

- `SA-288-003`
- `SA-288-006`
- `SA-288-010`

Agent-safe:

Agent-assisted. Human review required before merge.

Implementation status:

- Implemented in `.harness/review/2026-05-08-JSC-288-required-trust-evidence-repair.md`
  and `.github/PULL_REQUEST_TEMPLATE.md`.
- The PR-template required local gates no longer accept `memory.json` shape as
  memory proof.
- Replacement evidence is
  `pnpm exec tsx src/cli.ts tooling-audit --path . --json` plus the existing
  north-star learning-loop evidence lines or explicit `n.a.` reasons.
- `memory.json` remains unchanged.

## IU-288-005 - Compress Governance Prose

Objective:

Delete, link, generate, or explicitly mark repeated governance prose after
canonical authority is known.

Entry criteria:

- `IU-288-001` inventory is complete.
- `IU-288-003` contract ownership map is accepted for contract-backed guidance.
- Any target doc has a known source-of-truth role.

Allowed actions:

- Delete duplicated prose when another discoverable authoritative surface
  remains.
- Replace repeated prose with a link to the executable/generated/canonical
  source.
- Mark reference-only docs clearly when they do not define required behavior.
- Add a generation/drift-check proposal where manual duplication should stop.

Forbidden actions:

- Removing the only discoverable instruction for a required workflow.
- Updating broad docs for readability only.
- Adding new policy paragraphs without owner, enforcement/projection path,
  validation command, and deletion/revisit condition.

Validation:

- Markdown lint.
- `pnpm exec tsx src/cli.ts docs-gate --mode required --json` where governed
  docs are touched.
- `pnpm exec tsx src/cli.ts policy-gate --files <changed-files> --contract harness.contract.json --json`
  where policy-backed guidance is touched.
- Reviewer check for no orphaned required guidance.

Rollback:

- Restore deleted prose if validation or review shows discoverability was lost.
- Prefer reverting compression over weakening an executable gate.

Acceptance IDs:

- `SA-288-005`
- `SA-288-006`
- `SA-288-010`

Agent-safe:

Agent-assisted. Human review required before deletion.

Implementation status:

- Implemented in `.harness/review/2026-05-08-JSC-288-governance-prose-compression.md`
  and `docs/agents/20-project-brain-memory-extension-rollout.md`.
- The Project Brain memory-extension rollout note is explicitly
  reference-only for this repository.
- Live authority remains in `harness.contract.json`, `docs/agents/02-tooling-policy.md`,
  `docs/agents/03-local-memory.md`, `docs/agents/04-validation.md`, and
  `scripts/check-environment.sh`.

## IU-288-006 - Add Eval And Closure Evidence

Objective:

Prove JSC-288 repaired governance trust operationally, not just by adding
artifacts.

Entry criteria:

- All implementation units that change trust evidence are complete.
- Human review decisions are recorded.
- Required validation commands have exact outcomes.

Expected output:

- `.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`.

Eval must show:

- required seed inventory coverage
- memory ownership decision and resulting trust path
- placeholder memory cannot satisfy required evidence
- contract bounded-context ownership without aggregate compatibility breakage
- prose compression dispositions
- validation command outcomes
- unresolved risks or explicit deferrals

Validation:

- HE artifact identity lint on the eval.
- HE frontmatter safety lint on the eval.
- HE Linear traceability lint on the eval if it declares
  `traceability_required: true`.
- Markdown lint on the eval.
- Relevant repo gates from changed implementation files.
- `pnpm exec tsx src/cli.ts plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json`.

Rollback:

- Do not close `JSC-288` if the eval is missing, symbolic, or fails to prove
  placeholder trust repair.

Acceptance IDs:

- `SA-288-007`
- all accepted IDs from the traceability matrix

Agent-safe:

Agent-assisted. Human review required for closure.

Implementation status:

- Implemented in `.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`.
- All implementation units are complete pending final human review and merge
  closeout gates.

## Acceptance Criteria

- `SA-288-001`: Required governance truth surfaces are inventoried with role,
  owner, enforcement path, freshness signal, drift risk, disposition, and
  confidence.
- `SA-288-002`: Memory surfaces used by governance, review, Project Brain, or
  context loading are classified as operational, generated, fixture-only,
  reference-only, deprecated, or removed.
- `SA-288-003`: Placeholder `memory.json` evidence is either rejected by
  validation or removed from required trust paths with an accepted replacement.
- `SA-288-004`: Contract bounded contexts are named without breaking
  `harness.contract.json` aggregate compatibility.
- `SA-288-005`: Repeated governance prose has an explicit delete, link,
  generate, or keep disposition.
- `SA-288-006`: New governance admission criteria include repeated-failure or
  safety reason, owner, enforcement/projection path, validation command, and
  deletion or revisit condition.
- `SA-288-007`: Closure includes a governance drift eval artifact with exact
  validation outcomes.
- `SA-288-008`: Scope remains limited to JSC-288 governance, memory, and
  contract trust repair.
- `SA-288-009`: The required inventory seed is covered or blocked with concrete
  evidence.
- `SA-288-010`: Each retained required governance surface is classified as
  executable policy, generated projection, or canonical human guidance with an
  owner.
- `SA-288-011`: The first work unit remains behavior-preserving inventory.
- `SA-288-012`: Any Linear child issues map to decision and validation
  boundaries, not document count.

## Validation Plan

Plan artifact validation:

```bash
AGENT_SKILLS_ROOT="${AGENT_SKILLS_ROOT:-../agent-skills}"
python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py" .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py" .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py" .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
pnpm exec markdownlint-cli2 .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
pnpm exec tsx src/cli.ts plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json
```

Implementation validation by unit:

| Unit | Required validation |
| --- | --- |
| IU-288-001 | Markdown lint, `git diff --check`, seed coverage review. |
| IU-288-002 | Markdown lint; focused memory/provenance command if available; PR-template replacement command if changed. |
| IU-288-003 | Contract validation or explicit no-behavior-change proof; ADR-004 review. |
| IU-288-004 | Focused tests for changed validator/gate; `bash scripts/validate-codestyle.sh --fast`; `pnpm check` when source behavior changes. |
| IU-288-005 | Markdown lint; docs-gate/policy-gate if governed docs change; no-orphan-required-guidance review. |
| IU-288-006 | Eval artifact lints; relevant repo gates; plan-gate strict JSON. |

Validation rule:

Do not claim a unit complete unless the exact validation path for that unit ran
or is recorded as blocked with a concrete blocker.

## Rollback Plan

- Inventory-only artifacts can be reverted without runtime impact.
- Ownership decision artifacts can be revised without runtime impact until
  implementation begins.
- PR-template or memory validation changes must keep a rollback path to the
  previous evidence command.
- Contract ownership design must preserve `harness.contract.json` compatibility.
- Prose compression must be reversible if a required instruction loses
  discoverability.
- If validation cannot distinguish implementation failure from contract, docs,
  memory, or environment failure, stop the migration and keep `JSC-288` open.

## Technical Review Gate

Run a technical review before `he-work` starts and again before `JSC-288`
closure.

The review must block if:

- `IU-288-001` includes behavior-changing edits.
- A required inventory seed row is omitted without a concrete blocker and human
  review.
- A required trust path is classified as fixture, reference-only, deprecated, or
  stale without replacement executable/generated proof.
- `memory.json` can still satisfy required evidence with placeholder content.
- Contract ownership changes weaken published aggregate compatibility.
- New governance admission criteria lack owner, repeated-failure or safety
  reason, enforcement/projection path, validation command, or deletion/revisit
  condition.
- Prose compression removes the only discoverable instruction for a required
  workflow.
- The eval proves artifact existence rather than operational trust repair.

Review evidence should be recorded as a durable artifact under `.harness/review/`
or as equivalent independent review evidence linked from the final eval.

## Linear Child Issue Shape

Do not create child issues until execution starts. If child issues are needed,
create at most these four:

| Child issue | Maps to | Create now |
| --- | --- | --- |
| `[coding-harness] Inventory governance truth surfaces` | IU-288-001 | Optional when starting `he-work` |
| `[coding-harness] Decide memory trust ownership` | IU-288-002 | No |
| `[coding-harness] Design contract ownership map` | IU-288-003 | No |
| `[coding-harness] Repair governance trust evidence` | IU-288-004 through IU-288-006 | No |

Do not create one issue per document. Each child issue must remain independently
verifiable and must preserve acceptance IDs.

## Human Review Points

Human review is required before:

- accepting unknown-owner dispositions for required governance surfaces;
- demoting `memory.json` from required PR evidence;
- keeping `memory.json` as operational evidence;
- changing `.github/PULL_REQUEST_TEMPLATE.md` required evidence;
- approving contract bounded contexts;
- deleting or marking reference-only any doc that currently contains required
  workflow guidance;
- closing `JSC-288`.

## Out Of Scope

- CI migration boundary recovery.
- JSC-178 command-registry or contract modularization implementation.
- Full contract fragment migration.
- Reopening JSC-282 or JSC-283 implementation scope.
- Broad command-surface cleanup.
- Generic docs cleanup.
- New portfolio-level Linear process work.

## Traceability Matrix

| Spec acceptance ID | Plan unit | Validation evidence |
| --- | --- | --- |
| SA-288-001 | IU-288-001 | Inventory artifact with required columns and seed coverage review. |
| SA-288-002 | IU-288-001, IU-288-002 | Memory classification table and accepted ownership decision. |
| SA-288-003 | IU-288-002, IU-288-004 | Accepted decision and implementation remove placeholder `memory.json` from required trust path. |
| SA-288-004 | IU-288-003 | Accepted contract bounded-context ownership map and compatibility proof. |
| SA-288-005 | IU-288-005 | Delete/link/generate/keep disposition table. |
| SA-288-006 | IU-288-004, IU-288-005 | Governance admission criteria and focused validation. |
| SA-288-007 | IU-288-006 | Governance drift eval artifact. |
| SA-288-008 | All units | Scope guard preserved in plan and reviews. |
| SA-288-009 | IU-288-001 | Required inventory seed coverage. |
| SA-288-010 | IU-288-002, IU-288-003, IU-288-004 | Required surfaces remain executable, generated, or canonical with owner. |
| SA-288-011 | IU-288-001 | First phase is inventory-only and behavior-preserving. |
| SA-288-012 | Linear child issue shape | Child issues map to decision/validation boundaries. |

## Linear / Spec / Plan / PR Traceability

| Linear issue | Source acceptance IDs | Plan units | Acceptance IDs | PR evidence |
| --- | --- | --- | --- | --- |
| JSC-288 | SA-288-001 through SA-288-012 | IU-288-001 through IU-288-006 | SA-288-001 through SA-288-012 | Inventory artifact, ownership decisions, focused validation, and governance drift eval. |
| JSC-282 | Dependency evidence only | None | Not applicable | Do not reopen JSC-282 scope. |
| JSC-283 | Dependency evidence only | None | Not applicable | Do not reopen JSC-283 scope. |
| JSC-178 | Related future contract lane | None | Not applicable | Contract ownership input only; no JSC-178 implementation. |

## he-work Handoff

Authorized next stage:

- No further `he-work` implementation unit is authorized by this plan;
  `IU-288-001` through `IU-288-006` are complete pending human review.

First work instruction:

```text
Run final review and closeout gates for .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md. Do not change runtime behavior or reopen completed governance decisions unless validation proves a blocker.
```

Stop conditions for `he-work`:

- Any required seed, repair, compression, or validation surface cannot be read.
- Final review would require runtime behavior edits.
- Dirty worktree ownership is unclear for any JSC-288 output file the final
  review would touch.
- Validation cannot distinguish docs artifact problems from runtime behavior.

## Post-Plan Handoff

```yaml
post_plan_handoff:
  state: explicit_stop
  selected_next_stage: he-work
  evidence: ".harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md"
  next_action: "Run final review and closeout gates; do not start another implementation unit from this plan."
```

## Blackboard Delta

- `linear_status`: refreshed
- `linear_issue`: `JSC-288`
- `linear_milestone`: `Governance Trust Repair Slice`
- `plan_path`: `.harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md`
- `completed_units`: `IU-288-001`, `IU-288-002`, `IU-288-003`, `IU-288-004`,
  `IU-288-005`, `IU-288-006`
- `accepted_memory_decision`: replace PR-template `memory.json` proof with
  Project Brain, `.harness/memory/LEARNINGS.md`, and north-star learning-loop
  evidence
- `accepted_contract_ownership_map`: preserve `harness.contract.json` as the
  published aggregate and use bounded internal ownership before any future
  fragmentation
- `implemented_trust_repair`: PR-template `memory.json` proof replaced by
  `pnpm exec tsx src/cli.ts tooling-audit --path . --json` plus retained
  learning-loop evidence
- `implemented_prose_compression`: Project Brain memory-extension rollout note
  marked reference-only and linked to live authorities
- `implemented_eval`: governance contract memory simplification eval created
- `authorized_next_unit`: none
- `authorized_next_stage`: `he-work`
- `scope_guard`: do not edit PR-template, memory, contract, docs, or packaged
  skill behavior until the relevant implementation unit authorizes that surface
