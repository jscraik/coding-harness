# 2026-05-19 Evidence-Led Codebase Gap Audit

## Table of Contents

- [0. Snapshot And Refresh Status](#0-snapshot-and-refresh-status)
- [1. Executive Summary](#1-executive-summary)
- [2. Overall Gradecard](#2-overall-gradecard)
- [3. Evidence-to-Code Mapping](#3-evidence-to-code-mapping)
- [4. Post-Deep-Module Agent-Native Backlog](#4-post-deep-module-agent-native-backlog)
- [5. Gap Register](#5-gap-register)
- [6. Contradictions](#6-contradictions)
- [7. Missing Features](#7-missing-features)
- [8. Fix Roadmap](#8-fix-roadmap)
- [9. Highest-Leverage Fixes](#9-highest-leverage-fixes)
- [10. Implementation Advice](#10-implementation-advice)
- [11. Final Recommendation](#11-final-recommendation)
- [12. Agent-Native Execution Bindings](#12-agent-native-execution-bindings)

## 0. Snapshot And Refresh Status

Original evidence snapshot: 2026-05-19.

Refresh pass: 2026-05-20T09:10:50Z against git head 4367dfcb.

Reviewer loop:

- agent-native-reviewer: no-green until the audit includes an executable
  capability parity map and per-gap authoritative owner/enforcement bindings.
- architecture-strategist: no-green until the audit marks stale findings with
  snapshot status and prevents already-landed gaps from being re-opened as new
  implementation work.
- adversarial-reviewer: requested, but the role did not return a usable mailbox
  result twice during this pass. The self-adversarial refresh below was grounded
  in live repo evidence and the completed reviewer findings.

Refresh policy for this audit:

- Treat this file as an execution roadmap only after checking each gap's
  Refresh Status.
- open means implementation work remains.
- partially landed means the original gap is narrowed, and the remaining work
  is listed in the refreshed gap text.
- landed after snapshot means no new implementation should be started from the
  original recommendation unless a fresh validation run proves regression.
- historical evidence means the row explains why a fix existed, not what to
  build next.
- blocked pending refresh means the next action is a fresh verifier pass, not
  implementation from the original recommendation.

Execution-state enum for future automation:

| Display status | Machine status | Implementation rule |
|---|---|---|
| Open | open | Implement from the refreshed recommendation. |
| Partially landed | partially_landed | Implement only the remaining work named in the refreshed row. |
| Landed after snapshot | landed_after_snapshot | Add or keep regression proof; do not rebuild the original fix. |
| Historical evidence | historical_evidence | Preserve rationale only. |
| Open pending fresh verifier pass | blocked_pending_refresh | Verify current behavior first, then either close or implement. |
| Open roadmap | open_roadmap | Schedule after the deep-module boundary work unless a current blocker depends on it. |
| Open follow-on | open_follow_on | Treat as architecture-quality follow-on, not closeout-critical work. |

Live refresh evidence that changed gap status:

- package.json now wires both research:evidence:validate and architecture:check
  into pnpm check.
- src/lib/pr-closeout/evidence.ts now accepts Refs, Closes, and Fixes Linear
  references.
- src/lib/cli/command-registry.ts now supports bounded commands --for-agent
  modes: orient, verify, review, and handoff.
- src/commands/next.test.ts now includes required_evidence_missing fixtures for
  pr and ci mode without runtime evidence.
- src/lib/runtime/runtime-evidence-producer.ts still synthesizes a phaseExit
  object with gates: [] and phaseExitSourceCompleteness: "summary_only" when
  adapting runtime-card phase-exit state. GAP-008 remains open.

Refresh status summary:

| Gap | Refresh Status | Current Execution Meaning |
|---|---|---|
| GAP-001 | Partially landed | pr and ci modes now block without evidence; verify closeout mode, artifact auto-loading, and stale evidence behavior before closing. |
| GAP-002 | Open | Missing phase-exit still needs mode-aware blocker semantics in runtime-card/runtime-evidence. |
| GAP-003 | Partially landed | The evidence-pattern manifest and validator exist and run in pnpm check; remaining work is promotion lifecycle quality, owners, and stale-reference enforcement. |
| GAP-004 | Landed after snapshot | architecture:check is wired into pnpm check; keep only baseline ownership/freshness hardening if still needed. |
| GAP-005 | Partially landed | Agent catalog modes exist; remaining work is proving mode contents and first-contact execution coverage. |
| GAP-006 | Landed after snapshot | Refs, Closes, and Fixes are accepted; keep regression fixtures/current proof only. |
| GAP-007 | Open pending fresh verifier pass | Metadata-gap versus external-wait routing still needs direct verification before implementation or closure. |
| GAP-008 | Open | Summary-only phase-exit projection still risks laundering runtime-card state into gate evidence. |
| GAP-009 | Open | Attempt-ledger and recovery-event contracts remain fragmented. |
| GAP-010 | Open | Safety coverage still needs one surfaced local/CI coverage map. |
| GAP-011 through GAP-022 | Open roadmap | These are post-deep-module agent-native context authority work. |
| GAP-023 | Open follow-on | Effect migration remains scaffolded, not a closure prerequisite for agent-operability unless tied to a specific parity gap. |

## 1. Executive Summary

Overall maturity grade: **B- / C+**.

The repository is already a real agent control plane, not a documentation-only experiment. It has executable command routing, machine-readable CLI metadata, runtime-card contracts, phase-exit ingestion, PR closeout claim ledgers, CircleCI governance jobs, Project Brain surfaces, skill validation, evidence-pattern validation, architecture invariant checks, and source-level invariant checks. The best parts of the codebase already match the evidence documents: repository as control plane, deterministic validators, current-state packets, typed closeout claims, and CI-owned governance.

The main weakness is now freshness-scoped enforcement depth rather than total absence. Several truth mechanisms exist, and some originally identified gaps have landed after the first evidence snapshot. The remaining risk is that runtime-card/runtime-evidence can still represent missing or summary-only proof too softly, some research promotion and architecture mechanisms need owner/freshness lifecycle rules, and the roadmap needs explicit agent-operability bindings so an implemented fix is discoverable and executable by agents without human translation.

Effect-TS is also not complete in the strong migration sense. The repo has
contained Effect seams and import guards, but it still needs a canonical
service/layer pattern, real end-to-end exemplars, facade plus Effect-builder
tests, and a migration guide before agents should treat Effect as an established
module pattern.

Top 5 gaps:

1. Runtime-card and runtime-evidence still need mode-aware missing-proof and summary-only evidence semantics.
2. Evidence-to-policy promotion exists but needs owner, lifecycle, stale-reference, and adoption-quality enforcement.
3. Agent-facing command discovery now has modes, but the audit still needs an action-to-command capability parity map and first-contact execution proof.
4. PR closeout still needs a fresh verifier pass for check metadata gaps versus external wait routing.
5. The audit itself needs refresh metadata, per-gap status, authoritative surface, enforcement gate, and owner bindings so it does not reopen already-landed work.

Top 5 risks:

1. Agents can get safe-looking evidence when runtime proof is summary-only, stale, or missing but not classified as a blocker.
2. Missing validation evidence can look non-blocking.
3. Good research can still repeat as prose if promotion status lacks owners, lifecycle, and stale-reference checks.
4. Stale audit rows can cause duplicate or conflicting implementation after the repo has already moved.
5. Closeout can still stall if provider metadata gaps are classified as external waits instead of adapter evidence defects.

Strongest foundations:

- harness next --json is reachable and produced a structured decision packet with nextCommand, evidenceRef, and permission metadata.
- runtime-card/v1 models lifecycle, source freshness, blockers, branch, PR, Linear, artifact, and phase-exit state.
- pr-closeout/v1 has claim evidence fields, current-head discipline, freshness, blocker classes, and missing-context routing.
- .harness/README.md defines authority levels for policy, decisions, execution inputs, secondary context, generated runtime, and scratch.
- CircleCI has broad governance coverage: pr-template, linear-gate, risk-policy-gate, docs-gate, lint, typecheck, test, audit, check, memory, drift health, and security-scan.

Reviewer coverage:

- agent-native-reviewer: usable. Found optional evidence gates and over-narrow agent command discovery.
- adversarial-reviewer: usable. Found the Refs/Closes contradiction and unknown check-SHA wait-loop risk.
- api-contract-reviewer: coverage gap. The response was narrow and stale relative to this audit; API/schema contract findings below come from direct inspection.

## 2. Overall Gradecard

| Area | Grade | Confidence | Current Status | Main Gap | Recommended Fix |
|---|---:|---|---|---|---|
| Repository as Control Plane | B+ | High | .harness authority map, active-artifacts, contract, instructions, CI manifests, specs, and plans exist. | Research and review artifacts remain secondary context without promotion status. | Add an evidence-pattern adoption manifest and validator. |
| Runtime Truth and Decision Packets | B- | High | next, runtime-card/v1, HePhaseExit/v1, and PR closeout packets exist. | Runtime-card and phase-exit are optional cockpit inputs. | Add required evidence mode and canonical artifact auto-loading. |
| Claim-vs-Evidence Verification | B- | High | PR closeout claims and a source invariant gate exist. | Some verifier rules contradict wording or over-route to external wait. | Patch classifier defects and add fixtures. |
| Mechanical Architecture Enforcement | B | Medium | Architecture docs, module-boundary tests, architecture script, and architecture:check in pnpm check exist. | Baseline ownership, refresh status, and contradiction handling still need tightening. | Keep architecture:check wired and add owner/freshness status to baselines and audits. |
| Harness Runtime Loop | C | Medium | next, workflow contracts, validation-plan, review-gate, pr-closeout form a partial loop. | Attempt budgets and recovery records are fragmented. | Add attempt-ledger/v1 and recovery-event/v1. |
| Trace and Session Evidence | C+ | Medium | replay, tracer libs, run records, session-collector integration, and PR template fields exist. | Not all primary commands emit required run records. | Standardize run-record emission across cockpit, review, and closeout. |
| Context Engineering | B- | High | .harness authority levels, instruction map, glossary, CODESTYLE, and skills exist. | No executable context budget or research freshness gate. | Add context-health budget and stale-context checks. |
| Skills and Workflow Density | B | Medium | Packaged skill validation and commands --for-agent modes exist. | Need proof that mode contents expose the right verifier/review/handoff actions without bloat. | Add agent capability parity fixtures and first-contact execution proof. |
| Recovery and Failure Handling | C+ | Medium | CI retries, preflight recovery text, missing-context classifier, and replay fixtures exist. | No single recovery contract for attempts, stop reasons, and owners. | Add recovery schema and emit it from live commands. |
| Governance and Safety | B | High | Branch protection contract, authz, Semgrep, secret scripts, PR traceability, and review independence exist. | Some safety checks are hook/manual rather than default local check. | Add safety:local and explicit coverage reporting. |
| Effect Service and Layer Migration | C | Medium | Effect dependency, docs, two approved boundaries, and import containment tests exist. | No canonical service/layer exemplar or migration guide proves strong Effect adoption. | Convert one or two real modules end-to-end with sync facade, Effect builder, layers, and boundary tests. |

## 3. Evidence-to-Code Mapping

| Evidence Pattern | Source File | Code Location | Runtime Status | Grade | Confidence |
|---|---|---|---|---:|---|
| Repository as prompt/control plane | 2026-05-19-matt-pocock-evidence.md lines 53 and 995 | .harness/README.md lines 15-28, harness.contract.json lines 9-20 | implemented_enforced | B+ | High |
| Cold research needs promotion before authority | matt-pocock lines 20-21 and 170 | .harness/README.md lines 67-71 | partial | C | High |
| Ready-for-agent state machine | matt-pocock lines 59 and 391-393 | .harness/active-artifacts.md lines 20-38 plus Linear/gate commands | partial | C+ | Medium |
| Context-window austerity and lazy tool loading | matt-pocock lines 61 and 474-491 | command catalog and skill routing | implemented_not_enforced | C+ | High |
| Deep modules behind simple interfaces | matt-pocock lines 275-286 | docs/architecture/module-boundaries.md lines 26-49 and module-boundary tests | implemented_enforced | B | Medium |
| Effect-backed deep modules | matt-pocock lines 542 and agent-rft lines 462 | docs/architecture/effect-deep-modules.md plus src/lib/architecture/module-boundaries.test.ts Effect import guard | scaffolded_contained | C | Medium |
| Runtime cards/current state packets | Ryan evidence runtime-truth pattern | src/lib/runtime/runtime-card.ts lines 151-179 | implemented_not_enforced | B- | High |
| Claim-vs-evidence closeout | Ryan/Eno verification packet pattern | src/lib/pr-closeout/claim-helpers.ts lines 101-120 and check-pr-closeout-truth-contract.cjs lines 31-61 | partial | B- | High |
| Live PR and Linear state refresh | Ryan live-state proof pattern | src/lib/runtime/local-runtime-card.ts lines 150-214 and 245-310 | partial | B- | High |
| Command recommendation gate | Ryan command-truth pattern | src/commands/next.ts lines 134-179 and runtime next output | implemented_enforced | B | High |
| Agent capability catalog | Pocock/Eno tool-density pattern | src/lib/cli/registry/command-capabilities.ts lines 365-385 and 533-547 | partial | C | High |
| Replay and trace evidence | Eno/Ryan session evidence pattern | src/commands/replay.ts lines 1-180 and src/lib/replay/tracer.ts | partial | C+ | Medium |
| Recovery attempts and retry budgets | Ryan/Eno bounded retry pattern | .circleci/config.yml lines 83-97 and run-harness-evals retry fixtures | scaffolded | C | Medium |
| Governance safety and approval | all evidence docs | harness.contract.json lines 14-20 and 178-188, PR template traceability fields | implemented_enforced | B | High |

## 4. Post-Deep-Module Agent-Native Backlog

This section captures the new follow-on work identified during the planning
conversation after the deep module work. It should not interrupt the current
deep-module/trust-boundary implementation lane. Treat it as the next
agent-native context architecture backlog once the runtime and module-boundary
work is stable.

### 4.1 Principles To Encode

These principles should become machine-readable contracts, validators, routing
rules, or closeout evidence. They should not remain standalone doctrine.

| Principle | Agent Contract | Enforcement Candidate |
|---|---|---|
| Canonicity | Classify context before trusting it. Canon can describe current behavior; intent, history, reference, and secondary context cannot prove implementation. | .harness/authority-map.json, harness authority audit --json, PR closeout rejection when not-canon is cited as implementation proof. |
| Localisation | Keep context at the narrowest owning scope. Promote upward only after repeated use proves broader value. | AGENTS authoring audit, promotion evidence requirement for root instructions, scoped instruction placement checks. |
| Verifiability | Completion claims need current verifier, command, runtime, PR/CI, or blocker evidence. | Runtime-card freshness gates, pr-closeout/v1, required evidence mode for harness next, review artifact existence checks. |
| Portability | Codex can be the reference runtime, but durable repo contracts stay harness-owned and provider adapters remain explicit. | Schema naming rules, provider namespace checks, adapter-boundary tests, no provider-specific core contract names without exception. |
| Default-no | Automatically loaded context is excluded by default and must earn inclusion by changing behavior for most work in that scope. | Always-loaded surface budget, AGENTS size and directive-density checks, default-no justification for broad instruction changes. |

Internal evals and observability are first-class enforcement loops for these
principles, not optional reporting layers. Evals prove the harness induces the
desired agent behavior in controlled scenarios. Observability proves what
actually happened in live sessions, closeout flows, validation runs, and
recovery loops.

### 4.2 Context Architecture To Add

Target architecture:

| Layer | Surface | Load Mode | Agent Purpose |
|---|---|---|---|
| 0 | Authority map | Always/routed by tooling | Decide what can be trusted as current truth. |
| 1 | Root AGENTS.md | Always | Minimal operating baseline and routing rules only. |
| 2 | Scoped AGENTS.md, CODESTYLE.md, codestyle modules | Path/task scoped | Local operational rules and engineering standards. |
| 3 | Skills | Match scoped | Cross-folder procedures and domain workflows loaded on demand. |
| 4 | Roles and reviewers | Risk/explicit scoped | Independent verification, standards, security, and design review. |
| 5 | Connectors and runtime evidence | Task scoped | GitHub, Linear, CI, browser, logs, runtime-card, and live-state proof. |
| 6 | Tests, hooks, gates, validators | Change scoped | Mechanical enforcement and completion evidence. |
| 7 | Internal evals | Scenario/regression scoped | Prove agents choose the right authority, routing, validation, and recovery behavior. |
| 8 | Observability | Always emitted for governed flows | Record live agent behavior, steering, claims, evidence, blockers, and recovery decisions. |

Minimal human-facing docs should be limited to:

- a short AGENTS.md authority-map pointer
- one route in docs/agents/01-instruction-map.md
- an optional compact docs/agents/00-authority-map.md explainer

The primary source should be machine-readable:

- .harness/authority-map.json
- scripts/check-authority-map.cjs
- eventual harness authority audit, classify, and explain JSON commands
- internal eval fixtures for authority, routing, validation, closeout, and
  repeated-steering behavior
- runtime-card, PR-closeout, session-evidence, and context-health observability
  events

### 4.3 Agent-Native Flywheel To Add

The flywheel is the compounding loop that turns real agent work into stronger
future agent behavior. It should be a repo contract, not a metaphor:

1. Capture the signal: steering feedback, failed checks, PR comments, stale
   evidence, bad routing, weak validation, or recovery friction.
2. Classify the operational failure: missing context, stale state, weak
   validation, hidden assumption, retrieval failure, poor workflow design,
   runtime ambiguity, architecture drift, lack of verification, weak
   observability, missing guardrail, unclear authority boundary, excessive
   context noise, poor task routing, or insufficient deterministic enforcement.
3. Choose the durable destination: validator, schema, runtime check, trace
   event, CLI guard, CI gate, skill route, AGENTS rule, authority-map entry,
   closeout evidence requirement, recovery handler, internal eval,
   context-health metric, implementation note, Project Brain learning, or
   tracked exception.
4. Prove the behavior changed: the guard fails the old case, the eval catches
   the scenario, the trace emits the needed event, or closeout blocks the weak
   claim.
5. Observe recurrence: live runs show whether the same steering, stale
   evidence, skipped routing, or bad claim reappeared after the guard landed.
6. Maintain canon: scanner output and metrics feed cleanup, authority-map
   updates, eval seeds, and pruning of always-loaded context.

Useful flywheel states:

| State | Meaning | Required Evidence |
|---|---|---|
| captured | A real signal was recorded. | steering-signal/v1 or equivalent trace event. |
| classified | The root operational failure was named. | failure category and affected principle. |
| encoded | A durable system surface was changed or selected. | path, command, schema, gate, eval, or tracked exception. |
| proven | The old failure is now harder to repeat. | validator, runtime check, or eval result. |
| observed | Live or replayed execution can show recurrence. | observability event, context-health metric, or run record. |
| retired | The guard can be simplified or removed. | metric window with no recurrence plus owner decision. |

This flywheel should prefer local file artifacts and harness-owned schemas
first. External eval or observability platforms can export stable datasets
later, but they should not become the source of truth.

### 4.4 New Follow-On Gaps

#### GAP-011: Authority Map Registry Is Missing

**Category:** context / authority / agent-native

**Current State:** .harness/README.md defines useful authority levels inside
the .harness subtree, and harness.contract.json has context-integrity truth
sources. There is no repo-wide machine-readable canon/not-canon registry that
agents can query before trusting context.

**Expected State:** The repo has .harness/authority-map.json with authority
classes, artifact rules, always-loaded surfaces, generated projection
provenance, and non-canon proof boundaries.

**Risk:** Agents continue to infer authority from folder names or prose and may
treat intent/history as implementation proof.

**Severity:** High

**Fix Grade:** Post-deep-module P1

**Recommended Fix:** Add .harness/authority-map.json and
scripts/check-authority-map.cjs; wire pnpm run authority:check into pnpm check
after initial warning-mode validation stabilizes.

**Acceptance Criteria:** Canon artifacts declare validation hooks; generated
projections declare generator and inputs; non-canon artifacts explicitly cannot
prove current_behavior; always-loaded surfaces are canon and have a reason.

#### GAP-012: AGENTS Authoring Contract Is Not Audited

**Category:** context / default-no / localisation

**Current State:** Root AGENTS.md carries important operational rules, but the
repo lacks a validator that distinguishes behavior-changing instructions from
descriptive filler, over-prioritized directives, duplicate scoped rules, and
scope-mismatched guidance.

**Expected State:** AGENTS files are operational control surfaces. Every line
constrains action, routes context, defines authority, or names validation.

**Risk:** Always-loaded context grows, priority flattens, and agents spend token
budget on prose that does not change behavior.

**Severity:** Medium-high

**Fix Grade:** Post-deep-module P1

**Recommended Fix:** Extend the authority validator or add harness instructions
audit --json to report descriptive filler, MUST/NEVER density, stale path
references, duplicate root/nested rules, and rules placed broader than their
owning scope.

**Acceptance Criteria:** Root and scoped AGENTS files produce structured audit
results; broad instruction changes require localisation/promotion evidence or a
tracked exception.

#### GAP-013: Canon Hygiene Cleanup Is Not Planned As A Codebase Pass

**Category:** cleanup / maintainability / agent-native examples

**Current State:** The repo has strong standards and validators, but existing
files can still teach agents old or contradictory patterns. There is no ranked
cleanup pass for the most agent-visible canonical surfaces.

**Expected State:** The repo audits and cleans high-copy-risk canon first:
instructions, codestyle, docs/agents/**, schemas, command help, validators, and
high-traffic source/tests.

**Risk:** Agents follow written standards while copying non-standard local
examples from frequently opened files.

**Severity:** Medium-high

**Fix Grade:** Post-deep-module P2

**Recommended Fix:** Add harness canon audit --json or an audit mode under
authority tooling. Classify findings as agent_fixable, agent_refactorable,
human_decision_required, defer_to_normal_work, or do_not_change.

**Acceptance Criteria:** The audit ranks findings by visibility, authority
impact, fixability, owner, and suggested validation. Cleanup starts with P0/P1
surfaces instead of broad repo rewrites.

#### GAP-014: Canon Maintenance Loop Is Missing

**Category:** maintenance / ownership / stale-state prevention

**Current State:** Canonical docs often carry validation metadata, and
governance checks exist, but canonical artifact ownership/freshness is not
uniformly checked across agent-facing context.

**Expected State:** Canonical non-code artifacts have owner, authority class,
freshness or validation command, and a review/deletion condition. Scheduled
context scans detect stale canon, broken references, duplicate rules,
contradictions, and missing provenance.

**Risk:** Canon rots quietly and agents keep trusting stale operating context.

**Severity:** Medium-high

**Fix Grade:** Post-deep-module P2

**Recommended Fix:** Add owner/freshness requirements for authority-map canon
entries and a scheduled scanner report before introducing autonomous fixer
workers.

**Acceptance Criteria:** Scanner can distinguish canon from not-canon; canon
must be internally consistent; not-canon may disagree but cannot be cited as
current truth.

#### GAP-015: Validation Expectations Are Not Agent-Native Enough

**Category:** testing / validation loop / workflow skill

**Current State:** The repo has strong validation scripts and codestyle rules,
but agents still need a compact way to ask which tests or production paths are
required for a changed file set.

**Expected State:** Agents can request test expectations as structured output:
required validation, minimum production-path proof, acceptable blockers, and
evidence fields.

**Risk:** Agents either over-run broad gates or under-prove behavior with weak
or self-affirming tests.

**Severity:** Medium

**Fix Grade:** Post-deep-module P2

**Recommended Fix:** Add or extend a command such as harness testing
expectations with file inputs and JSON output, backed by codestyle testing
rules, related-test mapping, runtime-card closeout rules, and quality
self-affirming checks.

**Acceptance Criteria:** For CLI/source/runtime changes, the command names
focused tests, production-path smoke evidence, broader gates, and blocked
validation requirements.

#### GAP-016: Outcome Metrics Need Context-Health Counters

**Category:** observability / outcome metrics / context hygiene

**Current State:** The north-star status matrix tracks PR lead time, review
retry rate, manual interventions, guardrail recurrence, and related throughput
metrics. It does not yet track authority-map and canon-hygiene health.

**Expected State:** Outcome reporting distinguishes productivity gains from
context bloat and records whether agent-native context is getting healthier.

**Risk:** Token usage or feature velocity can rise while canon quality,
authority clarity, or context-load efficiency gets worse.

**Severity:** Medium

**Fix Grade:** Post-deep-module P3

**Recommended Fix:** Add metrics such as canon_drift_findings_count,
stale_canon_count, not_canon_cited_as_truth_count,
always_loaded_context_lines, authority_unknown_count,
post_guardrail_recurrence_rate, and token_usage_per_merged_pr.

**Acceptance Criteria:** Metrics appear in status or runtime evidence without
making raw token growth a north-star success proxy. Token growth only counts as
positive when paired with lower manual intervention, lower rework, or lower PR
lead time.

#### GAP-017: Internal Agent Behavior Evals Are Missing

**Category:** internal evals / agent behavior / regression prevention

**Current State:** The repo has harness eval infrastructure and validation
gates, but the new principles are not yet represented as explicit behavioral
evals. There are no scenario fixtures that prove agents distinguish canon from
intent/history, stop after planning-only steering, choose the narrowest context
scope, or refuse weak closeout evidence. package.json exposes test:evals and
scripts/run-harness-evals.mjs writes eval and observability artifacts, but
test:evals is not part of pnpm check and the current eval contract is still
north-star delivery oriented rather than principle/flywheel oriented.

**Expected State:** The harness has internal eval scenarios for the agent-native
principles and architecture. Each high-signal correction can become a regression
case when it represents repeatable agent behavior rather than a one-off task
detail.

**Risk:** Validators can pass while agents still behave poorly in realistic
session conditions. Repeated human steering remains the first detector for
workflow failure.

**Severity:** High

**Fix Grade:** Post-deep-module P2

**Recommended Fix:** Add internal eval fixtures for authority-map use,
default-no context loading, localisation, verification claims, planning versus
implementation mode, repeated-steering admission, PR closeout evidence, skill
routing, cleanup classification, and provider portability.

**Acceptance Criteria:** Eval output includes scenario id, principle tested,
expected behavior, observed behavior, pass/fail, and the durable surface that
would need repair. At least one eval fixture is derived from a real repeated
steering event. The default local gate either runs a bounded principle eval set
or explains why the eval lane is advisory with an explicit promotion threshold.

#### GAP-018: Agent-Native Observability Is Too Weak

**Category:** observability / runtime truth / feedback loop

**Current State:** Runtime-card, replay, PR-closeout, and traceability surfaces
exist, but the repo does not yet emit a unified view of which instructions were
read, which skills were routed, which authority class was cited, which claims
lacked evidence, what blockers appeared, or which recovery path was chosen.
src/commands/observability-gate.ts validates metric-label cardinality, and
context-health reports context-integrity metrics, but neither is yet the
agent-behavior event stream needed by the flywheel.

**Expected State:** Governed agent flows emit structured observability events
that make agent behavior inspectable without reconstructing the session from
chat. The system can count repeated steering, stale evidence, skipped routing,
not-canon citations, missing validation, and recovery-loop outcomes.

**Risk:** The team cannot tell whether the harness is improving agent behavior
or merely adding more instructions. Failure patterns stay invisible until Jamie
notices and restates them.

**Severity:** High

**Fix Grade:** Post-deep-module P2

**Recommended Fix:** Add an observability contract for governed flows that
records instruction surfaces read, skill routing decisions, authority-class
citations, validation commands and outcomes, blocker classes, steering
admissions, recovery events, closeout evidence freshness, and context-load
mode.

**Acceptance Criteria:** Observability output can answer: what did the agent
trust, what did it verify, what did it skip, what failed, who owns the next
action, and whether repeated steering recurred after a guard was added.

#### GAP-019: Flywheel Contract Is Missing

**Category:** flywheel / governance / durable learning

**Current State:** Repeated steering is covered by AGENTS.md,
docs/agents/04-validation.md, scripts/check-steering-feedback-contract.cjs, and
Project Brain memory, while eval, replay, context-health, runtime-card, and
PR-closeout are separate surfaces. There is no single contract that links a
signal to classification, durable destination, proof, eval seed, observability,
metric, and retirement condition.

**Expected State:** A high-signal correction or repeated failure has a
machine-readable flywheel record. The record shows the full chain from signal
to guardrail to proof to recurrence observation, or names a tracked exception.

**Risk:** The repo accumulates docs, guards, evals, and traces without proving
that any one correction made the same future steering unnecessary.

**Severity:** High

**Fix Grade:** Post-deep-module P1

**Recommended Fix:** Add steering-signal/v1 or flywheel-record/v1 plus a
focused command such as harness flywheel status --json. The command should
summarize open signals, durable fixes, missing evals, missing observability,
proof commands, recurrence counters, and retirement candidates.

**Acceptance Criteria:** Every admitted repeated-steering or high-signal
correction is in one of these states: validator_added, runtime_check_added,
eval_added, observability_added, authority_map_updated, skill_routing_updated,
workflow_rule_updated, memory_learning_added, tracked_exception_created, or
explicitly_rejected_with_reason.

#### GAP-020: Evals Do Not Yet Feed The Flywheel

**Category:** internal evals / replay / promotion

**Current State:** scripts/run-harness-evals.mjs supports local scenarios,
live fixtures, result output, and Braintrust-shaped observability output.
src/lib/learnings/eval-seed.ts can turn repeated review learning into eval seed
candidates. The audit does not yet require eval creation from flywheel signals
or require eval failures to route back into authority, validation, skills, or
runtime contracts.

**Expected State:** Evals are both regression checks and intake sources. A
failed eval creates or updates a flywheel record; a resolved flywheel record
names the eval that prevents recurrence.

**Risk:** Evals become a side benchmark lane rather than the behavior-regression
backbone for agent-native reliability.

**Severity:** Medium-high

**Fix Grade:** Post-deep-module P2

**Recommended Fix:** Add eval-to-flywheel linkage fields: sourceSignalId,
principle, expectedBehavior, observedBehavior, durableDestination,
recurrenceMetric, and promotionStatus. Keep local replay fixtures as the
default before exporting stable datasets to external eval tools.

**Acceptance Criteria:** New principle evals can be traced to either a real
signal, a known risk in this audit, or an explicit speculative-risk owner.
Failing principle evals cannot be ignored silently; they must create a blocker,
tracked exception, or backlog item.

#### GAP-021: Observability Can Leak Or Bloat Without An Agent Event Contract

**Category:** observability / privacy / default-no

**Current State:** Observability-gate checks metric label cardinality, and
replay traces sanitize some environment data. The future agent-behavior event
stream is not yet schema-bounded for secrets, prompt/raw-transcript exclusion,
cardinality, retention, or stable labels.

**Expected State:** agent-observability-event/v1 allows only bounded fields:
event type, authority class, route decision, validation outcome, blocker class,
recovery owner, evidence refs, redaction status, and correlation ids. It must
exclude raw prompts, secrets, bulky telemetry, and unbounded user content by
default.

**Risk:** Observability becomes either too weak to explain behavior or too noisy
and sensitive to keep enabled.

**Severity:** High

**Fix Grade:** Post-deep-module P1

**Recommended Fix:** Extend observability-gate from label checks to event-shape
checks. Add redaction assertions for steering, skill routing, authority
citations, validation output, and recovery events before any broader
observability rollout.

**Acceptance Criteria:** Event validation rejects raw transcript fields,
secret-like values, unbounded labels, missing redaction status, and authority
citations without evidence refs.

#### GAP-022: Authority Map Rollout Can Fail Open

**Category:** authority / rollout / guardrail hardening

**Current State:** The audit recommends warning-mode authority validation before
promoting deterministic checks into pnpm check. It does not yet define the
promotion threshold, expiry, exception model, or fail-closed behavior for
unclassified high-risk artifacts.

**Expected State:** Authority-map rollout has a bounded shadow period. Unknown
authority is allowed only for low-risk cold context during shadow mode; hot-path
instructions, validators, schemas, generated projections, runtime evidence, and
closeout artifacts fail closed when unclassified after the promotion date.

**Risk:** Warning mode becomes permanent and agents continue to infer authority
from folder names or prose.

**Severity:** High

**Fix Grade:** Post-deep-module P1

**Recommended Fix:** Add rollout state fields to authority-map/v1:
mode, shadowStartedAt, requiredAfter, unknownPolicyByGlob, exceptionOwner,
exceptionExpiresAt, and promotionValidation. Tie hot-path unknowns to
context-health and PR closeout blockers.

**Acceptance Criteria:** The authority check reports unknown artifacts by risk
tier, fails hot-path unknowns after the required date, and requires owner plus
expiry for exceptions.

#### GAP-023: Effect-TS Migration Is Scaffolded, Not Complete

**Category:** architecture / Effect-TS / deep modules

**Current State:** The repo has the Effect dependency, an Effect boundary doc,
and module-boundary tests that constrain Effect imports to approved files.
Current production Effect imports are limited to
src/lib/missing-context/classifier.ts and src/lib/pr-closeout/evaluator.ts,
with synchronous facades preserved for callers. This is useful containment, but
it is not a strong Effect conversion.

**Expected State:** Effect has a canonical service/layer pattern with one or
two real modules converted end-to-end as exemplars. Callers keep plain
synchronous or Promise-based facades while the module internals use Effect
builders, services, layers, typed failures, and test providers where they reduce
complexity.

**Risk:** The codebase can overclaim Effect migration from two shallow seams, or
future agents can scatter Effect imports through command, UI, and app-wiring
code without a proven module pattern.

**Severity:** Medium-high

**Fix Grade:** Post-deep-module P1

**Recommended Fix:** Document and enforce a canonical Effect service/layer
pattern; convert one or two high-value modules end-to-end; add sync facade plus
Effect builder tests; add module-boundary tests for allowed Effect imports; and
write a migration guide for future modules.

**Acceptance Criteria:** At least one exemplar module has public sync facade,
Effect builder, service interface, live/test layers, typed failure contract, and
boundary tests proving the facade and Effect path return the same
caller-visible behavior. Effect imports remain restricted to approved boundary,
runtime, provider, or test files.

### 4.5 Sequencing After Deep Module Work

1. Add authority registry and validator in warning mode.
2. Add compact AGENTS and instruction-map routing only; avoid long human docs.
3. Add AGENTS authoring audit and default-no budget checks.
4. Run canon hygiene audit against P0/P1 surfaces.
5. Add flywheel-record or steering-signal schema and status command.
6. Add observability event schema with redaction, retention, cardinality, and
   evidence-ref rules.
7. Add internal eval fixtures for authority, localisation, default-no,
   verification, planning-mode, repeated-steering, and closeout behavior.
8. Wire eval failures and repeated steering into flywheel records.
9. Add scheduled context scanner report.
10. Add validation-expectations command or skill-backed structured output.
11. Add context-health metrics to status/runtime evidence.
12. Add observability events for governed agent flows and wire them into
    runtime-card, PR closeout, replay, and context-health summaries.
13. Promote deterministic authority checks into pnpm check after shadow-mode
    thresholds are met.

### 4.6 Failure-Point Hardening Pass

The deep pass found that the largest risk is not absence of concepts. The repo
already has evals, context-health, replay, run records, observability-gate, and
steering guard surfaces. The failure point is fragmentation: a future
implementation could satisfy each surface locally while the behavior loop still
does not compound.

| Failure Point | How It Fails | Hardening Requirement |
|---|---|---|
| Static guard without behavior proof | docs:steering:guard can ensure wording exists while agents still mishandle the scenario. | Pair each high-signal steering rule with at least one internal eval or tracked reason why behavior eval is infeasible. |
| Eval lane isolated from default work | test:evals exists but is not in pnpm check. | Define a bounded principle-eval subset for default or pre-closeout use, with promotion criteria for the full eval suite. |
| Observability means labels, not behavior | observability-gate checks cardinality but not agent decisions. | Add agent-observability-event/v1 and validate event shape, redaction, authority refs, and blocker classification. |
| Context-health misses authority semantics | context-health reports authoritative coverage but not canon/not-canon misuse. | Add authority_unknown_count, not_canon_cited_as_truth_count, and always_loaded_context_lines once authority-map exists. |
| Warning-mode authority check never promotes | Authority rollout can stay advisory forever. | Require shadow start, required-after date, hot-path fail-closed globs, and owner-expiring exceptions. |
| Flywheel has no retirement rule | Guards accumulate after the failure is no longer active. | Each flywheel record needs owner, recurrence window, and retire/simplify condition. |
| Signal capture leaks raw content | Steering and trace events can accidentally preserve prompts, secrets, or bulky transcripts. | Store classifications, hashes, short quotes only when necessary, redaction status, and evidence refs instead of raw session text. |
| Durable destination is too weak | A correction lands only as prose or memory. | Closeout must name why the chosen destination is strong enough, or track the missing validator/eval/runtime-check follow-up. |
| Provider portability drifts | Codex-specific events become the only durable contract. | Schema names and event contracts stay harness-owned; Codex fields live under provider-specific adapters. |
| Metrics reward activity | Token usage and eval count rise while manual steering stays high. | Outcome metrics must pair usage with manual intervention, recurrence, rework, stale evidence, and PR lead time. |

### 4.7 Non-Goals

- Do not classify all docs/ as canon. Authority is per artifact or governed
  glob, not per broad directory.
- Do not make docs human-only. This repo intentionally uses agent-operational
  docs, but they must be classified and routed.
- Do not rewrite 20-30 percent of the repo by principle alone. Let the audit
  rank cleanup by agent visibility and fixability.
- Do not treat raw token usage as success unless throughput and review quality
  improve with it.
- Do not add a dashboard or external eval platform before local artifacts feed
  replay, closeout, and context-health.
- Do not store raw prompts, secrets, or bulky transcripts as flywheel evidence.

## 5. Gap Register

### GAP-001: Cockpit Evidence Is Optional

**Category:** runtime / verification

**Refresh Status (2026-05-20):** Partially landed. Current tests now block pr
and ci modes without phase-exit and runtime-card evidence. Remaining work is to
verify closeout-mode behavior, stale evidence handling, and canonical artifact
auto-loading before treating the original P0 as closed.

**Current State:** HarnessNextOptions defines phaseExit and runtimeCard as optional. Blocking logic only runs when those values are supplied. A local run of node --import tsx src/cli.ts next --json recommended validation-plan with evidence refs git:status and command-catalog only.

**Expected State:** PR, CI, and closeout modes should fail closed when current runtime-card and phase-exit evidence are missing or stale.

**Evidence Basis:** Runtime truth packets and ready-for-agent gates require current state before action.

**Code Evidence:** src/commands/next.ts lines 42-58 and 159-179; src/commands/next.test.ts has explicit artifact tests but not required-artifact mode.

**Risk:** False-success recommendations; agents continue despite missing CI, PR, Linear, or closeout proof.

**Severity:** Critical

**Fix Grade:** P0

**Recommended Fix:** Add --evidence required|optional or mode-specific enforcement. In --mode pr and --mode ci, auto-load canonical runtime-card and phase-exit artifacts or emit failureClass required_evidence_missing.

**Suggested Software / Method:** TypeScript validator, Vitest fixtures, jq CLI smoke tests.

**Files Likely To Change:** src/commands/next.ts, src/commands/next.test.ts, src/commands/next-decisions.ts, docs for harness next.

**Validation Command:** pnpm vitest run src/commands/next.test.ts && node --import tsx src/cli.ts next --json --mode pr | jq '.status,.failureClass'

**Acceptance Criteria:** PR mode without required evidence blocks; explicit valid evidence passes; stale or invalid evidence blocks; local exploratory mode is explicit.

### GAP-002: Runtime Card Allows phaseExit.not_run Without a Blocker

**Category:** runtime / traceability

**Current State:** node --import tsx src/cli.ts runtime-card --json --repo . returned phaseExit.status not_run and blockers empty.

**Expected State:** Missing required phase-exit should be a structured blocker for closeout, PR, CI, or autonomy-sensitive modes.

**Evidence Basis:** Claim-vs-evidence verification and runtime card patterns require missing proof to be machine-actionable.

**Code Evidence:** src/lib/runtime/runtime-card.ts lines 61-67 permits not_run; lines 240-244 only treat selected lifecycle values as blocking; runtime-evidence-producer.ts lines 47-68 omits phase-exit when not_run.

**Risk:** Missing validation proof appears non-blocking to harness next --runtime-card.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:** Add runtime-card context local|pr|ci|closeout and mark phaseExit.not_run as a blocker outside local mode. Include a phase_exit source with freshness missing and failureClass phase_exit_missing.

**Suggested Software / Method:** Runtime-card schema extension, Vitest fixtures, CLI smoke test.

**Files Likely To Change:** src/lib/runtime/local-runtime-card.ts, src/lib/runtime/runtime-card.ts, src/lib/runtime/runtime-evidence-producer.ts, src/commands/runtime-card.test.ts.

**Validation Command:** pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts

**Acceptance Criteria:** Closeout/PR runtime cards block on missing phase-exit; local cards are explicitly advisory; runtime-evidence-bundle preserves missing phase-exit state.

### GAP-003: Research Patterns Have No Adoption Ledger

**Category:** context / governance / validation

**Refresh Status (2026-05-20):** Partially landed. The repo now has
.harness/research/evidence-patterns.json, scripts/validate-evidence-patterns.cjs,
and research:evidence:validate in pnpm check. Remaining work is lifecycle
quality: owners, stale-reference checks, adopted/deferred/rejected completeness,
and promotion proof strength.

**Original Snapshot State:** Evidence files said they were cold research, not
instruction surfaces. .harness/README.md correctly said secondary context could
not drive implementation unless admitted, but there was no
adopted/deferred/rejected manifest.

**Current Implementation State:** The manifest and validator now exist and run
in pnpm check. The remaining gap is lifecycle quality: ownership,
stale-reference detection, disposition completeness, and proof that adopted
patterns reached an authoritative surface.

**Expected State:** High-value evidence patterns should have lifecycle status, target surface, owner, and validation command.

**Evidence Basis:** Pocock's repo-as-prompt, thin documentation, and durable memory patterns; Ryan/Eno runtime control-plane patterns.

**Code Evidence:** .harness/README.md lines 67-71 at the original snapshot;
package.json now runs research:evidence:validate in pnpm check; the remaining
evidence requirement is owner and stale-reference enforcement.

**Risk:** Useful patterns remain inert and are rediscovered repeatedly.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:** Keep the manifest and validator wired, then harden them
with owner, stale-reference, adoption-quality, and proof-strength fields. Track
source refs, status, target surface, validation, and explicit
rejection/defer reason.

**Suggested Software / Method:** JSON Schema or Node shape validator, jq, markdown line-reference checker.

**Files Likely To Change:** .harness/research/evidence-patterns.json,
scripts/validate-evidence-patterns.cjs, docs, and tests or fixtures for stale
references and owner/disposition completeness.

**Validation Command:** node scripts/validate-evidence-patterns.cjs --json and
pnpm check

**Acceptance Criteria:** Every current deep evidence file has tracked pattern disposition; adopted patterns point to code, tests, docs, or an explicit issue; missing refs fail.

### GAP-004: Architecture Rule Script Is Not a Default Gate

**Category:** architecture / validation

**Refresh Status (2026-05-20):** Landed after the original snapshot.
architecture:check is now wired into pnpm check. Do not reopen this gap as a new
implementation slice unless a fresh validation run proves the default gate no
longer executes it. Remaining hardening belongs to baseline owner/freshness
metadata, not initial gate wiring.

**Original Snapshot State:** scripts/check-architecture-rules.cjs checked
cycles, command cross-imports, auth crypto usage, GitHub lib filesystem
separation, and diagram freshness. package.json check did not call it directly.
CircleCI had many jobs but no explicit architecture rule job.

**Current Implementation State:** architecture:check is now wired into pnpm
check. The remaining work is regression proof plus baseline owner, reason, and
freshness metadata.

**Expected State:** Architecture drift should keep failing in the default
validation path, and any baseline exception should have an owner, reason,
created or reviewed date, and expiry or refresh condition.

**Evidence Basis:** Deep-module and navigable-file-system evidence treats structure as agent infrastructure.

**Code Evidence:** scripts/check-architecture-rules.cjs lines 10-16 and
357-384; package.json now wires architecture:check through pnpm check; the
remaining evidence requirement is baseline ownership/freshness proof.

**Risk:** Architecture can drift through stale baseline exceptions or future
gate removal if the landed default check is not protected by regression proof.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:** Keep architecture:check in pnpm check, add regression
proof that the default gate still invokes it, and require owner/reason/date for
baseline entries. Add or adjust CI only if the existing check job stops running
pnpm check.

**Suggested Software / Method:** Existing Node script first; dependency-cruiser, madge, or ts-morph only if local script becomes insufficient.

**Files Likely To Change:** scripts/check-architecture-rules.cjs,
.architecture-baseline.txt or its replacement registry, package.json only for
regression fixture updates, and CI config only if pnpm check is not already run.

**Validation Command:** pnpm run architecture:check && pnpm check

**Acceptance Criteria:** Existing repo passes; command cross-import fixtures fail; baselined issues are visible and owned.

### GAP-005: Agent-Facing Command Discovery Is Too Narrow

**Category:** skills / context / agent-native

**Refresh Status (2026-05-20):** Partially landed. commands --for-agent now
supports bounded orient, verify, review, and handoff modes. Remaining work is to
prove that those modes expose the right native verifier/review/handoff commands
without bloat and that first-contact agents can execute the path end to end.

**Current State:** commands --json --for-agent returns one command: next. The full catalog has 70 commands and includes runtime-card, pr-closeout, review-gate, validation-plan, evidence-verify, and replay.

**Expected State:** Agents need a compact but useful first-contact rail with phase-specific verifier and handoff commands.

**Evidence Basis:** Tool-density and context austerity: expose the right tools without flooding context.

**Code Evidence:** src/lib/cli/registry/command-capabilities.ts lines 365-385 and 533-547; runtime output from commands --json --for-agent.

**Risk:** Agents miss native validators and invent ad hoc shell flows.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:** Add --for-agent modes: orient, verify, review, handoff. Keep next as default; expose validation-plan, runtime-card, evidence-verify, review-gate, and pr-closeout in bounded modes.

**Suggested Software / Method:** CLI catalog schema v3 additive fields and Vitest assertions.

**Files Likely To Change:** src/lib/cli/registry/command-capabilities.ts, src/lib/cli/command-registry.ts, src/cli.test.ts.

**Validation Command:** node --import tsx src/cli.ts commands --json --for-agent --mode verify | jq '.commands[].name'

**Acceptance Criteria:** Agent catalog remains compact; verifier and handoff commands are discoverable; tests prevent accidental catalog bloat.

### GAP-006: PR Body Contract Rejects Closes Despite Saying Refs/Closes

**Category:** verification / governance

**Refresh Status (2026-05-20):** Landed after the original snapshot.
hasLinearReference now accepts Refs, Closes, and Fixes. Keep this row as
historical evidence and regression coverage guidance only.

**Current State:** hasLinearReference only matches Refs JSC-123, while the blocker says Refs/Closes.

**Expected State:** Runtime enforcement and operator-facing policy text must agree.

**Evidence Basis:** Claim-vs-evidence and repo-as-control-plane patterns require deterministic wording contracts.

**Code Evidence:** src/lib/pr-closeout/evidence.ts lines 52-55; src/lib/pr-closeout/blockers.ts lines 121-127.

**Risk:** Legitimate closeout PRs can be blocked.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:** Accept both Refs and Closes, or change all policy text to Refs only. Because repo workflow distinguishes Refs in review and Closes at full completion, accepting both is the safer implementation.

**Suggested Software / Method:** Regex fixture tests.

**Files Likely To Change:** src/lib/pr-closeout/evidence.ts, src/lib/pr-closeout.test.ts.

**Validation Command:** pnpm vitest run src/lib/pr-closeout.test.ts -t Linear

**Acceptance Criteria:** Refs JSC-1 and Closes JSC-1 pass; missing or malformed references block.

### GAP-007: Unknown Check SHA Routes to External Wait

**Category:** verification / recovery

**Current State:** If checks pass but head SHA metadata is missing, requiredChecksAreCurrent returns false, freshness becomes unknown, claim blockers are non-fixable, and status maps check blockers to wait_for_external_check.

**Expected State:** Missing SHA metadata should be classified as a verifier/provider evidence gap, not an external check wait, unless a check is actually pending.

**Evidence Basis:** Runtime truth and failure classification patterns.

**Code Evidence:** src/lib/pr-closeout/claim-helpers.ts lines 53-62; claim-builders.ts lines 41-60 and 89-113; claims.ts lines 22-26; status.ts lines 72-80.

**Risk:** Closeout stalls in a wait loop that cannot resolve without better evidence collection.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:** Split unknown freshness into provider_metadata_missing versus pending_external_check. Route provider metadata gaps to tool or harness_gates blockers with codex_can_fix_now or needs_jamie_decision depending on adapter authority.

**Suggested Software / Method:** Typed blocker cause enum and Vitest fixture.

**Files Likely To Change:** src/lib/pr-closeout/claim-helpers.ts, claim-builders.ts, claims.ts, status.ts, tests.

**Validation Command:** pnpm vitest run src/lib/pr-closeout.test.ts -t SHA

**Acceptance Criteria:** Passing checks without SHA do not produce wait_for_external_check; pending checks still do.

### GAP-008: Runtime Evidence Bundle Synthesizes Empty Gate Evidence

**Category:** traceability / API contract

**Current State:** phaseExitFromRuntimeCard creates a HePhaseExit/v1 object from runtime-card summary state and sets gates to an empty array.

**Expected State:** Consumers should distinguish summary-only projection from gate-backed evidence.

**Evidence Basis:** Evidence packets should not launder summaries into verifier proof.

**Code Evidence:** src/lib/runtime/runtime-evidence-producer.ts lines 47-68.

**Risk:** A downstream consumer can treat summarized phase-exit status as original gate evidence.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:** Add sourceCompleteness summary_only|gate_backed, or do not emit phaseExit unless an original phase-exit artifact was supplied.

**Suggested Software / Method:** Additive schema field and adapter tests.

**Files Likely To Change:** src/lib/runtime/runtime-evidence-bundle.ts, src/lib/runtime/runtime-evidence-producer.ts, tests.

**Validation Command:** pnpm vitest run src/lib/runtime

**Acceptance Criteria:** Consumers can distinguish summary projection from gate evidence.

### GAP-009: Retry and Recovery Are Fragmented

**Category:** recovery / traceability

**Current State:** CircleCI has shell retries, eval fixtures model retry caps, preflight emits recovery text, and missing-context classifier routes some failures. There is no single attempt-ledger or recovery-event contract used by the runtime loop.

**Expected State:** Retryable workflows should record attempt count, first failure, retry decision, owner, stop reason, and next action.

**Evidence Basis:** Bounded retries, stop reasons, failure classification, and replayability.

**Code Evidence:** .circleci/config.yml lines 83-97; scripts/run-harness-evals.mjs retry fixtures; scripts/codex-preflight.sh orchestration; src/lib/missing-context/classifier.ts.

**Risk:** Failures get retried in the wrong layer or handed to the wrong owner.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:** Add attempt-ledger/v1 and recovery-event/v1; emit from review-gate, pr-closeout, runtime-card --live, and CI adapters.

**Suggested Software / Method:** JSONL run records now; OpenTelemetry later if volume justifies it.

**Files Likely To Change:** src/lib/contract/run-record-emitter.ts, src/commands/review-gate-core.ts, src/commands/pr-closeout.ts, src/lib/runtime/local-runtime-card.ts.

**Validation Command:** node --import tsx src/cli.ts replay --list --json plus command-specific tests.

**Acceptance Criteria:** Retryable and non-retryable failures carry attempts, stop reasons, owner, and replayable evidence.

### GAP-010: Secrets and Security Coverage Are Split Across Hooks, Scripts, and CI

**Category:** governance / safety

**Current State:** secrets:staged, semgrep:changed, and Semgrep full scripts exist. CircleCI runs security-scan. pnpm check runs audit but not staged secrets or changed Semgrep.

**Expected State:** Local, CI, release, and closeout safety coverage should be explicit so agents do not overclaim local validation.

**Evidence Basis:** Governance and safety patterns across the evidence docs.

**Code Evidence:** package.json lines 84-86; Makefile lines 94-105; .circleci/config.yml lines 471-474; scripts/check-environment.sh line 250.

**Risk:** A local check pass can be interpreted as broader security proof than it is.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:** Add safety:local and make verify-work.sh report which safety gates ran, skipped, or are CI-owned.

**Suggested Software / Method:** Existing scripts.

**Files Likely To Change:** package.json, scripts/verify-work.sh, docs.

**Validation Command:** pnpm run safety:local && bash scripts/verify-work.sh --fast

**Acceptance Criteria:** Handoff can truthfully distinguish local safety evidence from CI-owned security gates.

## 6. Contradictions

Contradiction rows are blocking only when they are still current. If a
contradiction is marked landed or historical, do not start implementation from
the old row; keep only the regression fixture or status-refresh requirement.
Critical and high current contradictions block governed closeout. Medium current
contradictions block only when they affect the touched surface or the current
PR's claimed readiness.

| Claim | Actual Implementation At Snapshot | Refresh Status | Severity | Operational Impact | Recommended Fix |
|---|---|---|---|---|---|
| PR body accepts Refs/Closes references. | Regex accepted only Refs. | Landed: Refs, Closes, and Fixes are now accepted. | Historical Medium | Valid closeout wording could be blocked. | Keep regression fixture/current proof only. |
| Runtime-card is a current-state packet for safe continuation. | Missing phase-exit could be not_run with no blockers. | Open. | High | Missing validation proof can look non-blocking. | Mode-aware blocking for not_run and summary-only evidence. |
| Agent command catalog is agent-readable. | --for-agent returned only next. | Partially landed: bounded modes now exist. | Medium | Agents can still miss native validators if mode contents are weak. | Add capability parity fixtures and first-contact execution proof. |
| Architecture is mechanically enforced. | Architecture checker existed but was absent from package check. | Landed: architecture:check is now in pnpm check. | Historical Medium | Structural drift could pass default gate. | Keep gate wired; add baseline owner/freshness metadata. |
| Cold research can shape future validators. | No promotion manifest existed. | Partially landed: manifest and validator exist. | High | Reusable insights can still stay inert without owners and stale-reference checks. | Harden evidence pattern lifecycle quality. |
| Waiting for checks means checks are externally pending. | Missing SHA metadata can map to wait_for_external_check. | Open pending fresh verifier pass. | High | Agent waits instead of fixing evidence adapter. | Split metadata gaps from pending checks. |

## 7. Missing Features

Runtime state:

- Required evidence mode for harness next.
- Mode-aware runtime-card blocking.
- Canonical runtime-card artifact path and freshness gate.

Command selection:

- Agent-facing command catalog mode completeness and parity tests.
- Safe verifier recommendation when runtime-card says evidence is missing.

Verification:

- Regression proof for Refs, Closes, and Fixes PR body acceptance.
- Tests for missing check SHA classification.
- Promotion validator for research patterns.

Validation:

- Regression proof that architecture:check remains wired into pnpm check.
- Local safety gate that names secrets and Semgrep coverage.

Architecture enforcement:

- Baseline owner/reason/date requirement.
- Source invariant checks integrated into CI.
- Canonical Effect service/layer pattern plus allowed-import tests.
- Effect migration guide with sync facade and Effect builder requirements.

Traces:

- Uniform run records for next, runtime-card, review-gate, pr-closeout, and validators.
- Attempt ledger artifacts for retry and stop reasons.
- Observability events for instruction surfaces read, skill routing decisions,
  authority-class citations, validation outcomes, blocker classes, steering
  admissions, and recovery decisions.

Context:

- Context budget and stale-context check.
- Research pattern promotion queue.
- Authority map registry and authority-check validator.
- AGENTS authoring audit for descriptive filler, priority flattening, and scope mismatch.
- Canon hygiene cleanup audit for high-copy-risk source, tests, schemas, command help, and governance docs.
- Scheduled context scanner for stale canon, broken references, duplicate instructions, and contradiction candidates.

Skills:

- Research-to-validator promotion skill.
- Smaller command-surface bundles by workflow phase.

Internal evals:

- Authority-map evals for canon versus intent, history, memory, reference, and
  runtime evidence.
- Default-no and localisation evals for context placement and loaded-context
  discipline.
- Verification evals for claim evidence, stale proof, blocked proof, and
  not-canon proof rejection.
- Planning-mode and repeated-steering evals derived from real correction
  events.
- Skill-routing and provider-portability evals that catch prompt-only or
  Codex-specific shortcuts.
- Effect boundary eval or fixture proving a migrated module hides Effect behind
  a stable public facade.

Recovery:

- Runtime recovery event schema.
- Owner classification for provider metadata gaps versus external waits.

Governance:

- Explicit proof that live PR and Linear state was observed or blocked.
- Clear separation of local, CI, and release safety coverage.

CI/CD:

- Architecture invariant job regression proof.
- Runtime-card and phase-exit smoke fixtures.

Observability:

- JSONL trace artifacts attached to validation and closeout.
- Replay fixtures connected to actual command outputs.
- Context-health counters for canon drift, stale canon, unknown authority, not-canon cited as truth, always-loaded context size, and token usage per merged PR.
- Agent-behavior counters for repeated steering, skipped skill routing,
  instructions read, claims without evidence, stale closeout evidence, recovery
  attempts, and post-guard recurrence.

## 8. Fix Roadmap

### Phase 1 — Critical Trust Boundary Fixes

Objective: eliminate false-success, stale-state, unsafe-command, and missing-evidence risks.

Fixes included: open portions of GAP-001, GAP-002, and GAP-007. GAP-006
is now a regression-proof item, not a fresh implementation item.

Files likely affected: src/commands/next.ts, src/commands/next-decisions.ts,
src/lib/runtime/local-runtime-card.ts, src/lib/runtime/runtime-card.ts,
src/lib/pr-closeout/claim-helpers.ts, src/lib/pr-closeout/claim-builders.ts,
src/lib/pr-closeout/claims.ts, src/lib/pr-closeout/status.ts, related tests.

Validation gates: pnpm vitest run src/commands/next.test.ts src/commands/runtime-card.test.ts src/lib/pr-closeout.test.ts; node --import tsx src/cli.ts next --json --mode pr; node --import tsx src/cli.ts runtime-card --json --repo .

Expected risk reduction: high. This prevents continuation recommendations when required state proof is absent or misclassified.

### Phase 2 — Mechanical Enforcement

Objective: make architecture and evidence promotion fail in CI instead of relying on reviewer memory.

Fixes included: remaining open portions of GAP-003 plus GAP-004 regression and
baseline-freshness hardening. The architecture check and evidence-pattern
validator are already wired; the remaining work is ownership, freshness,
adoption quality, and regression proof.

Files likely affected: .harness/research/evidence-patterns.json, scripts/validate-evidence-patterns.cjs, scripts/check-architecture-rules.cjs, package.json, .circleci/config.yml.

Validation gates: node scripts/validate-evidence-patterns.cjs --json; pnpm run architecture:check; pnpm check.

Expected risk reduction: medium-high.

### Phase 3 — Runtime Harness Maturity

Objective: make runtime failures replayable and recovery decisions auditable.

Fixes included: GAP-008 and GAP-009.

Files likely affected: src/lib/runtime/runtime-evidence-bundle.ts, src/lib/runtime/runtime-evidence-producer.ts, src/lib/contract/run-record-emitter.ts, src/commands/review-gate-core.ts, src/commands/pr-closeout.ts, src/commands/runtime-card.ts.

Validation gates: pnpm vitest run src/lib/runtime src/commands/replay.test.ts; node --import tsx src/cli.ts replay --list --json.

Expected risk reduction: medium.

### Phase 4 — Context and Skill Compression

Objective: keep hot-path agent context small while making the right tools discoverable.

Fixes included: GAP-005, context budget/staleness report, research-to-skill/gate promotion workflow.

Files likely affected: src/lib/cli/registry/command-capabilities.ts, src/lib/cli/command-registry.ts, src/commands/context-health.ts, packaged skill references.

Validation gates: node --import tsx src/cli.ts commands --json --for-agent --mode verify; pnpm vitest run src/cli.test.ts.

Expected risk reduction: medium.

### Phase 5 — Governance and Scaling

Objective: make autonomy expansion safe only where deterministic evidence and rollback are present.

Fixes included: GAP-010, live PR/Linear observation proof in closeout, maintenance checks for evidence-pattern drift and architecture baseline drift.

Files likely affected: scripts/verify-work.sh, package.json, harness.contract.json, .harness/ci-required-checks.json, docs and PR template guidance.

Validation gates: bash scripts/verify-work.sh --fast; bash scripts/run-harness-gate.sh docs-gate --mode required --json; pnpm check.

Expected risk reduction: medium.

### Phase 6 — Agent-Native Context Authority

Objective: make canon/not-canon, instruction loading, cleanup, maintenance, and
context-health metrics enforceable after the deep module work lands, with
internal evals and observability proving whether the system changes future
agent behavior.

Fixes included: GAP-011, GAP-012, GAP-013, GAP-014, GAP-015, GAP-016,
GAP-017, GAP-018, GAP-019, GAP-020, GAP-021, GAP-022.

Files likely affected: .harness/authority-map.json,
scripts/check-authority-map.cjs, package.json, AGENTS.md,
docs/agents/01-instruction-map.md, optional compact
docs/agents/00-authority-map.md, context-health or authority CLI command files,
internal eval fixtures, replay/session evidence contracts, runtime-card and
PR-closeout observability emitters, and north-star/status metric surfaces.

Validation gates: pnpm run authority:check; pnpm docs:lint; pnpm run
docs:ubiquitous:guard; pnpm run docs:steering:guard; focused CLI tests for
authority or context-health commands once implemented; focused internal eval
run for authority, routing, validation, planning-mode, and repeated-steering
fixtures.

Expected risk reduction: medium-high. This prevents agents from trusting the
wrong artifact class, bloating always-loaded context, or treating cleanup and
maintenance as optional prose. It also makes behavior regressions and repeated
steering visible before Jamie has to detect them manually.

### Phase 7 — Effect Service Layer Migration

Objective: move from contained Effect seams to an honest, repeatable Effect
module pattern without letting Effect leak through the whole codebase.

Priority note: Effect is an architecture-quality follow-on, not an immediate
agent-native closeout prerequisite, unless a specific runtime, recovery, or
provider-boundary gap requires typed failures or layer substitution to be
implemented safely.

Fixes included: GAP-023.

Files likely affected: docs/architecture/effect-deep-modules.md,
docs/architecture/module-boundaries.md,
src/lib/architecture/module-boundaries.test.ts, one or two exemplar modules,
and their focused seam tests.

Validation gates: pnpm vitest run
src/lib/architecture/module-boundaries.test.ts; focused tests for each
converted module; pnpm typecheck; pnpm run test:related; pnpm run quality:size.

Expected risk reduction: medium. This gives agents a concrete migration pattern
while preserving the thin public interfaces that make deep modules useful.

## 9. Highest-Leverage Fixes

| Rank | Fix | Impact | Difficulty | Risk Reduced | Why First |
|---:|---|---|---|---|---|
| 1 | Prove and complete required evidence in harness next PR/CI modes | Very high | Medium | False safe recommendations | The cockpit is the front door. |
| 2 | Make missing phase-exit block runtime-card closeout/PR mode | Very high | Medium | Missing validation proof | Runtime-card is otherwise too optimistic. |
| 3 | Keep Refs/Closes/Fixes PR body regression proof current | Medium | Low | PR closeout churn | The parser is landed; prevent regression. |
| 4 | Fix missing check SHA classification | High | Medium | Infinite external waits | Prevents wrong-owner recovery. |
| 5 | Add evidence-pattern promotion manifest | High | Medium | Research staying inert | Converts this audit into durable system work. |
| 6 | Keep architecture check wired and add baseline owner/freshness metadata | High | Low-medium | Structural drift | The gate is landed; now make its authority explicit. |
| 7 | Prove agent command catalog mode completeness | Medium | Low-medium | Tool blindness | Agents discover native validators. |
| 8 | Mark runtime evidence summaries as summary-only | Medium | Medium | Evidence laundering | Prevents summaries masquerading as proof. |
| 9 | Add attempt/recovery ledger | Medium | Medium-high | Blind retries | Builds runtime maturity. |
| 10 | Add local safety coverage summary | Medium | Low | Overclaimed validation | Clarifies what local checks prove. |
| 11 | Add authority-map registry and validator | High | Medium | Not-canon cited as truth | Gives agents a machine-readable trust map. |
| 12 | Add AGENTS authoring and default-no audit | Medium-high | Medium | Context bloat and flattened priority | Keeps always-loaded instructions operational. |
| 13 | Add canon hygiene audit and scanner | Medium-high | Medium-high | Stale canon and bad local examples | Makes cleanup and maintenance repeatable. |
| 14 | Add validation-expectations command | Medium | Medium | Weak or over-broad validation | Gives agents structured test obligations. |
| 15 | Add context-health metrics | Medium | Medium | Productivity gains hiding context rot | Pairs throughput with context quality. |
| 16 | Add internal agent-behavior evals | High | Medium | Repeated behavior regressions | Proves the harness changes agent choices, not just repo text. |
| 17 | Add governed-flow observability events | High | Medium-high | Invisible runtime failures | Shows what agents trusted, verified, skipped, and recovered from. |
| 18 | Add flywheel record and status command | High | Medium | Disconnected learnings | Links signal, fix, proof, eval, observability, and retirement. |
| 19 | Harden Effect service/layer exemplar | Medium-high | Medium | Effect leakage or shallow migration | Makes Effect adoption real and bounded. |

## 10. Implementation Advice

Build first:

- Start with the still-open harness next evidence proofs, runtime-card missing
  phase-exit blocking, and runtime-evidence summary-only semantics.
- Run a fresh verifier pass for the missing check SHA classification before
  patching it; if confirmed, split provider metadata gaps from pending external
  checks.
- Treat Effect as scaffolded, not complete. Before expanding Effect, pick one
  module that benefits from typed failures, provider substitution, or retry
  semantics and convert it end-to-end behind a stable facade.

Do not build yet:

- Do not introduce a large orchestration framework or OpenTelemetry-first runtime before simple JSONL/run-record emission is uniform.
- Do not add dependency-cruiser or madge until the existing architecture checker is wired and its gaps are proven.
- Do not migrate broad command runners, CLI wiring, or simple pure helpers to
  Effect before the exemplar service/layer pattern is proven.

Remove or simplify:

- Avoid adding more secondary research without an adoption status.
- Avoid more first-contact docs if a command catalog mode can carry the same information.

Should become a validator:

- Evidence-pattern adoption status.
- Architecture baseline metadata.
- Runtime-card required-evidence mode.
- PR closeout wording contract.
- Effect approved-boundary, facade, builder, service, layer, and test-provider
  requirements.

Should become a schema:

- evidence-pattern/v1.
- attempt-ledger/v1.
- recovery-event/v1.
- agent-behavior-eval/v1.
- agent-observability-event/v1.
- runtime evidence sourceCompleteness.

Should become internal evals:

- Authority-map trust selection.
- Default-no context loading and localisation.
- Verification claim-vs-evidence behavior.
- Planning-only stop behavior.
- Repeated-steering admission and durable guard creation.
- Skill-routing discipline.
- Provider portability boundary checks.
- Effect exemplar behavior parity between public facade and Effect builder.

Should become observability:

- Instruction surfaces read.
- Skills routed or skipped.
- Authority classes cited as evidence.
- Validation commands, outcomes, and blockers.
- Closeout evidence freshness.
- Steering admissions and post-guard recurrence.
- Recovery attempts, stop reasons, and next owner.

Should become a skill:

- Research promotion: convert a deep evidence file into adopted/deferred/rejected pattern records plus validator candidates.
- Runtime closeout repair: inspect runtime-card, phase-exit, PR closeout, and CI state, then classify owner and next action.

Should become documentation:

- One short operator page explaining local, CI-owned, release-owned, and closeout-owned gates.
- A compact cold-research-to-executable-policy SOP.

Should become CI:

- architecture:check regression proof and baseline freshness check.
- validate-evidence-patterns adoption-quality check.
- Runtime-card and phase-exit smoke fixtures.

Should remain manual:

- Strategic choice of which research patterns to adopt.
- High-risk autonomy expansion.
- Reversing or deleting historical .harness artifacts.

## 11. Final Recommendation

Immediate next action: implement the still-open parts of Phase 1 as a small
trust-boundary patch, using the refresh statuses in this audit as the execution
source. Do not reimplement rows marked landed or historical; add regression
fixtures for those rows instead.

Safest first patch: add or refresh the missing check SHA classification fixture,
then fix the adapter only if the fresh verifier pass confirms the stale
classification. In parallel, harden runtime-evidence so summary-only projections
cannot be mistaken for gate-backed proof.

Highest-risk missing system: required runtime evidence and source completeness
in the continuation path. Until harness next, runtime-card, phase-exit,
PR-closeout, and live PR/Linear evidence all fail closed on missing, stale, or
summary-only proof, the project is not ready for broader unattended Codex
autonomy.

Best validation to add first: a capability-parity fixture for commands
--for-agent modes plus a runtime-evidence fixture proving summary-only is
visible and non-authoritative. architecture:check is already wired into
pnpm check and should be protected as regression coverage.

Broader Codex autonomy readiness: **not yet** for PR closeout or lifecycle movement without human oversight. The repo is ready for bounded read-only planning, validation recommendation, and focused fixes. It is not ready for unattended closeout until runtime-card, phase-exit, PR closeout, and live PR/Linear state are required, current, and replayably evidenced.

## 12. Agent-Native Execution Bindings

This section converts the audit from a human-readable research note into an
agent-operable execution map. If implementation work starts from this document,
each row below must be treated as a binding control-plane expectation unless a
newer canonical artifact supersedes it.

### 12.1 Capability Parity Map

| Operator action | Agent-operable surface | Evidence gate | Current status | Priority |
|---|---|---|---|---|
| Orient to current repo rules | AGENTS.md, CODESTYLE.md, docs/agents/01-instruction-map.md, commands --for-agent --mode orient | docs:lint, docs:ubiquitous:guard, command catalog fixture | Partially landed; needs first-contact proof | Must |
| Choose validation for a change | commands --for-agent --mode verify, verify-work.sh, validation-expectations future command | focused command catalog fixture, verify-work evidence | Partially landed | Must |
| Review PR readiness | commands --for-agent --mode review, pr-closeout, review-gate, CodeRabbit evidence import | PR closeout tests, review-context and learnings gates | Partially landed | Must |
| Handoff or close a lane | commands --for-agent --mode handoff, pr-closeout/v1, runtime-card/v1, phase-exit evidence | closeout claim/evidence tests and live-state proof | Partially landed; not autonomous | Must |
| Recover from missing evidence | runtime-card, phase-exit, next --mode pr/ci, future recovery-event/v1 | missing evidence fixtures and blocker-owner classification | Open | Must |
| Promote research into policy | evidence-pattern manifest, validate-evidence-patterns, future research-promotion skill | adoption status, owner, stale-reference checks | Partially landed | Should |
| Maintain canonical context | authority-map future registry, AGENTS authoring audit, context-health future command | authority:check, context-health counters, scanner tickets | Open roadmap | Should |
| Evaluate agent behavior | internal eval fixtures for routing, verification, planning-only, repeated steering | eval pass/fail artifacts and recurrence metrics | Open roadmap | Should |
| Observe governed flow | future agent-observability-event/v1 and JSONL trace records | replay fixtures and schema validation | Open roadmap | Should |

### 12.2 Per-Gap Ownership Binding

| Gap | Authoritative surface | Non-authoritative mirrors | Enforcement gate | Owner class |
|---|---|---|---|---|
| GAP-001 | harness next decision logic and tests | docs and audit notes | next PR/CI evidence fixtures | CLI/runtime owner |
| GAP-002 | runtime-card closeout logic and schema | docs and PR examples | runtime-card tests | Runtime owner |
| GAP-003 | evidence-pattern manifest and validator | research audit prose | research:evidence:validate plus owner/stale-reference checks | Governance owner |
| GAP-004 | architecture checker and baseline registry | architecture diagrams and docs | architecture:check in pnpm check plus baseline freshness proof | Architecture owner |
| GAP-005 | command registry and capability fixtures | README/help prose | commands --for-agent mode tests | CLI owner |
| GAP-006 | PR closeout evidence parser tests | workflow docs | Refs/Closes/Fixes regression fixture | Closeout owner |
| GAP-007 | PR closeout claim freshness and blocker model | closeout docs | missing SHA classification fixture | Closeout owner |
| GAP-008 | runtime-evidence-bundle contract and producer | runtime-card summaries | runtime evidence source-completeness fixture | Runtime owner |
| GAP-009 | attempt-ledger and recovery-event contracts | closeout notes | schema tests and replay fixtures | Runtime owner |
| GAP-010 | verify-work safety summary and CI ownership contract | PR template wording | verify-work and docs-gate checks | Governance owner |
| GAP-011 | authority-map registry | docs index | authority:check | Governance owner |
| GAP-012 | nested AGENTS authoring validator | human docs | docs:lint plus AGENTS audit | Instruction owner |
| GAP-013 | canon hygiene audit and cleanup classifier | audit notes | canon hygiene report with visibility/fixability ranking | Maintenance owner |
| GAP-014 | canon ownership/freshness scanner | context notes | scheduled scanner plus owner/freshness checks | Maintenance owner |
| GAP-015 | validation-expectations command or skill-backed output | docs examples | focused validation-expectations tests | Validation owner |
| GAP-016 | context-health and north-star status metrics | narrative summaries | context-health metric fixtures | Product/ops owner |
| GAP-017 | principle-focused internal eval fixture set | anecdotal feedback | eval runner artifacts | Eval owner |
| GAP-018 | agent-behavior observability event contract | handoff summaries | trace schema and replay tests | Observability owner |
| GAP-019 | flywheel record/status command | roadmap prose | flywheel status/eval/trace checks | Governance owner |
| GAP-020 | eval-to-flywheel linkage fields | eval summaries | eval promotion and blocker routing checks | Eval owner |
| GAP-021 | bounded agent-observability-event schema | raw trace notes | observability-gate event-shape and redaction checks | Observability owner |
| GAP-022 | authority-map rollout policy fields | rollout prose | authority unknown-policy and expiry checks | Governance owner |
| GAP-023 | Effect service/layer pattern and boundary tests | migration notes | module-boundary and exemplar tests | Architecture owner |

### 12.3 Phase Agent-Operability Acceptance

Each roadmap phase is complete only when an agent can discover, execute, and
verify it from repo surfaces without human translation:

| Phase | Agent-operability acceptance |
|---|---|
| Phase 1 | commands --for-agent --mode verify or handoff points to the trust-boundary command, and tests prove missing/stale evidence blocks. |
| Phase 2 | pnpm check runs the relevant architecture and evidence validators, and failures name the owning surface. |
| Phase 3 | runtime and recovery artifacts can be replayed from a command output without reading conversation history. |
| Phase 4 | command catalog modes expose the right workflow surface with a bounded token footprint. |
| Phase 5 | local, CI-owned, release-owned, and closeout-owned safety gates are distinguishable in verifier output. |
| Phase 6 | authority-map and context-health checks prevent canon/not-canon confusion and default-include context drift. |
| Phase 7 | public facades remain synchronous where required, Effect builders stay behind approved boundaries, and allowed-import tests prove no leakage. |

### 12.4 Schema Governance For New Contracts

New contracts proposed here should live under the existing contract/schema
surface used by the harness, with namespaced version identifiers such as
evidence-pattern/v1, attempt-ledger/v1, recovery-event/v1,
agent-behavior-eval/v1, agent-observability-event/v1, and
runtime-evidence-bundle/v1.

Compatibility rule: v1 additions must be additive unless the artifact is marked
experimental. Any breaking field rename, enum narrowing, or authority semantics
change requires a new version, migration note, regression fixture, and docs-gate
surface update.

Promotion rule: no schema becomes canonical merely because this audit names it.
It becomes canonical only after it has an owner, authoritative path, validation
gate, adoption status, and at least one fixture proving the behavior it is meant
to change.

### 12.5 Contradiction Blocking Policy

Current critical or high contradictions block governed closeout. Current medium
contradictions block only when they affect the touched surface or a claimed
readiness path. Historical contradictions do not block implementation, but they
must retain regression proof if the prior failure would be costly to repeat.

When this audit conflicts with current repo evidence, current executable repo
evidence wins. The audit must then be refreshed rather than used as authority
for duplicate implementation.
