# Governance Contract Memory Simplification

# Refactor Classification

governance reduction, cognition compression, modularity correction,
anti-drift hardening, context-load reduction, moat reinforcement

# Problem Statement

Governance is a core strength of Coding Harness, but the governance substrate is
at risk of becoming heavier than the PR-loop failures it prevents. The prior
artifacts identify three connected problems:

- `harness.contract.json` and `src/lib/contract/types-core.ts` aggregate many
  policy domains.
- `memory.json` contains placeholder content while memory is treated as a
  required trust surface.
- Governance prose repeats across docs and can become ceremony unless tied to
  gates, generated truth, or measured improvement.

The future-agent issue is severe: agents cannot reliably distinguish executable
policy from reassurance prose, and they cannot know whether memory/context
surfaces are operational truth, fixture data, or stale placeholders.

# Root Cause Analysis

This architecture emerged because repo-local governance was the correct answer
to real agent failure modes. Contracts, PR templates, CI checks, docs, Project
Brain, Local Memory, and learning files were added to reduce ambiguity and make
agents safer.

It survived because every surface has a plausible purpose in isolation.
Together, they create a broad policy substrate. The contract became a convenient
place to add policy. Memory scaffolding remained because shape checks could pass
without meaningful content. Docs repeated policy because humans and agents need
orientation, but repeated prose became drift-prone.

The issue is strategic and operational. Governance is the moat only when it is
executable, current, and cheaper than the failure it prevents.

# Evidence

Facts:

- `.harness/review/coding-harness-architecture-review.md` identifies
  `harness.contract.json` at 1120 lines and `src/lib/contract/types-core.ts` at
  1776 lines.
- The same review identifies `memory.json` containing placeholder values while
  PR workflows treat memory validation as required.
- `.harness/triage/coding-harness-triage.md` recommends ADRs for contract
  bounded contexts, memory surface ownership, and governance admission
  criteria.
- `.harness/strategy/coding-harness-strategy.md` says governance policy must be
  executable, generated, validated, or deleted.

Interpretation:

- Contract breadth and placeholder memory are not separate cleanups. They are
  symptoms of governance trust drift.
- Governance simplification should reduce the number of surfaces agents need to
  read before acting.

Assumptions:

- The published contract aggregate must remain compatible during migration.
- Some memory surfaces may remain valuable after ownership is clarified.

# Architectural Impact

Affected systems:

- `harness.contract.json`
- `src/lib/contract/types-core.ts`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.harness/memory/**`
- `.harness/knowledge/**`
- `memory.json`
- docs under `docs/agents/**`
- docs-gate, policy-gate, memory/context checks
- packaged skill references to governance and memory

Blast radius:

High for governance semantics, medium for runtime behavior if the published
contract remains stable.

Migration complexity:

Difficult because many surfaces are policy projections. The migration must
classify ownership before deleting prose or moving schema.

Rollback difficulty:

Moderate if schema fragments compose to the same aggregate and old docs remain
available during transition.

Likely files/directories touched:

- `harness.contract.json`
- `src/lib/contract/**`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/agents/**`
- `.harness/memory/**`
- `.harness/knowledge/**`
- `memory.json`
- packaged skill references

Systems that must not be touched casually:

- CI ownership split.
- Current-head review proof.
- North-star mission and metric.
- Required-check contract.
- Published contract compatibility.

# Desired End State

Governance should have clear layers:

- contract fragments by bounded context
- a composed published contract for compatibility
- generated or validated docs projections
- one memory ownership map that names canonical, fixture, generated, and
  deprecated memory surfaces
- PR template checks that validate meaningful evidence, not placeholder shape
- governance admission rules requiring repeated-failure ID, enforcement
  destination, and deletion condition

Future agents should know which surface is executable truth without reading the
entire docs tree.

# Migration Strategy

Use a governance inventory and projection migration. Do not start by moving
schema. Start by classifying policy ownership and memory truth.

Sequencing order:

1. Inventory governance surfaces and classify each as contract, gate, generated
   projection, human guide, fixture, or stale.
2. Decide memory ownership: operational `memory.json`, fixture-only
   `memory.json`, or removal from required validation.
3. Define contract bounded contexts and owners.
4. Introduce internal contract fragments that compose to the same aggregate.
5. Delete or generate duplicate governance prose.
6. Add validation that prevents new policy prose without enforcement or source
   ownership.

Coexistence rule:

The aggregate contract remains the public compatibility layer until all
fragments and projections are validated.

Rollback strategy:

If contract fragmentation creates compatibility risk, keep fragments internal
and generate the existing aggregate exactly.

Linear milestone/parent issue shape:

One parent issue for governance simplification. Sub-issues should be grouped by
surface class, not one issue per document.

# Execution Phases

## Phase 1 - Governance Surface Inventory

Objective:

Map every governance surface to source-of-truth status, owner, enforcement, and
deletion condition.

Affected systems:

Contract, docs, PR template, memory files, gates.

Expected risk:

Low.

Can run in parallel:

No.

Validation requirements:

- Inventory artifact exists.
- No behavior changes.

Rollback conditions:

If ownership cannot be determined for a critical surface, stop and create an ADR
decision point.

Linear mapping:

Sub-issue: "Inventory governance truth surfaces".

Agent-safe:

Yes.

Human review required:

Yes for ownership decisions.

## Phase 2 - Memory Ownership Decision

Objective:

Decide whether `memory.json` is operational, fixture-only, or removed from
required validation.

Affected systems:

`memory.json`, PR template, memory docs, Project Brain docs, memory gates.

Expected risk:

Medium.

Can run in parallel:

No.

Validation requirements:

- PR template no longer requires meaningless placeholder evidence.
- Memory docs identify canonical surfaces.
- Any retained memory has provenance and review date.

Rollback conditions:

If memory validation becomes weaker without an alternative trust surface, stop.

Linear mapping:

Sub-issue: "Resolve memory surface ownership".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 3 - Contract Bounded Context Design

Objective:

Define contract fragments by bounded context while preserving the published
aggregate.

Affected systems:

`harness.contract.json`, `src/lib/contract/types-core.ts`, contract tests.

Expected risk:

Medium-high.

Can run in parallel:

No.

Validation requirements:

- Generated aggregate matches current contract shape.
- Type tests preserve existing public types.
- No new top-level policy domain without owner.

Rollback conditions:

If published contract shape changes unintentionally.

Linear mapping:

Sub-issue: "Design contract bounded contexts".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 4 - Contract Fragment Migration

Objective:

Move schema definitions into context-specific modules and compose the aggregate.

Affected systems:

Contract type modules, defaults, schema validation, docs projections.

Expected risk:

High.

Can run in parallel:

No.

Validation requirements:

- Contract fingerprint compatibility documented.
- Existing contract validation passes.
- Downstream generated files unchanged unless intentionally migrated.

Rollback conditions:

Any unintended scaffold or contract output drift.

Linear mapping:

Sub-issue: "Migrate contract schema to fragments".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 5 - Governance Prose Compression

Objective:

Delete, link, or generate repeated policy prose.

Affected systems:

Docs, AGENTS guidance, PR template, packaged skill references.

Expected risk:

Medium.

Can run in parallel:

Yes, after source-of-truth inventory exists.

Validation requirements:

- Docs lint.
- Docs-gate passes.
- No policy behavior exists only in deleted prose.

Rollback conditions:

If deletion removes the only discoverable instruction for a required workflow.

Linear mapping:

Sub-issue: "Compress repeated governance prose".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 6 - Governance Admission Enforcement

Objective:

Prevent new governance surfaces unless they name repeated failure, enforcement
destination, owner, and deletion condition.

Affected systems:

Docs-gate, policy-gate, PR template, reviewer instructions.

Expected risk:

Medium.

Can run in parallel:

No.

Validation requirements:

- Fixture proves unsupported policy prose fails.
- Existing docs either pass or are grandfathered with owner/date.

Rollback conditions:

If enforcement blocks unrelated docs-only work.

Linear mapping:

Sub-issue: "Enforce governance admission criteria".

Agent-safe:

Assisted.

Human review required:

Yes.

# Linear Mapping

Workspace/team: Jscraik
Team key: JSC
Top-level initiative: Dev Portfolio
Cross-repo project: Portfolio Ops
Repo-specific work: coding-harness

Target Linear project:

Coding Harness - Governance Simplification And Trust Repair.

Repo-specific or cross-repo:

Repo-specific first. Cross-repo later if governance admission rules become a
shared harness pattern.

Portfolio Ops:

Yes as governance hygiene, but execution belongs in coding-harness.

Dev Portfolio:

Yes.

Recommended milestone name:

Governance Contract Memory Simplification.

Recommended parent issue title:

Simplify governance, contract, and memory truth surfaces.

Recommended sub-issues:

- Inventory governance truth surfaces.
- Resolve memory surface ownership.
- Design contract bounded contexts.
- Migrate contract schema to fragments.
- Compress repeated governance prose.
- Enforce governance admission criteria.

Suggested priority:

P1 for memory ownership, P2 for full contract migration.

Suggested labels:

governance, contract, memory, cognition, anti-drift, refactor-program.

Dependencies:

Memory ownership before adding memory/context work. Contract design before
fragment migration.

Project reactivation:

Reactivate any governance simplification project if present.

Active set:

Keep active set small: memory ownership plus one contract/design issue.

# Anti-Regression Constraints

- Do not weaken CI ownership split.
- Do not remove independent review requirements.
- Do not change published contract shape accidentally.
- Do not keep placeholder memory as required evidence.
- Do not add governance docs without enforcement destination.
- Do not duplicate policy across docs and contract without generated sync.
- Do not create one Linear issue per repeated paragraph.

# Eval Requirements

Expected eval artifact:

`.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`

Eval must prove:

- Memory surfaces have explicit ownership and provenance.
- Placeholder memory is removed, replaced, or marked fixture-only and excluded
  from required trust checks.
- Contract fragments compose to the published aggregate.
- Duplicate policy prose decreases.
- New governance surfaces require repeated-failure ID and enforcement
  destination.
- Agents can identify canonical governance truth surfaces in one pass.

No Linear parent issue or milestone should close without this eval artifact.

# Success Criteria

- `memory.json` no longer presents placeholder content as operational truth.
- Contract bounded contexts are named and owned.
- Published contract compatibility is preserved.
- Duplicate governance prose is reduced or generated.
- New policy surfaces have owner, enforcement, and deletion conditions.
- Future agents can distinguish contract, gate, docs, memory, and fixture
  surfaces.

# Safe Rollback Conditions

Rollback if:

- contract aggregate changes unintentionally
- CI ownership or review independence weakens
- memory validation loses meaningful trust signal
- doc deletion removes required operational guidance
- governance admission enforcement blocks unrelated work

Linear status recommendation:

Block the active migration sub-issue, keep the parent open, and record whether
the failure was contract compatibility, memory trust, or docs discoverability.

# Future-Agent Guidance

Preserve:

- north-star mission and metric
- CI ownership split
- independent review surfaces
- published contract compatibility
- meaningful memory provenance

Simplify further:

- duplicated docs
- symbolic memory checks
- contract internals
- generated projections

Intentional complexity:

Repo-local governance and independent check ownership.

Accidental complexity:

Placeholder memory, repeated prose, and broad policy aggregation.

Safe to modify:

Docs layout, memory scaffolding, contract internal organization after aggregate
compatibility tests exist.

Human review required:

Contract shape, PR template requirements, CI ownership, and memory-source
ownership.

# Related Systems

- `.harness/features/coding-harness-intent.md`
- `.harness/review/coding-harness-architecture-review.md`
- `.harness/triage/coding-harness-triage.md`
- `.harness/strategy/coding-harness-strategy.md`
- `harness.contract.json`
- `src/lib/contract/types-core.ts`
- `memory.json`
- `.harness/memory/**`
- `.harness/knowledge/**`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/agents/**`
