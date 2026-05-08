# Coding Harness Linear Execution Plan

## Table Of Contents

- [Executive Linear Routing Summary](#executive-linear-routing-summary)
- [Target Linear Destination](#target-linear-destination)
- [Existing Project Match](#existing-project-match)
- [Proposed Milestones](#proposed-milestones)
- [Proposed Parent Issues](#proposed-parent-issues)
- [Proposed Sub-Issues](#proposed-sub-issues)
- [Now / Next / Later / Do Not Create](#now--next--later--do-not-create)
- [Dependency Map](#dependency-map)
- [Eval Gate Map](#eval-gate-map)
- [Human vs Agent Execution Map](#human-vs-agent-execution-map)
- [Recommended Labels](#recommended-labels)
- [Priority Mapping](#priority-mapping)
- [Project Reactivation Recommendation](#project-reactivation-recommendation)
- [Portfolio Ops Items](#portfolio-ops-items)
- [Dev Portfolio Impact](#dev-portfolio-impact)
- [Issue Templates](#issue-templates)
- [Evidence & Traceability Matrix](#evidence--traceability-matrix)

## Executive Linear Routing Summary

Route this work into the existing `coding-harness` Linear project under the
existing `Dev Portfolio` initiative. Do not create a new initiative or project.

Use Linear for execution state only. Keep `.harness/*` as the cognition,
strategy, ADR, invariant, evidence, and refactor-program source of truth.

Recommended active set:

1. Start one milestone: `Agent Cockpit Compression Slice`.
2. Open two parent issues under that milestone.
3. Keep all CI migration, contract/memory, and validation-orchestration work in
   `Next` or `Later` until the command cockpit stops lying.

Reason: command truth drift blocks agent confidence across the rest of the
system. Fixing it first reduces ambiguity before deeper migrations.

## Approved Current Slice

None.

`JSC-282` is locally complete for the source-command scope. Closure proof lives
in `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`, and the
active plan is marked complete. Live Linear still shows `JSC-282` in `Triage`,
so Linear state needs cleanup, but it should not reopen the implementation
slice.

## Linear Delta Capture

Last synced: 2026-05-08
Source: Linear project `coding-harness`, milestone `Agent Cockpit Compression
Slice`, parents `JSC-282` and `JSC-283`
Label status: resolved

Required label reconciliation:

| Label | Live status | Reason |
| --- | --- | --- |
| Developer Experience | created/applied | Planned label for command/skill UX impact; created in the JSC team and applied to `JSC-282` and `JSC-283`. |
| Reliability | created/applied | Planned label for validation/release-confidence impact; created in the JSC team and applied to `JSC-282` and `JSC-283`. |
| Architecture | existing as `architecture` | Case drift is obvious and reusable; acceptable normalization if applied. |
| Routing | created/applied | Planned label for command routing determinism; created in the JSC team and applied to `JSC-282`. |
| Drift-Risk | created/applied | Planned label for anti-drift work; created in the JSC team and applied to `JSC-282`. |
| Agent-Native | created/applied | Planned label for agent execution/discoverability work; created in the JSC team and applied to `JSC-283`. |
| Eval | created/applied | Planned label for eval-backed closure; created in the JSC team and applied to `JSC-283`. |

Labels were reconciled through the Linear plugin on 2026-05-08 after explicit
approval. `JSC-282` now has `Developer Experience`, `Reliability`,
`architecture`, `Routing`, and `Drift-Risk`; `JSC-283` now has `Developer
Experience`, `Agent-Native`, `Eval`, and `Reliability`.

| Issue | Title | Status | Priority | Classification | Reason |
| --- | --- | --- | --- | --- | --- |
| JSC-282 | `[coding-harness] Reconcile command truth for PR-loop cockpit` | Triage | High | already_covered | Live issue exists in the planned milestone. Local source-scope implementation and eval are complete, but Linear status is stale and should be closed or advanced separately. |
| JSC-283 | `[coding-harness] Prove packaged skill behavior for cockpit commands` | Triage | High | candidate_next_slice | This is the planned second parent issue for the active milestone and is explicitly unblocked by JSC-282 source proof. It has no child issues and no labels yet. |
| JSC-248 | `Implement agent-native cockpit control loop first slice` | In Progress | High | already_covered | Legacy/umbrella cockpit work remains active under `Control loop hardening and flow telemetry`; do not let it expand the next spec beyond JSC-283. |
| JSC-178 | `Modularize contract validation and command registry to reduce core-file risk` | In Progress | High | out_of_scope | Separate architecture-modularization work. It overlaps command-registry concerns but is not part of the approved cockpit packaged-skill slice. |

## Approved Next Slice Queue

| Order | Slice | Linear Issue | Route | Depends On | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Prove packaged skill behavior for cockpit commands | JSC-283 | he-spec -> he-plan -> he-work; agent-assisted with human review at fixture/admission boundaries | JSC-282 source-command proof; label reconciliation approval or explicit label deferral | Next bounded spec should consume `.harness/refactors/packaged-skill-behavior-assurance.md`, ADR-007, routing/moat/execution invariants, and the JSC-282 eval. Do not include broader command cleanup or JSC-248 umbrella scope. |
| 2 | Governance Trust Repair Slice | not yet selected | hold | JSC-283 packaged behavior proof or explicit deferral | Remains next strategic lane after adoption-surface proof. |
| 3 | CI Migration Boundary Recovery Slice | not yet selected | hold | active cockpit milestone closed or paused | High leverage but migration-risk; keep out of the current spec. |

## Target Linear Destination

| Work type | Destination | Parent initiative | Reason |
| --- | --- | --- | --- |
| Repo-specific refactors | `coding-harness` project | `Dev Portfolio` | All primary work modifies this repo's CLI, contract, validation, skill, docs, or harness artifacts. |
| Cross-repo operating hygiene | `Portfolio Ops` project | `Dev Portfolio` | Only reusable portfolio cadence, labels, or project hygiene belongs here. |
| New initiative | Do not create | `Dev Portfolio` already exists | The existing initiative cleanly represents the work. |

## Existing Project Match

| Repo | Matching project | Status recommendation | Reactivate? | Active set limit |
| --- | --- | --- | --- | --- |
| `coding-harness` | `coding-harness` | Active or reactivated for one milestone only | Yes, only if execution starts now | 2 parent issues, 4-6 sub-issues total |
| Portfolio-level process | `Portfolio Ops` | Backlog unless recurring hygiene is approved | No immediate reactivation required | 0 active issues now |

## Proposed Milestones

| Milestone | Target project | Status | Scope | Success criteria | Validation gates | Expected issue count | Explicitly out of scope |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Agent Cockpit Compression Slice | `coding-harness` | Now | Reconcile command truth and prove packaged skill command behavior for the cockpit path. | README/help/registry/dispatch/skill references agree for the chosen cockpit set; skill fixture matrix exists. | Lint, typecheck, tests, drift-gate, skill validation, routing determinism eval. | 2 parent, 4-6 sub | Broad command cleanup, all legacy command dispatch, UI work, new plugins. |
| Governance Trust Repair Slice | `coding-harness` | Next | Resolve memory ownership, governance surface ownership, and contract bounded-context design. | Placeholder memory is removed/reclassified/replaced; governance surfaces have owner/enforcement status; contract split plan is approved. | Docs lint, policy/docs gates, memory health, contract validation, governance drift eval. | 1-2 parent, 3-5 sub | Full contract migration until ownership is settled. |
| CI Migration Boundary Recovery Slice | `coding-harness` | Next | Characterize CI migration behavior and extract first lifecycle boundaries. | Characterization baseline exists; reporting/proof-pack extraction lands without behavior drift. | Test, typecheck, CI migration characterization, architecture drift eval, rollback proof. | 1 parent, 3-4 sub | Provider rewrite, broad CI redesign, break-glass changes beyond characterized paths. |
| Validation Typed Gate Specs Slice | `coding-harness` | Later | Mirror shell-heavy validation into typed gate specs behind stable entrypoints. | Gate graph snapshot and typed mirror exist; shell launcher remains stable. | Build, test, typecheck, verify-work, gate-spec eval, rollback checks. | 1 parent, 2-4 sub | Replacing `verify-work.sh` outright, changing external command contract. |

## Proposed Parent Issues

| Object type | Name/title | Target project | Parent initiative | Milestone | Priority | Labels | Execution route | Blocks | Blocked by | Source artifacts | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parent issue | `[coding-harness] Reconcile command truth for PR-loop cockpit` | `coding-harness` | `Dev Portfolio` | Agent Cockpit Compression Slice | 2 High | Developer Experience, Reliability, Architecture, Routing, Drift-Risk | Agent-assisted, human-review required | Skill behavior fixtures, cockpit enforcement | None | ADR-001, ADR-002, routing invariants, command refactor | Command truth drift directly increases agent ambiguity. |
| Parent issue | `[coding-harness] Prove packaged skill behavior for cockpit commands` | `coding-harness` | `Dev Portfolio` | Agent Cockpit Compression Slice | 2 High | Developer Experience, Agent-Native, Eval, Reliability | Agent-assisted, human-review required | Release gate integration for packaged skill | Command cockpit set identified | ADR-007, skill refactor | Skill validity must mean downstream usability, not string freshness. |
| Parent issue | `[coding-harness] Resolve memory and governance truth ownership` | `coding-harness` | `Dev Portfolio` | Governance Trust Repair Slice | 2 High | Governance, Reliability, Context, Drift-Risk | Agent-assisted, human-review required | Contract bounded-context migration | Command cockpit warnings triaged enough to avoid overlapping drift | ADR-003, ADR-004, ADR-007, governance refactor | Required governance and memory surfaces must not be symbolic. |
| Parent issue | `[coding-harness] Characterize and split CI migration lifecycle boundaries` | `coding-harness` | `Dev Portfolio` | CI Migration Boundary Recovery Slice | 2 High | Reliability, Architecture, Refactor, Migration | Agent-assisted, human-review required | Provider adapter and policy extraction | Characterization baseline | ADR-006, CI refactor | `ci-migrate-core.ts` is the highest-risk oversized orchestrator. |
| Parent issue | `[coding-harness] Mirror validation orchestration into typed gate specs` | `coding-harness` | `Dev Portfolio` | Validation Typed Gate Specs Slice | 3 Normal | Reliability, Automation, Eval, Refactor | Agent-assisted, human-review required | Shell launcher burn-down | Gate graph snapshot | ADR-006, execution invariants, validation refactor | Validation must become inspectable without breaking stable wrappers. |

## Proposed Sub-Issues

Only create sub-issues when execution starts for a milestone.

| Parent issue | Sub-issue title | Priority | Execution route | Can run in parallel | Validation gates | Rollback condition |
| --- | --- | --- | --- | --- | --- | --- |
| `[coding-harness] Reconcile command truth for PR-loop cockpit` | `[coding-harness] Inventory command truth across dispatch, registry, docs, and skill` | 2 High | Agent-safe | No | Drift-gate snapshot, docs lint | Stop if inventory cannot distinguish command aliases from missing dispatch. |
| `[coding-harness] Reconcile command truth for PR-loop cockpit` | `[coding-harness] Tier cockpit, domain, plumbing, and legacy command surfaces` | 2 High | Agent-assisted | No | Command inventory review, ADR-002 conformance | Stop if tier rules conflict with public CLI compatibility. |
| `[coding-harness] Reconcile command truth for PR-loop cockpit` | `[coding-harness] Generate or validate command truth projections` | 2 High | Agent-assisted | No | Lint, typecheck, drift-gate | Roll back if docs/help/registry diverge further. |
| `[coding-harness] Reconcile command truth for PR-loop cockpit` | `[coding-harness] Dispatch or demote first cockpit command batch` | 2 High | Agent-assisted | No | Focused CLI tests, drift-gate, verify-work fast | Roll back if command behavior changes without explicit migration note. |
| `[coding-harness] Prove packaged skill behavior for cockpit commands` | `[coding-harness] Design packaged skill fixture matrix` | 2 High | Agent-safe | Yes | Skill validation, fixture design review | Stop if fixtures duplicate existing validators without behavior proof. |
| `[coding-harness] Prove packaged skill behavior for cockpit commands` | `[coding-harness] Add clean install and update/idempotence skill fixtures` | 2 High | Agent-assisted | No | Skill fixture tests, verify-work fast | Roll back if fixtures require non-portable local state. |
| `[coding-harness] Prove packaged skill behavior for cockpit commands` | `[coding-harness] Validate packaged skill command reference resolution` | 2 High | Agent-assisted | Yes after command tiering | Skill validation, routing determinism eval | Stop if command truth source is unresolved. |
| `[coding-harness] Resolve memory and governance truth ownership` | `[coding-harness] Inventory governance truth surfaces` | 2 High | Agent-safe | No | Docs lint, policy/docs gate | Stop if authoritative and reference-only docs cannot be separated. |
| `[coding-harness] Resolve memory and governance truth ownership` | `[coding-harness] Decide operational, fixture-only, or removed status for memory.json` | 2 High | Human-review required | No | Memory health, PR template validation | Stop if required memory signal becomes weaker without replacement. |
| `[coding-harness] Resolve memory and governance truth ownership` | `[coding-harness] Design contract bounded-context ownership map` | 2 High | Human-review required | Yes after inventory | Contract validation, ADR-004 conformance | Stop if published aggregate compatibility is unclear. |
| `[coding-harness] Characterize and split CI migration lifecycle boundaries` | `[coding-harness] Capture CI migration characterization baseline` | 2 High | Agent-assisted | No | Existing CI migration tests, characterization artifact | Stop if baseline is non-deterministic. |
| `[coding-harness] Characterize and split CI migration lifecycle boundaries` | `[coding-harness] Extract CI migration reporting and proof-pack boundary` | 2 High | Agent-assisted | No | Focused tests, typecheck, architecture drift eval | Roll back if extracted module imports old core as hidden dependency. |
| `[coding-harness] Mirror validation orchestration into typed gate specs` | `[coding-harness] Snapshot verify-work gate graph and artifact expectations` | 3 Normal | Agent-assisted | No | verify-work fast, docs lint | Stop if snapshot cannot explain current shell behavior. |
| `[coding-harness] Mirror validation orchestration into typed gate specs` | `[coding-harness] Add typed spec mirror behind stable verify-work entrypoint` | 3 Normal | Agent-assisted | No | Typecheck, tests, verify-work fast | Roll back if wrapper compatibility changes. |

## Now / Next / Later / Do Not Create

| Bucket | Work | Destination | Rationale |
| --- | --- | --- | --- |
| Now | Agent Cockpit Compression Slice | `coding-harness` | Fixes the highest-context-cost path first: command truth and skill behavior. |
| Next | Governance Trust Repair Slice | `coding-harness` | Memory/governance trust should follow command truth so agents know where to route. |
| Next | CI Migration Boundary Recovery Slice | `coding-harness` | High leverage, but migration-risk; start after active cockpit work is bounded. |
| Later | Validation Typed Gate Specs Slice | `coding-harness` | Important, but less urgent than trust and command drift. |
| Later | Portfolio-level reactivation checklist | `Portfolio Ops` | Useful only if the pattern repeats across repo projects. |
| Do Not Create | Generic architecture review issues | None | Cognition already lives in `.harness/*`; Linear should not mirror the docs. |
| Do Not Create | One issue per ADR/invariant | None | Creates process noise without execution value. |
| Do Not Create | New `Project Brain` project | None | Memory confirms Project Brain is part of `coding-harness`, not a separate initiative. |
| Do Not Create | Broad plugin ecosystem work | None | Optional plugin breadth is a false moat until behavior-tested. |
| Do Not Create | Full CI migration rewrite | None | Refactor program requires strangler migration, not a clean rewrite. |

## Dependency Map

| Item | Dependency type | Blocks | Blocked by | Parallel? | Human review |
| --- | --- | --- | --- | --- | --- |
| Command truth parent | blocking, cognition | Skill fixtures, drift enforcement | None | No | Required for tier/admission decisions |
| Skill behavior parent | eval, agent-native | Packaged skill release gate | Command cockpit set | Partially | Required before release gating |
| Governance/memory parent | governance, cognition | Contract migration, memory health gates | Command truth stabilization | Partially | Required for memory ownership decision |
| CI migration parent | migration, architecture | Provider/policy extraction | Characterization baseline | No | Required at phase boundaries |
| Validation typed specs parent | eval, reliability | Shell launcher burn-down | Gate graph snapshot | No | Required before wrapper behavior changes |
| Portfolio Ops hygiene item | soft, governance | Cross-repo reuse only | Evidence from at least two repo projects | Yes | Optional |

## Eval Gate Map

| Milestone | Build | Test | Typecheck | Lint | Security | Eval | Architecture Drift | Routing Determinism | Context Load | Agent Discoverability | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Agent Cockpit Compression Slice | As affected | Focused CLI and skill tests | Required | Required | Not primary | `.harness/evals/coding-harness-command-cockpit-truth-reconciliation-eval.md`; `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md` | Required | Required | Required | Required | Required for demotions |
| Governance Trust Repair Slice | As affected | Contract/memory tests | Required | Required | Governance-sensitive | `.harness/evals/coding-harness-governance-contract-memory-simplification-eval.md` | Required | Secondary | Required | Secondary | Required for memory changes |
| CI Migration Boundary Recovery Slice | Required | CI migration characterization | Required | Required | CI ownership-sensitive | `.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md` | Required | Secondary | Required | Secondary | Required |
| Validation Typed Gate Specs Slice | Required | Gate spec and wrapper tests | Required | Required | Not primary | `.harness/evals/coding-harness-validation-typed-gate-specs-eval.md` | Required | Required | Secondary | Secondary | Required |

## Human vs Agent Execution Map

| Work | Classification | Agent role | Human role |
| --- | --- | --- | --- |
| Command inventory | Agent-safe | Gather evidence and produce deterministic diff | Review only if command semantics are ambiguous |
| Command tier/admission rules | Human-review required | Draft tier map and conflicts | Approve public command classification |
| Command projection/gate implementation | Agent-assisted | Implement and test | Review compatibility and deprecations |
| Skill fixture matrix | Agent-assisted | Draft fixtures and test harness | Confirm downstream workflow realism |
| Memory ownership decision | Human-review required | Inventory facts and options | Decide operational vs fixture-only vs removal |
| Contract bounded-context design | Human-review required | Draft ownership map | Approve compatibility posture |
| CI migration extraction | Agent-assisted | Implement phased extraction with tests | Review phase boundaries and rollback evidence |
| Validation typed spec mirror | Agent-assisted | Implement mirror and tests | Review wrapper compatibility |
| Portfolio Ops hygiene | Human-review required | Draft reusable checklist | Approve cross-repo policy |

## Recommended Labels

Use existing labels first:

- Developer Experience
- Reliability
- Governance
- Automation

Add these only if absent and approved:

| Label | Purpose | Why existing labels are insufficient |
| --- | --- | --- |
| Architecture | Structural boundary and module-shape work | Reliability does not distinguish architecture migration. |
| Agent-Native | Agent discoverability, skill behavior, routing clarity | Developer Experience is broader than agent execution. |
| Eval | Work requiring explicit eval artifact closure | Reliability does not name eval-backed completion. |
| Moat-Critical | Protects operational learning or determinism | Governance/Architecture do not encode strategic importance. |
| Refactor | Staged structural migration | Architecture can include decisions; Refactor signals execution. |
| Drift-Risk | Work driven by known drift warning or anti-drift rule | Reliability is too broad for drift-specific queues. |
| Migration | Multi-phase reversible change | Refactor does not always imply migration sequencing. |
| Context | Memory/context/cognition surfaces | Agent-Native is broader than memory/context trust. |
| Routing | Command, skill, or execution path routing | Developer Experience is too broad for route determinism. |

Do not create one-off labels for individual refactor programs.

## Priority Mapping

| Priority | Use in this plan |
| --- | --- |
| 1 Urgent | Do not use now; no active production/safety regression is identified. |
| 2 High | Command truth, skill behavior proof, memory/governance truth, CI migration boundary recovery. |
| 3 Normal | Validation typed specs and supporting non-blocking architecture hardening. |
| 4 Low | Portfolio checklist or docs-only support work. |
| 0 No priority | Backlog placeholders only; avoid unless creating a holding issue is explicitly approved. |

## Project Reactivation Recommendation

If `coding-harness` is active, add the `Agent Cockpit Compression Slice`
milestone directly and keep only its two parent issues active.

If `coding-harness` is backlog or completed, reactivate it only for this
milestone. Do not reopen broad architecture work. Close or pause reactivation
after command truth and skill fixture proof are validated.

Do not reactivate `Portfolio Ops` for this plan unless the same reactivation
pattern is being applied to multiple repos.

## Portfolio Ops Items

| Item | Create now? | Target | Priority | Reason |
| --- | --- | --- | --- | --- |
| `[Portfolio Ops] Standardize repo project reactivation checklist` | No | `Portfolio Ops` | 4 Low | Useful only after at least two repo projects reuse this pattern. |
| `[Portfolio Ops] Define shared architecture-artifact to Linear routing rule` | No | `Portfolio Ops` | 4 Low | This plan already defines the rule locally; avoid process work until repeated. |
| `[Portfolio Ops] Audit labels across repo projects for architecture execution` | No | `Portfolio Ops` | 4 Low | Avoid label churn until Linear object creation is approved. |

## Dev Portfolio Impact

This plan strengthens `Dev Portfolio` by clarifying how architecture cognition
becomes execution without duplicating the cognition layer.

No new initiative is recommended because:

- all primary execution is repo-specific to `coding-harness`
- `Dev Portfolio` already represents active/backlog/dormant repo projects
- `Portfolio Ops` already represents cross-repo hygiene
- new initiative creation would increase portfolio ceremony without adding
  routing clarity

## Issue Templates

### Parent Issue Template: Command Truth

```text
## Objective
Reconcile command truth for the PR-loop cockpit so CLI dispatch, registry,
capability metadata, docs, help, packaged skill references, and drift gates agree
for the chosen command set.

## Source Artifacts
- .harness/decisions/ADR-001-pr-loop-cockpit-core.md
- .harness/decisions/ADR-002-command-truth-and-surface-budget.md
- .harness/core/routing-invariants.md
- .harness/refactors/command-cockpit-truth-reconciliation.md

## Why This Matters
Command truth is product truth for an agent-native CLI. Drift here forces agents
to over-read, guess, or run nonexistent commands.

## Scope
Inventory command truth, classify command tiers, generate or validate command
projections, and dispatch or demote the first cockpit command batch.

## Out of Scope
Broad legacy cleanup, new plugins, UI work, and full command-surface rewrite.

## Execution Notes
Start with inventory. Do not dispatch every README command by default. Tier
commands before implementing behavior.

## Validation Gates
docs:lint, lint, typecheck, focused CLI tests, drift-gate, verify-work --fast,
.harness/evals/coding-harness-command-cockpit-truth-reconciliation-eval.md.

## Rollback Conditions
Stop if generated projections increase drift, command behavior changes without a
migration note, or public compatibility cannot be classified.

## Linear Routing
Project: coding-harness
Milestone: Agent Cockpit Compression Slice
Labels: Developer Experience, Reliability, Architecture, Routing, Drift-Risk
Priority: 2
Blocks: packaged skill command behavior proof
Blocked by: none
```

### Parent Issue Template: Packaged Skill Behavior

```text
## Objective
Prove the packaged coding-harness skill works in downstream-like fixture states
for cockpit command discovery, install/update behavior, and command references.

## Source Artifacts
- .harness/decisions/ADR-007-portable-skill-and-memory-proof.md
- .harness/core/routing-invariants.md
- .harness/core/moat-invariants.md
- .harness/refactors/packaged-skill-behavior-assurance.md

## Why This Matters
The packaged skill is the adoption surface. Passing string validation is not the
same as downstream usability.

## Scope
Design fixture matrix, add clean install/update fixtures, validate command
reference resolution, and prepare release-gate integration.

## Out of Scope
Changing skill philosophy, adding plugin breadth, or turning fixtures into a
general downstream repo simulator.

## Execution Notes
Begin after the cockpit command set is identified. Keep fixtures portable and
deterministic.

## Validation Gates
skill:validate, fixture tests, lint, typecheck, verify-work --fast,
.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md.

## Rollback Conditions
Stop if fixtures depend on Jamie-local state or fail to exercise real skill
behavior.

## Linear Routing
Project: coding-harness
Milestone: Agent Cockpit Compression Slice
Labels: Developer Experience, Agent-Native, Eval, Reliability
Priority: 2
Blocks: packaged skill release-gate integration
Blocked by: cockpit command set identified
```

### Parent Issue Template: Governance And Memory Truth

```text
## Objective
Resolve ownership and truth status for governance, memory, Project Brain, and
contract surfaces so required evidence is never symbolic.

## Source Artifacts
- .harness/decisions/ADR-003-executable-governance-or-delete.md
- .harness/decisions/ADR-004-bounded-contract-contexts.md
- .harness/decisions/ADR-007-portable-skill-and-memory-proof.md
- .harness/core/governance-invariants.md
- .harness/refactors/governance-contract-memory-simplification.md

## Why This Matters
Governance is a moat only when it creates trustworthy execution state. Placeholder
memory and duplicated prose damage that trust.

## Scope
Inventory governance truth surfaces, decide memory ownership, design contract
bounded-context ownership, and compress duplicated governance prose.

## Out of Scope
Full contract migration before ownership is approved; new Project Brain project;
cross-repo governance policy.

## Execution Notes
Treat Project Brain as a coding-harness capability. Keep published aggregate
contract compatibility.

## Validation Gates
docs:lint, contract validation, memory health, policy/docs gates, verify-work
--fast, .harness/evals/coding-harness-governance-contract-memory-simplification-eval.md.

## Rollback Conditions
Stop if memory validation becomes weaker without replacement or if aggregate
contract compatibility is unclear.

## Linear Routing
Project: coding-harness
Milestone: Governance Trust Repair Slice
Labels: Governance, Reliability, Context, Drift-Risk
Priority: 2
Blocks: contract bounded-context migration
Blocked by: command cockpit warnings triaged enough to avoid overlapping drift
```

### Parent Issue Template: CI Migration Boundaries

```text
## Objective
Characterize CI migration behavior and begin staged lifecycle extraction from
the oversized CI migration core.

## Source Artifacts
- .harness/decisions/ADR-006-no-new-behavior-in-oversized-orchestrators.md
- .harness/core/architecture-invariants.md
- .harness/core/execution-invariants.md
- .harness/refactors/ci-migration-boundary-recovery.md

## Why This Matters
CI migration behavior is valuable but concentrated in a high-risk orchestrator.
Future changes need local reasoning and rollback safety.

## Scope
Capture characterization baseline, extract reporting/proof-pack boundary, and
define next lifecycle extraction order.

## Out of Scope
Full provider rewrite, clean rewrite, uncharacterized policy changes, and broad
CI ownership migration.

## Execution Notes
Use strangler migration. Extracted modules must not import the old core as a
hidden dependency.

## Validation Gates
Focused CI migration tests, typecheck, lint, verify-work --fast, architecture
drift eval, .harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md.

## Rollback Conditions
Stop if characterization is non-deterministic or extracted behavior changes
without explicit proof.

## Linear Routing
Project: coding-harness
Milestone: CI Migration Boundary Recovery Slice
Labels: Reliability, Architecture, Refactor, Migration
Priority: 2
Blocks: provider adapter and policy extraction
Blocked by: characterization baseline
```

### Parent Issue Template: Validation Typed Specs

```text
## Objective
Mirror validation orchestration into typed gate specs while preserving stable
shell entrypoints.

## Source Artifacts
- .harness/decisions/ADR-006-no-new-behavior-in-oversized-orchestrators.md
- .harness/core/execution-invariants.md
- .harness/refactors/validation-orchestration-typed-gate-specs.md

## Why This Matters
Validation is moat-critical, but shell-heavy policy engines increase cognition
cost and make behavior harder to inspect.

## Scope
Snapshot gate graph, add typed spec mirror, define failure taxonomy, and keep
`verify-work.sh` compatibility.

## Out of Scope
Deleting `verify-work.sh`, changing public wrapper behavior, or broad validation
redesign.

## Execution Notes
Do not replace the launcher first. Mirror, test, then burn down internals only
when equivalence is proven.

## Validation Gates
lint, typecheck, tests, verify-work --fast, gate-spec eval,
.harness/evals/coding-harness-validation-typed-gate-specs-eval.md.

## Rollback Conditions
Stop if wrapper behavior changes or current shell behavior cannot be explained
by the typed mirror.

## Linear Routing
Project: coding-harness
Milestone: Validation Typed Gate Specs Slice
Labels: Reliability, Automation, Eval, Refactor
Priority: 3
Blocks: shell launcher burn-down
Blocked by: gate graph snapshot
```

## Evidence & Traceability Matrix

| Conclusion | Evidence | Affected systems | Confidence | Operational impact |
| --- | --- | --- | --- | --- |
| Route primary work to `coding-harness`, not a new project. | User-supplied operating model; memory says Project Brain is part of coding-harness; all artifacts target this repo. | Linear project routing, Dev Portfolio | High | Prevents project sprawl and keeps repo work in the right control surface. |
| Do not create a new initiative. | Existing `Dev Portfolio` structure represents portfolio-level work; artifacts are repo-specific. | Dev Portfolio, Portfolio Ops | High | Avoids initiative theater. |
| Start with command cockpit compression. | ADR-001, ADR-002, routing invariants, drift warnings, command refactor. | CLI dispatch, registry, docs, packaged skill | High | Reduces immediate agent ambiguity and unlocks skill proof. |
| Packaged skill behavior proof belongs in the first active slice but after command truth. | ADR-007, packaged-skill refactor, moat invariants. | `.agents/skills/coding-harness/**`, skill validators | High | Ensures adoption surface is behavior-tested. |
| Governance/memory work is high priority but should be next, not simultaneous. | ADR-003, ADR-004, ADR-007, governance refactor. | `memory.json`, `.harness/memory/**`, contract, PR template | Medium-high | Repairs trust without overloading active execution. |
| CI migration decomposition is high-value but migration-risk. | ADR-006, CI refactor, review/triage findings. | `ci-migrate-core.ts`, CI migration tests | High | Requires characterization before extraction. |
| Validation typed specs are valuable later. | ADR-006, execution invariants, validation refactor. | `scripts/verify-work.sh`, gate specs | Medium-high | Improves inspectability after nearer trust issues. |
| Portfolio Ops should receive no immediate active issue. | Plan scope is repo-specific; portfolio hygiene is reusable only after repetition. | Portfolio Ops | Medium | Avoids cross-repo process work before need is proven. |
