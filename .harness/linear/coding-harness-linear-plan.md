# Coding Harness Linear Execution Plan

## Table Of Contents

- [Executive Linear Routing Summary](#executive-linear-routing-summary)
- [Target Linear Destination](#target-linear-destination)
- [Existing Project Match](#existing-project-match)
- [Proposed Milestones](#proposed-milestones)
- [Proposed Parent Issues](#proposed-parent-issues)
- [Proposed Sub-Issues](#proposed-sub-issues)
- [JSC-301 Future Work: Skill-Backed HE Gates](#jsc-301-future-work-skill-backed-he-gates)
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

Reason: command truth drift blocked agent confidence across the rest of the
system. The current gate must now prevent stale Linear state from reopening
completed slices and must route the next spec to the first genuinely new slice.

## Approved Current Slice

No new implementation slice is approved from this plan until stale Linear state
is reconciled for completed slices.

`JSC-282` is locally complete for the source-command scope. Closure proof lives
in `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`, and the
active plan is marked complete. Live Linear still shows `JSC-282` in `Triage`,
so Linear state needs cleanup, but it should not reopen the implementation
slice.

`JSC-283` is locally complete for the packaged-skill behavior scope. Closure
proof lives in
`.harness/evals/coding-harness-jsc-283-packaged-skill-behavior-assurance-eval.md`.
Live Linear still shows `JSC-283` in `Triage`, so Linear state needs cleanup,
but it should not remain the active implementation slice.

`JSC-288` is implementation-complete for the governance trust repair scope.
Closure proof lives in
`.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`.
Live Linear still shows `JSC-288` in `Triage`, so Linear state needs cleanup,
but it should not become the next `he-spec` target.

`JSC-289` is implementation-complete enough for eval-backed closure review.
Closure proof lives in
`.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md`, which
states that Linear closure remains gated on human acceptance. Live Linear still
shows `JSC-289` in `In Progress`, so the next action is Linear/eval acceptance
cleanup, not a new JSC-289 spec.

`JSC-290` is implementation-complete and merged through PR
[#232](https://github.com/jscraik/coding-harness/pull/232) at head
`e18ba04d4aeea854d0d14c3b46f724f8a770a6fb`. Closure proof lives in
`.harness/evals/coding-harness-validation-typed-gate-specs-eval.md`, and the
PR check rollup is green. Live Linear still shows `JSC-290` in `In Progress`
and unattached to a project milestone, so the next action is Linear closure
cleanup, not another validation typed-gate spec.

## Linear Delta Capture

Last synced: 2026-05-12T21:32Z
Source: Linear projects `Harness cockpit routing` and legacy archived
`coding-harness`; live project issue set `JSC-300`, `JSC-301`, `JSC-302`,
`JSC-304`, and `JSC-311`; direct issue checks for `JSC-303`, `JSC-178`,
`JSC-198`, `JSC-282`, `JSC-283`, `JSC-288`, `JSC-289`, and `JSC-290`.
2026-05-12 verification note: direct Linear fetch confirms
`JSC-300`, `JSC-301`, `JSC-302`, and `JSC-304` each have
`archivedAt=2026-05-11T10:45:30.716Z` in project `Harness cockpit routing`.
Label status: resolved

2026-05-11 delta: Linear has been reorganized. `Harness cockpit routing` is
the current active project for lifecycle routing work under the `Dev Portfolio`
initiative; it has no milestones. The previous `coding-harness` project issues
are now archived in Linear, and the formerly stale completed slices have been
closed where appropriate.

2026-05-11 active-route delta: `JSC-311` is the only unarchived,
high-priority, spec-ready issue in the live `Harness cockpit routing` project.
It is `Todo`, parented by `JSC-300`, labeled `Drift-Risk`, `Routing`,
`Eval`, `Agent-Native`, and `Reliability`, and scoped to HE phase-exit
evidence gates for skill-backed commit readiness. This should now move from
future work to the approved next spec slice after the active JSC-301 PR closeout
is acknowledged.

2026-05-11 hold delta: `JSC-301`, `JSC-302`, `JSC-304`, and parent
`JSC-300` still appear in the `Harness cockpit routing` project, but Linear
reports them as archived. Treat them as archived issue records with active
closeout evidence only for PR-linked reconciliation, not as active next-slice
candidates. `JSC-303` remains under the archived legacy `coding-harness`
project and is also not an active next-slice candidate.

2026-05-12 reconciliation note: the active PR #242 branch and review flow are
implementation-closeout evidence for archived `JSC-301`, not proof that
`JSC-301` is unarchived in Linear. Keep `JSC-311` as the only active next-slice
issue in `Harness cockpit routing`, and keep
`JSC-300`/`JSC-301`/`JSC-302`/`JSC-304` classified as archived until Linear
state changes.

2026-05-15 local artifact reconcile note: PR #247 merged the first JSC-311
internal contract slice on `main` as `8ba56537 JSC-311: Harden worktree
environment baseline (#247)`. Local artifacts now distinguish the merged
internal `HeGateResult/v1` / `HePhaseExit/v1` contract from later integration
work. Live Linear was not refreshed by this local artifact pass, so tracker
status remains a separate reconcile action.

2026-05-11 closure delta: `JSC-282`, `JSC-283`, `JSC-288`, `JSC-289`,
and `JSC-290` now report `Done` in Linear. This resolves the previous stale
closure blocker for those slices. `JSC-178` and `JSC-198` still report
`In Progress` under archived legacy `coding-harness`, so they remain legacy
closure or portfolio-flow context rather than the next fresh spec candidate.

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
approval and were rechecked on 2026-05-09 through the Linear issue-label list.
The repo project label set remains intentionally smaller, but the required team
issue labels exist and are applied to the relevant parent issues.

| Issue | Title | Status | Priority | Classification | Reason |
| --- | --- | --- | --- | --- | --- |
| JSC-300 | `HE lifecycle routing integration for coding-harness cockpit` | Triage, archived | High | archived_parent_context | Parent issue for the route-integration family. Keep as context for `JSC-311`; do not spec directly while archived. |
| JSC-301 | `RouteDecision/v1 contract and cockpit compatibility mapping` | Triage, archived | High | active_pr_closeout | Implementation is represented by draft PR #242 in this repo. Treat as archived Linear context with active PR closeout/review evidence, not a new spec target. |
| JSC-302 | `Advisory lifecycle route adapter for harness next` | Triage, archived | High | hold_archived | Archived Linear state makes this unavailable as the next slice. Re-admit only with explicit human decision after JSC-301/JSC-311 evidence. |
| JSC-303 | `Executable resume and automation loop eval fixtures` | Triage, archived | Medium | hold_archived | Legacy `coding-harness` project issue. Keep as future routing/eval context, not current next-slice queue. |
| JSC-304 | `Decide expert exposure for harness route --json` | Triage, archived | Low | hold_decision | Optional expert exposure remains a later decision gate; do not spec before internal evidence gates exist. |
| JSC-282 | `[coding-harness] Reconcile command truth for PR-loop cockpit` | Done, archived | High | closed | Previous stale Linear state is resolved. Keep as historical cockpit evidence only. |
| JSC-283 | `[coding-harness] Prove packaged skill behavior for cockpit commands` | Done, archived | High | closed | Previous stale Linear state is resolved. Keep as historical skill-behavior evidence only. |
| JSC-288 | `[coding-harness] Resolve memory and governance truth ownership` | Done, archived | High | closed | Previous stale Linear state is resolved. Keep as governance precedent. |
| JSC-289 | `[coding-harness] Characterize and split CI migration lifecycle boundaries` | Done, archived | High | closed | Previous stale Linear state is resolved. Keep as CI boundary precedent. |
| JSC-290 | `[coding-harness] Mirror validation gate graph in typed specs` | Done, archived | High | closed | Previous stale Linear state is resolved. Keep as validation-gate precedent. |
| JSC-248 | `Implement agent-native cockpit control loop first slice` | Not refreshed in this gate | High | unresolved | Not part of the live route project issue set checked in this pass; do not use as the next spec target without a fresh direct Linear read. |
| JSC-178 | `Modularize contract validation and command registry to reduce core-file risk` | In Progress, archived | High | legacy_closure_context | Still active-looking but archived under legacy `coding-harness`. Keep as closure/evidence repair context, not a fresh spec candidate. |
| JSC-198 | `Flow Ops: Instrument Linear-GitHub-CircleCI lifecycle telemetry and gates` | In Progress, archived | High | legacy_flow_context | Still active-looking but archived under legacy `coding-harness`. Demote from immediate next spec because the stale closure blocker was mostly resolved and live route work now points to `JSC-311`. |
| JSC-199 | `Sync GitHub PR lifecycle metadata back to Linear issues` | Done | High | supporting_issue_done | This support issue is now completed in Linear. Keep it as historical evidence and pattern input for the JSC-198 slice, not as active implementation scope. |
| JSC-200 | `Sync CircleCI pipeline outcomes into Linear flow metrics` | Done | High | supporting_issue_done | This support issue is now completed in Linear. Use its outcomes as closure-evidence inputs under the JSC-198 slice. |
| JSC-201 | `Enforce intake and done gates for HE workflow` | Done | High | supporting_issue_done | This support issue is now completed in Linear. Use its gates as constraints while scoping the narrow JSC-198 closure-evidence slice. |
| JSC-202 | `Add telemetry confidence score for flow reliability` | Done | High | supporting_issue_done | This support issue is now completed and should be treated as prior telemetry groundwork, not new slice scope. |
| JSC-203 | `Build flow reconciliation dashboard and drift alerts` | Done | High | supporting_issue_done | This support issue is now completed. Preserve as evidence context while keeping the next slice narrowly focused on deterministic closure reconciliation. |
| JSC-311 | `[coding-harness] Add HE phase-exit evidence gates for skill-backed commit readiness` | In Progress; local internal contract merged | High | next_integration_candidate | PR #247 merged the internal `HeGateResult/v1` / `HePhaseExit/v1` contract and worktree baseline. The next local slice is integration evidence visibility/adapters, not replaying the first spec/plan/work implementation. Live Linear still needs an explicit refresh before tracker closure claims. |

## Approved Next Slice Queue

| Order | Slice | Linear Issue | Route | Depends On | Notes |
| --- | --- | --- | --- | --- | --- |
| 0 | JSC-301 PR closeout guard | JSC-301 / PR #242 | Review/merge hygiene only; no new spec | Draft PR #242 checks and review state | Keep the active branch honest. Do not widen JSC-301 beyond the RouteDecision/v1 contract and governance sync already in PR. |
| 1 | Phase-exit evidence visibility and adapter follow-up | JSC-311 live | he-spec -> he-plan -> he-work | PR #247 internal contract and worktree baseline merged | Recommended next local slice. Expose phase-exit evidence where operators see it and adapt live review/validation outputs into `HeGateResult/v1`; do not replay the completed internal contract slice. |
| 2 | Advisory lifecycle route adapter | JSC-302 archived | hold; requires explicit re-admission | JSC-311 proves phase-exit evidence can be represented without prompt-memory claims | Do not spec now. Archived state and route-adapter behavior risk make this a later slice. |
| 3 | Executable resume/automation loop eval fixtures | JSC-303 archived | hold; requires explicit re-admission | JSC-311 evidence gates and route-adapter decision | Keep as later eval/control-loop context. |
| 4 | Flow Ops closure-evidence reconciliation | JSC-198 archived legacy context | later; no current spec | Fresh direct read plus human decision to reactivate archived legacy project work | Demoted because prior stale closure blockers are mostly closed and live active route work points to JSC-311. |

## Target Linear Destination

| Work type | Destination | Parent initiative | Reason |
| --- | --- | --- | --- |
| Lifecycle routing and HE cockpit refactors | `Harness cockpit routing` project | `Dev Portfolio` | Current active Linear destination for JSC-300/JSC-311 lifecycle routing work. |
| Legacy repo-specific refactors | Archived `coding-harness` project | `Dev Portfolio` | Historical destination for completed or archived CLI, contract, validation, skill, docs, and harness artifacts. Re-admit only with explicit Linear reactivation. Excludes `JSC-311`. |
| JSC-311 project routing guard | `Harness cockpit routing` project only | `Dev Portfolio` | Do not route `JSC-311` to legacy `coding-harness`; legacy routing is historical-only context. |
| Cross-repo operating hygiene | `Portfolio Ops` project | `Dev Portfolio` | Only reusable portfolio cadence, labels, or project hygiene belongs here. |
| New initiative | Do not create | `Dev Portfolio` already exists | The existing initiative cleanly represents the work. |

## Existing Project Match

| Repo | Matching project | Status recommendation | Reactivate? | Active set limit |
| --- | --- | --- | --- | --- |
| `coding-harness` lifecycle routing | `Harness cockpit routing` | Active for JSC-311 only | Already active | 1 parent issue, 2-4 sub-issues total |
| Legacy `coding-harness` queue | `coding-harness` | Archived; closure context only | No, unless explicitly reactivated | 0 active issues now |
| Portfolio-level process | `Portfolio Ops` | Backlog unless recurring hygiene is approved | No immediate reactivation required | 0 active issues now |

## Proposed Milestones

| Milestone | Target project | Status | Scope | Success criteria | Validation gates | Expected issue count | Explicitly out of scope |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Agent Cockpit Compression Slice | `coding-harness` | Linear cleanup | Reconcile command truth and prove packaged skill command behavior for the cockpit path. | README/help/registry/dispatch/skill references agree for the chosen cockpit set; skill fixture matrix exists. | Lint, typecheck, tests, drift-gate, skill validation, routing determinism eval. | 2 parent, 4-6 sub | Broad command cleanup, all legacy command dispatch, UI work, new plugins. |
| Governance Trust Repair Slice | `coding-harness` | Linear cleanup | Resolve memory ownership, governance surface ownership, and contract bounded-context design. | Placeholder memory is removed/reclassified/replaced; governance surfaces have owner/enforcement status; contract split plan is approved. | Docs lint, policy/docs gates, memory health, contract validation, governance drift eval. | 1-2 parent, 3-5 sub | Full contract migration until ownership is settled. |
| CI Migration Boundary Recovery Slice | `coding-harness` | Closure cleanup | Characterize CI migration behavior and extract first lifecycle boundaries. | Characterization baseline exists; reporting/proof-pack extraction lands without behavior drift. | Test, typecheck, CI migration characterization, architecture drift eval, rollback proof. | 1 parent, 3-4 sub | Provider rewrite, broad CI redesign, break-glass changes beyond characterized paths. |
| Validation Typed Gate Specs Slice | `coding-harness` | Linear closure only; milestone absent in live Linear | Mirror shell-heavy validation into typed gate specs behind stable entrypoints. | Gate graph snapshot and typed mirror exist; shell launcher remains stable; PR #232 is merged and green. | Build, test, typecheck, verify-work, gate-spec eval, rollback checks, PR-template gate. | 1 parent, 2-4 sub | Replacing `verify-work.sh` outright, changing external command contract. |
| Contract Validation Modularization Slice | `coding-harness` | Closure/follow-up only | Modularize contract validation and command-registry-adjacent boundaries now that typed gate metadata exists. | Bounded slice already landed; remaining work is PR #234 evidence closure unless review finds a real product defect. | PR-template gate, review state, eval artifact acceptance, Linear closure. | No new issues by default | Broad CLI rewrite, command catalog redesign, provider policy migration. |
| Flow Ops closure-evidence reconciliation slice | `coding-harness` | Next spec candidate | Prove a narrow, deterministic reconciliation loop for PR merge state, eval artifact presence, CircleCI state, and Linear done/intake metadata. | Completed slices stop leaking into the next planning cycle; missing evidence is surfaced before merge or closure. | Linear refresh, GitHub PR state, CircleCI check state, eval artifact presence, markdownlint for planning artifacts. | 1 parent, 2-3 sub | Broad telemetry platform, weekly reporting, custom field rollout, portfolio-level process redesign. |
| HE phase-exit evidence gates slice | `Harness cockpit routing` | Active next-slice lane after JSC-301 PR closeout evidence | Model skill-backed gate evidence and phase-exit recommendations for commit readiness. | Required gates can distinguish direct skill evidence, proxy review evidence, not-applicable cases, and blockers before commit. | Focused TypeScript tests, gate fixture matrix, codestyle fast, he-code-review evidence. | 1 parent, 3-4 sub | Public CLI exposure, arbitrary skill prompt execution from TypeScript, external tracker mutation, replacing route decisions. |

## Proposed Parent Issues

| Object type | Name/title | Target project | Parent initiative | Milestone | Priority | Labels | Execution route | Blocks | Blocked by | Source artifacts | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parent issue | `[coding-harness] Reconcile command truth for PR-loop cockpit` | `coding-harness` | `Dev Portfolio` | Agent Cockpit Compression Slice | 2 High | Developer Experience, Reliability, Architecture, Routing, Drift-Risk | Agent-assisted, human-review required | Skill behavior fixtures, cockpit enforcement | None | ADR-001, ADR-002, routing invariants, command refactor | Command truth drift directly increases agent ambiguity. |
| Parent issue | `[coding-harness] Prove packaged skill behavior for cockpit commands` | `coding-harness` | `Dev Portfolio` | Agent Cockpit Compression Slice | 2 High | Developer Experience, Agent-Native, Eval, Reliability | Agent-assisted, human-review required | Release gate integration for packaged skill | Command cockpit set identified | ADR-007, skill refactor | Skill validity must mean downstream usability, not string freshness. |
| Parent issue | `[coding-harness] Resolve memory and governance truth ownership` | `coding-harness` | `Dev Portfolio` | Governance Trust Repair Slice | 2 High | Governance, Reliability, Context, Drift-Risk | Agent-assisted, human-review required | Contract bounded-context migration | Command cockpit warnings triaged enough to avoid overlapping drift | ADR-003, ADR-004, ADR-007, governance refactor | Required governance and memory surfaces must not be symbolic. |
| Parent issue | `[coding-harness] Characterize and split CI migration lifecycle boundaries` | `coding-harness` | `Dev Portfolio` | CI Migration Boundary Recovery Slice | 2 High | Reliability, Architecture, Refactor, Migration | Agent-assisted, human-review required | Provider adapter and policy extraction | Characterization baseline | ADR-006, CI refactor | `ci-migrate-core.ts` is the highest-risk oversized orchestrator. |
| Parent issue | `[coding-harness] Mirror validation gate graph in typed specs` (`JSC-290`) | `coding-harness` | `Dev Portfolio` | Not attached; Linear closure only | 2 High | Reliability, Agent-Native, CE: Spec, Refactor, Drift-Risk, architecture | Agent-assisted, human-review required | Contract validation modularization | PR #232 merge and eval acceptance evidence | ADR-006, execution invariants, validation refactor, `.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md` | Validation must become inspectable without breaking stable wrappers. |
| Parent issue | `[coding-harness] Reconcile Flow Ops closure evidence` (`JSC-198` child recommended) | `coding-harness` | `Dev Portfolio` | Flow Ops closure-evidence reconciliation slice | 2 High | Reliability, Automation, Drift-Risk, Agent-Native | Agent-assisted, human-review required | Next architecture slice | PR #234 unblock and stale Linear closure queue acknowledged | JSC-198, JSC-199, JSC-200, JSC-201, execution invariants, governance invariants | Closure evidence must become deterministic before more architecture slices stack up. |
| Parent issue | `[coding-harness] Add HE phase-exit evidence gates for skill-backed commit readiness` (`JSC-311`) | `Harness cockpit routing` | `Dev Portfolio` | HE phase-exit evidence gates slice | 2 High | Reliability, Agent-Native, Eval, Routing, Drift-Risk | Agent-assisted, human-review required | Commit-readiness gates and heartbeat stop rules | JSC-301 RouteDecision/v1 contract closeout | `$simplify`, `$he-code-review`, `$he-fix-bugs`, `$autofix`, `@testing-reviewer`, JSC-301 spec and plan | Skills must become checkable gate evidence, not ceremonial closeout wording. |

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
| `[coding-harness] Mirror validation gate graph in typed specs` | `[coding-harness] Snapshot verify-work gate graph and artifact expectations` | 2 High | Agent-assisted | No | full validate-codestyle, docs lint | Stop if snapshot cannot explain current shell behavior. |
| `[coding-harness] Mirror validation gate graph in typed specs` | `[coding-harness] Add typed spec mirror behind stable verify-work entrypoint` | 2 High | Agent-assisted | No | Typecheck, tests, full validate-codestyle | Roll back if wrapper compatibility changes. |
| `[coding-harness] Reconcile Flow Ops closure evidence` | `[coding-harness] Inventory closure evidence sources and stale-state failure modes` | 2 High | Agent-safe | No | Linear/GitHub/CircleCI refresh evidence, markdownlint | Stop if current live states cannot be classified without manual inference. |
| `[coding-harness] Reconcile Flow Ops closure evidence` | `[coding-harness] Define deterministic closure queue and eval artifact checks` | 2 High | Agent-assisted | Yes after inventory | Focused fixture or command proof, docs lint, Linear delta replay | Roll back if the slice creates process-only docs without executable or checkable closure evidence. |
| `[coding-harness] Add HE phase-exit evidence gates for skill-backed commit readiness` | `[coding-harness] Define HeGateResult/v1 and gate execution-mode taxonomy` | 2 High | Agent-assisted | No | Typecheck, focused gate-contract tests, markdownlint | Stop if gate evidence cannot distinguish direct skill use from proxy review or manual validation. |
| `[coding-harness] Add HE phase-exit evidence gates for skill-backed commit readiness` | `[coding-harness] Add fixtures for simplify, testing-reviewer, he-fix-bugs, he-code-review, and autofix gates` | 2 High | Agent-assisted | Yes after taxonomy | Focused fixture tests, codestyle fast | Roll back if fixtures treat route labels as proof that a gate ran. |
| `[coding-harness] Add HE phase-exit evidence gates for skill-backed commit readiness` | `[coding-harness] Add HePhaseExit/v1 aggregator for continue, stop, and commit-blocked decisions` | 2 High | Agent-assisted | No | Aggregator tests, focused route-decision regression tests | Stop if commit can be allowed while a required gate configured for this phase is fail, blocked, or not_run. |

## JSC-301 Future Work: Skill-Backed HE Gates

The JSC-301 RouteDecision/v1 work exposed a separate control-plane gap:
lifecycle routing can say which HE stage applies, but it cannot prove that a
required closeout gate actually ran. The future work should make those gates
typed and testable before they are used as commit or heartbeat stop rules.

Recommended Linear issue:

| Field | Value |
| --- | --- |
| Issue | `JSC-311` |
| Title | `[coding-harness] Add HE phase-exit evidence gates for skill-backed commit readiness` |
| Parent | `JSC-300` |
| Project | `Harness cockpit routing` |
| Priority | High |
| Labels | Reliability, Agent-Native, Eval, Routing, Drift-Risk |
| Status | In Progress |

Scope:

- Define `HeGateResult/v1` for one gate's evidence, status, execution mode,
  source refs, findings, actions, skipped items, validation, and blockers.
- Define `HePhaseExit/v1` for aggregating required gates into continue, stop,
  human-review, or commit-blocked decisions.
- Model the first gate set from `$simplify`, `@testing-reviewer`,
  `$he-fix-bugs`, `$he-code-review`, and `$autofix`.
- Keep `testing-reviewer` as test-adequacy evidence only.
- Keep `$he-fix-bugs` conditional on concrete failing evidence; use
  `not_applicable` when there is no bug evidence.
- Keep `$autofix` tied to review-feedback inventory and accounting, not generic
  cleanup.

Out of scope:

- Public CLI exposure in the first slice.
- Executing arbitrary skill prompt bodies from TypeScript.
- Inferring that a skill ran from prose that merely resembles a skill output.
- Mutating git, Linear, GitHub, CodeRabbit, or CircleCI.
- Replacing `RouteDecision/v1` or `HarnessDecision/v1`.

Acceptance:

- Gate fixtures distinguish `direct_skill`, `subagent_proxy`, `manual_review`,
  `validation_only`, `not_applicable`, and `not_run`.
- `simplify` requires reuse, quality, and efficiency review accounting.
- `testing-reviewer` cannot satisfy `$he-fix-bugs`.
- `he-fix-bugs` blocks when failing evidence exists without reproduction and
  repair proof.
- `he-code-review` requires findings-first evidence, traceability, validation,
  and `safe_to_continue`.
- `autofix` blocks when review feedback exists but inventory/accounting is
  missing.
- Phase exit refuses commit when any required configured gate is `fail`,
  `blocked`, or `not_run`.
- Tests prove `RouteDecision/v1` route labels are not treated as gate-run
  evidence.

## Now / Next / Later / Do Not Create

| Bucket | Work | Destination | Rationale |
| --- | --- | --- | --- |
| Now | JSC-311 phase-exit control-plane reconcile and worktree bootstrap follow-up | `Harness cockpit routing` | The internal contract and worktree baseline landed in PR #247; local artifacts now need to route future work to integration/adapters instead of replaying the completed internal slice. |
| Next | Phase-exit evidence visibility and adapter slice | `Harness cockpit routing` | Spec the smallest follow-up that exposes phase-exit evidence where operators see it and maps real review/validation outputs into `HeGateResult/v1`. |
| Later | Flow Ops closure-evidence reconciliation slice | `coding-harness` | Still useful if stale issue/PR/eval closure repeats, but it is not the immediate route while JSC-311 integration remains the active cockpit lane. |
| Later | Contract Validation follow-up | `coding-harness` | Only useful if PR #234 or human review reveals an actual contract-validation behavior defect. Do not reopen JSC-178 for architecture expansion. |
| Later | Portfolio-level reactivation checklist | `Portfolio Ops` | Useful only if the pattern repeats across repo projects. |
| Do Not Create | Another Validation Typed Gate Specs spec | None | JSC-290 already has a spec, plan, implementation, eval, commit, push, and merged PR #232. Remaining work is Linear closure, not a new spec. |
| Do Not Create | Another Contract Validation Modularization spec | None | JSC-178 already has a spec, plan, implementation, eval report, compound review, and follow-up eval PR. Remaining work is PR/Linear closure unless a real blocker appears. |
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
| Agent Cockpit Compression Slice | As affected | Focused CLI and skill tests | Required | Required | Not primary | `.harness/evals/coding-harness-command-cockpit-truth-reconciliation-eval.md`; `.harness/evals/coding-harness-jsc-283-packaged-skill-behavior-assurance-eval.md` | Required | Required | Required | Required | Required for demotions |
| Governance Trust Repair Slice | As affected | Contract/memory tests | Required | Required | Governance-sensitive | `.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md` | Required | Secondary | Required | Secondary | Required for memory changes |
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
.harness/evals/coding-harness-jsc-283-packaged-skill-behavior-assurance-eval.md.

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
--fast, .harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md.

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
