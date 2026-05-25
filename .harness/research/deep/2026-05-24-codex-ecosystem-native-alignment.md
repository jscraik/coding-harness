# Codex Ecosystem-Native Alignment Review

Generated: 2026-05-24

Evidence window: meaningful Codex changes from 2026-05-17 through
2026-05-24, read for operational direction rather than changelog value.

Authority posture:

- This is a deep research artifact for Coding Harness.
- It is secondary context until promoted through
  `.harness/research/evidence-patterns.json`, a decision record, a spec, or a
  validator-backed implementation plan.
- Recommendations below are integration candidates, not current Coding Harness
  policy.

Primary local evidence surfaces:

- `/Users/jamiecraik/dev/codex`
- `/Users/jamiecraik/dev/coding-harness`
- `/Users/jamiecraik/dev/codex/codex-rs/app-server/README.md`
- `/Users/jamiecraik/dev/codex/codex-rs/app-server-protocol/src/protocol/v2/thread.rs`
- `/Users/jamiecraik/dev/codex/codex-rs/app-server-protocol/src/protocol/v2/item.rs`
- `/Users/jamiecraik/dev/codex/codex-rs/app-server-protocol/src/protocol/v2/mcp.rs`
- `/Users/jamiecraik/dev/codex/codex-rs/core/src/session/input_queue.rs`
- `/Users/jamiecraik/dev/codex/codex-rs/core/src/tools/spec_plan.rs`
- `/Users/jamiecraik/dev/codex/codex-rs/core/src/goals.rs`
- `/Users/jamiecraik/dev/codex/codex-rs/ext/goal/src/steering.rs`
- `/Users/jamiecraik/dev/codex/codex-rs/hooks/src/events/common.rs`
- `/Users/jamiecraik/dev/codex/codex-rs/thread-store/src/local/search_threads.rs`
- `/Users/jamiecraik/dev/codex/codex-rs/rollout/src/search.rs`
- `/Users/jamiecraik/dev/codex/codex-rs/tui/src/slash_command.rs`
- `/Users/jamiecraik/dev/coding-harness/src/lib/runtime/runtime-card.ts`
- `/Users/jamiecraik/dev/coding-harness/src/lib/runtime/runtime-evidence-contract.ts`
- `/Users/jamiecraik/dev/coding-harness/src/lib/runtime/runtime-evidence-bundle.ts`
- `/Users/jamiecraik/dev/coding-harness/src/lib/issue-loop/artifact-spine.ts`
- `/Users/jamiecraik/dev/coding-harness/docs/cli-reference.md`
- `/Users/jamiecraik/dev/coding-harness/.harness/active-artifacts.md`

## Executive Summary

Codex is evolving into a stateful operational runtime, not just a CLI that
streams model output. The strongest direction in the last seven days is toward
typed thread state, app-server-mediated workflow control, native goals, explicit
permission and environment profiles, runtime-visible tool exposure plans,
extension lifecycle events, side-thread and review modes, durable thread search,
and identity-bearing tool, MCP, plugin, and subagent events.

Coding Harness already aligns with the direction in one important way: it
believes operational truth should be evidenced, not narrated. Runtime cards,
runtime evidence contracts, artifact spines, closeout gates, and active artifact
reconciliation are conceptually close to Codex's new model. The gap is that
Coding Harness often stores this truth as harness-owned artifacts, while Codex
is moving toward live typed runtime surfaces: `thread_id`, `turn_id`,
`item_id`, goal state, memory mode, permission profile, tool registry,
plugin attribution, MCP startup state, review mode, and queue state.

The highest-leverage improvement is a Codex runtime-state adapter that lets
Coding Harness consume Codex's native thread, turn, goal, permission, MCP,
plugin, review, and memory state as first-class inputs to runtime cards and
closeout gates. That adapter should not reimplement Codex. It should translate
Codex app-server, rollout, and SDK state into Harness evidence objects with
freshness, provenance, blocker classes, and ownership.

The biggest place Coding Harness fights the ecosystem is duplicated
orchestration. A separate Harness goal board, artifact routine, review lane,
permission model, and runtime card are useful only when they reconcile with
Codex-native state. If they become parallel truth systems, they will create the
same stale-state and repeated-steering failures that Harness is meant to
prevent.

The most important missing primitives are:

- A Codex runtime-state adapter.
- A thread-turn-item identity spine across all Harness evidence.
- Queue and steering state with accepted, deferred, rejected, and stale-turn
  outcomes.
- Native goal reconciliation with Codex goal statuses and accounting.
- Permission profile and environment parity with Codex managed profiles.
- Artifact lifecycle state that treats artifacts as runtime surfaces, not files.
- Review mode and side-thread interop.
- Tool exposure planning that mirrors Codex's registry/spec-plan pattern.
- Plugin, MCP, and subagent attribution in all reviewer and tool evidence.

The immediate canonical direction should be: make Coding Harness a thin,
typed, evidence-producing operational layer around Codex's native runtime
surfaces. Harness should add guardrails, reconciliation, artifact policy, and
closeout truth. It should not compete with Codex for thread orchestration,
goal storage, permission resolution, plugin discovery, or live tool routing.

## Codex Ecosystem Direction

### Operational Direction

Codex is moving from command execution toward a resident workflow runtime. The
app-server documentation now frames the system around core primitives:
`Thread`, `Turn`, and `Item`. Threads can be started, resumed, forked,
subscribed to, configured, searched, and kept loaded after unsubscribe. Turns
can be started, steered, interrupted, reviewed, and completed. Items carry the
runtime stream: tool calls, approvals, MCP progress, review-mode transitions,
messages, and metadata.

The operational model is no longer "run Codex and parse output". It is
"observe and steer a typed runtime".

### Workflow Philosophy

The emerging philosophy is: expose the workflow state at the boundary where
humans, agents, extensions, plugins, and tools can all see the same truth.
Recent changes cluster around:

- Thread settings as explicit state: cwd, model, effort, service tier,
  approval policy, sandbox policy, active permission profile, reviewer, memory
  mode, collaboration mode, personality, and workspace roots.
- Goal state as explicit state: objective, status, token budget, tokens used,
  elapsed time, updated time, continuation state, and event-driven mutations.
- Permission and environment selection as explicit state, including managed
  profiles, runtime refresh, requirements, network constraints, and environment
  routing for MCP and exec-server.
- Tool exposure as planned state, with mandatory executor specs and a
  centralized registry instead of scattered command availability.
- Review and side conversations as runtime modes, not detached social
  conventions.
- Search and memory as rollout-backed runtime continuity, not generic text
  archives.

### Runtime Model

The runtime model is converging on typed event streams plus durable state:

- `thread/start`, `thread/resume`, and `thread/fork` establish context.
- `turn/start`, `turn/steer`, `turn/completed`, and review-mode items
  express active work.
- `ThreadSettings`, `ThreadGoal`, `ThreadMemoryMode`, and git metadata
  keep state inspectable.
- MCP progress notifications include `thread_id`, `turn_id`, and `item_id`.
- MCP tool call items now include `pluginId`.
- Hook events include subagent identity through `agent_id` and `agent_type`.
- Runtime queues decide whether input is accepted into the active turn, deferred
  to the next turn, or held until the session is idle.

This is a major alignment signal for Coding Harness: every meaningful Harness
claim should be able to point to thread, turn, item, artifact, verifier, and
source identities where available.

### Interaction Model

The interaction model is becoming interruptible, steerable, and mode-aware.
`turn/steer` requires an `expectedTurnId`, which makes stale steering a typed
failure instead of a vague prompt mistake. Side conversations are available
through `/side` and `/btw`, but command availability is deliberately
constrained inside active side conversations. Review mode is entered and exited
through runtime items. Budget-limited goal extension turns receive model-visible
steering items that tell the model to wrap up honestly.

Coding Harness should treat this as a durable expectation: orchestration must
be safe under interruption, continuation, stale state, and partial progress.

### Ecosystem Assumptions

Codex now increasingly assumes:

- Workflow state is live and inspectable.
- Runtime state can change during a session.
- Permissions and environments are first-class operational inputs.
- Goals are durable across turns and sessions.
- Tool visibility is planned and mode-dependent.
- Review is a runtime mode.
- Side work is a constrained fork, not an untracked branch of thought.
- Memory is searchable by thread content and citable with line ranges.
- Tool calls and subagent actions need identity and attribution.
- Stale steering, stale settings, and stale artifacts are correctness risks.

### Emerging Primitives

The strongest emerging primitives are:

- App-server protocol as the typed operational bus.
- Thread settings as the state contract.
- Native goals as task lifecycle state.
- Input queues as steering safety infrastructure.
- Tool exposure plans as tool governance.
- Permission profiles and explicit environments as runtime safety controls.
- Review mode items as first-class workflow transitions.
- Rollout-backed search as durable context retrieval.
- Memory citations as source-grounded context links.
- PluginId, MCP startup state, and subagent identity as attribution surfaces.

## Critical Question Answers

1. What is Codex evolving toward operationally?

Codex is evolving toward a resident, typed, stateful workflow runtime with an
app-server control plane. The CLI/TUI is becoming one client of a richer
runtime that exposes threads, turns, items, goals, settings, memory, reviews,
MCP state, permission profiles, environments, extensions, and tool registries.

2. What assumptions does Codex now make about workflow state?

Codex assumes workflow state is explicit, mutable, inspectable, and identity
bearing. It expects settings, goals, permissions, environments, active turns,
queued input, review modes, MCP progress, plugin attribution, and memory mode to
be represented as state rather than inferred from logs or prose.

3. What primitives does Coding Harness currently lack?

Coding Harness lacks a Codex runtime adapter, a thread-turn-item identity spine,
queue and steering state, native goal reconciliation, Codex permission profile
parity, MCP and plugin runtime attribution, review-mode interop, side-thread
interop, and artifact lifecycle state that treats artifacts as live runtime
surfaces.

4. What native workflow expectations are emerging?

Native workflows now expect safe steering with turn identity, runtime goal
status, mode-aware tool visibility, review mode transitions, permission profile
selection, environment routing, durable memory and search, and typed
verification of whether a runtime action actually happened.

5. What runtime patterns should Coding Harness align with?

Harness should align with app-server state, `ThreadSettings`, `ThreadGoal`,
`ThreadMemoryMode`, MCP progress notifications, pluginId attribution,
subagent hook identity, input queue semantics, review mode items, and generated
schema parity.

6. What architectural patterns should be copied?

Copy the adapter pattern, event-sink pattern, tool exposure plan, explicit
state object pattern, bounded queue and backpressure pattern, generated schema
parity pattern, and identity-bearing runtime event pattern.

7. What architectural patterns should NOT be copied?

Do not copy Codex internals wholesale. Harness should not reimplement the
thread store, goal engine, MCP manager, permission resolver, plugin installer,
side conversation runtime, or app-server. It should consume and reconcile those
surfaces.

8. Where is Coding Harness fighting Codex instead of extending it?

It fights Codex when Harness artifacts become parallel truth systems for goals,
runtime status, review state, permission state, and artifact lifecycle. It also
fights Codex when orchestration is done through manual prompts instead of
`turn/steer`, `review/start`, thread settings, or native goal state.

9. What abstractions currently create friction?

The current friction points are harness-owned runtime cards without a native
Codex adapter, goal boards without native goal reconciliation, reviewer
artifacts without subagent identity, permission profiles that do not map to
active Codex profiles, and artifact spines that treat files as evidence without
enough runtime item identity.

10. What integrations would make Coding Harness feel ecosystem-native?

The most native integrations would be app-server state ingestion, native goal
sync, turn/item identity capture, Codex permission profile and environment
mapping, review-mode import, MCP/plugin attribution, rollout search integration,
memory citation support, and a side-panel runtime card viewer.

11. What metadata/state/artifact systems are now expected?

Expected systems include thread id, turn id, item id, tool call id, plugin id,
subagent id and type, active permission profile, environment id, goal status,
goal budget accounting, memory mode, git metadata, review mode, MCP startup
state, runtime workspace roots, and artifact freshness/provenance.

12. What review/verification UX patterns are emerging?

Review is becoming a mode with entered/exited items, inline or detached
workflow shape, and runtime item traceability. Verification UX is moving toward
visible lifecycle state, exact blocker classes, stale-state warnings, and
proof-bearing command outcomes rather than narrative confidence.

13. What automation patterns should become first-class?

First-class automation should include heartbeat and wake-up continuation,
budget-limited goal extension, queued steering with turn checks, retry-after
backpressure, runtime status polling, review-mode monitoring, and stale-state
reconciliation before action.

14. What operational surfaces should Coding Harness expose?

Harness should expose `codex-runtime-state`, `goal-sync`, `steering-queue`,
`permission-profile-map`, `review-mode-import`, `artifact-runtime-index`,
`mcp-status`, `plugin-attribution`, `memory-citations`, and
`side-panel-runtime-card` surfaces.

15. What would make Codex want to use Coding Harness naturally?

Codex would naturally use Coding Harness if Harness made runtime truth easier
to inspect, closeout claims safer, artifacts easier to review, stale state more
obvious, and repeated steering less necessary, all while preserving Codex's own
thread, goal, tool, permission, MCP, and memory systems as the source of live
truth.

## Native Integration Opportunities

### 1. Codex Runtime-State Adapter

What:

Build a `codex-runtime-state/v1` adapter that reads Codex thread, turn,
settings, goal, permission, memory, MCP, plugin, and review state and emits a
Harness-normalized runtime evidence object.

Why:

Coding Harness already has `runtime-card/v1` and
`runtime-evidence-contract/v1`, but those objects are stronger when backed by
Codex-native state instead of inferred local artifacts.

Operational value:

- Reduces stale local status.
- Turns Codex runtime into a direct evidence source.
- Lets PR closeout, review gates, and next-action routing use the same state
  that Codex uses.
- Makes blocked, budget-limited, usage-limited, review, and permission states
  visible before the harness recommends action.

Implementation difficulty:

Medium. The shape should start as a read-only adapter around app-server or
available session exports, then gain richer live behavior later.

Ecosystem leverage:

Very high. This is the bridge that makes Harness feel like a native operational
extension rather than an external status dashboard.

Expected UX improvement:

Users see one coherent runtime card that says what Codex is actually doing,
what Harness believes, and where the evidence came from.

Runtime/governance implications:

Runtime-card freshness must include Codex source timestamps, thread id, turn id,
and source kind. Harness gates should fail closed when the adapter reports stale
or unavailable native state for required claims.

### 2. Thread-Turn-Item Identity Spine

What:

Add thread, turn, item, tool-call, plugin, and subagent identity fields across
runtime evidence, review artifacts, artifact spine entries, verifier receipts,
and closeout summaries.

Why:

Codex now exposes identity throughout MCP progress, tool call items, hook
events, memory citations, and app-server turns. Harness artifacts that lack
these identities become harder to reconcile with live runtime truth.

Operational value:

- Makes artifacts traceable to the exact Codex event that produced or verified
  them.
- Separates one reviewer, subagent, plugin, or MCP server from another.
- Enables stale artifact detection by comparing artifact identity to current
  thread and turn state.

Implementation difficulty:

Medium. It requires schema evolution, backward compatibility, and careful
optional fields.

Ecosystem leverage:

Very high. Identity is the substrate for runtime-native automation and review.

Expected UX improvement:

A user can inspect a reviewer artifact or runtime card and see which Codex
thread, turn, item, plugin, MCP server, and subagent it came from.

Runtime/governance implications:

Closeout should classify missing identity as a freshness or provenance gap for
high-risk claims, not as a hard failure for legacy artifacts.

### 3. Native Goal Reconciliation

What:

Reconcile Harness goal boards and phase state with Codex `ThreadGoal` state:
objective, status, token budget, tokens used, elapsed time, and continuation
events.

Why:

Codex goals are now default, persistent, budget-aware, event-driven, and wired
to dedicated goal storage. Harness should not maintain a competing task
lifecycle for work that already has a native Codex goal.

Operational value:

- Avoids split-brain task state.
- Turns budget-limited, usage-limited, blocked, paused, and complete into
  routing inputs.
- Lets Harness next-action recommendations respect native Codex continuation
  behavior.

Implementation difficulty:

Medium.

Ecosystem leverage:

Very high.

Expected UX improvement:

The runtime card can say: native goal active, blocked, budget-limited, complete,
or paused, with the same accounting Codex sees.

Runtime/governance implications:

Harness should treat native goal state as stronger than a stale local goal
board. Local boards remain planning and audit artifacts, not live task truth.

### 4. Steering Queue And Safe Continuation Contract

What:

Introduce a Harness steering contract that records active-turn steering,
queued-next-turn input, mailbox delivery, deferred input, rejected stale input,
and interruption outcomes.

Why:

Codex input queues now distinguish active-turn injection from pending input and
mailbox delivery. `turn/steer` requires `expectedTurnId`, which makes stale
steering detectable.

Operational value:

- Prevents accidental steering of the wrong turn.
- Makes queued work inspectable.
- Reduces repeated manual prompts after interruptions.
- Gives automation a safe way to wake, continue, or defer work.

Implementation difficulty:

Medium-high because it touches orchestration semantics.

Ecosystem leverage:

High.

Expected UX improvement:

Harness can show "queued for next Codex turn", "applied to active turn",
"rejected because turn changed", or "deferred until idle" instead of leaving
the user guessing.

Runtime/governance implications:

Automation must record the target `thread_id` and `expected_turn_id` before
steering. Stale-turn rejection should be treated as a safe stop, not a failure
to bulldoze through.

### 5. Permission Profile And Environment Parity

What:

Map Harness permission profiles to Codex active permission profiles,
requirements, sandbox policy, approval policy, managed profiles, network
constraints, and explicit environments.

Why:

Codex has added permission profile selection, profile inheritance, runtime
refresh, requirements-managed profiles, explicit environments for MCP, and
safety checks that reject unsafe read-only fallback.

Operational value:

- Reduces mismatches between what Harness thinks is allowed and what Codex can
  actually do.
- Lets runtime cards explain why a command needs approval or cannot proceed.
- Makes environment drift a first-class blocker.

Implementation difficulty:

Medium.

Ecosystem leverage:

High.

Expected UX improvement:

Instead of "permission unknown", Harness can show active Codex profile,
requirements source, environment, approval reviewer, and the exact blocker.

Runtime/governance implications:

Permission profile mismatch should block high-risk automation and force
refresh/reconciliation.

### 6. Artifact-As-Runtime-Surface Index

What:

Extend the artifact spine so PDFs, CSVs, docs, tables, browser captures, review
reports, and generated evidence are indexed as runtime surfaces with lifecycle,
inspection state, verifier state, annotation state, source item identity, and
freshness.

Why:

Codex is treating items, review mode, browser-visible artifacts, documents,
memory citations, and tool outputs as part of the runtime stream. Harness still
leans toward artifact files as proof.

Operational value:

- Makes artifact generation, inspection, steering, annotation, verification,
  and expiry visible.
- Enables stale artifact warnings.
- Lets reviewers and users know whether an artifact was opened, rendered,
  checked, cited, superseded, or merely created.

Implementation difficulty:

Medium-high.

Ecosystem leverage:

High.

Expected UX improvement:

The user sees artifact state as "rendered and inspected", "generated but not
verified", "annotation requested", "superseded by turn X", or "blocked by
missing source", not just a path.

Runtime/governance implications:

For high-risk artifacts, closeout should require inspection or verifier state,
not just file existence.

### 7. Review Mode And Side-Thread Interop

What:

Connect Harness review gates and reviewer artifacts to Codex review mode,
side-thread semantics, `/side`, `/btw`, inline/detached review starts, and
review-mode entered/exited items.

Why:

Codex is making review and side work runtime-native. Harness review flows should
consume those modes rather than inventing parallel side-review conventions.

Operational value:

- Makes review entry/exit traceable.
- Prevents side work from becoming invisible.
- Gives reviewers a clear runtime parent and artifact target.
- Reduces review-state ambiguity during closeout.

Implementation difficulty:

Medium.

Ecosystem leverage:

High.

Expected UX improvement:

Review panels and runtime cards can show active review mode, detached review
threads, side conversation state, and which artifacts came from each.

Runtime/governance implications:

Harness should preserve Codex's constrained command availability inside side
conversations. Side work must not silently mutate primary runtime state.

### 8. Tool Exposure Plan For Harness Commands

What:

Adopt a Codex-like tool exposure plan for Harness CLI and automation commands:
central registry, executor specs, feature/mode gating, environment availability,
and model-visible descriptions.

Why:

Codex centralized tool exposure planning and made executor specs mandatory. The
pattern reduces drift between docs, runtime availability, feature flags, and
tool-call behavior.

Operational value:

- Prevents command discovery drift.
- Gives agents a stable catalog of Harness capabilities.
- Makes unavailable commands explainable.
- Enables mode-aware hiding of dangerous or irrelevant operations.

Implementation difficulty:

Medium.

Ecosystem leverage:

High.

Expected UX improvement:

Codex can ask Harness "what can I do here?" and get an accurate, mode-aware
answer instead of searching docs or guessing CLI commands.

Runtime/governance implications:

Unknown command availability should become a validation failure in high-risk
automation and PR closeout flows.

### 9. MCP, Plugin, And Subagent Attribution Bridge

What:

Record MCP server state, MCP progress, pluginId, installed plugin references,
subagent start/stop identity, and reviewer role metadata in Harness artifacts.

Why:

Codex now carries plugin id on MCP tool call items and subagent identity through
hooks. Without this, Harness cannot reliably explain which runtime component
produced a result.

Operational value:

- Better audit trails.
- Cleaner reviewer artifact verification.
- Better plugin/runtime failure classification.
- Stronger support for ecosystem-native plugin workflows.

Implementation difficulty:

Low-medium once identity fields exist.

Ecosystem leverage:

High.

Expected UX improvement:

Runtime cards can say "blocked by MCP server startup failure", "tool call came
from plugin X", or "reviewer Y failed artifact verification".

Runtime/governance implications:

Reviewer artifacts without requested subagent identity should be coverage gaps,
especially for swarms or delegated reviews.

### 10. Rollout Search And Memory Citation Integration

What:

Integrate Codex rollout-backed thread search and memory citation structures
into Harness memory, implementation notes, and closeout artifacts.

Why:

Codex search is moving toward case-insensitive rollout-backed content search
with metadata cross-reference. Memory citations include path, line ranges,
notes, and thread ids.

Operational value:

- Makes prior context discoverable through Codex-native retrieval.
- Allows Harness claims to cite session evidence.
- Reduces repeated rediscovery and stale memory assumptions.

Implementation difficulty:

Medium.

Ecosystem leverage:

Medium-high.

Expected UX improvement:

Harness can surface "related prior Codex thread" and "memory citation" alongside
implementation notes and runtime cards.

Runtime/governance implications:

Memory-derived claims should carry citation freshness and should not outrank
current runtime state.

### 11. Backpressure, Retry, And Recovery Semantics

What:

Adopt explicit overloaded, retry-after, auth-recovery, reconnect, and fresh
session classifications for long-running Harness operations.

Why:

Codex app-server uses bounded queues and overloaded retry semantics. Remote
control and exec-server changes emphasize auth recovery and websocket
reconnection with fresh sessions.

Operational value:

- Better automation resilience.
- Cleaner blocked/runtime failure classification.
- Less manual recovery after transient runtime failure.

Implementation difficulty:

Medium.

Ecosystem leverage:

Medium.

Expected UX improvement:

Harness reports "retry after X", "auth recovered", "fresh session created", or
"queue overloaded" instead of vague runtime failure.

Runtime/governance implications:

Retries need limits, attempt ledgers, and ownership classification so recovery
does not hide real failures.

### 12. Schema Parity And SDK Boundary

What:

Consume generated Codex schemas and SDK return types where possible, especially
`TurnResult`, app-server protocol types, and schema fixtures.

Why:

Codex app-server guarantees TypeScript and JSON schemas match the current
version, and the Python SDK is moving toward first-class login, packaged
runtimes, steering, interruption, and `TurnResult`.

Operational value:

- Reduces hand-rolled type drift.
- Makes Harness adapters resilient to protocol evolution.
- Gives future automation a cleaner SDK boundary.

Implementation difficulty:

Medium.

Ecosystem leverage:

Medium-high.

Expected UX improvement:

Harness reports native turn outcomes and schema-backed state rather than
best-effort parsing.

Runtime/governance implications:

Adapter validation should fail on incompatible schema versions rather than
silently downgrading.

## Priority-Ordered Implementation Plan

| Priority | Recommendation | Why First | Ecosystem Impact | Difficulty | Risk Reduction |
|---|---|---|---|---|---|
| P0 | Build read-only `codex-runtime-state/v1` adapter for thread settings, goal, memory mode, permission profile, MCP status, plugin attribution, review mode, and git metadata. | It connects Harness truth to Codex truth before adding more Harness-only state. | Very high | Medium | Very high |
| P0 | Add thread-turn-item identity fields to runtime evidence, artifact spine, reviewer artifacts, and closeout receipts. | Native state cannot be reconciled without stable identity. | Very high | Medium | Very high |
| P0 | Reconcile Harness goal boards with native Codex `ThreadGoal` state and statuses. | Goals are now default and persistent in Codex; duplicate task truth is dangerous. | Very high | Medium | Very high |
| P0 | Add queue and steering state with `expectedTurnId`, accepted, deferred, queued, rejected, and interrupted outcomes. | Safe steering is central to native workflow continuity. | High | Medium-high | High |
| P0 | Map Harness permission profiles to Codex active permission profiles, requirements, approval policy, sandbox policy, and environments. | Permission mismatch creates unsafe automation and false blockers. | High | Medium | High |
| P1 | Upgrade artifact spine into an artifact-as-runtime-surface index with inspection, annotation, verifier, source item, freshness, and supersession state. | Artifact work is becoming runtime work, not file output. | High | Medium-high | High |
| P1 | Import Codex review mode and side-thread state into Harness review gates and runtime cards. | Review and side work are now native Codex modes. | High | Medium | Medium-high |
| P1 | Create a Harness tool exposure plan patterned after Codex `spec_plan`. | Prevents CLI/docs/runtime drift and makes Harness capabilities model-visible. | High | Medium | Medium-high |
| P1 | Record MCP, plugin, and subagent attribution in all reviewer and tool evidence. | Attribution is now part of Codex runtime truth. | High | Low-medium | Medium-high |
| P1 | Integrate rollout search and memory citations into implementation notes and closeout evidence. | Makes durable context Codex-native and citable. | Medium-high | Medium | Medium |
| P2 | Add bounded queue, retry-after, auth-recovery, and reconnect classifications to long-running Harness operations. | Improves resilience after the core state bridge exists. | Medium | Medium | Medium |
| P2 | Consume Codex generated schemas and SDK return types for adapter boundaries. | Reduces drift but depends on adapter design. | Medium-high | Medium | Medium |
| P2 | Add side-panel/runtime-card inspection UX for live native state and artifact lifecycle. | UX polish should follow state correctness. | Medium-high | Medium-high | Medium |
| P3 | Package Harness automation around Codex SDK packaged runtimes. | Valuable later, but premature before state contracts settle. | Medium | High | Low-medium |
| P3 | Add browser-native artifact review loops beyond current evidence needs. | Useful for visual artifacts, but not the first alignment blocker. | Medium | Medium-high | Low-medium |

## Missing Primitives

### Missing Runtime Systems

- Codex runtime-state adapter.
- Thread, turn, item, and tool-call identity spine.
- Native thread settings snapshot in Harness runtime evidence.
- Native goal state reconciliation.
- Native memory mode and thread search linkage.
- Runtime workspace roots and git metadata reconciliation.
- MCP startup and progress state ingestion.
- Plugin attribution ingestion.
- Subagent lifecycle ingestion.
- Runtime stale-state detector based on native thread and turn ids.

### Missing Artifact Systems

- Artifact lifecycle beyond path/status/reason.
- Artifact source item identity.
- Artifact inspection receipts.
- Artifact annotation state.
- Artifact supersession state.
- Rendered artifact verification state.
- Browser/PDF/CSV/doc/table runtime surface classification.
- Artifact-to-review-mode linkage.
- Artifact-to-goal and artifact-to-turn linkage.

### Missing Workflow Primitives

- Safe active-turn steering with expected turn identity.
- Deferred input and queued-next-turn state.
- Side-thread parent/child state.
- Review mode entry and exit state.
- Native pause, resume, budget-limited, usage-limited, and blocked goal routing.
- Wake-up and heartbeat state tied to Codex thread ids.
- Backpressure and retry-after state.

### Missing Review Surfaces

- Review-mode import from Codex.
- Inline versus detached review classification.
- Reviewer artifact identity tied to subagent start/stop.
- Review coverage gaps tied to missing artifact files and missing runtime
  identities.
- Visual runtime-card display of review state.
- Stale-review warning when review artifacts do not match current turn or head.

### Missing Memory Systems

- Rollout-backed thread search integration.
- Memory citation ingestion with path, line ranges, notes, and thread ids.
- Clear precedence between current runtime state, Harness memory, Project Brain,
  implementation notes, and cold research.
- Operational memory records tied to runtime card and closeout receipts.

### Missing Automation Systems

- Turn-safe queued automation.
- Heartbeat/wake-up state reconciled with active Codex goals.
- Budget-limited goal continuation handling.
- Automation pause on blocked, usage-limited, stale-turn, or permission-mismatch
  states.
- Retry ledgers with owner classification.

### Missing Verifier Systems

- Verifier receipts that include thread/turn/item identity.
- Native state freshness requirements.
- Permission and environment verifier.
- Artifact inspection verifier.
- Review-mode verifier.
- MCP/plugin/subagent attribution verifier.
- Stale-state verifier for queued steering and closeout claims.

### Missing State Surfaces

- `codex-runtime-state`
- `goal-sync`
- `steering-queue`
- `permission-profile-map`
- `environment-map`
- `review-mode-import`
- `artifact-runtime-index`
- `mcp-status`
- `plugin-attribution`
- `subagent-lifecycle`
- `memory-citations`
- `side-panel-runtime-card`

## Workflow Friction Analysis

### Unnecessary Prompting

Harness still needs too much human steering when it cannot tell whether Codex
has an active turn, paused goal, budget-limited continuation, rejected steering
input, stale permission profile, or blocked MCP startup. Native state ingestion
would let Harness recommend the next safe action without asking the user to
reconstruct runtime truth.

### Duplicated State

The biggest duplication risk is goal state. Harness goal boards and active
artifacts are useful planning and audit surfaces, but Codex native goals now
own live objective, status, budget, and continuation behavior. Duplicate goal
state must become reconciled state.

Runtime cards also risk duplication when they summarize branch, PR, artifact,
tracker, and validation truth without including Codex thread, turn, settings,
goal, permission, and review state.

### Broken Continuity

Continuity breaks when a Harness artifact says "review pending" but Codex is in
or out of review mode; when a Harness next action assumes an active turn but
Codex has moved on; when a permission profile changes at runtime; or when a
side conversation produces useful evidence with no parent identity.

### Manual Recovery

Manual recovery still appears around stale artifacts, missing reviewer reports,
unknown runtime role availability, MCP failures, and permission mismatches.
Codex is adding typed states for several of these. Harness should consume them
and classify recovery rather than ask the user to narrate what happened.

### Stale-State Risks

High-risk stale-state surfaces:

- Runtime card generated before a new turn or goal update.
- Reviewer artifact written for an old head SHA or side conversation.
- Permission profile inferred from config while active runtime profile differs.
- Goal board says active while native Codex goal is blocked, paused, or
  budget-limited.
- Artifact exists but was never rendered or inspected.
- Queued input targets an old turn.
- MCP status changed after a tool call failed.

### Awkward Orchestration

Harness feels external when it launches its own workflow language around Codex
instead of using native surfaces such as `thread/settings/update`,
`turn/steer`, `review/start`, native goals, memory mode, permission profiles,
and environment routing.

### Review Friction

Review friction comes from file artifacts standing in for runtime review state.
Codex now exposes review-mode transitions. Harness should know whether review
mode was entered, whether it was inline or detached, what thread/turn produced
the comments, and whether reviewer artifacts exist for each requested reviewer.

### Artifact Friction

Artifact friction comes from treating paths as completion evidence. A generated
PDF, CSV, document, table, screenshot, or review file should carry source
identity, rendered/inspected state, annotation state, verifier result,
freshness, and supersession.

## Native UX Recommendations

### How Coding Harness Should Feel

Coding Harness should feel like Codex's operational dashboard and policy layer:
the place where live Codex state, artifacts, goals, reviews, validation, and
closeout truth become inspectable and enforceable.

It should not feel like a second orchestrator that asks Codex to work around
Codex.

### What Should Become Automatic

- Runtime-card ingestion from Codex thread state.
- Goal reconciliation.
- Permission and environment mismatch detection.
- Stale-turn detection before steering.
- Reviewer artifact identity capture.
- MCP/plugin/subagent attribution capture.
- Artifact freshness and inspection checks.
- Review-mode state import.
- Memory citation attachment when claims rely on prior sessions.

### What Should Become Inspectable

- Active thread id, turn id, and item ids.
- Current thread settings.
- Active permission profile and environment.
- Native goal status and accounting.
- Queued steering inputs and their target turns.
- Review mode and side-thread state.
- MCP startup/progress state.
- Plugin and subagent attribution.
- Artifact lifecycle state.
- Validation and verifier ownership.
- Staleness warnings and recovery path.

### What Should Become Artifact-Native

- PDFs, CSVs, docs, tables, screenshots, browser captures, review reports, and
  generated evidence should have lifecycle state.
- Artifacts should be tied to runtime item identity and verifier receipts.
- Artifact review should record rendered/inspected/annotated/superseded states.
- Artifact claims should fail closed when required inspection is missing.

### What Should Become Side-Panel-Native

- Runtime card inspection.
- Artifact preview and annotation.
- Review-mode transitions.
- Goal status and budget accounting.
- Permission profile/environment state.
- Queue and steering state.
- MCP/plugin/subagent trace.

### What Should Become Runtime-Card-Native

- Codex native goal status.
- Active thread settings.
- Memory mode.
- Permission profile and environment.
- Turn and item identity.
- Review mode.
- Queued/deferred/rejected steering.
- MCP startup and progress state.
- Plugin and subagent attribution.
- Artifact lifecycle freshness.
- Explicit stale-state blockers.

## What NOT To Implement

### Do Not Reimplement Codex Internals

Do not build a Harness thread store, goal engine, MCP manager, permission
resolver, plugin installer, side conversation runtime, remote-control server,
or app-server clone. Those are Codex-owned primitives. Harness should adapt,
reconcile, validate, and display them.

### Do Not Create A Parallel Goal Authority

Harness goal boards should not compete with native Codex goals. They should
store planning, audit, and cross-system context, while native Codex goal state
owns live objective status and continuation behavior.

### Do Not Treat Files As Runtime Truth

File existence is not enough. Reviewer reports, PDFs, docs, CSVs, and generated
summaries need source identity, freshness, inspection state, and verifier
results before they can support closeout claims.

### Do Not Copy Every Codex Feature

Not every last-seven-days change should become a Harness feature. Examples that
should remain Codex-owned or deferred:

- Plugin install discovery mechanics.
- Full permission inheritance resolution.
- Full remote-control reconnect logic.
- Complete app-server API surface.
- TUI command implementation.
- Packaged runtime launching.
- Generic browser runtime behavior.

### Do Not Over-Materialize Research

This artifact should not become automatic policy just because it is detailed.
Promote only the recommendations that get a target surface, owner, validation
command, and disposition in the Harness evidence pipeline.

### Do Not Hide Native State Behind Harness Vocabulary

Harness terms such as runtime card, artifact routine, review gate, and goal
board are useful only if they preserve native Codex state. Avoid abstractions
that rename away `thread_id`, `turn_id`, `item_id`, `pluginId`,
`ThreadGoal`, `ThreadSettings`, permission profile, and review mode.

### Do Not Make Side Work Unbounded

Side conversations should preserve Codex's constrained mode semantics. Harness
should not turn every side investigation into an unconstrained workflow that can
silently mutate primary state.

### Do Not Make Automation More Aggressive Than State Allows

Automation should pause on stale turn, blocked goal, usage limit, budget limit,
permission mismatch, unknown MCP state, missing reviewer artifact, or stale
artifact evidence. A native-feeling Harness is safer, not more forceful.

## Final Recommendation

Implement immediately:

- `codex-runtime-state/v1` as a read-only adapter.
- Thread-turn-item identity fields across runtime evidence and artifact spine.
- Native goal reconciliation.
- Safe steering queue state with `expectedTurnId`.
- Permission profile and environment parity.

These are the highest-leverage moves because they make Harness operate on the
same runtime truth Codex now exposes. They also reduce repeated human steering,
stale-state failures, closeout overclaims, and duplicated task state.

Implement next:

- Artifact-as-runtime-surface lifecycle.
- Review mode and side-thread interop.
- Harness tool exposure plan.
- MCP, plugin, and subagent attribution bridge.
- Rollout search and memory citation integration.

These make Harness feel native in daily review, artifact, and memory workflows.
They should follow the core state bridge so their evidence has a real runtime
identity spine.

Wait on:

- Packaged runtime automation.
- Full SDK embedding.
- Broad side-panel UX.
- Browser-heavy artifact review loops.
- Deep remote-control recovery.

Those are useful, but premature until the state, identity, goal, permission,
and artifact contracts are stable.

The canonical architectural direction should be:

Coding Harness is a thin, typed, validator-backed operational layer around
Codex. Codex owns live runtime execution. Harness owns coherence: evidence
normalization, artifact lifecycle, review and closeout gates, stale-state
detection, governance, and memory-safe continuity.

The most native version of Coding Harness is not a wrapper around Codex. It is
the place Codex goes when it needs to prove what happened, decide what is safe
to do next, and carry operational truth across threads, artifacts, reviews,
automations, and humans.

## Validation Evidence

- Command:
  `git log --since="2026-05-17 00:00" --date=short --pretty=format:"%ad %h %s" --no-merges`
  -> pass. Used to identify the last-seven-days Codex change clusters.
- Command:
  `git log --since="2026-05-17 00:00" --no-merges --name-only --pretty=format: | awk 'NF {print}' | sed 's#/.*##' | sort | uniq -c | sort -nr`
  -> pass. Used to confirm change density across core, TUI, app-server,
  protocol, SDK, extension, hooks, state, CLI, plugins, and config surfaces.
- Command:
  `sed -n` over the Codex and Coding Harness files listed in this artifact
  -> pass. Used to ground recommendations in source files rather than commit
  titles alone.
- Command:
  `pnpm exec markdownlint-cli2 ".harness/**/*.md"`
  -> pass. Used because the standard docs lint glob excludes hidden
  directories unless `.harness` is included explicitly.
- Command:
  `pnpm research:evidence:validate`
  -> pass. The artifact is tracked in
  `.harness/research/evidence-patterns.json` as deferred research, not as
  adopted implementation authority.
