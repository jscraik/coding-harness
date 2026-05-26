---
schema_version: 1
artifact_type: deep_operational_review
status: research
date: 2026-05-26
source_window: 2026-05-19..2026-05-26
primary_source_repo: /Users/jamiecraik/dev/codex
primary_target_repo: /Users/jamiecraik/dev/coding-harness
authority: advisory_until_adopted
evidence_registry_id: 2026-05-26-codex-ecosystem-operational-review
---

# Codex Ecosystem Operational Review

## Table of Contents

- [Executive Summary](#executive-summary)
- [Ecosystem Architecture Map](#ecosystem-architecture-map)
- [Golden Nuggets](#golden-nuggets)
- [Cross-Project Improvements](#cross-project-improvements)
- [Missing Systems](#missing-systems)
- [Codex-Native Integration Opportunities](#codex-native-integration-opportunities)
- [Highest-Leverage Implementations](#highest-leverage-implementations)
- [Suggested Architecture Changes](#suggested-architecture-changes)
- [Anti-Patterns and Risks](#anti-patterns-and-risks)
- [Final Operational Roadmap](#final-operational-roadmap)
- [Evidence Notes](#evidence-notes)

## Executive Summary

Codex is evolving from a CLI-first execution tool into a typed, resident runtime
with durable threads, turns, item streams, native goals, permission profiles,
explicit environments, hookable subagent lifecycle events, app-server APIs,
rollout-backed search, SDK-generated schemas, review modes, and retry-aware
remote control. The last seven days of meaningful work point in one direction:
operational truth is moving out of final prose and into structured runtime
events that can be streamed, resumed, searched, replayed, and governed.

Coding Harness already aligns with that direction more than a generic
orchestrator would. It has runtime-card and runtime-evidence contracts, PR
closeout gates, artifact-routine checks, active-artifact hygiene, evidence
pattern registration, deterministic replay fixtures, and a current verifier
cockpit plan. The highest leverage improvement is therefore not another large
orchestration layer. It is a Codex-native runtime adapter that binds those
existing Harness contracts to Codex's native thread, turn, item, goal,
permission, environment, hook, review, and trace identities.

The weakest architectural area is split truth. Codex has live operational state;
Harness has governance artifacts and verifier intent. When those surfaces are
not identity-bound, humans must repeatedly steer: check live PR state, do not
trust stale artifacts, that was only a plan, CI is not review truth, the runtime
proof was degraded. Those corrections are telemetry. They should become
runtime-card fields, evidence-bundle provenance, verifier receipts, and
closeout blockers.

Highest leverage integrations:

- P0: Codex runtime-state adapter for app-server events, rollout trace, hooks,
  and SDK-shaped packets.
- P0: Runtime identity spine using thread_id, turn_id, item_id, tool_call_id,
  plugin_id, subagent_id, trace_id, git sha, branch, PR number, and artifact id.
- P0: Claim-vs-evidence verifier contract that blocks unsupported done,
  merge-ready, root-tidy, review-addressed, and goal-complete claims.
- P0: Goal, permission profile, sandbox, approval reviewer, and environment
  parity between Codex runtime state and Harness runtime cards.
- P1: Artifact-native runtime surfaces where documents, reviews, PDFs, CSVs,
  screenshots, browser output, and implementation notes are inspectable state,
  not just files on disk.
- P1: Replayable telemetry envelope that turns failed runs, auth recovery, stale
  evidence, blocked runtime, review churn, and queue decisions into eval seeds.

The main architectural risk is over-copying Codex internals. Harness should not
become a competing app-server, goal store, tool registry, or thread engine. It
should stay thin and strict: ingest Codex-native runtime facts, normalize them,
enforce governance, produce verifier receipts, and decide whether claims are
allowed.

## Ecosystem Architecture Map

| Layer | Primary Owner | Responsibility | Should Not Own |
| --- | --- | --- | --- |
| Codex runtime | /Users/jamiecraik/dev/codex | Threads, turns, item streams, tools, permissions, environments, MCP, hooks, goals, review mode, background sessions, compaction, remote control, runtime schemas. | Cross-project delivery governance, PR merge authority, Harness evidence promotion, long-lived project policy. |
| Coding Harness | /Users/jamiecraik/dev/coding-harness | Runtime truth enforcement, PR closeout, evidence normalization, verifier receipts, stale-state prevention, review convergence, artifact governance, deterministic replay/evals, operational memory. | Native Codex execution semantics, model/runtime scheduling, raw MCP server lifecycle, goal storage internals. |
| GitHub and CI | External operational substrate | PR metadata, checks, reviews, review threads, mergeability, artifacts, logs, branch freshness. | Conversational interpretation of readiness. |
| Linear and project trackers | External planning substrate | Issue state, ownership, project status, handoff queue, business priority. | Runtime truth or proof of implementation. |
| Memory and rollout evidence | Shared context substrate | Prior decisions, repeated steering, session evidence, traceable learnings, future eval seeds. | Unverified current state. |

Runtime flow:

1. Codex app-server emits thread, turn, item, goal, settings, memory, review,
   command, permission, environment, and MCP state.
2. Codex rollout trace and JSON logs add codex_turn_id, attempts, request spans,
   auth recovery, compaction, and remote-control lifecycle.
3. Codex hooks add SessionStart, SubagentStart, SubagentStop, PreToolUse,
   PermissionRequest, PostToolUse, PreCompact, and PostCompact evidence.
4. Harness normalizes those facts into runtime-evidence-bundle/v1 and a future
   codex-runtime-state/v1.
5. Harness projects a runtime-card with liveState, evidenceState,
   governanceState, and actionState.
6. Harness validators decide whether a claim is allowed, blocked, stale, or
   needs human authority.

Telemetry should converge on RuntimeEventEnvelope/v1:

- identity: RuntimeIdentity/v1.
- source: codex_app_server, codex_rollout_trace, codex_hook, github, ci,
  linear, artifact, or harness_validator.
- event_type: turn_started, item_completed, goal_updated, permission_decision,
  review_thread_updated, artifact_verified, or claim_evaluated.
- observed_at: timestamp.
- freshness: current, stale, missing, or unknown.
- evidence_ref: path, URL, span id, or artifact id.
- confidence: direct, inferred, degraded, or blocked.

Verification flow should compare declared intent to current evidence:

- Implemented requires git diff, tests, artifact references, and current runtime
  evidence for the changed surface.
- PR ready requires PR metadata, latest head SHA, checks, unresolved review
  threads, review requests, template fields, and dirty worktree state.
- Goal complete requires Codex goal status, Harness goal board status,
  validation receipts, and no remaining required closeout action.
- Review addressed requires review thread state and response artifacts, not only
  local code changes.
- Runtime proof passed requires runtime evidence freshness. Degraded
  observability should produce blocked_runtime rather than a green-looking pass.

Orchestration authority:

- Codex owns execution: start, steer, interrupt, fork, compact, resume.
- Harness owns admission and closeout authority: whether a next action is safe,
  stale, blocked, or requires human approval.
- Automation should carry expectedTurnId, expectedHeadSha,
  expectedArtifactVersion, and expiry checks before acting.
- Human checkpoints remain required for approval escalation, merge, public
  release, irreversible data changes, and ambiguous product judgment.

## Golden Nuggets

### 1. Typed Runtime State Is The New Control Plane

Insight: Codex app-server v2 exposes threads, turns, items, goals, settings,
permissions, environments, memory mode, review mode, and runtime workspace roots
as typed APIs and generated schemas.

Why it matters: Harness should stop treating Codex as a transcript plus shell
runner. The native integration point is a runtime state adapter.

Affected projects: Codex and Coding Harness.

Implementation opportunity: Add codex-runtime-state/v1 as an internal Harness
adapter output, sourced from app-server events, SDK packets, rollout traces, and
hooks.

Operational value: Reduces repeated steering and stale-state claims by giving
Harness a current runtime substrate.

Risk/tradeoff: Do not mirror every Codex type. Normalize only the fields needed
for governance and replay.

### 2. Identity Is Operational Currency

Insight: Recent Codex work pushes identity through turn_id, expectedTurnId,
pluginId, subagent_id, subagent_type, codex_turn_id in trace inference, and item
streams.

Why it matters: Without a shared identity spine, Harness cannot prove which
runtime event supports which claim.

Affected projects: Coding Harness first, Codex integration second.

Implementation opportunity: Add RuntimeIdentity/v1 and require it on runtime
cards, evidence bundles, verifier receipts, review artifacts, and replay seeds.

Operational value: Makes claims replayable and debuggable across Codex,
Harness, GitHub, CI, Linear, and artifacts.

Risk/tradeoff: Identity fields must tolerate unknown values. Missing identity
should block strong claims without blocking all analysis.

### 3. Goals Are Native Lifecycle State

Insight: Codex now has a dedicated goal store, default-on goals, goal statuses,
budget accounting, continuation turns, and explicit events for mutation and
resume.

Why it matters: Harness goal boards should not be detached checklists. They
should reconcile with Codex ThreadGoal state.

Affected projects: Coding Harness.

Implementation opportunity: Add a goal reconciliation adapter that maps Codex
ThreadGoalStatus to Harness lifecycle and closeout gates.

Operational value: Prevents goal complete from being claimed while Codex is
paused, blocked, usage-limited, budget-limited, or still accounting.

Risk/tradeoff: Keep Harness governance richer than Codex goal status. Codex goal
state is necessary evidence, not the whole verdict.

### 4. Queue Semantics Are Stale-State Prevention

Insight: Codex input queue distinguishes active-turn injection, deferred
next-turn input, mailbox pending, idle pending, and mergeable pending user
input.

Why it matters: Harness automations and review responders need the same
semantic distinction. Send work is not one state.

Affected projects: Coding Harness.

Implementation opportunity: Introduce SteeringQueue/v1 with expectedTurnId,
delivery mode, expiry, merge policy, and stale-state preconditions.

Operational value: Reduces accidental steering against old turns or superseded
work.

Risk/tradeoff: Queue controls must be lightweight. A heavy scheduler would fight
Codex instead of extending it.

### 5. Tool Exposure Planning Is Governance

Insight: Codex centralized tool exposure planning and made executor specs
mandatory, with tool sources classified across shell, MCP, resources,
utilities, collab, runtime, dynamic, extension, and hosted tools.

Why it matters: Tool visibility is policy. Harness should know what a lane is
allowed to invoke before it trusts a runtime claim.

Affected projects: Coding Harness.

Implementation opportunity: Add a Harness tool-exposure receipt that records
which tool families were available, hidden, deferred, or blocked for a run.

Operational value: Makes could not validate and did not validate distinct.

Risk/tradeoff: Avoid becoming a second tool registry. Harness should consume
Codex tool plans and assert policy deltas.

### 6. Permission Profiles And Environments Are Runtime Truth

Insight: Codex added managed permission profiles, runtime refresh, inheritance,
permission profile list APIs, explicit MCP environments, strict exec-server
config, and canonical filesystem deny semantics.

Why it matters: Harness cannot assess proof without knowing the permission and
environment posture that produced it.

Affected projects: Coding Harness.

Implementation opportunity: Expand runtime-card codexRuntime to include
activePermissionProfile, approvalPolicy, approvalsReviewer, sandboxPolicy,
runtimeWorkspaceRoots, environment ids, and permission decision receipts.

Operational value: Prevents false confidence when proof came from read-only,
degraded, inherited, or wrong-environment execution.

Risk/tradeoff: Do not expose secrets or raw env values. Store classifications,
ids, and redacted references.

### 7. Review Is A Runtime Mode

Insight: Codex exposes review/start and enteredReviewMode/exitedReviewMode item
events. TUI slash commands also distinguish side/review flows.

Why it matters: Review should not be a chat convention. Harness needs a
review-lifecycle state machine.

Affected projects: Coding Harness.

Implementation opportunity: Add ReviewLifecycle/v1 with mode, reviewer,
artifact refs, unresolved threads, response state, and closeout blocking status.

Operational value: Reduces review churn and prevents CI-green from masquerading
as review-ready.

Risk/tradeoff: Review lifecycle should integrate GitHub threads and CodeRabbit
artifacts without requiring every reviewer to use the same transport.

### 8. Artifact Is A Runtime Surface

Insight: Codex app-server streams item types for file changes, command
execution, MCP calls, memory citations, and review mode. The broader desktop
runtime treats documents, PDFs, tables, browser surfaces, screenshots, and side
panels as inspectable operational surfaces.

Why it matters: Harness currently has artifact routines and active artifacts,
but artifacts still lean file-centric.

Affected projects: Coding Harness.

Implementation opportunity: Add ArtifactRuntimeSurface/v1 with artifact id,
kind, producer, verifier, preview/open command, freshness, annotations, lineage,
lifecycle state, and claim eligibility.

Operational value: Turns report exists into report is current, inspected,
verified, and attached to the claim it supports.

Risk/tradeoff: Keep raw large artifacts out of runtime cards. Store compact
metadata and evidence refs.

### 9. Rollout Search Makes Memory Operational

Insight: Codex added rollout-backed thread content search and case-insensitive
thread search over user/assistant text, snippets, metadata, and state DB.

Why it matters: Prior steering should become searchable evidence and eval seed
material, not tribal memory.

Affected projects: Coding Harness.

Implementation opportunity: Add a replay-seed miner that links repeated
steering phrases to evidence-pattern ids, validator candidates, and recovery
handlers.

Operational value: Converts repeated human correction into durable guardrails.

Risk/tradeoff: Search results should be treated as candidate evidence until
refreshed against current files or live state.

### 10. Recovery Is A First-Class Runtime Class

Insight: Codex remote-control work now retries after auth recovery, reconnects
exec-server websocket clients with fresh sessions, classifies overload, and
times out remote compaction requests.

Why it matters: Harness should distinguish runtime recovery, external blocker,
auth recovery, backpressure, missing artifact, stale evidence, and validation
failure.

Affected projects: Coding Harness.

Implementation opportunity: Extend recovery-event/v1 and runtime-card blockers
with recoveryClass, retryAfter, attemptId, and owner.

Operational value: Prevents churn where agents keep patching code for an
environment or transport failure.

Risk/tradeoff: Too many failure classes can become noise. Start with classes
that affect next safe action.

### 11. Schema Generation Is Anti-Drift Infrastructure

Insight: Codex app-server requires schema generation and generated TypeScript
for active v2 API changes.

Why it matters: Harness should treat runtime contracts the same way. Every
adopted evidence primitive should have a schema fixture and negative tests.

Affected projects: Coding Harness.

Implementation opportunity: Generate JSON schemas or fixture validators for
runtime-card/v2, codex-runtime-state/v1, RuntimeIdentity/v1,
ArtifactRuntimeSurface/v1, ReviewLifecycle/v1, and RuntimeEventEnvelope/v1.

Operational value: Makes contract drift locally catchable.

Risk/tradeoff: Avoid schema busywork for research-only artifacts. Promote only
adopted primitives.

### 12. Hooks Make Agent Work Attributable

Insight: Codex added SubagentStart and SubagentStop hooks with agent_id and
agent_type.

Why it matters: Harness review swarms and verifier agents need lifecycle
receipts that prove who ran, what artifact they wrote, and whether they stopped
or blocked.

Affected projects: Coding Harness.

Implementation opportunity: Add SubagentReceipt/v1 and require reviewer reports
to cite hook identity when available.

Operational value: Reduces mailbox-status-as-proof and missing-artifact
ambiguity.

Risk/tradeoff: Keep hook data optional for non-Codex runtimes.

### 13. Blocked Runtime Is Valid Evidence

Insight: Recent Harness memory and verifier work already learned that degraded
observability must fail closed and emit blocked_runtime rather than pass-looking
proof.

Why it matters: The Codex runtime is adding richer recovery classes; Harness
should preserve those as legitimate evidence states.

Affected projects: Coding Harness.

Implementation opportunity: Treat blocked_runtime as schema-valid in runtime
cards, verifier receipts, PR closeout, and replay fixtures.

Operational value: Prevents false success when the runtime truth source is
unavailable or stale.

Risk/tradeoff: Blocked states must include owner and next action so they do not
become vague stop signs.

### 14. Instruction Provenance Is Runtime Safety

Insight: Codex fixed wrong-CWD startup, invalid UTF-8 AGENTS warnings, compact
SessionStart hooks, and contextual user fragment rendering.

Why it matters: Harness should verify instruction and context provenance before
trusting work performed in a repo.

Affected projects: Coding Harness.

Implementation opportunity: Add ContextProvenanceReceipt/v1 with cwd,
workspaceRoots, instructionSources, branch, memory mode, AGENTS parse state,
and active artifact refs.

Operational value: Catches wrong-root and stale-instruction failures before
implementation or closeout claims.

Risk/tradeoff: Do not require every project to have the same instruction
layout.

### 15. Packaged Runtime Is A Distribution Contract

Insight: Codex package tooling creates canonical runtime packages with
manifests, entrypoints, resources, and packaged runtimes.

Why it matters: Harness should eventually ship as a Codex-native operational
profile, not just a repo-local CLI.

Affected projects: Coding Harness and future greenfield/brownfield adopters.

Implementation opportunity: Create a Harness runtime package/profile with
validators, schemas, adapter config, command contracts, and optional project
presets.

Operational value: Makes Harness reusable without copy-pasting local repo lore.

Risk/tradeoff: Package only stable contracts. Do not package current research as
canonical behavior.

## Cross-Project Improvements

### Coding Harness

What to improve: Promote Codex runtime integration from research to an adapter
contract.

Why: Harness already has runtime-card/v1 and runtime-evidence-bundle/v1, but
Codex's native runtime identity is only partially represented. The missing bind
causes stale-state checks to depend on human steering.

Implementation priority: P0.

Integration implications: Add codex-runtime-state/v1 as an internal adapter
output. Project it into runtime-card/v2 rather than replacing runtime-card/v1 in
one large step.

Suggested architecture: CodexRuntimeAdapter consumes app-server events,
rollout-trace events, hook events, SDK-shaped packets, and manual fixtures. It
emits RuntimeEventEnvelope/v1 and codex-runtime-state/v1.

Suggested validators: Positive and negative fixtures for missing turn_id,
mismatched head sha, stale goal status, read-only permission proof, missing
subagent artifact, blocked runtime, and auth recovery.

Suggested telemetry: OTel spans for adapter ingestion, verifier decision,
runtime-card projection, and blocked runtime classification.

Suggested workflows: Harness runtime-card should accept Codex runtime evidence
and show whether Codex state is current, stale, missing, blocked, or
insufficient for a claim.

What to improve: Make claim-vs-evidence the canonical closeout model.

Why: Human steering repeatedly corrects overclaims: plan is not implementation,
CI is not review readiness, local tests are not merge readiness, stale artifacts
are not current truth.

Implementation priority: P0.

Integration implications: PR closeout, runtime-card, artifact-routine,
active-artifacts, and evidence-pattern registry should share verdict language.

Suggested architecture: DeliveryTruthVerifier compares ClaimIntent/v1 against
evidence refs and returns allowed, blocked, downgraded, or unknown.

Suggested validators: Fixtures for root_tidy, merge_ready, review_addressed,
goal_complete, implementation_done, artifact_current, and runtime_proof_valid.

Suggested telemetry: Emit verifier_result.status, verifier_result.reason,
claim_id, evidence_ref_count, freshness, blocker_class, and owner.

Suggested workflows: PR body generation and closeout should automatically
downgrade unsupported claims.

What to improve: Turn artifacts into inspectable runtime state.

Why: Harness has active artifacts and artifact-routine, but artifact lifecycle
state is not yet first-class enough for side-panel or review-loop workflows.

Implementation priority: P1.

Integration implications: Artifact ids should be carried by runtime cards,
review receipts, implementation notes, verifier reports, PR templates, and
replay seeds.

Suggested architecture: ArtifactRuntimeSurface/v1 backed by compact metadata,
preview/open commands, annotations, lifecycle state, verifier refs, and lineage.

Suggested validators: Missing artifact, stale front matter, broken path,
uninspected generated artifact, unsupported claim, and mismatched artifact
lineage fixtures.

Suggested telemetry: artifact.created, artifact.updated, artifact.verified,
artifact.superseded, artifact.claim_bound, artifact.annotation_added.

Suggested workflows: Artifact status, artifact verify, and side-panel surfaces
should inspect the same contract.

What to improve: Use deterministic replay as the learning loop.

Why: Harness already contains deterministic replay fixtures for canary cases.
Codex's rollout trace and search direction can feed new replay seeds.

Implementation priority: P1.

Integration implications: Failed runs and repeated steering should become
replay fixtures before they become broad policy prose.

Suggested architecture: ReplaySeed/v1 with source event, expected verdict,
claim text, evidence refs, runtime identity, and regression owner.

Suggested validators: Each adopted steering pattern must have either a validator
or a documented blocked reason.

Suggested telemetry: replay.seeded, replay.passed, replay.failed,
replay.blocked, replay.promoted_to_validator.

Suggested workflows: A weekly mining pass should propose new validators from
repeated corrections, stale-state incidents, CI failures, review churn, and
blocked runtime events.

### Codex Integration Expectations

What to improve: Preserve stable integration fields for external control
planes.

Why: Harness should consume Codex, not fork it. Stable app-server schemas, SDK
types, hook payloads, rollout trace fields, and logs are the integration seam.

Implementation priority: P1 from the Harness side; upstream Codex changes only
when needed.

Integration implications: Harness should tolerate unknown fields, version-gate
experimental fields, and keep adapters narrow.

Suggested architecture: A versioned compatibility matrix that records which
Codex schema version supports which Harness ingestion fields.

Suggested validators: Fixture tests for older Codex packets, missing fields,
experimental fields, and unknown future fields.

Suggested telemetry: adapter.compatibility.version,
adapter.compatibility.missing_required_fields, adapter.compatibility.degraded.

Suggested workflows: Harness should classify unsupported Codex fields as
degraded or blocked rather than scraping prose to compensate.

## Missing Systems

Missing runtime truth systems:

- codex-runtime-state/v1 as the normalized live Codex runtime projection.
- RuntimeIdentity/v1 shared across runtime cards, evidence bundles, artifacts,
  PR closeout, review receipts, and replay seeds.
- ContextProvenanceReceipt/v1 for cwd, workspace roots, instruction sources,
  AGENTS parse state, memory mode, and active artifact refs.
- Runtime-card liveState/evidenceState/governanceState/actionState split.
- ExpectedTurnId and expectedHeadSha guards on queued automation.

Missing telemetry:

- RuntimeEventEnvelope/v1 with freshness, confidence, source, and identity.
- OTel spans for Harness verifier decisions and artifact verification.
- Low-cardinality blocker classes for runtime recovery, stale evidence, missing
  artifact, review-state mismatch, and external service failure.
- Trace links between Codex codex_turn_id and Harness verifier receipts.
- Telemetry for claim downgrades, not just pass/fail outcomes.

Missing governance:

- Deterministic claim-vs-evidence closeout gates for done, merge-ready,
  review-addressed, goal-complete, and root-tidy claims.
- Evidence-pattern promotion workflow from research to spec to validator.
- Review lifecycle contract that separates CI, review threads, local
  validation, tracker state, and PR metadata.
- Automation safety policy for queued work, wake-ups, and long-running runtime
  cards.
- Explicit human authority boundaries for merge, release, irreversible changes,
  and ambiguous product judgment.

Missing orchestration:

- SteeringQueue/v1 with active-turn injection, deferred next-turn input, queued
  mailbox work, expiry, merge policy, and stale-state guards.
- Recovery handler registry for auth recovery, websocket disconnect, overload,
  remote compaction timeout, missing artifact, and blocked runtime.
- Bounded reviewer swarm receipts tied to SubagentStart/SubagentStop where
  available.
- Goal continuation ownership that distinguishes Codex budget extension from
  Harness project lifecycle continuation.

Missing evals and verifiers:

- Codex runtime packet fixtures for app-server, SDK, rollout-trace, hook-only,
  and degraded runtime evidence.
- False-success evals for stale artifacts, stale PR head, unresolved review
  threads, green local tests with external blockers, and blocked observability.
- Architecture drift verifier for duplicated runtime truth systems.
- Context drift verifier for wrong cwd, stale AGENTS, stale active-artifacts,
  and missing instruction provenance.
- Artifact review verifier that proves generated artifacts were inspected and
  bound to the right claim.

Missing replay infrastructure:

- ReplaySeed/v1 from failed runs and repeated human steering.
- Replay harness that reconstructs a claim from runtime events, artifact refs,
  git sha, PR state, and verifier output.
- Replay classification for environment/tooling failure versus introduced
  regression.
- Regression dashboard for validator coverage gaps.

Missing Codex-native workflows:

- Harness next powered by current Codex runtime state.
- Runtime-card side-panel inspection.
- Goal reconciliation between Codex ThreadGoal and Harness goal boards.
- Review mode interop between Codex review items and Harness PR closeout.
- Tool exposure receipts from Codex tool planning.
- Permission/environment parity checks before proof claims.

## Codex-Native Integration Opportunities

Harness should feel like the thing Codex consults before it claims operational
truth. It should not feel like a separate wrapper. A Codex turn should naturally
ask Harness:

- What is the current work item?
- Which artifacts are active and current?
- Is this PR closeout claim supported by live evidence?
- Which verifier owns this blocker?
- Is my goal active, blocked, complete, or stale relative to project state?
- Which tool, permission, and environment posture produced this proof?
- What is the next safe action?

Operational assumptions Codex now makes:

- Work happens inside durable threads with resumable settings.
- Turns and items are identity-bearing runtime events.
- Goals are persisted runtime state with budget and continuation behavior.
- Permission profiles and environments are explicit, refreshable constraints.
- MCP and plugin attribution matters.
- Tools are planned and exposed according to mode, source, and feature gates.
- Review can be represented as a runtime mode.
- Background sessions, remote control, retries, compaction, and websocket
  recovery are normal runtime behavior.
- Searchable prior thread content is part of operational continuity.

To reduce steering:

- Turn repeated corrections into claim validators.
- Require runtime identity on evidence before closeout.
- Treat stale or missing live state as a blocker with owner and next action.
- Reconcile Codex goal state and Harness goal board state before completion.
- Make artifact freshness visible in Harness next.
- Classify recovery failures instead of retrying the wrong layer.

To reduce stale-state execution:

- Carry expectedTurnId, expectedHeadSha, expectedGoalUpdatedAt, and
  expectedArtifactVersion through queued actions.
- Expire queued actions when Codex thread settings, branch head, active plan, or
  PR review state changes.
- Make runtime cards name the evidence collection timestamp for every source.
- Treat old memory and old artifacts as orientation-only unless refreshed.

To improve artifact-centric workflows:

- Give artifacts lifecycle state and verifier receipts.
- Add artifact review surfaces that show claim eligibility.
- Require generated artifacts to cite source evidence and validation outcomes.
- Bind review comments and annotations to artifact ids.
- Use side-panel/browser inspection as evidence when visual or rendered output
  matters.

## Highest-Leverage Implementations

| Priority | What | Why | How | Where | Validation Method | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | CodexRuntimeState adapter | Gives Harness native Codex truth without scraping prose. | Ingest app-server, rollout-trace, hook, and SDK-shaped fixtures into codex-runtime-state/v1. | src/lib/runtime and runtime-card command. | Fixture tests for direct, degraded, missing, and stale packets. | Over-mirroring Codex internals. |
| P0 | RuntimeIdentity/v1 | Makes claims traceable across Codex, Harness, PRs, CI, Linear, and artifacts. | Add identity object to runtime cards, evidence bundles, verifier receipts, artifacts, and replay seeds. | src/lib/runtime, PR closeout, artifact spine. | Negative tests for missing/mismatched identities. | Unknown fields must not block all analysis. |
| P0 | Claim-vs-evidence verifier | Stops false success and stale closeout claims. | Compare ClaimIntent/v1 to current evidence refs and return allowed, downgraded, blocked, or unknown. | src/lib/runtime and src/commands/pr-closeout. | Fixtures for done, merge_ready, review_addressed, root_tidy, goal_complete. | Too broad if not claim-scoped. |
| P0 | Goal, permission, and environment parity | Codex now treats these as native runtime state. | Project ThreadGoal, activePermissionProfile, sandbox, approvalsReviewer, environments, and runtimeWorkspaceRoots into runtime-card. | Runtime adapter and Harness next. | Fixtures for paused, blocked, budget-limited, read-only, wrong environment. | Secret leakage if raw env is stored. |
| P1 | SteeringQueue/v1 | Prevents queued work from landing on stale turns or branches. | Store expectedTurnId, expectedHeadSha, expiry, mode, and merge policy. | Automation and next-action surfaces. | Replay stale turn, stale head, superseded artifact cases. | Avoid heavy scheduler behavior. |
| P1 | ArtifactRuntimeSurface/v1 | Makes artifacts inspectable runtime state. | Add ids, lifecycle, verifier refs, preview/open metadata, annotation refs, claim eligibility. | src/lib/issue-loop, artifact-routine, active artifacts. | Broken path, stale artifact, unverified generated artifact fixtures. | Large artifact storage creep. |
| P1 | ReviewLifecycle/v1 | Separates review truth from CI and local validation. | Normalize GitHub threads, review mode items, reviewer artifacts, response state, unresolved blockers. | PR closeout and review commands. | Fixtures for unresolved thread, stale review, missing reviewer artifact. | Connector or API drift. |
| P1 | RuntimeEventEnvelope/v1 plus OTel | Creates replayable, queryable operational evidence. | Emit low-cardinality spans for adapter ingestion, verifier verdicts, artifact verification, and closeout. | Runtime adapter, validators, collector bridge. | Span snapshot fixtures and blocked-runtime evals. | Noisy telemetry if attributes are unbounded. |
| P1 | ToolExposureReceipt/v1 | Tool availability is part of proof quality. | Consume Codex tool exposure planning and classify hidden, deferred, or blocked tools. | Runtime adapter and verifier receipts. | Fixture where validation was impossible because a tool was hidden. | Duplicating Codex registry. |
| P2 | ReplaySeed miner | Turns repeated steering into durable evals. | Search rollout/memory for repeated corrections and produce candidate replay seeds. | Evals and evidence-pattern workflow. | Deterministic replay cases generated from known steering failures. | Memory can be stale; require refresh before adoption. |
| P2 | Recovery handler registry | Stops code churn for external/runtime failures. | Classify auth recovery, overload, websocket disconnect, timeout, missing artifact, blocked runtime. | Runtime-card recovery events. | Fixtures for each recovery class and next owner. | Too many classes without action impact. |
| P2 | Codex-native Harness package/profile | Makes Harness reusable across projects. | Package stable validators, schemas, presets, and adapter config. | Future packaging surface. | Install smoke test in greenfield fixture. | Packaging unstable research too early. |

## Suggested Architecture Changes

New shared primitives:

- RuntimeIdentity/v1: project_root, codex_thread_id, codex_turn_id,
  codex_item_id, tool_call_id, plugin_id, mcp_server, subagent_id,
  subagent_type, trace_id, git_sha, git_branch, pr_number, linear_key,
  artifact_id, observed_at.
- RuntimeEventEnvelope/v1: schemaVersion, identity, source, eventType,
  observedAt, freshness, confidence, evidenceRef, payloadDigest, blockerClass,
  owner.
- ClaimIntent/v1: claimType, text, requestedScope, requiredEvidenceKinds,
  currentStateExpectation, sourceRefs.
- VerifierReceipt/v1: verifierId, claimId, status, reason, evidenceRefs,
  identity, verifiedAt, owner, nextAction.
- ArtifactRuntimeSurface/v1: artifactId, kind, pathOrUrl, producer, lifecycle,
  freshness, sourceRefs, verifierRefs, previewCommand, annotationRefs,
  claimEligibility.

Runtime-card evolution:

- liveState: Codex, GitHub, CI, Linear, filesystem, artifact, and memory state.
- evidenceState: sources, freshness, confidence, provenance, and evidence refs.
- governanceState: validators, blockers, claim eligibility, human authority.
- actionState: next safe action, retry posture, queue state, owner, expiry.

Trace schema evolution:

- Preserve codex_turn_id, attempt_id, auth_recovery_attempt, command_handle,
  approval_decision, permission_profile, environment_id, tool_source, plugin_id,
  subagent_id, artifact_id, verifier_id, claim_id, expected_head_sha, and
  expected_turn_id.

OTel improvements:

- Add low-cardinality spans for runtime adapter ingestion, runtime-card
  projection, verifier evaluation, claim downgrade, artifact verification, PR
  closeout evaluation, and replay seed creation.
- Avoid raw prompts, raw artifact bodies, secret-bearing environment values, and
  high-cardinality free text in span attributes.
- Put large detail in evidence artifacts and attach refs.

Verifier architecture:

- Model claims as ClaimIntent to RequiredEvidence to EvidenceRefs to
  RuntimeIdentity to VerifierReceipt.
- Support allow, downgrade, block, and unknown.
- Never silently coerce unknown runtime state into a pass.

Replay systems:

- Reconstruct claim text, runtime identity, git sha and branch, Codex runtime
  events, artifact refs, PR/CI/review state, Linear state, verifier output, and
  expected verdict.
- Replay success means the current Harness still reaches the expected verdict
  and owner classification.

Governance systems:

- Validator-owned: evidence registry shape, active artifact freshness, source
  refs, runtime identity consistency, claim/evidence sufficiency, PR closeout
  completeness, review thread status, stale queue preconditions, blocked runtime
  classification.
- Human-owned: product priority, merge approval, public release, data-risk
  acceptance, ambiguous architectural tradeoffs, irreversible external
  mutations.

## Anti-Patterns and Risks

Commit-summary theater: Listing recent Codex commits without extracting the
runtime philosophy misses the point. The useful signal is the shift toward
typed runtime state, identity, recovery, and governance.

Competing runtime layer: Harness should not rebuild Codex threads, goals, tool
registry, or app-server. It should consume and govern them.

Documentation as delivery: Specs, plans, research, and Markdown validation are
not implementation proof. They become authority only after adoption and
validator coverage.

File-exists evidence: A report existing on disk does not prove it is current,
inspected, verifier-backed, or claim-bound.

CI-green equals ready: CI status, local validation, PR mergeability, unresolved
review threads, Linear state, and artifact freshness are separate truth
surfaces.

Conversational-state reliance: Chat memory should not decide closeout, merge
readiness, or goal completion.

Noisy telemetry: High-cardinality prompt text, raw logs, raw env values, or
artifact bodies in traces will make observability expensive and unsafe.

Over-broad abstractions: A universal workflow engine would fight Codex. Harness
needs small, enforceable primitives with clear ownership.

Reviewer mailbox proof: Reviewer status messages are not artifact evidence.
Harness should verify expected reports exist, are non-empty, and cite current
evidence.

Hidden coupling: If Harness assumes private Codex internals instead of stable
schemas, events, hooks, and logs, upgrades will break the ecosystem.

Stale automation: Wake-ups and queued tasks without expectedTurnId,
expectedHeadSha, expiry, and evidence freshness will repeat stale-state
incidents.

Runtime silence as pass: Missing runtime events, degraded observability, or
failed collectors must produce blocked or unknown states, not green proof.

## Final Operational Roadmap

### Phase 1 - Runtime Truth And Verification

Objectives:

- Add CodexRuntimeState adapter fixtures.
- Add RuntimeIdentity/v1.
- Add ClaimIntent/v1 and VerifierReceipt/v1.
- Extend runtime-card projection with Codex thread, turn, goal, permission, and
  environment summaries.
- Preserve blocked_runtime as a first-class valid state.

Systems affected:

- Runtime card.
- Runtime evidence bundle.
- PR closeout.
- Evidence contract.
- Verifier cockpit plan.

Implementation priorities:

- P0 CodexRuntimeState adapter.
- P0 RuntimeIdentity/v1.
- P0 claim-vs-evidence verifier.
- P0 goal, permission, and environment parity.

Risks:

- Over-mirroring Codex protocol.
- Treating unknown runtime fields as fatal for all workflows.
- Leaking permission/environment details.

Validators:

- Positive and negative adapter fixtures.
- Runtime-card schema validation.
- Claim verifier fixtures for stale, missing, blocked, and mismatched evidence.
- PR closeout downgrade fixtures.

Success criteria:

- Harness can block a false done claim because Codex runtime evidence is stale,
  missing, read-only, blocked, or identity-mismatched.
- Runtime cards explain the owner and next safe action.

### Phase 2 - Telemetry And Replayability

Objectives:

- Introduce RuntimeEventEnvelope/v1.
- Emit Harness OTel spans for adapter ingestion, verifier decisions, artifact
  verification, claim downgrades, and replay seeds.
- Link Codex codex_turn_id to Harness verifier receipts.
- Add ReplaySeed/v1 and mine repeated steering patterns.

Systems affected:

- Runtime adapter.
- Collector bridge.
- Evals.
- Evidence-pattern registry.
- Runtime-card recovery events.

Implementation priorities:

- P1 RuntimeEventEnvelope/v1.
- P1 OTel span contract.
- P1 blocked runtime replay fixtures.
- P2 replay seed miner.

Risks:

- Telemetry noise.
- Memory-derived stale assumptions.
- Replay fixtures that do not map to real validators.

Validators:

- Span snapshot fixtures.
- Replay fixtures for auth recovery, missing artifact, stale PR head, review
  blocker, and degraded observability.
- Evidence-pattern validation requiring each adopted replay seed to name target
  surfaces.

Success criteria:

- A repeated human steering correction can become a deterministic replay case
  and then a validator or documented blocked reason.

### Phase 3 - Codex-Native Workflow Integration

Objectives:

- Reconcile Codex ThreadGoal state with Harness goal boards.
- Add SteeringQueue/v1 with expectedTurnId, expectedHeadSha, expiry, and merge
  policy.
- Ingest Codex review mode and side-thread state into review lifecycle.
- Add ToolExposureReceipt/v1.
- Add ContextProvenanceReceipt/v1.

Systems affected:

- Harness next.
- Goal boards.
- Automation and wake-up workflows.
- Review closeout.
- Tool invocation governance.

Implementation priorities:

- P0 goal parity.
- P1 steering queue.
- P1 review lifecycle.
- P1 tool exposure receipt.
- P2 context provenance.

Risks:

- Duplicating Codex scheduling.
- Overblocking useful analysis because some runtime fields are absent.
- Making queue UX heavy.

Validators:

- Stale queue replay.
- Goal paused, blocked, and complete mismatch fixtures.
- Review mode and unresolved thread fixtures.
- Tool unavailable proof fixture.

Success criteria:

- Queued work expires safely when the Codex turn, branch head, active artifact,
  or review state changes.

### Phase 4 - Governance And Review Automation

Objectives:

- Make PR closeout claim-vs-evidence driven.
- Require reviewer artifact receipts and classify missing artifacts.
- Separate CI, local validation, review, Linear, artifact, and runtime truth.
- Automate stale review and merge-readiness blockers.
- Keep human authority for merge and ambiguous product calls.

Systems affected:

- PR closeout.
- Review response flows.
- GitHub and CI integration.
- Linear integration.
- Artifact routine.

Implementation priorities:

- P0 closeout verifier.
- P1 ReviewLifecycle/v1.
- P1 ArtifactRuntimeSurface/v1.
- P2 recovery handler registry.

Risks:

- Review automation that responds before evidence is current.
- Treating bot review artifacts as authoritative without human-required
  checkpoints.
- Merge blockers that are hard to override when human judgment is needed.

Validators:

- Unresolved review thread fixture.
- Stale review after new push fixture.
- Missing reviewer artifact fixture.
- CI green but review blocked fixture.
- Linear stale or non-closeout state fixture.

Success criteria:

- Harness cannot produce a merge-ready claim unless PR, CI, review, Linear,
  artifact, runtime, and dirty-worktree evidence agree or are explicitly
  downgraded with owner and next action.

### Phase 5 - Unified Operational Ecosystem

Objectives:

- Package stable Harness primitives as a Codex-native operational profile.
- Provide greenfield and brownfield onboarding presets.
- Publish compatibility matrix for Codex schema versions and Harness adapter
  fields.
- Make runtime cards, verifier receipts, artifact surfaces, replay seeds, and
  evidence registry the shared ecosystem contract.

Systems affected:

- Harness CLI.
- Codex runtime integration.
- Project templates.
- CI setup.
- Skills and plugins.
- Documentation.

Implementation priorities:

- P2 packaged Harness profile.
- P2 compatibility matrix.
- P3 project onboarding presets.
- P3 ecosystem dashboard.

Risks:

- Freezing unstable research too early.
- Creating a heavyweight framework where a thin validator layer is enough.
- Cross-project coupling that makes brownfield adoption expensive.

Validators:

- Greenfield fixture install.
- Brownfield fixture install.
- Compatibility matrix fixture.
- End-to-end runtime-card to PR-closeout replay.

Success criteria:

- A new project can adopt Coding Harness as a Codex-native control plane without
  copying local repo lore, and Codex can naturally use Harness to know what is
  safe, current, blocked, or ready.

## Evidence Notes

Evidence used for this review included:

- Codex git history since 2026-05-19, filtered for meaningful operational
  changes rather than commit-summary output.
- Codex app-server README and v2 protocol files for thread, turn, item, goal,
  settings, permission, review, and MCP shapes.
- Codex core runtime files for input queue semantics, goal store behavior, and
  tool exposure planning.
- Codex hook event definitions for SubagentStart and SubagentStop attribution.
- Codex rollout and thread search implementation for operational memory and
  search direction.
- Coding Harness runtime-card, runtime-evidence-contract,
  runtime-evidence-bundle, artifact-spine, CLI reference, active-artifacts, and
  current Codex runtime evidence verifier cockpit plan/spec.
- Prior memory about blocked_runtime, false-success prevention, runtime proof,
  closeout truth, latest-head PR state, and previous Codex ecosystem alignment
  research. Memory was used as steering telemetry and was not treated as current
  live proof.

Validation status at creation:

- Research artifact is advisory until explicitly adopted.
- Evidence registry entry should remain deferred until a separate spec or
  implementation plan promotes specific recommendations.
- Command: pnpm exec markdownlint-cli2 ".harness/**/*.md" -> pass.
- Command: pnpm research:evidence:validate -> pass.
