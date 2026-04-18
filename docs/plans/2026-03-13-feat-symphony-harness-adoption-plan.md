---
date: 2026-04-13
title: Symphony Harness Adoption Plan (CircleCI-Aware, Deep-Module Aligned)
status: active
owners:
  - coding-harness-maintainers
last_validated: 2026-04-18
---

# Symphony Harness Adoption Plan

## Table of Contents
- [Purpose](#purpose)
- [Inputs Reviewed](#inputs-reviewed)
- [Plan Boundaries](#plan-boundaries)
- [Target Operating Model](#target-operating-model)
- [User Outcome](#user-outcome)
- [Adoption Tiers](#adoption-tiers)
- [Solo-Agent Execution Model](#solo-agent-execution-model)
- [Regressions and Guardrails Loop](#regressions-and-guardrails-loop)
- [Intentional Compaction Workflow](#intentional-compaction-workflow)
- [Anti-Bloat Doctrine](#anti-bloat-doctrine)
- [Architecture Rules (Deep Modules + Grey Box)](#architecture-rules-deep-modules--grey-box)
- [Operator Rules (AI-Contributed Development)](#operator-rules-ai-contributed-development)
- [Behavior-Change Delivery Doctrine](#behavior-change-delivery-doctrine)
- [Architecture Contracts](#architecture-contracts)
- [Implementation Slices](#implementation-slices)
- [Gate Contract Table](#gate-contract-table)
- [Operator Metric Thresholds and Response Rules](#operator-metric-thresholds-and-response-rules)
- [Decision Rights and Operator View](#decision-rights-and-operator-view)
- [Workflow Contract Requirements](#workflow-contract-requirements)
- [CircleCI Migration Gates](#circleci-migration-gates)
- [Validation and Evidence](#validation-and-evidence)
- [Risks and Mitigations](#risks-and-mitigations)
- [Exit Criteria](#exit-criteria)

## Purpose
Adopt Symphony patterns in `coding-harness` without importing prototype fragility. Keep `coding-harness` as the policy control plane, keep runners external, and harden execution through deterministic workflow contracts and CI-provider-aware gates.

## Inputs Reviewed
- `docs/brainstorms/2026-03-04-symphony-harness-adoption-brainstorm.md`
- `docs/specs/workflow-contract-v1.md`
- `docs/agents/review-gate-workflow-contract.md`
- User-provided design guidance: "How To Make Codebases AI Agents Love" (deep modules, grey-box boundaries, progressive disclosure, faster feedback loops).
- User-provided operator guidance: "9 Ways AI Coding Has Rewired My Brain" (integration-test-first, productive friction, doc-rot skepticism, meta-programmed operator workflows).
- User-provided delivery guidance: "My Skill Makes Claude Code GREAT At TDD" and "Tracer Bullets: Keeping AI Slop Under Control" (vertical slices, RED -> GREEN honesty, public-interface tests, tracer-bullet-first cross-layer delivery).

## Plan Boundaries
- `coding-harness` remains the control plane (contracts, policy, validation, evidence).
- Symphony-style orchestration is treated as external-runner behavior, not in-repo coupling.
- No merge to required workflow states unless CI-provider posture is explicitly validated.
- Human review remains mandatory at merge boundary in pilot phases.

## Target Operating Model
1. Deterministic workflow contracts (`S|E|G|A|N`) define behavior.
2. Harness policy gates enforce review/CI/docs/security contracts.
3. Tracker status changes are adapter-driven (Linear aliases), not hardcoded labels.
4. Evidence is machine-readable and replayable (logs + transition traces + dry-run).
5. Pilot first, then scale by measured reliability.
6. One primary coding agent owns each task end-to-end; sub-agents are internal workers, not peer operators.
7. Clean runs should end in one of three operator states only:
   - green-and-ready
   - blocked-with-remediation
   - escalated-for-decision
8. Jamie should not need to manually coordinate specialist agents to close routine work.

## User Outcome
Jamie should become a better AI orchestrator through three concrete improvements:
- Better delegation: workflows expose clear boundaries so Jamie decides at the module and policy level, not at implementation-detail level.
- Better supervision: every agent run emits enough evidence for Jamie to detect drift, weak reasoning, and policy bypass quickly.
- Better throughput without losing control: routine coordination moves into repeatable harness workflows while irreversible decisions stay explicitly gated.

## Adoption Tiers
`coding-harness` should be installed into other repositories by tier, not as one fixed governance bundle.

| Tier | Default Use | Included Capabilities | Excluded by Default | Promotion Trigger |
| --- | --- | --- | --- | --- |
| `lite` | small or low-risk repos, early adoption | minimal `AGENTS.md` router, workflow prompts, local validation hooks, plan/work/review contract, `Decision Packet` | provider adapters, change-control dashboards, heavy audit artifacts | repeated drift, repeated regressions, or growing CI/review overhead |
| `standard` | active repos with recurring AI implementation work | `lite` plus review gate, evidence envelope, tracker normalization, CI-provider adapter, compact scorecards | full regulated controls and heavyweight audit workflows | policy exceptions, regulated delivery needs, or sustained multi-step rollout risk |
| `regulated` | higher-risk repos with strict traceability needs | `standard` plus richer change-control evidence, stricter approval routing, expanded audit artifacts | none | only when explicit risk posture justifies the extra operator cost |

Tier rules:
- default new repos to `lite`
- justify promotion with observed pain, not theory
- do not promote a repo unless the added tier removes manual glue work or recurring risk

## Solo-Agent Execution Model
The default execution model is one supervisor agent per task, with optional bounded sub-agents used internally.

Supervisor loop:
1. understand task and governing artifact
2. verify or produce the plan
3. execute the smallest tracer bullet
4. run local checks and review gates
5. open or update the PR
6. recover failing CI or review findings
7. stop only at `green-and-ready`, `blocked-with-remediation`, or `escalated-for-decision`

Rules:
- `main_agent_owns_task: true`
- `subagents_internal_only: true`
- `definition_of_done: merged or green-and-ready with blockers explicitly classified`
- Jamie should intervene only for scope change, policy exception, risky merge, or unresolved product ambiguity

## Regressions and Guardrails Loop
Repeated failures must become persistent guardrails instead of one-off chat corrections.

Promotion rules:
- any repeated failure mode observed twice in the same repo within 30 days must produce one of:
  - a `regressions.md` entry with the one-line rule
  - a workflow-contract check
  - a fixture or regression test
  - a prompt or routing update
- if a failure can be checked mechanically, prefer a checker or test over prose
- every promoted guardrail must link back to the triggering failure pattern or evidence artifact

Guardrail priorities:
1. executable check or fixture
2. plan/workflow contract rule
3. concise operator note in `regressions.md`

## Intentional Compaction Workflow
When the active run enters the "dumb zone", the harness should compact and reset instead of piling on more context.

Compaction triggers:
- repeated blocked loops without state change for the same run key
- the same tool called repeatedly with identical arguments and no new evidence
- apology spirals or instruction loss
- runaway raw logs or traces that crowd out the current task

Compaction action:
1. emit a compact `Decision Packet`
2. summarize:
   - current verified state
   - failed approaches
   - remaining open decisions
   - next best bounded step
3. start a fresh context or bounded retry path
4. record the compaction event in run evidence

Compaction rule:
- do not keep escalating context volume when the correct move is to reset with a sharper artifact

## Anti-Bloat Doctrine
This plan must optimize for decision speed, not governance volume.

Core rule:
- No new policy, doc, artifact, or dashboard ships unless it reduces ambiguity, shortens time-to-decision, or removes manual glue work.

Enforcement rules:
- Every new policy must map to one enforcement point:
  - command or checker
  - fail condition
  - emitted artifact
  - owner
- Every new artifact must name:
  - default consumer
  - decision unlocked
  - whether it is primary output or appendix only
- Every new section added to this plan or successor docs must map to:
  - a contract requirement
  - an implementation slice
  - a metric
  - or it should be removed

Compression rules:
- One default run artifact only: `Decision Packet`
- Detailed traces, compatibility reports, and diagnostics are linked appendices for blocked, failed, or explicitly requested runs
- Default operator view must fit on one screen without reading raw logs

Stop-growth rules:
- No new artifact type may be added unless:
  - an existing artifact is consolidated or removed
  - or the new artifact replaces a manual glue step
- If governance/reporting surface grows while `decision_time_ms`, manual intervention rate, or false-block rate do not improve, freeze new policy features

Pruning rules:
- Review artifact list, policy surface, and duplicate docs every 30 days
- Remove stale, unconsumed, or duplicative outputs by default

## Architecture Rules (Deep Modules + Grey Box)
### Rule A: Deep module boundaries are mandatory
- Each workflow capability exposes a small public interface and hides orchestration internals.
- Public interface surface must be documented at folder boundary (`README` or contract file).

### Rule B: Grey-box ownership split
- Human owns interface + tests + acceptance criteria.
- Agent owns implementation internals inside module boundary.
- Refactors may change internals freely if interface and tests remain stable.

### Rule C: Progressive disclosure
- Top-level docs route to contracts and module entry points first.
- Large procedural docs should avoid mixing policy, runtime details, and migration notes in one file.
- Canonical workflow artifact paths must be stable and discoverable from a single index.

### Rule D: Feedback-loop compression
- Every implementation slice must include local deterministic checks runnable in one command.
- No slice is complete without gate outputs that can be consumed by automation.

## Operator Rules (AI-Contributed Development)
### Rule E: Integration-test-first for agent lanes
- Feature work starts with integration or end-to-end tests for user stories.
- For git-sensitive flows, use local temporary git environments so verification stays local and deterministic.

### Rule F: Productive friction is required
- Pre-commit hooks, type checks, and CI checks are mandatory for every AI-generated change path.
- Missing friction (for example bypassed checks) is treated as policy failure, not convenience.

### Rule G: UI prototyping before implementation
- For non-trivial UI changes, require multiple throwaway prototype variants before final implementation.
- Only promote a UI direction into production code after explicit selection.

### Rule H: Meta-program workflows over manual toil
- Encode recurring operator tasks (triage, backlog pruning, task routing) into repeatable harness workflows.
- Treat workflow automation as first-class scope, not side work.

### Rule I: Doc-rot control
- Operational docs must be validated against executable contracts.
- Exploration notes are ephemeral unless promoted with proof links to tests/checks.
- Missing or moved canonical workflow files are treated as drift and must fail parity checks.

### Rule J: Cognitive-load management
- Prefer a small set of deep modules with stable interfaces over many shallow modules.
- Enforce module boundary tests so internal changes do not require global mental context.

## Behavior-Change Delivery Doctrine
### Rule K: Behavior-changing work defaults to TDD
- Every behavior-changing task defaults to `tdd-required` unless an explicit reviewed exemption is recorded.
- Exemptions must include `exemption_reason` and `reviewed_by`; silent exemption is policy failure.

### Rule L: Tracer bullet before parity
- New cross-layer work must prove one tiny end-to-end slice before broader rollout across adjacent layers or surfaces.
- A tracer bullet must exercise the critical path through real public interfaces, not mock-only seams.

### Rule M: Honest tests over implementation-detail tests
- Tests should verify observable behavior through public interfaces.
- Mock-heavy tests, private-method tests, and tests that only verify collaborator call counts do not satisfy policy by default.

### Rule N: Validation strategy must match change class
- `docs-only`, formatting-only, and non-behavioral config changes should use deterministic validation rather than ceremonial TDD.
- Cross-layer or risky changes must include at least one integration or boundary test in addition to any unit-level work.

### Rule O: Planning owns the delivery contract
- Plan artifacts must declare:
  - `change_class`
  - `test_mode`
  - `test_tier`
  - `tracer_bullet_first`
  - `red_evidence_required`
- Work may not begin on behavior-changing items until these fields are present and specific enough to validate.

## Architecture Contracts
Required deep modules for this plan:

| Module | Public Interface | Forbidden Dependencies | Boundary Tests | Owner |
| --- | --- | --- | --- | --- |
| `workflow-contract-checker` | validate workflow docs/contracts and emit pass/fail artifacts | direct tracker or CI API calls | contract fixtures, determinism checks | `coding-harness-maintainers` |
| `policy-compiler` | compile contract + provider policy + migration mode into resolved guards/checks | UI/report rendering | policy fixture suite, explainability snapshots | `coding-harness-maintainers` |
| `ci-provider-adapter` | resolve provider-specific check identities and capabilities | tracker writes, scorecard decisions | adapter conformance tests | `coding-harness-maintainers` |
| `tracker-status-normalizer` | map tracker-native states into canonical workflow states | CI provider internals | normalization fixtures | `coding-harness-maintainers` |
| `run-record-store` | persist run state, idempotency keys, retries, resume metadata, replay index | direct UI composition | replay/resume tests | `coding-harness-maintainers` |
| `review-gate` | evaluate merge-review readiness against canonical policy | direct workflow mutation outside policy contract | review gate fixtures, replay tests | `coding-harness-maintainers` |
| `evidence-store` | write decision packet and linked appendices | policy compilation | evidence schema tests | `coding-harness-maintainers` |

Boundary guardrails:
- `coding-harness` does not own external job execution orchestration.
- Provider adapters may observe external systems but not redefine workflow semantics.
- Scorecards and dashboards may read from `run-record-store` and `evidence-store` only.

## Implementation Slices
### Slice 0: Repo Qualification + Tier Selection
- Before adopting `coding-harness`, qualify the target repo:
  - tests exist or a test harness can be added
  - entrypoints and validation commands are discoverable
  - repo has enough recurring agent work to justify harness overhead
  - CI and tracker posture are known
- Assign one tier only:
  - `lite`
  - `standard`
  - `regulated`
- Output:
  - repo qualification checklist
  - chosen tier
  - explicit reason the tier improves operator throughput

### Slice 1 (highest value, immediate): Preset + Workflow-Contract Checker
- Build a contract checker that validates:
  - deterministic `(S,E)` guard resolution
  - terminal/non-terminal transition rules
  - required error taxonomy
  - mode declarations (`STRICT`, `ADVISORY`)
  - dry-run and log-field requirements
  - validation-contract declarations for behavior-changing workflows
  - exemption metadata for any non-TDD behavior-changing workflow
  - canonical source path exists for each promoted workflow artifact
- Add a canonical artifact registry file:
  - `docs/workflow-artifact-registry.json`
  - fields: `id`, `path`, `owner`, `status`, `last_validated_at`, `deprecation_policy`
- Deliver preset templates for compact operational specs.
- Output: machine-readable pass/fail report per workflow file.

### Slice 2: CI-Provider Policy Adapter (CircleCI-aware)
- Introduce `ciProviderPolicy` contract fields:
  - provider identity
  - required check manifest
  - timeout and escalation behavior
  - migration stage compatibility
- Keep provider-neutral contract core; adapter maps provider specifics.
- Support explicit migration modes:
  - `dual-provider`
  - `circleci-primary`
  - `circleci-only`
- Each mode must define required checks plus fail-open/fail-closed behavior.

### Slice 3: Workflow State Normalization
- Add `status_aliases` map for tracker states.
- Prevent hard dependency on custom Linear labels by translating to canonical states.
- Ensure review gate references canonical states only.

### Slice 4: Gate Bundle Consolidation
- Single envelope for pre-handoff checks:
  - environment
  - policy
  - docs
  - tests
  - review gate
- Envelope must be idempotent and replay-safe.

### Slice 4a: Operator Feedback Dashboard
- Produce a compact scorecard per workflow run:
  - state reached
  - blockers raised
  - tests executed
  - policy gates passed/failed
  - `decision_time_ms`
  - `confidence`
  - `recommended_action`
  - `blocking_reason`
  - remediation suggestion
- Optimize for Jamie deciding "continue, intervene, or stop" in under one minute.
- Dashboard rollout depends on:
  - `run-record-store` schema v1 frozen
  - decision matrix defined
  - evidence envelope contract frozen

### Slice 5: Agent-Native Test Harness Upgrades
- Add integration-test templates and local git-fixture utilities for workflow and CLI verification.
- Add compact validation wrappers so passing runs stay short and failures preserve exact assertion-bearing output.
- Require each workflow module to publish:
  - boundary test command
  - smoke test command
  - expected artifact outputs
  - RED/GREEN evidence format for `tdd-required` paths

### Slice 6: Scale-out Pilot
- Run one constrained project lane.
- Track success/failure with transition-level observability.
- Expand only after exit criteria are met for two consecutive windows.
- Two consecutive windows means two 14-day windows with no stop criteria triggered.

## Gate Contract Table
| Gate ID | Owner | Data Source | Threshold | Evaluation Window | Pass Condition | Block Condition | Escalation Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ci_migration_ready` | `coding-harness-maintainers` | transition plan + provider policy artifacts | active mode defined and required checks versioned | current release window | migration Next Gate marked complete and checker passes | provider mismatch or unversioned checks | block promotion and open remediation item |
| `pilot_stability` | `coding-harness-maintainers` | run records + scorecards | pass rate `>= 95%` | 14 days | pass rate met and policy bypass `= 0` | pass rate below threshold or policy bypass `> 0` | freeze rollout |
| `behavior_change_honesty` | `coding-harness-maintainers` | plan/work evidence + scorecards | `100%` of behavior-changing pilot items declare validation contract and required RED evidence | 14 days | all pilot behavior-changing items include contract fields and evidence | any pilot item missing fields or required RED evidence | block promotion and require plan/workflow remediation |
| `operator_speed` | `coding-harness-maintainers` | scorecards | `p50 decision_time_ms <= 60000` | 14 days | median within threshold | exceeded for 2 consecutive windows | demote dashboard to advisory and review evidence surface |
| `false_block_control` | `coding-harness-maintainers` | blocked payloads + review outcomes | false-block rate `<= 5%` | 14 days | below threshold | exceeds threshold | require policy-compiler remediation |
| `solo_operator_efficiency` | `coding-harness-maintainers` | scorecards + PR run records | manual intervention rate `<= 20%` for non-risky pilot tasks | 14 days | routine tasks complete without ad hoc Jamie glue work | operator handholding exceeds threshold | simplify workflow surface before adding features |
| `pr_green_closure` | `coding-harness-maintainers` | PR records + CI outcomes | `>= 90%` of non-blocked pilot PRs reach green or explicit blocked state without orphaned follow-up | 14 days | threshold met | threshold missed | prioritize CI recovery and closure workflow remediation |
| `guardrail_capture` | `coding-harness-maintainers` | regression log + checker/test updates | `100%` of repeated failures promoted to a guardrail within 2 business days | 30 days | all repeated failures promoted on time | any repeated failure remains chat-only | block tier promotion and require regression hygiene fix |
| `compaction_health` | `coding-harness-maintainers` | run records + compaction events | repeated blocked loops resolved within one compaction cycle | 14 days | compaction resets unblock or escalate runs cleanly | same run loops through repeated failures after compaction | simplify context surface and reduce tool load |
| `review_capacity` | `coding-harness-maintainers` | review queue metrics | queue latency within agreed SLO | 14 days | no backlog breach | sustained breach | force human-confirm throttling |

## Operator Metric Thresholds and Response Rules
Use these thresholds to decide whether the harness is helping Jamie or creating ceremony.

| Metric | Healthy Threshold | Warning Sign | Required Response |
| --- | --- | --- | --- |
| `decision_time_ms` | `p50 <= 60000` | above threshold for 2 windows | compress operator surface and remove non-essential artifacts |
| `manual_intervention_rate` | `<= 20%` on non-risky work | Jamie repeatedly stitches runs together manually | simplify workflow, demote tier, or remove gates causing glue work |
| `false_block_rate` | `<= 5%` | clean work is being blocked too often | patch policy compiler or adapter before adding more enforcement |
| `pr_green_closure_rate` | `>= 90%` on non-blocked PRs | PRs stall in half-done or ownerless states | tighten CI recovery loop and closure workflow |
| `repeat_failure_recurrence` | downward trend over 30 days | same failures keep recurring | promote failures into guardrails, tests, or contract rules |
| `compaction_event_rate` | stable or declining | frequent compaction with no quality gain | reduce tool surface and shrink default context |

Response rules:
- if two or more warning signs appear in the same 14-day window, freeze new harness features for that tier
- if a repo stays above warning thresholds for 30 days, demote it one tier unless there is a documented exception
- do not add new artifacts or gates while a repo is failing operator-speed or manual-intervention thresholds

## Decision Rights and Operator View
Decision rights:

| Category | Meaning | Examples |
| --- | --- | --- |
| `auto` | system may proceed without Jamie intervention | dry-run generation, fixture validation, non-blocked evidence appendices |
| `human-confirm` | system recommends an action and waits for Jamie confirmation | policy changes, rollout promotion, provider mode changes |
| `human-only` | system must not act without Jamie deciding directly | merge boundary exceptions, irreversible actions, bypass approvals |

Operator view contract:
- One default artifact per run: `Decision Packet`.
- Packet fields:
  - `state`
  - `recommended_action`
  - `confidence`
  - `decision_time_ms`
  - `blocking_reason`
  - `next_action`
  - `owner`
  - `retry_condition`
  - `escalation_target`
- Detailed traces, compatibility reports, and test artifacts are linked appendices, not default reading for clean runs.

Decision matrix requirements:
- `state x blocker_severity x confidence -> recommended_action`
- deterministic precedence rules
- escalation timeout path for unresolved blocked states

## Workflow Contract Requirements
- Transition table is canonical source of truth.
- Mermaid diagram must be derived strictly from table rows.
- All failures route to explicit `FAIL` or `BLOCKED` terminal outcomes.
- Idempotency keys required for stateful side effects.
- Dry-run required and must emit deterministic trace rows.
- Behavior-changing workflows must declare `change_class`, `test_mode`, `test_tier`, `tracer_bullet_first`, and `red_evidence_required`.
- `tdd-required` workflows must emit RED/GREEN evidence through public interfaces, not implementation-detail probes.
- Cross-layer work marked `tracer_bullet_first: yes` must prove one end-to-end slice before parity expansion.
- Non-behavioral workflows must still declare deterministic validation strategy rather than using fake TDD labels.

## CircleCI Migration Gates
- Do not promote to broader enforcement unless migration plan "Next Gate" is complete.
- Required check names must be manifest-backed and versioned.
- Required-check manifests must include:
  - `requiredOnEvents` with both `pull_request` and `merge_group`
  - `freshnessWindowDays` as an integer in `[1,7]`
  - non-empty `sourceAppId`
  - valid regex `externalIdPattern`
- `ciProviderPolicy.transitionStatusArtifactPath` is mandatory and must point to a valid transition-status artifact.
- `ci-migrate verify` is the strict preflight gate before promotion-sensitive actions.
- Contract checker must fail on stale provider assumptions.
- Any provider-policy mismatch routes workflow to blocked state with remediation payload.
- Transition-status artifact requirements:
  - path default: `.harness/ci-provider-transition-status.json`
  - schema: `ci-provider-transition-status/v1`
  - required fields: `schemaVersion`, `nextGateComplete`, `updatedAt`
  - `updatedAt` must be valid ISO timestamp
  - for migration stages other than `circleci-only`, `nextGateComplete` must be `true`

## Validation and Evidence
Required validation for plan/document updates in this lane:
- `pnpm markdownlint docs/plans/2026-03-13-feat-symphony-harness-adoption-plan.md`
- `pnpm markdownlint docs/specs/workflow-contract-v1.md docs/agents/review-gate-workflow-contract.md`
- behavior validation must also exist per implemented slice:
  - contract-checker fixture tests
  - adapter conformance tests
  - replay suite with deterministic traces
  - strict migration preflight checks via `pnpm test -- src/commands/ci-migrate.test.ts`
  - strict migration preflight wiring in type-safe builds (`pnpm typecheck`)

Evidence artifacts:
- contract-checker report (pass/fail + reasons)
- dry-run transition traces
- CI-provider policy compatibility report
- required-check manifest with strict metadata:
  - `.harness/ci-required-checks.json`
- transition-status artifact:
  - `.harness/ci-provider-transition-status.json`
- tracked starter templates:
  - `docs/examples/ci-migrate/ci-required-checks.template.json`
  - `docs/examples/ci-migrate/ci-provider-transition-status.template.json`
- integration test run reports for agent lanes
- RED/GREEN cycle evidence for `tdd-required` pilot work
- tracer-bullet proof artifact for cross-layer pilot work
- doc-to-contract parity checks (stale-doc detection)
- operator scorecards for pilot workflow runs
- repo qualification checklist + assigned adoption tier
- compaction event records for reset/restart decisions
- guardrail promotion log linking repeated failures to fixes or checks

## Risks and Mitigations
- Risk: Overfitting to one orchestration implementation.
  - Mitigation: keep adapter boundary; avoid runner internals in core contracts.
- Risk: CI migration drift breaks gate assumptions.
  - Mitigation: versioned check manifest + provider policy contract.
- Risk: Interface sprawl causes agent confusion.
  - Mitigation: deep-module limits + small interface surface + progressive disclosure.
- Risk: Slow feedback loops increase rework.
  - Mitigation: mandatory single-command local validation per slice.
- Risk: Doc rot misleads agents toward stale behavior.
  - Mitigation: contract parity checks and ephemeral exploration notes by default.
- Risk: Cognitive overload from shallow module sprawl.
  - Mitigation: deep-module boundary policy with interface-level test requirements.
- Risk: Jamie still becomes the human glue between tools.
  - Mitigation: scorecards, gate envelopes, and stable workflow modules must reduce decision load rather than add reporting overhead.
- Risk: the harness assumes a many-agent operating model and increases coordination overhead.
  - Mitigation: one-supervisor-agent default with internal sub-agents only when they reduce risk or cycle time.
- Risk: queue pressure makes human review mandatory in theory but unusable in practice.
  - Mitigation: review-capacity gate plus human-confirm throttling during overload.
- Risk: AI-generated work claims TDD without honest failing-test evidence.
  - Mitigation: required validation contract fields plus RED/GREEN evidence checks and public-interface testing expectations.
- Risk: agents outrun the critical path and create speculative layers.
  - Mitigation: tracer-bullet-first rule for cross-layer work plus compact fail-fast validation wrappers.
- Risk: repeated failures stay trapped in chat memory instead of improving the system.
  - Mitigation: regressions-to-guardrails loop with promotion deadlines and executable-first preference.
- Risk: context bloat causes instruction loss and repeated loops.
  - Mitigation: intentional compaction workflow with explicit reset triggers and evidence.

## Exit Criteria
- Preset + contract checker adopted for all active workflow specs.
- each adopted repo has an explicit tier assignment with a documented reason.
- CircleCI migration policy fields are validated in contract checks.
- `ci-migrate verify` passes in strict mode with manifest metadata and transition-status artifacts present.
- Pilot lane runs with deterministic traces and no unresolved policy ambiguity.
- Review gate remains reproducible under `STRICT` and `ADVISORY` modes.
- No required workflow depends on non-canonical tracker labels.
- Integration tests cover primary user stories for pilot workflow modules.
- All behavior-changing pilot items declare validation contract fields and meet required RED/GREEN evidence expectations.
- Cross-layer pilot items prove one tracer bullet before parity expansion.
- Doc-to-contract parity checks pass for all promoted operational docs.
- Pilot scorecards show Jamie can decide next action from evidence without reading raw logs in normal cases.
- `p50 decision_time_ms <= 60000` over two consecutive 14-day windows.
- `policy_bypass_incidents = 0` during pilot windows.
- false-block rate stays at or below `5%`.
- manual intervention rate stays at or below `20%` for non-risky pilot work.
- `>= 90%` of non-blocked pilot PRs reach green or explicit blocked state without orphaned follow-up.
- repeated failures are promoted into guardrails within 2 business days during pilot windows.

Stop criteria:
- `>= 1` policy bypass in a 14-day window
- `p50 decision_time_ms > 60000` for two consecutive windows
- false-block rate `> 5%`
- repeated blocked loops without state change for the same run key
- manual intervention rate `> 20%` for two consecutive windows on non-risky work
- repeated failures remain chat-only after the promotion deadline
- strict `ci-migrate verify` fails due stale/missing transition status or malformed required-check metadata
