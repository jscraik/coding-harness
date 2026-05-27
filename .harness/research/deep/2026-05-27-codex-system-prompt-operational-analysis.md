---
schema_version: 1
artifact_type: codex_system_prompt_operational_analysis
status: research
date: 2026-05-27
primary_source_repo: /Users/jamiecraik/dev/codex
primary_target_repo: /Users/jamiecraik/dev/coding-harness
authority: advisory_until_adopted
evidence_registry_id: 2026-05-27-codex-system-prompt-operational-analysis
---

# Codex System Prompt Operational Analysis

## Table of Contents

- [Executive Summary](#executive-summary)
- [System Prompt Operational Findings](#system-prompt-operational-findings)
- [Codex Operational Philosophy](#codex-operational-philosophy)
- [coding-harness Alignment Review](#coding-harness-alignment-review)
- [Codex-Native Integration Opportunities](#codex-native-integration-opportunities)
- [Hidden Golden Nuggets](#hidden-golden-nuggets)
- [Missing Systems In coding-harness](#missing-systems-in-coding-harness)
- [What NOT To Copy](#what-not-to-copy)
- [Highest-Leverage Implementations](#highest-leverage-implementations)
- [Final Operational Roadmap](#final-operational-roadmap)
- [Evidence Notes](#evidence-notes)

## Executive Summary

Codex's built-in prompting is not best understood as a static system prompt.
It is a runtime-composed operating contract. The base prompt establishes the
agent's working posture, but the actual behavior-shaping surface is assembled
per turn from model instructions, developer fragments, permission profile,
approval policy, collaboration mode, apps/plugins/skills, AGENTS/user
instructions, environment context, goal state, tool exposure, review mode,
guardian policy, compaction, realtime state, and extension contributors.

The strongest Codex operational pattern is layered authority with current-state
evidence. Codex separates base/model instructions, developer instructions,
contextual user instructions, environment facts, tools, and runtime policies.
It also repeatedly teaches the agent that current worktree/external/runtime
state beats conversation memory. That is the deepest alignment point for Coding
Harness: Harness should stop treating chat text, plan prose, and generated
artifacts as proof unless they are bound to fresh runtime receipts.

The biggest hidden assumption is that prompts are only one part of governance.
Tool availability, sandboxing, approvals, goals, hooks, agent routing, review
mode, and queue semantics are runtime primitives. Codex uses prompt text to
explain behavior, but it uses typed surfaces to constrain behavior. Coding
Harness should follow the same split: do not copy prompts mechanically; extract
their invariants into validators, receipts, runtime-card fields, and replayable
events.

Coding Harness already aligns well. It has runtime-card/v1,
runtime-evidence-contract/v1, delivery-truth composition, review-state
validation, active-artifact tracking, packet schema manifests, session-context
orientation, and evidence registry discipline. The current friction is not
philosophical. It is durability and binding: runtime cards can be generated but
are not always persisted as handoff artifacts; decision-request/v1 exists as
schema but is not yet emitted; session context is correctly orientation-only
but can be over-read unless closeout requires external-state snapshots.

The target operating stance is agent-native by default. Coding Harness should
let agents inspect, decide, act, validate, review, retry, and continue through
durable runtime contracts without routine human steering. HILT should be an
exception path for authority-bearing, irreversible, sensitive, externally
consequential, or genuinely ambiguous decisions where human judgment is the
source of truth.

Highest-leverage improvements:

- P0: Add PromptContextReceipt/v1 so Harness can record which Codex prompt
  layers and runtime instruction contributors shaped a run.
- P0: Make runtime-card/v1 durable by default for goal and closeout lanes.
- P0: Add GoalCompletionAuditReceipt/v1 that encodes Codex's evidence-first
  completion and strict blocked-state rules.
- P0: Add SteeringQueue/v1 for queued, deferred, rejected, interrupting, and
  non-steerable work.
- P0: Project Codex permission profile and tool exposure into runtime-card and
  runtime-evidence receipts.
- P1: Emit decision-request/v1 only at legitimate HILT boundaries such as
  approval escalation, ambiguity, destructive/shared-state risk, or human
  authority.
- P1: Promote ReviewLifecycle/v1 with selectable findings, artifact receipts,
  reviewer coverage, and explicit tool restrictions.
- P1: Add a guardian-style ActionReviewReceipt/v1 for high-risk Harness actions
  such as merge, release, destructive cleanup, and external tracker mutation.
- P2: Add replay packets that bind prompt context, runtime events, tool
  exposure, permissions, queue state, and evidence receipts.

The largest architectural risk is over-copying Codex. Harness should not become
a second Codex app-server, goal store, tool registry, approval system, or model
prompt pack. It should be the thin, strict operational layer around Codex: ingest
Codex-native state, normalize evidence, enforce governance, prevent stale-state
claims, and make handoffs replayable.

## System Prompt Operational Findings

### 1. Prompting Is Layered Runtime Assembly

WHAT: Codex resolves base instructions from config override, persisted
conversation/session metadata, or active model instructions, then assembles
developer and contextual user messages from permissions, collaboration mode,
realtime state, personality, apps, skills, plugins, extension fragments,
AGENTS/user instructions, and environment context.

WHY: This keeps model behavior adaptable without treating every source as equal
authority. Operational policy, capability listings, repository instructions,
runtime facts, and human requests remain distinguishable.

Behavioral implication: The agent learns what to do from multiple ranked
surfaces, not from a single monolithic prompt.

Orchestration implication: A change in permissions, tools, collaboration mode,
or environment can change the next turn without changing the base prompt.

Runtime-truth implication: Prompt context itself is runtime state and should be
receipt-backed when a run must be explained or replayed.

Governance implication: Harness should validate instruction provenance instead
of only validating output artifacts.

coding-harness adaptation opportunity: Add PromptContextReceipt/v1 with fields
for base prompt source, model slug, personality, developer fragments,
permission profile, approval policy, AGENTS paths, selected skills, apps/plugins,
environment context, and extension contributors.

### 2. AGENTS Instructions Are Scoped Context, Not Global Law

WHAT: Codex discovers project instructions separately and injects them as
contextual user content with explicit markers. The base prompt explains how
to interpret AGENTS hierarchy and scope.

WHY: Repository instructions are important, but they are still repo-local
context beneath system/developer/user-turn authority.

Behavioral implication: Agents should respect local rules while still resolving
conflicts according to instruction authority.

Orchestration implication: Work under different directories can legitimately
carry different instruction sets.

Runtime-truth implication: A claim that instructions were followed needs the
actual discovered instruction files and scope, not a memory of prior repo rules.

Governance implication: Harness should treat instruction discovery as evidence.

coding-harness adaptation opportunity: Runtime cards should record
instructionSources with path, scope root, freshness, conflict status, and
whether the source was applied, skipped, truncated, or superseded.

### 3. Permissions Are Prompted Runtime Policy

WHAT: Codex renders sandbox mode, approval policy, writable roots, network
policy, approved command prefixes, request-permission behavior, and approval
reviewer state into developer instructions.

WHY: The agent needs to reason about what it can do before it calls tools, but
the source of truth is the runtime permission profile.

Behavioral implication: The agent avoids impossible escalation paths and shapes
commands around the current execution envelope.

Orchestration implication: The same task can require different execution plans
under read-only, workspace-write, danger-full-access, or never-approval modes.

Runtime-truth implication: Permission state is part of any trustworthy delivery
claim. A green local result under degraded permissions may not prove the same
thing as a green result under full runtime access.

Governance implication: Harness should block claims that require permissions not
available during the run.

coding-harness adaptation opportunity: Extend RuntimeEvidenceResolvedState with
Codex-native permission details: sandbox mode, approval policy, approval
reviewer, writable roots, network posture, command prefix grants, and blocked
approval attempts.

### 4. Tool Exposure Is Governance, Not Convenience

WHAT: Codex builds tool specs per turn from model capabilities, shell backend,
MCP tools, deferred/discoverable tools, dynamic tools, extensions, goals,
permissions, apps, plugins, multi-agent features, and code-mode flags.

WHY: What the model can see and call is an explicit runtime decision.

Behavioral implication: The agent's strategy should depend on available tools,
not assumed tools.

Orchestration implication: Tool exposure changes create compatibility and replay
risk. A run that used deferred MCP tools or direct-model-only multi-agent tools
is not equivalent to a run without them.

Runtime-truth implication: Replaying or auditing a run requires the tool
registry, exposure class, namespaces, and hidden/deferred status.

Governance implication: Harness can detect false-success when a validator was
not actually exposed or a tool was hidden by the active mode.

coding-harness adaptation opportunity: Add ToolExposureReceipt/v1 with direct,
deferred, hidden, code-mode-only, direct-model-only, hosted, dynamic, MCP, and
extension tool classes plus reason for exposure.

### 5. Plans And Preambles Are Operator Interfaces

WHAT: The base prompt instructs the agent to send concise progress updates,
use plans for meaningful multi-step work, keep only one in-progress item, and
update progress as work completes.

WHY: Codex treats operator trust as part of the runtime. The human needs to know
what is happening before and during action, not only after completion.

Behavioral implication: Agents should show their next move and keep work
observable.

Orchestration implication: Progress state is separate from proof state. A plan
can orient work but cannot prove done.

Runtime-truth implication: Harness should not treat a plan item marked complete
as evidence unless it points to current receipts.

Governance implication: Claim validators should distinguish plan progress,
implementation evidence, validation evidence, review truth, and external state.

coding-harness adaptation opportunity: Keep plan/goal boards as orientation,
but require receipt references before a plan item can support delivery-truth.

### 6. Dirty Worktree Protection Is A Core Human-Work Boundary

WHAT: Codex instructions repeatedly forbid reverting user changes, require
working with unexpected changes, and reserve destructive git commands for
explicit user intent.

WHY: The runtime is shared with the human. Preserving unowned work is a safety
invariant, not a style preference.

Behavioral implication: Agents must inspect before editing and avoid
overwriting unrelated changes.

Orchestration implication: Worktree ownership and file-touch provenance should
shape task routing and closeout.

Runtime-truth implication: A dirty worktree may invalidate readiness claims even
when local tests pass.

Governance implication: Harness should enforce worktree ownership and dirty
state classification before merge-ready or closeout claims.

coding-harness adaptation opportunity: Add owned/unowned worktree
classifications to runtime-card sources and require closeout blockers for
unrelated dirty state when it affects readiness.

### 7. Goal Continuation Is Evidence-First Lifecycle Governance

WHAT: Codex goal continuation instructions define objectives as user-provided
data, require progress from current evidence, forbid narrowing the success
criteria, and only allow completion when every explicit requirement is proven.

WHY: Long-running autonomy needs a stricter done definition than a normal chat
turn.

Behavioral implication: Agents must audit completion instead of declaring
success from partial work.

Orchestration implication: A goal is a persistent lifecycle object with state,
budget, usage, continuation, resume, and blocked thresholds.

Runtime-truth implication: Goal state must reconcile with current repo, tests,
external systems, artifacts, and remaining requirements.

Governance implication: Harness should model goal completion as a verifier-owned
claim, not as a chat-level status.

coding-harness adaptation opportunity: Add GoalCompletionAuditReceipt/v1 with
objective hash, explicit requirements, evidence refs, current-state checks,
unproven requirements, blocked-turn count, budget posture, and verdict.

### 8. Blocked State Has A High Bar

WHAT: Codex only permits a goal to be marked blocked after the same blocking
condition recurs for at least three consecutive goal turns and meaningful
progress is impossible without external change.

WHY: This avoids premature blocked claims and prevents agents from converting
uncertainty into a terminal state.

Behavioral implication: Agents should continue meaningful work under uncertainty
and reserve blocked for true impasse.

Orchestration implication: Blockers need recurrence counters and attempted
fallbacks.

Runtime-truth implication: A blocked claim requires history, not just one
failure message.

Governance implication: Harness should reject one-turn blocked classifications
unless the action is inherently impossible or policy-forbidden.

coding-harness adaptation opportunity: Track blockedAudit in runtime cards:
condition id, first seen turn, consecutive count, fallback attempts, owner, and
whether the strict threshold is satisfied.

### 9. Steering And Queueing Are Separate Semantics

WHAT: Codex distinguishes active-turn injection, next-turn deferred input,
mailbox pending input, queued response items, followup tasks that trigger turns,
messages that only queue, rejected steers at end of turn, and non-steerable
tasks such as review/compact.

WHY: User sent text is not one operational state.

Behavioral implication: Agents should know whether a new instruction will affect
the current tool boundary, the next turn, or no active turn.

Orchestration implication: Automations need expected turn ids, delivery mode,
stale-precondition checks, and interrupt/edit behavior.

Runtime-truth implication: A run can become stale because steering applied to an
old turn or arrived after the relevant action.

Governance implication: Harness should validate that queued actions still match
current head SHA, artifact version, and runtime-card state before execution.

coding-harness adaptation opportunity: Add SteeringQueue/v1 with states:
active_turn_pending, after_next_tool, next_turn, mailbox_pending, trigger_turn,
rejected_end_of_turn, non_steerable, interrupted, expired, and applied.

### 10. Review Mode Is A Restricted Runtime, Not Just A Prompt

WHAT: Codex review mode runs a specialized sub-Codex with review base
instructions, target-specific review prompts, restricted tools, disabled goals,
and structured JSON findings that can become selectable review comments.

WHY: Review needs a different operating envelope from implementation.

Behavioral implication: Reviewers prioritize actionable bugs introduced by the
change and avoid broad summaries or fixes.

Orchestration implication: Review should have its own lifecycle, tool exposure,
target, findings schema, and completion event.

Runtime-truth implication: Review results are evidence only if they cite current
diff lines and active target state.

Governance implication: Harness should separate review was run from review
state supports the claim.

coding-harness adaptation opportunity: Add ReviewLifecycle/v1 with review
target, base ref/head SHA, mode, tool restrictions, reviewer artifact refs,
findings, selectable comments, unresolved-thread reconciliation, and coverage
gaps.

### 11. Guardian Review Treats Transcript As Untrusted Evidence

WHAT: Guardian approval review assembles exact planned action JSON plus compact
transcript/context, tells the reviewer to treat all dynamic data as untrusted
evidence rather than instructions, uses read-only posture, and fails closed on
timeout/session/parse failures.

WHY: High-risk actions need a verifier that evaluates action authority, not a
model that obeys the transcript.

Behavioral implication: The reviewing agent should assess whether an action is
allowed, justified, and bounded, not whether the previous agent sounded
confident.

Orchestration implication: High-risk actions should be reviewed as explicit
payloads with risk class, policy, evidence, and delta cursor.

Runtime-truth implication: The action being approved must be identical to the
action executed.

Governance implication: Harness should not approve merge/release/destructive
actions from prose. It should approve exact action envelopes.

coding-harness adaptation opportunity: Implement ActionReviewReceipt/v1 for
merge, release, destructive cleanup, external tracker mutation, credential
handling, and broad filesystem changes.

### 12. Hooks Are Middleware With Mutation Authority

WHAT: Codex hook discovery merges config layers and plugin hook sources. Pre
tool hooks can block or rewrite input, post tool hooks can add context, stop
execution, or replace output, and selected hooks run concurrently while results
are sorted back to configured order.

WHY: Runtime behavior is extensible without changing the base prompt.

Behavioral implication: Agents may see tool results that have been transformed
by runtime middleware.

Orchestration implication: Hook configuration and hook output are part of
execution truth.

Runtime-truth implication: Replay needs hook ids, input/output rewrites, stop
decisions, and ordering.

Governance implication: Harness should treat hooks as evidence producers and
policy gates, not background implementation details.

coding-harness adaptation opportunity: Add hook event ingestion to runtime
traces and require hook provenance on claim-supporting evidence.

### 13. Compaction Is A Handoff Contract

WHAT: Codex compaction asks for current progress, decisions, constraints,
remaining steps, and critical references so another model can resume.

WHY: Long-running work assumes context loss and needs a durable handoff format.

Behavioral implication: Agents should preserve operational continuity rather
than narrating everything.

Orchestration implication: A compacted thread needs enough identity and evidence
to continue safely.

Runtime-truth implication: Compaction is an orientation packet, not proof of
current state.

Governance implication: Harness should store compaction/handoff artifacts as
resume aids and require revalidation for current claims.

coding-harness adaptation opportunity: Align session-context/v1 and future
replay packets with Codex compact handoff fields while preserving the
orientation-vs-proof boundary.

### 14. Realtime Backend Prompt Assumes An Intermediary

WHAT: Codex realtime backend instructions treat the model as an executor behind
an intermediary, warn that transcript may be noisy, and bias toward concise
action only when backend work is needed.

WHY: Some Codex sessions are mediated by another UI/runtime surface rather than
direct terminal chat.

Behavioral implication: The agent should avoid unnecessary backend work and
latency.

Orchestration implication: There may be a difference between user-visible
conversation and backend execution state.

Runtime-truth implication: Realtime execution needs its own receipt fields:
intermediary, requested backend action, skipped/no-op reason, and latency/turn
state.

Governance implication: Harness should not assume every user-visible utterance
maps to a Harness action.

coding-harness adaptation opportunity: Add optional intermediaryExecution to
runtime cards and replay packets for Codex Desktop/browser/side-panel flows.

### 15. Final Answer Rules Are Handoff Semantics

WHAT: Codex final-answer guidance emphasizes concise outcome, changed files,
validation run, command outputs summarized for the user, and no overwhelming
dumps.

WHY: The user does not see tool output and needs the actionable result, not the
raw execution log.

Behavioral implication: The agent should summarize proof and blockers clearly.

Orchestration implication: Exact proof must live outside the final answer if it
will govern future work.

Runtime-truth implication: Final prose is a report. It is not a receipt unless
linked to artifacts, commands, and current state.

Governance implication: Harness should capture validation evidence in structured
artifacts instead of relying on final messages.

coding-harness adaptation opportunity: Require claim-supporting receipts for
final claims and keep final messages as human-readable summaries.

## Codex Operational Philosophy

Codex expects work to flow as:

1. Discover current instructions, environment, and state.
2. Build a runtime prompt/tool surface for the turn.
3. Plan only when the task is nontrivial.
4. Act with conservative scope and explicit human-work boundaries.
5. Validate against the relevant proof surface.
6. Summarize the result and remaining risk.
7. Preserve enough state for resume, review, compaction, or continuation.

Codex treats humans as steering partners, not queue appenders. Humans can steer
through direct messages, queued inputs, interrupt/edit actions, approvals,
review selections, goals, automations, app-server calls, and external surfaces.
Those steering paths have different runtime semantics, and Codex increasingly
models them as state. Harness should push ordinary steering into agent-native
receipts, validators, review lifecycle state, artifact inspection, and recovery
loops; human escalation should remain exceptional when authority truly belongs
to the human.

Codex treats runtime truth as fresher than conversation. Conversation and memory
help locate evidence, but current worktree state, current permission profile,
current external state, current tool exposure, current goal state, and current
artifact contents decide whether action is safe.

Codex treats verification as claim-specific. Narrow validation cannot prove a
broad delivery claim. Review findings must cite exact file/line evidence. Goal
completion requires all explicit requirements. Approval review evaluates an
exact action payload. Tool outputs and hook transformations belong to the proof
chain.

Codex treats continuity as a runtime problem. It has persistent thread state,
goal state, reference context, compaction prompts, session history, app-server
APIs, agent spawn edges, queued response items, and memory extensions. The
philosophy is not keep everything in context; it is preserve the minimum state
needed to resume safely.

Codex treats artifacts as operational surfaces when they can steer action:
review findings become selectable comments, tool results are response items,
goals are queryable, app-server schemas are generated, screenshots/files can be
viewed, and hooks can add context. The direction is artifact-as-runtime-surface,
not artifact-as-output-file.

Codex treats governance as layered and fail-closed when risk is high. Approval
policy, sandbox, guardian review, restricted review mode, tool exposure, hooks,
and non-steerable modes all reduce the agent's ability to invent authority in
chat.

## coding-harness Alignment Review

### Where coding-harness Aligns Well

Coding Harness is already close to the Codex philosophy in several important
ways:

- runtime-card/v1 models lifecycle, branch, PR, artifacts, Linear, phase-exit,
  sources, blockers, attempt ledger, and recovery events.
- runtime-evidence-contract/v1 ties declared intent, resolved runtime state,
  verifier result, claim-trace consistency, evaluation, and run-record outcome.
- Delivery-truth composition separates external state, review state, and
  PR-closeout sources before allowing merge_ready.
- Review-state validation checks reviewer artifacts, freshness, receipt support,
  and positive artifact size.
- session-context/v1 is an orientation packet rather than a proof surface.
- Evidence registry entries distinguish adopted, deferred, and planning-only
  research.
- Active-artifact and goal-board routines reflect the same state over prose
  doctrine that Codex now encodes in goals and runtime events.

### Where coding-harness Fights Codex

The main fight is not feature mismatch. It is parallel truth.

Harness can maintain rich artifacts that are not always bound to Codex's active
thread, turn, prompt context, permission profile, tool exposure, or queue state.
That makes the Harness feel external even when its policy is correct. A Codex
agent must still ask: Which turn was this artifact from? Which tools existed?
Was the runtime card current? Did review run against this head SHA? Did the user
steering apply before or after the relevant tool call?

The second fight is durability. The CLI can generate a runtime card, but the
current Harness explorer found no persisted runtime-card artifact in allow-listed
paths for the active checkout. That means the next agent sees missing runtime
state even though a command can produce it.

The third fight is decision emission. decision-request/v1 exists as a schema,
but it is not yet an emitted packet in the observed manifest. Codex has multiple
human-in-the-loop surfaces; Harness needs durable decision requests so approval
and ambiguity do not live only in chat.

### Where coding-harness Duplicates Codex Unnecessarily

Harness should avoid duplicating:

- General coding-agent prompt behavior such as using plans, giving concise
  updates, preferring rg, and protecting dirty worktrees.
- Codex's tool registry, app-server, goal store, agent scheduler, or permission
  engine.
- Review prompt wording and reviewer persona logic when the durable principle is
  structured, diff-grounded, severity-ranked, current-target findings.
- The Codex memory subsystem when Harness only needs orientation, provenance,
  and replay references.
- Codex approval prompt wording when Harness needs exact action envelopes and
  policy verdicts.

### What coding-harness Is Missing

Harness lacks the following Codex-native primitives:

- Prompt-layer provenance for runs.
- Tool-exposure receipts.
- Durable permission-profile projection beyond a coarse permission enum.
- Steering queue semantics.
- Goal completion audit receipts.
- Emitted decision requests.
- Guardian-style exact-action review.
- Review lifecycle packets with selectable findings and tool restrictions.
- Hook provenance in replay/evidence.
- Durable runtime-card persistence as standard handoff practice.
- Replay packets that bind prompt context to runtime events and evidence
  receipts.

### What Should Remain Independent

Harness should remain independent for:

- PR merge readiness and closeout governance.
- Cross-project evidence normalization.
- Linear/GitHub/CI reconciliation.
- Delivery-truth verdicts.
- Evidence registry adoption decisions.
- Long-lived project memory and implementation-note governance.
- Policy for what counts as production-ready in Jamie's ecosystem.

Codex should execute; Harness should govern claims.

## Codex-Native Integration Opportunities

### P0: PromptContextReceipt/v1

WHAT: A durable receipt that records the instruction and context surfaces used
for a Harness-governed Codex run.

WHY: Codex behavior is shaped by layered prompt/runtime context. Without a
receipt, replay and blame collapse into the agent said so.

HOW: Emit a JSON packet from session-context, runtime-card, or a new
codex-context command. Include model slug, base instruction source, developer
fragments, contextual user sources, AGENTS paths, selected skills, apps/plugins,
permission profile, approval policy, collaboration mode, environment context,
goal id, and tool exposure receipt id.

Operational impact: Makes agent behavior explainable and replayable.

Implementation priority: P0.

Validation strategy: Schema validator plus fixture tests for missing AGENTS,
changed permissions, selected skills, disabled tools, and model switch.

Risk/tradeoff: Do not store full prompt text by default. Store provenance,
hashes, and source references unless a debug mode explicitly captures text.

### P0: Durable Runtime-Card Handoff

WHAT: Persist generated runtime-card and evidence-bundle artifacts by default
for goal/closeout lanes.

WHY: Codex expects current state to be inspectable by future turns. A command
that can generate state is weaker than a durable handoff artifact.

HOW: Add default output behavior or goal-lane integration that writes
.harness/runtime/ISSUE_OR_BRANCH/runtime-card.json and a paired evidence bundle.
Update session-context to discover the path.

Operational impact: Reduces stale-state restarts and repeated human steering.

Implementation priority: P0.

Validation strategy: CLI fixture where runtime-card generation causes
session-context to report one current runtime card.

Risk/tradeoff: Avoid writing stale cards silently. Include expiry, source
freshness, and head SHA.

### P0: GoalCompletionAuditReceipt/v1

WHAT: A verifier-owned receipt for goal completion and blocked-state claims.

WHY: Codex goal continuation has a strict completion audit and blocked audit.
Harness goal boards should share that discipline.

HOW: Derive from goal objective, explicit requirements, current runtime card,
external-state snapshot, review state, validation receipts, and unproven items.
Store verdict: complete, not_complete, blocked_threshold_met,
blocked_threshold_not_met, or needs_human.

Operational impact: Prevents false goal completion and premature blocked claims.

Implementation priority: P0.

Validation strategy: Fixtures for partial validation, stale PR state,
one-turn blocker, three-turn repeated blocker, and broad goal with narrow test.

Risk/tradeoff: Must tolerate analysis-only tasks where no implementation proof
is expected.

### P0: SteeringQueue/v1

WHAT: A queue-state packet for pending, deferred, applied, rejected,
interrupting, and non-steerable instructions.

WHY: Codex distinguishes send_message, followup_task, active-turn input, mailbox
pending, next-turn items, and non-steerable review/compact modes.

HOW: Add queue receipts with expected turn id, head SHA, artifact version,
delivery mode, expiry, stale-precondition check, trigger behavior, and applied
turn id.

Operational impact: Prevents stale automation, review responses against old
state, and human steering that silently lands after the relevant action.

Implementation priority: P0.

Validation strategy: Unit tests for queued vs trigger-turn semantics and stale
head/artifact rejection.

Risk/tradeoff: Keep the state model small enough to use during normal work.

### P0: Permission and Tool Exposure Projection

WHAT: Project Codex permission and tool surface into runtime-card and evidence
contracts.

WHY: Claims depend on what the agent was allowed and able to do.

HOW: Extend runtime-card codexRuntime with permission profile, approval policy,
sandbox, network posture, tool counts by exposure class, key tool names,
deferred/hidden tool availability, and blocked permission attempts.

Operational impact: Makes degraded runs visible and catches false proof.

Implementation priority: P0.

Validation strategy: Fixture cards for read-only, no-approval, disabled shell,
missing goal tools, hidden MCP, and deferred tools.

Risk/tradeoff: Do not require exact upstream Codex type parity; normalize only
governance-relevant fields.

### P1: decision-request/v1 Emission

WHAT: Emit durable decision request packets only when agent-native execution
reaches a legitimate HILT boundary.

WHY: Codex has approval, elicitation, and interrupt surfaces. Harness needs the
decision itself to be traceable outside chat, but ordinary workflow continuity
should be owned by agents, validators, receipts, and runtime state.

HOW: Wire decision-request/v1 into next, policy-gate, closeout, and high-risk
action flows. Include action envelope, risk class, evidence refs, suggested
options, default-safe action, expiry, required authority, and explicit reason
why agent-native execution cannot safely continue.

Operational impact: Keeps HILT rare, explicit, and auditable while preventing
agents from offloading ordinary uncertainty to the user.

Implementation priority: P1.

Validation strategy: Tests for destructive action, ambiguous tracker state,
external service blocker, merge decision, and policy-gated action.

Risk/tradeoff: The validator should reject weak decision requests such as
routine continuation, obvious validation, normal live-state refresh, or fixes
that a runtime receipt can safely govern.

Risk/tradeoff: Avoid turning every uncertainty into a decision request. Use only
for authority or irreducible ambiguity.

### P1: ReviewLifecycle/v1

WHAT: A Codex-native review lifecycle packet for review targets, reviewers,
tool restrictions, artifacts, findings, and resolution state.

WHY: Codex review mode is structured, restricted, and selectable. Harness review
truth should inherit that shape.

HOW: Record review target, base/head, mode, reviewer role, tool exposure,
artifact path, findings count, selectable comments, unresolved threads,
coverage gaps, and verdict.

Operational impact: Improves review convergence and prevents review ran from
being confused with review supports merge.

Implementation priority: P1.

Validation strategy: Fixture with missing artifact, stale head SHA, empty
finding file, unresolved review thread, and valid no-findings review.

Risk/tradeoff: Review lifecycle should compose existing review-state/v1, not
replace it wholesale.

### P1: ActionReviewReceipt/v1

WHAT: A guardian-style receipt for exact high-risk Harness actions.

WHY: Codex Guardian shows the durable principle: review exact action JSON, treat
transcript as untrusted evidence, fail closed.

HOW: Before merge/release/destructive cleanup/external tracker mutation, create
an action envelope and require policy verdict from validator or human.

Operational impact: Reduces accidental authority escalation.

Implementation priority: P1.

Validation strategy: Golden fixtures for allow/block verdicts and mismatch
between approved action and executed action.

Risk/tradeoff: Keep scope to high-risk actions. Do not add ceremony to safe
read-only orientation.

### P1: ArtifactRuntimeSurface/v1

WHAT: Treat artifacts as inspectable state with lifecycle, annotations,
rendering, reviewer links, and steering state.

WHY: Codex is moving toward artifact-as-runtime-surface: review comments,
browser surfaces, files, images, and generated schemas drive action.

HOW: Extend artifact references with render state, inspection state, annotation
links, verifier receipt ids, stale warning, owning workflow, and next action.

Operational impact: Reduces artifact friction and review ambiguity.

Implementation priority: P1.

Validation strategy: Fixtures for missing render, stale projection, reviewed
source vs generated projection, and annotation resolution.

Risk/tradeoff: Avoid making every file an artifact. Only promote artifacts that
steer execution or claims.

### P2: ReplayPacket/v1

WHAT: A replayable packet binding prompt context, runtime events, queue state,
tool exposure, permissions, artifacts, and evidence receipts.

WHY: Codex has runtime events, compaction, hooks, and app-server state; Harness
needs a minimal replay substrate for diagnosis and evals.

HOW: Emit JSONL with RuntimeIdentity/v1, prompt receipt id, runtime-card id,
tool events, hook events, queue decisions, validator outputs, and final claims.

Operational impact: Converts repeated steering, failures, and review churn into
eval seeds.

Implementation priority: P2.

Validation strategy: Replay fixture that reconstructs why a merge-ready claim
was blocked.

Risk/tradeoff: Keep replay minimal; do not store secrets or full transcripts by
default.

## Hidden Golden Nuggets

- Objective text is data, not higher-priority instruction. Harness should hash
  and audit objectives instead of letting goal prose override policy.
- Current state beats conversation. Memory and prior artifacts orient; they do
  not prove.
- Tool exposure is a contract. Missing tools should be visible as degraded
  runtime, not inferred from agent behavior.
- Approval command segmentation matters. Policies should reason about compound
  commands, subshells, and chained actions rather than only the full string.
- Prior review results are context, not precedent. A later exact action can be
  approved if the user gives explicit authority and policy allows it.
- Review mode disables capabilities that could widen scope. Harness reviewer
  roles should declare tool limits.
- wait_agent reports mailbox status, not content. This protects the boundary
  between liveness and evidence.
- Compaction is continuity, not correctness. A compact summary is a resume aid,
  never a done proof.
- Stable path-addressed agents make delegation auditable. Harness should keep
  subagent ids and role/type separate from display names.
- Hook outputs can rewrite execution. Any governance replay that ignores hooks
  is incomplete.
- Non-steerable modes are a first-class queue state. Review and compact should
  not silently absorb normal steering.
- Realtime backend prompts imply mediated execution. Harness should distinguish
  operator-facing conversation from backend action.
- Generated schemas and manifests are governance surfaces. Harness should keep
  packet schema parity validators close to runtime emitters.
- Warning/pass drift is dangerous. A high-risk warning that still passes is an
  architectural mismatch when the policy floor says human authority is needed.

## Missing Systems In coding-harness

| Missing System | Severity | Priority | Suggested Architecture | Validation Method |
| --- | --- | --- | --- | --- |
| PromptContextReceipt/v1 | Critical | P0 | Packet with prompt-layer provenance, source refs, hashes, permission/tool/goal context, and selected capability surfaces. | Schema validator plus fixtures for model switch, permission change, missing AGENTS, selected skill, disabled tool. |
| Durable runtime-card persistence | Critical | P0 | Default write path for runtime-card and evidence bundle in goal/closeout lanes, discovered by session-context. | CLI test where persisted card removes runtime_card missing stale-state warning. |
| GoalCompletionAuditReceipt/v1 | Critical | P0 | Verifier-owned goal audit with objective hash, requirement matrix, evidence refs, blocked-turn count, and verdict. | Fixtures for complete, partial, stale, one-turn blocker, three-turn blocker. |
| SteeringQueue/v1 | Critical | P0 | Queue packet with expected turn/head/artifact ids, delivery mode, expiry, stale checks, and applied/rejected state. | Unit tests for queue vs trigger-turn vs non-steerable modes. |
| Permission/tool exposure receipts | High | P0 | Normalize sandbox, approval, network, reviewer, writable roots, tool names, exposure classes, hidden/deferred counts. | Runtime-card validation fixtures for degraded and full tool environments. |
| decision-request/v1 emission | High | P1 | Emit existing schema from policy/next/closeout actions requiring authority or judgment. | Tests for destructive, merge, ambiguous, external blocker, and no-op cases. |
| ReviewLifecycle/v1 | High | P1 | Compose review-state with target, base/head, reviewer, tool limits, artifacts, findings, selectable comments, coverage gaps. | Fixture validator for stale target, missing artifact, blocked reviewer, valid no-finding review. |
| ActionReviewReceipt/v1 | High | P1 | Guardian-style exact action envelope, policy verdict, evidence refs, and executed-action match check. | Golden allow/block/mismatch fixtures. |
| Hook provenance in replay | Medium | P2 | Include hook source, event, input rewrite, block/stop decision, output replacement, and ordering in replay packet. | Replay test where hook rewrite explains final result. |
| Artifact runtime surface | Medium | P1 | Artifact refs with render/inspection/annotation/verifier/stale state and owning workflow. | Fixtures for stale projection and reviewed-source mismatch. |
| Prompt/context drift validator | Medium | P2 | Compare initial context surfaces against update/resume paths and flag uncovered contributors. | Static validator over configured contributors and packet schema. |
| Realtime/intermediary receipt | Low | P3 | Optional fields for backend/intermediary execution and no-op backend decisions. | Fixture for mediated action vs skipped backend work. |

## What NOT To Copy

- Do not copy Codex prompt text into Harness as policy. Extract invariants and
  enforce them as validators or receipt schemas.
- Do not build a second Codex app-server. Use Codex APIs and runtime events as
  producers; let Harness normalize and govern.
- Do not mirror Codex's complete goal store. Harness needs reconciliation and
  completion audits, not duplicate scheduling internals.
- Do not reimplement the Codex tool registry. Capture tool exposure relevant to
  governance and replay.
- Do not use AGENTS discovery as a universal policy system outside scoped repo
  work. Harness should track scope and conflict, not flatten authority.
- Do not make every artifact a runtime surface. Promote only artifacts that
  steer work, verify claims, or carry review/governance state.
- Do not make every uncertainty a decision request. Reserve decision packets for
  authority, policy, irreversible action, or irreducible ambiguity.
- Do not normalize HILT as the default control path. A human checkpoint is an
  exceptional authority boundary, not a replacement for missing runtime truth,
  weak validators, poor artifact inspection, or incomplete replay state.
- Do not copy OpenAI-internal feature flags as Harness roadmap items. Import the
  operational principle only when it reduces stale state or steering.
- Do not rely on final answer prose as evidence. Store receipts and cite them.
- Do not turn Harness into a broader automation scheduler competing with Codex
  goals and queues.
- Do not make prompt capture secret-heavy. Prefer hashes, source refs, and
  provenance over full prompt bodies by default.
- Do not require live external refresh for orientation-only packets. Require it
  only when the claim depends on external truth.

## Highest-Leverage Implementations

| Priority | WHAT | WHY | HOW | Validation Method | Risk |
| --- | --- | --- | --- | --- | --- |
| P0 | PromptContextReceipt/v1 | Makes Codex prompt/runtime shaping replayable and auditable. | Emit source refs, hashes, permission/tool/goal/context contributors. | Schema and fixture tests for changed surfaces. | Capturing too much prompt text or secrets. |
| P0 | Durable runtime-card handoff | Removes repeated where is current state steering. | Default persisted card/evidence path for goal and closeout lanes. | session-context sees current card after generation. | Stale cards becoming false proof. |
| P0 | GoalCompletionAuditReceipt/v1 | Aligns Harness goal boards with Codex's strict completion semantics. | Requirement matrix plus current evidence and blocked audit. | Partial/stale/blocked/complete fixtures. | Too much ceremony for small analysis tasks. |
| P0 | SteeringQueue/v1 | Prevents stale instructions landing on old turns or artifacts. | Expected ids, delivery mode, expiry, applied/rejected state. | Queue, trigger-turn, interrupt, non-steerable tests. | Overbuilding scheduler behavior. |
| P0 | Permission/tool exposure projection | Explains what the agent could and could not prove. | Add normalized permission and tool fields to runtime-card/evidence. | Degraded-permission and hidden-tool fixtures. | Chasing Codex internals rather than normalized fields. |
| P1 | decision-request/v1 emission | Makes exceptional HILT boundaries durable without making them routine. | Emit only on authority/judgment gates with exact action, options, and agent-native stop reason. | Policy-gate and closeout fixtures. | Prompting for decisions too often or using HILT to mask missing validators. |
| P1 | ReviewLifecycle/v1 | Makes review mode artifact-native and claim-safe. | Compose review target, artifacts, findings, tool limits, coverage. | Missing/stale/valid review fixtures. | Duplicating existing review-state instead of composing. |
| P1 | ActionReviewReceipt/v1 | Imports Guardian's strongest safety idea without copying internals. | Exact action envelope, untrusted context, verdict, execution match. | Allow/block/mismatch golden tests. | Excess friction if used beyond high-risk actions. |
| P1 | ArtifactRuntimeSurface/v1 | Moves artifacts from output files to inspectable workflow state. | Render, inspect, annotation, verifier, stale, owner fields. | Stale projection and annotation fixtures. | Promoting low-value files into governance clutter. |
| P2 | ReplayPacket/v1 | Converts failures and steering corrections into eval seeds. | Bind prompt context, runtime events, hooks, queue, receipts. | Replay why a false claim was blocked. | Telemetry noise or sensitive transcript capture. |
| P2 | Prompt/context drift validator | Catches missing update/resume coverage when context surfaces change. | Compare initial contributors to update/resume packet coverage. | Static validator fixtures. | False positives during upstream Codex changes. |
| P3 | Realtime/intermediary receipt | Supports Desktop/browser mediated execution. | Optional mediated backend action/no-op fields. | Mediated action fixture. | Low immediate value outside realtime lanes. |

## Final Operational Roadmap

### Phase 1 - Runtime Truth Alignment

Objectives:

- Make Codex prompt/runtime shaping visible to Harness.
- Make runtime-card state durable by default.
- Separate orientation packets from claim-supporting proof.

Systems affected:

- runtime-card/v1
- runtime-evidence-contract/v1
- session-context/v1
- Evidence registry
- Packet schema manifest

Implementation priorities:

- P0 PromptContextReceipt/v1.
- P0 durable runtime-card/evidence-bundle persistence.
- P0 permission/tool exposure projection.
- P0 external-state snapshot requirement for closeout claims.

Risks:

- Storing too much prompt text.
- Stale runtime cards being treated as proof.
- Overfitting to upstream Codex internals.

Validators:

- Packet schema validator.
- Runtime-card discovery fixture.
- Permission/tool exposure fixture.
- External-state claim-support validator.

Success criteria:

- A resumed Codex agent can inspect one durable packet and know which prompt,
  permissions, tools, current state, and evidence governed the last run.
- Merge-ready and goal-complete claims cannot pass from orientation-only state.

### Phase 2 - Steering and Workflow Integration

Objectives:

- Represent Codex-style queued, deferred, rejected, interrupting, and
  non-steerable work.
- Prevent automation from acting on stale turn/head/artifact state.

Systems affected:

- New SteeringQueue/v1
- Automations
- Runtime cards
- Goal boards
- Session context

Implementation priorities:

- P0 queue packet with expected turn id, head SHA, artifact version, and expiry.
- P0 stale-precondition validation before applying queued work.
- P1 decision-request emission for exceptional HILT authority checkpoints.

Risks:

- Accidentally building a parallel scheduler.
- Making normal steering too heavy.

Validators:

- Queue-state unit tests.
- Stale head/artifact rejection tests.
- Non-steerable review/compact fixtures.

Success criteria:

- Harness can explain whether a steering input applies now, next turn, after a
  tool boundary, or not at all.
- Queued automation fails closed when expected runtime state changed.
- Ordinary workflow continuation is handled by agent-native receipts and
  validators rather than by asking the human to restate obvious next steps.

### Phase 3 - Artifact and Review Workflows

Objectives:

- Make review and artifact state Codex-native.
- Treat artifacts as inspectable runtime surfaces when they steer action.

Systems affected:

- review-state/v1
- New ReviewLifecycle/v1
- New ArtifactRuntimeSurface/v1
- Active artifacts
- Implementation notes
- External-state snapshots

Implementation priorities:

- P1 review lifecycle packet.
- P1 selectable finding and reviewer coverage support.
- P1 artifact render/inspection/annotation/stale fields.

Risks:

- Duplicating existing review-state implementation.
- Promoting too many artifacts into governance.

Validators:

- Missing/empty/stale reviewer artifact validator.
- Stale projection vs reviewed source validator.
- Annotation resolution fixture.

Success criteria:

- Review truth is tied to current target, reviewer artifact, finding selection,
  and unresolved-thread state.
- Artifact handoff distinguishes file existence from inspected, current,
  claim-supporting runtime surface.

### Phase 4 - Replayability and Operational Memory

Objectives:

- Convert repeated steering, failures, and governance blocks into replayable
  evidence and eval seeds.
- Preserve memory as orientation, not proof.

Systems affected:

- New ReplayPacket/v1
- PromptContextReceipt/v1
- Hook event ingestion
- Evidence registry
- Harness evals
- Local memory/implementation notes

Implementation priorities:

- P2 replay JSONL for significant Harness runs.
- P2 hook provenance and queue decisions in replay.
- P2 prompt/context drift validator.
- P2 false-success replay fixtures.

Risks:

- Telemetry noise.
- Sensitive data capture.
- Replay schema churn.

Validators:

- Replay reconstruction test for blocked false-success claim.
- Redaction checks.
- Evidence registry adoption validator.

Success criteria:

- A failed or blocked run can be replayed enough to explain which claim failed,
  which evidence was missing/stale, and what validator should be added.

### Phase 5 - Fully Codex-Native Harness Integration

Objectives:

- Make Coding Harness feel like a first-class operational extension around
  Codex rather than an external wrapper.
- Keep Codex as execution runtime and Harness as governance/control plane.

Systems affected:

- Runtime adapter
- App-server integration
- Runtime cards
- Review lifecycle
- Decision requests
- Artifact surfaces
- Replay/evals
- Goal reconciliation

Implementation priorities:

- Codex app-server/runtime adapter for thread, turn, item, goal, review,
  permission, tool, hook, and queue state.
- Harness-native command/profile that emits Codex-compatible receipts by
  default.
- Side-panel/browser inspection surfaces for runtime cards, decision requests,
  review findings, and artifacts.
- Compatibility matrix for Codex version, packet schema, and Harness validators.

Risks:

- Over-coupling Harness to Codex internals.
- Recreating Codex features instead of governing them.
- Making the control plane too complex for normal work.

Validators:

- End-to-end Codex run producing runtime card, prompt context receipt,
  steering queue receipt, review lifecycle receipt, external-state snapshot,
  and delivery-truth verdict.
- Contract tests across Codex version changes.
- Closeout audit that distinguishes local validation, CI, review, tracker,
  artifact, memory, and merge truth.

Success criteria:

- Codex can naturally use Harness because Harness consumes Codex-native state
  and returns concise, strict, claim-specific operational truth.
- Human steering drops because repeated corrections become receipts,
  validators, and stale-state blockers.
- Harness remains thin: it governs claims and workflows without competing with
  Codex's runtime engine.

## Evidence Notes

Primary Codex evidence surfaces inspected:

- /Users/jamiecraik/dev/codex/codex-rs/protocol/src/prompts/base_instructions/default.md
- /Users/jamiecraik/dev/codex/codex-rs/models-manager/prompt.md
- /Users/jamiecraik/dev/codex/codex-rs/core/prompt_with_apply_patch_instructions.md
- /Users/jamiecraik/dev/codex/codex-rs/core/review_prompt.md
- /Users/jamiecraik/dev/codex/codex-rs/core/templates/compact/prompt.md
- /Users/jamiecraik/dev/codex/codex-rs/core/templates/realtime/backend_prompt.md
- /Users/jamiecraik/dev/codex/codex-rs/core/templates/goals/continuation.md
- /Users/jamiecraik/dev/codex/codex-rs/core/src/session/mod.rs
- /Users/jamiecraik/dev/codex/codex-rs/core/src/session/input_queue.rs
- /Users/jamiecraik/dev/codex/codex-rs/core/src/session/review.rs
- /Users/jamiecraik/dev/codex/codex-rs/core/src/tasks/review.rs
- /Users/jamiecraik/dev/codex/codex-rs/core/src/tools/spec_plan.rs
- /Users/jamiecraik/dev/codex/codex-rs/core/src/guardian/prompt.rs
- /Users/jamiecraik/dev/codex/codex-rs/core/src/goals.rs
- /Users/jamiecraik/dev/codex/codex-rs/hooks/src/engine/dispatcher.rs
- /Users/jamiecraik/dev/codex/codex-rs/app-server-protocol/src/protocol/v2/thread.rs

Primary Coding Harness evidence surfaces inspected:

- /Users/jamiecraik/dev/coding-harness/AGENTS.md
- /Users/jamiecraik/dev/coding-harness/CODESTYLE.md
- /Users/jamiecraik/dev/coding-harness/src/lib/runtime/runtime-card.ts
- /Users/jamiecraik/dev/coding-harness/src/lib/runtime/runtime-evidence-contract.ts
- /Users/jamiecraik/dev/coding-harness/src/lib/runtime/local-runtime-card.ts
- /Users/jamiecraik/dev/coding-harness/src/lib/runtime/local-runtime-card-live.ts
- /Users/jamiecraik/dev/coding-harness/src/lib/session-context/types.ts
- /Users/jamiecraik/dev/coding-harness/src/lib/session-context/collector.ts
- /Users/jamiecraik/dev/coding-harness/src/lib/review-state/validation.ts
- /Users/jamiecraik/dev/coding-harness/src/lib/delivery-truth/composition.ts
- /Users/jamiecraik/dev/coding-harness/contracts/runtime-packet-schemas.manifest.json
- /Users/jamiecraik/dev/coding-harness/.harness/active-artifacts.md
- /Users/jamiecraik/dev/coding-harness/.harness/research/deep/2026-05-26-codex-ecosystem-operational-review.md

Validation run:

- Command: zsh -lc 'pnpm exec markdownlint-cli2 ".harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md" ".harness/research/deep/2026-05-26-codex-ecosystem-operational-review.md"' -> pass.
- Command: zsh -lc 'pnpm research:evidence:validate' -> pass.
