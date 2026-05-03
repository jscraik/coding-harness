---
schema_version: 1
title: Session Friction Evidence Contracts Plan
type: feat
status: draft
date: 2026-05-02
plan_id: feat-session-friction-evidence-contracts
source_report: <operator-local-codex-usage-report>
source_prior_art: https://github.com/withastro/flue
source_codex_prior_art: <operator-local-codex-checkout>
source_claude_code_comparison: <operator-local-claude-code-checkout>
source_plan: docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md
linear_status: JSC-249
run_type: planning-artifact
---

# Session Friction Evidence Contracts Plan

## Enhancement Summary

**Planned on:** 2026-05-02
**Mode:** `he-plan`
**Source report:** `<operator-local-codex-usage-report>`
**Prior art:** [withastro/flue](https://github.com/withastro/flue)
**Primary agent runtime prior art:** `<operator-local-codex-checkout>`
**Secondary comparison source:** `<operator-local-claude-code-checkout>`
**Depends on:** [Agent-Native Cockpit Control Loop First Slice](./2026-05-02-feat-agent-native-cockpit-control-loop-plan.md)
**Linear status:** [JSC-249](https://linear.app/jscraik/issue/JSC-249/add-session-friction-and-evidence-contracts) assigned and In Progress.

This plan turns the Codex usage report into a concrete Harness follow-on. The
report shows that the current product gap is not another broad command family;
it is structured operational evidence for session friction, delay, permissions,
subagent quality, PR closure, and final outcomes.

Codex is the primary execution agent and the main prior-art source for this
follow-on. Harness should optimize first for Codex's permission, sandbox,
session, skill, plugin, hook, and tool-call model. Claude Code is useful as a
secondary comparison source for command visibility, task identity, hook
coverage, and context-budget patterns; it should not displace Codex as the
target runtime.

Flue is useful additional prior art because it treats agents as programmable,
typed, sandbox-aware runtimes. Harness should not become a hosted agent
framework, but it should steal the product lesson: every recommended action
should declare the cheapest sufficient execution profile, required tool grants,
durable session or task identity, and typed result evidence.

The work should make messy Codex sessions answer these questions in machine
readable form:

```text
What slowed this down?
Was it repo state, permissions, tool friction, unclear instruction,
validation failure, external service state, or implementation complexity?
What evidence exists?
What should the next agent do?
What should be remembered?
```

## Table of Contents

- [Source Traceability](#source-traceability)
- [Prior-Art Translation](#prior-art-translation)
- [Additional Product Distillation](#additional-product-distillation)
- [Problem Statement](#problem-statement)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Linear Work Item Payload](#linear-work-item-payload)
- [Current Repo Evidence](#current-repo-evidence)
- [Scope Boundaries](#scope-boundaries)
- [Execution Rules](#execution-rules)
- [Implementation Units](#implementation-units)
- [Deferred Goals](#deferred-goals)
- [Dependency Graph](#dependency-graph)
- [Validation Plan](#validation-plan)
- [Risk Controls](#risk-controls)
- [Acceptance Traceability](#acceptance-traceability)
- [Resume Cursor](#resume-cursor)
- [Handoff to he-work](#handoff-to-he-work)

## Source Traceability

| Source                                                                                                                                                                                   | Role                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<operator-local-codex-usage-report>`                                                                                                                                                    | Usage evidence for friction, delay, permissions, subagents, review-thread activity, and missing outcomes                                                     |
| `<operator-local-codex-checkout>`                                                                                                                                                        | Primary runtime prior art for Codex-first permissions, sandbox policy, capability loading, hooks, task/session state, parallel safety, and evidence indexing |
| `<operator-local-claude-code-checkout>`                                                                                                                                                  | Secondary comparison source for command ranking, task IDs, hook taxonomy, context budgeting, and bounded stats caches                                        |
| `https://github.com/withastro/flue`                                                                                                                                                      | Prior art for virtual sandboxes, session/task identity, typed result schemas, command grants, and deployable agent workspaces                                |
| User-supplied harness-engineering notes on expert leverage, ablation, distillation, Ralph loops, security underspecification, Codex workouts, autocompaction, and repo-owned automations | Product pressure for expert-judgment compression, small loops, resume-safe evidence, and eval-led improvement                                                |
| `docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`                                                                                                                   | Existing cockpit first-slice dependency                                                                                                                      |
| `src/lib/decision/harness-decision.ts`                                                                                                                                                   | Current shared decision envelope                                                                                                                             |
| `src/commands/next.ts`                                                                                                                                                                   | Current read-only cockpit decision producer                                                                                                                  |
| `UBIQUITOUS_LANGUAGE.md`                                                                                                                                                                 | Existing prompt translation and canonical vocabulary surface                                                                                                 |
| `AGENTS.md`                                                                                                                                                                              | Existing validation, review swarm, evidence, and workflow contracts                                                                                          |

The report captured these concrete signals:

| Signal              | Count or state                               | Harness implication                                                  |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| Tool errors         | `2,472` total, `1,997` classified as `Other` | Harness needs a sharper blocker and friction taxonomy                |
| Long waits          | `461` responses over 15 minutes              | Long-running loops need delay checkpoints and next-action state      |
| Permission requests | `131` request-permission calls               | Next actions should declare permission needs before execution        |
| Subagent activity   | `280` spawned agents and `233` waits         | Subagent completion needs artifact evidence, not mailbox status only |
| Review cleanup      | `212` resolved review threads                | PR closure needs a checklist contract                                |
| Outcomes            | `No data`                                    | Harness needs closeout labels and outcome artifacts                  |

## Prior-Art Translation

### Codex-Primary Runtime Lessons

Harness should treat Codex as the default execution agent and make its contracts
easy for Codex to consume. The useful Codex lessons are local control-plane
contracts, not hosted-agent features:

| Codex pattern                                                                           | Harness adaptation                                                                        | Product impact                                                                       |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `PluginLoadOutcome` summarizes effective skills, MCP servers, apps, hooks, and warnings | `CapabilityDigest` in `harness check`, `harness next`, or a routed context helper         | Agents see the actual operating surface instead of re-reading every instruction file |
| Turn-level approval, reviewer, sandbox, model, effort, and output-schema overrides      | `ExecutionProfile` and `PermissionPlan` metadata on command capabilities and decisions    | Codex can request the narrowest needed permission before work starts                 |
| MCP `supports_parallel_tool_calls` is explicit and conservative                         | `parallelSafe`, `reads`, `writes`, and `conflictsWith` command metadata                   | Work loops can safely fan out read-only checks without racing mutative state         |
| Hook lifecycle events can block, augment, or classify execution                         | Harness event taxonomy for run artifacts, blockers, evidence writes, and closeouts        | Reports can explain what happened without replaying raw transcripts                  |
| SQLite-backed rollout state avoids repeated heavy filesystem reads                      | Lightweight `.harness/runs/index.jsonl` first, with SQLite deferred until needed          | `harness next` can become faster and more resume-aware                               |
| Thin-core architecture keeps runtime features isolated                                  | Small Harness modules for decisions, capabilities, permissions, runs, and context routing | The cockpit stays understandable instead of becoming one large orchestrator          |

### Claude Code Comparison Lessons

Claude Code should be used as comparison pressure, not as the primary target.
The useful comparisons are:

| Claude Code pattern                                                                                      | Harness adaptation                                               | Product impact                                                              |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Commands carry source, aliases, visibility, sensitivity, and user-invocable metadata                     | Enrich command capability metadata and `harness commands --json` | Humans and agents discover the right command faster                         |
| Suggestion ranking prefers recent skills, built-ins, exact names, aliases, prefixes, then fuzzy matches  | Rank cockpit and task-relevant commands before the full catalog  | `harness next` and help output become more intuitive                        |
| Task state records task ID, type, status, tool-use ID, output file, offsets, and timestamps              | Add run/task identity to evidence and closeout contracts         | Delegated work can be resumed or audited without mailbox guessing           |
| Hook schema covers permission denial, subagent start, file changes, worktree creation, and tool failures | Use a compact event vocabulary, not a full hook engine           | Harness captures useful lifecycle evidence without building another runtime |
| Tool-result budgeting and compaction keep long sessions usable                                           | Store evidence summaries plus refs, tails, and important lines   | Agents avoid flooding their own context with large logs                     |

### Flue Translation

Flue's useful lesson is not that Harness should become a general agent runtime.
It is that the operating contract around an agent should be explicit enough for
trusted code to decide where and how to run work.

Harness translation:

| Flue pattern                               | Harness adaptation                                       | Product impact                                                      |
| ------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Virtual sandbox as the fast default        | Execution profile metadata on commands and decisions     | Prefer read-only or local work before costly isolation              |
| `session.skill(..., { commands, result })` | Per-recommendation permission plan and result schema     | Declare tool grants and expected evidence before execution          |
| Agent, session, and task separation        | Session, task, and parent-task IDs in evidence contracts | Trace subagent and long-running work without mailbox guesswork      |
| Buildable agent workspace                  | Routed context digest or agent pack                      | Load the smallest correct instructions, skills, and validation lane |
| Typed result schemas                       | Versioned Harness evidence contracts                     | Make human output a renderer over validated machine results         |

The boundary is deliberate: Flue builds and deploys agents; Harness governs
coding-agent work inside repositories. The follow-on should improve Harness'
performance and intent clarity without introducing hosted-agent deployment
semantics.

## Additional Product Distillation

The user-supplied notes sharpen the plan without expanding the first issue:

- Harness should encode scarce expert judgment into repeatable Codex loops, not
  passive dashboards or static governance surfaces.
- Spec, implementation, and evaluation should form a loop: extract a spec from
  behavior, let a fresh agent implement from the spec, evaluate source/spec/impl
  drift, then improve the spec.
- Long-running work needs one durable state pad: plan progress, Linear comment,
  run artifact, closeout, or automation runbook. Chat history cannot be the
  only resume source.
- Human security and review programs are underspecified for agents, so Harness
  should prefer explicit policy IDs, permission classes, approval gates,
  evidence refs, and stop conditions over unwritten social norms.
- Repeated friction should be distilled into contracts, evals, learned rules,
  skill improvements, or guardrails. Surfaces that do not improve agent
  completion should be ablated, hidden, merged, or removed.
- Codex workout sessions should become eval pressure: run Codex against a clear
  flag, capture where it failed, improve the runbook/skill/contract, and repeat
  until reliability or wall-clock improves.
- Repo-owned automation runbooks should hold the durable behavior; app
  automation prompts should only identify the automation and point at the
  reviewed runbook.

## Problem Statement

Harness now has the beginning of an agent-native cockpit through
`HarnessDecision` and `harness next`. That helps agents decide the next safe
command, but it does not yet capture why work slows down, what class of blocker
occurred, whether subagent work produced durable evidence, or whether a session
ended as done, blocked, partial, abandoned, or advisory-only.

As a result, retrospective reports can count activity but cannot reliably answer
whether the work landed or what should improve next.

## Goals

This first follow-on is intentionally narrow. It should prove that Codex gets a
clearer, cheaper next action and better closeout evidence before Harness adds
more PR, review, instruction-routing, or indexing surfaces.

### First-Issue Goals

1. Add first-class friction and delay classification to the agent decision
   contract without breaking existing `HarnessDecision` consumers.
2. Add a small session closeout contract that records outcome, primary friction,
   validation evidence, next action, and learning candidates.
3. Add permission planning metadata so recommended actions can declare network,
   filesystem, git, and human-approval needs before execution.
4. Add execution profile metadata so `harness next` can prefer the cheapest
   sufficient read-only, local, virtual, container, or remote posture.
5. Add session and task identity to evidence contracts so long-running work and
   subagent delegation can be traced across artifacts.

### Deferred Goals

The usage report and Codex/Claude-Code prior art also justify later work, but
those tracks must not ship in the first issue. They require evidence that P1-P3
improved Codex session flow or exposed a concrete blocker:

- subagent evidence validation
- PR closure checklist state
- routed instruction context and capability digest
- command ranking and visibility metadata
- run artifact indexing and lifecycle event taxonomy
- broader prompt translation expansion
- repo-owned automation runbook validation
- resume, workout, and ablation evals

## Non-Goals

1. Building an analytics dashboard.
2. Parsing every historical Codex report format.
3. Replacing `HarnessDecision` or existing `GateResult` payloads.
4. Implementing mutative auto-remediation.
5. Auto-merging PRs, closing review threads, or mutating Linear state.
6. Replacing CodeRabbit, GitHub, Linear, CircleCI, or Semgrep behavior.
7. Creating another long narrative documentation layer.
8. Treating Claude Code conventions, `CLAUDE.md`, or Claude-specific command
   modes as primary Harness contracts.

## Linear Work Item Payload

Tracked in Linear as
[JSC-249](https://linear.app/jscraik/issue/JSC-249/add-session-friction-and-evidence-contracts).
Original ready-to-create payload:

```yaml
team: coding-harness
title: Add session friction and evidence contracts
description: |
  Use Codex usage-report evidence to extend the agent-native cockpit with
  structured friction classification, session closeout outcomes, permission
  planning, execution profile metadata, and session/task identity. Defer
  subagent evidence validation, PR closure checklist state, routed instruction
  context, capability digest, run indexing, command ranking, and broad prompt
  translations until the first slice proves measurable value.
labels:
  - harness
  - agent-native
  - evidence
  - product
refs:
  - <operator-local-codex-usage-report>
  - <operator-local-codex-checkout>
  - <operator-local-claude-code-checkout>
  - https://github.com/withastro/flue
  - docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md
```

## Current Repo Evidence

Live inspection found these relevant surfaces:

- `src/lib/decision/harness-decision.ts` already defines
  `HarnessDecision`, `status`, `retry`, `riskTier`, `failureClass`,
  `requiresHuman`, `requiresNetwork`, `writesFiles`, and `meta`.
- `src/commands/next.ts` already emits read-only decisions and uses
  `failureClass` for blocked paths such as invalid mode, empty file overrides,
  and unavailable git state.
- `docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`
  intentionally deferred telemetry persistence, PR readiness, review-fix,
  learning productization, and hero-story evaluations.
- `UBIQUITOUS_LANGUAGE.md` already contains a `Prompt Translations` table but
  does not yet include the report-driven phrases such as "close this PR
  properly" or "what do you actually think?"
- `AGENTS.md` already treats validation evidence and artifact-first review
  outputs as mandatory operating concepts.
- Flue's public README demonstrates a useful contrast: simple work defaults to
  a lightweight virtual sandbox, privileged CLIs are granted per skill call, and
  prompt or skill calls can require typed result schemas.
- Codex local prior art shows that effective plugin capabilities can be
  summarized from loaded skills, MCP servers, apps, hooks, and warnings; approval
  and sandbox posture can be carried as turn-level state; parallel tool safety
  should be explicit; and indexed session state avoids expensive raw artifact
  scans.
- Claude Code local comparison shows that command discoverability benefits from
  source, aliases, hidden/sensitive flags, user-invocable status, and usage-aware
  ranking; task state benefits from IDs, status, output refs, and offsets; and
  long-running sessions need output-budgeting patterns.

## Scope Boundaries

### In Scope

- Add additive decision metadata or typed helpers for friction and delay
  classification.
- Add a session closeout contract and fixture validation.
- Add permission planning fields to recommendations or decision metadata.
- Add execution profile metadata to command capabilities or decision metadata.
- Add session, task, and parent-task identity fields to closeout and evidence
  contracts.
- Add one optional prompt-translation example only if it is needed to explain
  the new friction taxonomy; broader vocabulary work is deferred.

### Out of Scope

- Full historical telemetry ingestion.
- Persistent analytics dashboards.
- Mutative PR cleanup.
- Automatic review-thread replies.
- Automatic Linear status transitions.
- Broad docs restructuring.
- Command deletion or deprecation.
- Hosted-agent deployment semantics such as `dev`, `run`, or `build` lifecycle
  commands.
- Subagent evidence validation in the first issue.
- PR closure checklist implementation in the first issue.
- Routed instruction context, capability digest, and command-ranking
  implementation in the first issue.
- Run artifact indexing or lifecycle event persistence in the first issue.

## Execution Rules

1. Keep all new contracts additive and versioned.
2. Prefer extending `HarnessDecision.meta` or typed producer helpers before
   changing required top-level fields.
3. Do not make `harness next --json` depend on network access by default.
4. Treat missing evidence as `blocked` or `action_required`, not as success.
5. Any command that inspects PR or issue state must be explicit about network
   requirements.
6. Do not infer session success from command volume or subagent completion.
7. Keep human rendering as a view over structured contracts.
8. Avoid another standalone command unless it feeds `harness next` or validates
   evidence produced by an existing workflow.
9. Prefer the cheapest sufficient execution profile and fail closed when the
   profile is unknown.
10. Keep Flue-inspired ideas as Harness control-plane contracts, not runtime
    framework features.
11. Optimize first for Codex as the primary agent runtime; treat Claude Code as
    comparison evidence only.
12. Store large evidence as summary plus refs, tails, and important lines; avoid
    dumping full logs into decision payloads.
13. Do not add a hook engine until a compact run-event contract has proven
    useful.
14. Every new contract must first pass the consolidation test: can it be an
    additive `HarnessDecision.meta` extension or shared `EvidenceRef` helper?
    Introduce a standalone versioned contract only when two independent
    producers need it or validation cannot be expressed as a decision/evidence
    helper.
15. Do not invent a replacement Codex shell, tool-call RPC, agent runner,
    hosted workspace lifecycle, or nested JSON command grammar. Harness should
    recommend normal repo commands, preserve argv metadata for agents, classify
    permission and sandbox friction, and let Codex execute through its native
    tools.
16. If an implementation makes Codex translate a recommended action through a
    Harness-specific invocation language before it can run a shell command, the
    design is wrong; reduce it back to command metadata, evidence refs, and a
    plain next command.
17. Treat every new surface as an ablation candidate: if removing it does not
    make Codex slower, less safe, or less able to finish the loop, hide, merge,
    or remove it.
18. Long-running loops must write a durable progress cursor before handoff or
    sleep so a fresh or compacted Codex instance can resume without private chat
    context.

## Implementation Units

### P0 - Tracker and Contract Alignment

Goal: attach this follow-on to a Linear issue and confirm it follows the
existing cockpit slice instead of expanding `JSC-248` retroactively.

Primary files:

- `docs/plans/2026-05-02-feat-session-friction-evidence-contracts-plan.md`
- Linear tracker once created or assigned

Completion criteria:

- Linear issue exists as
  [JSC-249](https://linear.app/jscraik/issue/JSC-249/add-session-friction-and-evidence-contracts).
- Plan source report, source cockpit plan, and deferred-scope boundaries are
  linked.
- Existing dirty worktree files are classified before implementation starts.

Validation:

- `pnpm exec markdownlint-cli2 docs/plans/2026-05-02-feat-session-friction-evidence-contracts-plan.md`

### P1 - Friction and Delay Taxonomy

Goal: make delay and blocker classes stable enough for agents and reports.

Primary files:

- `src/lib/decision/harness-decision.ts`
- focused unit tests beside the decision module

Completion criteria:

- Add typed values for friction classes such as `none`, `tool_friction`,
  `permission_sandbox`, `repo_state`, `unclear_instruction`,
  `validation_failure`, `implementation_complexity`, and `external_service`.
- Add typed values for delay classes such as `normal`, `waiting_on_command`,
  `waiting_on_agent`, `repeated_failure`, and `human_needed`.
- Preserve backwards compatibility for existing `harness-decision/v1` payloads.
- Provide helper validation for producers that opt into the new metadata.

Validation:

- `pnpm exec vitest run src/lib/decision/harness-decision.test.ts`
- `pnpm typecheck`

### P2 - Execution Profile and Permission Plan Metadata

Goal: make recommendations performance-aware and permission-explicit before an
agent attempts execution.

Primary files:

- `src/lib/decision/harness-decision.ts` or a nearby helper module
- `src/lib/cli/registry/command-capabilities.ts`
- `src/lib/cli/registry/types.ts`
- `src/commands/next.ts`
- `src/commands/next.test.ts`

P2 first-PR limit:

- Add metadata only for recommendations that `harness next` already emits.
- Do not add new cockpit recommendations, new command families, run indexing,
  routed instruction discovery, PR/review state inspection, or provider
  integrations in this slice.
- If a field is not needed to choose the next safe existing command, defer it.

Completion criteria:

- Define execution profiles such as `read_only`, `local`, `virtual`,
  `container`, and `remote`.
- Define startup-cost values such as `none`, `low`, `medium`, and `high`.
- Recommendations can declare network, git-write, filesystem-write, command,
  secret, and human-approval requirements.
- `harness next --json` includes execution and permission metadata for commands
  it recommends.
- Tests prove the existing `harness next` recommendations declare the cheapest
  known read-only or local execution metadata for their current command path.
  Ranking between competing command profiles is deferred with D3.
- Unknown requirements remain conservative and classify as `action_required` or
  `blocked`.

Validation:

- `pnpm exec vitest run src/commands/next.test.ts`
- `pnpm exec vitest run src/lib/cli/command-registry.test.ts`
- `pnpm typecheck`

### P3 - Session Closeout Contract

Goal: give reports the missing outcome labels.

Primary files:

- future module under `src/lib/session/**`
- focused unit tests
- optional fixtures under `tests/fixtures/**`

Completion criteria:

- Define a versioned closeout payload with outcome, primary friction,
  validation evidence, commits, PR reference, next action, and learning
  candidate.
- Include `sessionId`, `taskId`, and optional `parentTaskId` so long-running
  work and delegated work can be connected without relying on prose summaries.
- Outcomes include `done`, `blocked`, `partial`, `advisory_only`, and
  `abandoned`.
- Validation rejects empty evidence for `done` unless an explicit no-validation
  reason is present.
- Contract can be written by future work loops without requiring a dashboard.

Validation:

- focused unit tests for valid and invalid closeout fixtures
- `pnpm typecheck`

## Deferred Candidate Tracks

The following tracks are not part of the first implementation issue. They remain
useful candidates, but each needs P1-P3 adoption evidence or a concrete blocked
Codex workflow before promotion into an implementation plan.

### D1 - Subagent Evidence Contract

Candidate goal: make artifact-first review machine-checkable.

Promotion entry criteria:

- A real Codex workflow records repeated `waiting_on_agent` or
  `review_artifact_missing` friction through P1-P3 fields.
- At least two independent review producers need the same evidence shape, or the
  missing artifact cannot be represented as `HarnessDecision.meta` plus
  `EvidenceRef`.

Required semantics before implementation:

- `nil`: no manifest/source supplied. Emit `status=action_required`,
  `failureClass=missing_input`, and a next action that asks for the manifest or
  reviewer list.
- `empty`: manifest/source is valid but expects no reviewers or artifacts. Emit
  `status=pass` only when the caller explicitly marks review as not required;
  otherwise emit `status=action_required`.
- `error`: artifact read, permission, or runtime failure. Emit
  `status=blocked`, preserve the error evidence ref, and do not summarize the
  review as complete.

### D2 - PR Closure Checklist Contract

Candidate goal: turn review cleanup into a structured non-mutating decision
surface.

Promotion entry criteria:

- P1-P3 closeouts show repeated PR-state blockers or review cleanup delays that
  cannot be resolved by the current cockpit decision envelope.
- The implementation can remain read-only and explicitly network-gated.

Required semantics before implementation:

- `nil`: no PR/source supplied. Emit `status=action_required`,
  `requiresNetwork=false`, and a next action that asks for PR context.
- `empty`: provider is reachable and there are no checks/comments/items. Emit a
  typed empty state, not success, unless merge-readiness evidence is also
  present.
- `error`: provider permission, network, API, or rate-limit failure. Emit
  `status=blocked`, `requiresNetwork=true`, `failureClass=external_service`, and
  preserve the provider error evidence ref.

### D3 - Routed Instruction Context and Capability Digest

Candidate goal: reduce Codex context-loading cost by pointing agents at the
smallest correct instruction set and active capability surface.

Promotion entry criteria:

- P1-P3 evidence shows `unclear_instruction`, `repo_state`, or
  `implementation_complexity` friction caused by loading or missing the wrong
  context.
- A small source-of-truth contract can be implemented without copying full
  instruction prose into decision payloads.

Required source order before implementation:

1. Repo command registry and command-capability metadata.
2. Discovered repo instruction files from current working directory scope.
3. Repo-local skill roots and `.agents/skills/**` metadata where present.
4. Harness contract and validation surfaces.
5. Optional runtime/plugin/MCP/app/hook state only when it is locally
   discoverable without network access.

Required partial-data states before implementation:

- `unknown`: source exists conceptually but Harness cannot determine it locally.
- `not_loaded`: source is configured but not active in the current context.
- `unavailable`: source discovery failed; include evidence and a conservative
  next action.

Command ranking remains deferred with this track. It must rank cockpit commands
and task-relevant commands before plumbing commands, but only after the source
contract above is accepted.

### D4 - Run Artifact Index and Event Taxonomy

Candidate goal: let `harness next` and reports inspect recent evidence cheaply
without replaying raw transcripts or reading every artifact.

Promotion entry criteria:

- P1-P3 closeouts are produced by real workflows and repeated raw artifact
  scanning becomes a measured cost or reliability problem.
- The first implementation can be append-only JSONL; SQLite remains deferred
  until query cost proves JSONL insufficient.

Required semantics before implementation:

- Missing index: `harness next --json` continues without failure and emits
  `indexState=unavailable`.
- Malformed entry: skip the bad entry, preserve an evidence warning, and do not
  treat indexed history as complete.
- Large output: store summary plus refs, not raw logs in decision payloads.

### D5 - Prompt Translation Product Surface

Candidate goal: preserve Jamie's outcome-shaped wording as executable routing
hints.

Promotion entry criteria:

- P1-P3 produce stable command paths and blocker names.
- At least one prompt phrase appears in repeated Codex sessions or Linear
  handoffs as a real routing ambiguity.
- The update stays table-driven and removes ambiguity without adding a new
  narrative layer.

### D6 - Repo-Owned Automation Runbooks

Candidate goal: make Codex app automations reviewed, versioned, and resumable
instead of single-instance app prompt blobs.

Promotion entry criteria:

- A heartbeat or cron automation needs repeated phase execution, commit
  checkpoints, external service checks, or explicit safety stop conditions.
- The workflow can be described as a repo runbook without inventing a new
  automation DSL.

Required semantics before implementation:

- Runbook source of truth lives under `docs/automations/**`.
- App prompt stays tiny and points at the reviewed runbook.
- Runbook includes stable automation ID, target, cadence, progress cursor,
  next-step rule, validation evidence, stop conditions, safety gates, and
  reporting format.
- The progress cursor points to durable state such as a plan checklist, Linear
  comment, run artifact, PR, or closeout file.

### D7 - Resume and Workout Evals

Candidate goal: prove Harness helps Codex complete loops after compaction,
handoff, or repeated failed attempts.

Promotion entry criteria:

- P1-P3 contracts produce enough evidence for a fresh Codex instance to resume
  from persisted state.
- At least one live workflow shows repeated friction that can be reproduced as
  an eval flag.

Required semantics before implementation:

- `compaction-resume-loop`: fresh Codex resumes from a plan, closeout, run
  artifact, or progress cursor and identifies the next safe command.
- `automation-runbook-loop`: Codex executes the next automation wake-up from a
  repo-owned runbook and reports validation, blocker, commit, and next phase.
- `ablation-surface-check`: a claimed load-bearing surface must prove that
  removing it degrades completion rate, safety, blocker classification, or
  evidence quality.

## Dependency Graph

```text
P0 tracker alignment
  -> P1 friction taxonomy
    -> P2 execution profile and permissions
    -> P3 session closeout

Deferred candidates after measured P1-P3 value:
  -> D1 subagent evidence
  -> D2 PR closure checklist
  -> D3 routed instruction context and capability digest
  -> D4 run artifact index and event taxonomy
  -> D5 prompt translations
  -> D6 repo-owned automation runbooks
  -> D7 resume and workout evals
```

P1 is the core dependency because the later contracts should share the same
friction vocabulary. P2 is the highest-value performance slice because it gives
`harness next` a way to prefer cheap safe work before expensive or permissioned
work. P3 fills the report's missing outcome data. D1-D7 stay deferred until
P1-P3 produce real workflow evidence or a repeated blocker that cannot be
handled by the smaller contract.

## Validation Plan

Focused validation during implementation:

- `pnpm exec vitest run src/lib/decision/harness-decision.test.ts`
- `pnpm exec vitest run src/commands/next.test.ts`
- `pnpm exec vitest run src/lib/cli/command-registry.test.ts`
- focused tests added beside new session, evidence, or decision modules
- `pnpm exec markdownlint-cli2 docs/plans/2026-05-02-feat-session-friction-evidence-contracts-plan.md`
- `pnpm exec markdownlint-cli2 UBIQUITOUS_LANGUAGE.md` and
  `pnpm run docs:ubiquitous:guard` only if the optional prompt-translation
  example changes the glossary

Broader validation before PR handoff:

- `pnpm codestyle:parity`
- `pnpm typecheck`
- `pnpm test`
- `pnpm check`
- `bash scripts/validate-codestyle.sh`
- `bash scripts/verify-work.sh`

Fast gates such as `bash scripts/validate-codestyle.sh --fast` and
`bash scripts/verify-work.sh --fast` are allowed during iteration only. They do
not replace the full handoff gates above.

If unrelated dirty worktree changes block broader gates, record the exact
blocker and preserve focused validation evidence for this slice.

## Risk Controls

| Risk                                                                               | Control                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract churn breaks existing agents                                              | Keep new fields additive or under typed `meta`; preserve existing `harness-decision/v1` validation                                                                                       |
| Analytics scope balloons                                                           | Start with closeout and evidence contracts, not dashboards                                                                                                                               |
| Flue prior art pulls Harness toward runtime framework scope                        | Limit borrowed ideas to execution profile, permissions, typed evidence, and context routing                                                                                              |
| Claude Code comparison displaces the Codex-first target                            | Keep Codex as the primary runtime prior art and use Claude only for comparative pressure                                                                                                 |
| Performance metadata becomes decorative                                            | Require `harness next` tests that prove existing recommendations expose the cheapest known safe profile                                                                                  |
| Capability digest becomes another docs dump                                        | Keep D3 deferred until P1-P3 prove context-loading friction; when promoted, emit compact paths, active capabilities, warnings, and command metadata rather than copied instruction prose |
| Run artifact index becomes premature infrastructure                                | Keep D4 deferred until raw artifact scanning is a measured cost; if promoted, start with append-only JSONL and defer SQLite until query cost is proven                                   |
| Hook inspiration becomes a hook engine                                             | Start with event records only; do not execute lifecycle hooks in this slice                                                                                                              |
| Harness fights Codex post-training by inventing a parallel shell/tool-call surface | Keep commands as normal CLI invocations, preserve argv metadata for agent execution, and classify Codex-native permission or sandbox friction instead of hiding it                       |
| PR checklist becomes mutative                                                      | Keep first slice read-only and explicit about network requirements                                                                                                                       |
| Subagent status is mistaken for evidence                                           | Require artifact paths and non-empty evidence validation                                                                                                                                 |
| Prompt translations become prose sprawl                                            | Keep translations table-driven and linked to command or workflow evidence                                                                                                                |
| Permission planning becomes overconfident                                          | Unknown requirements must classify as conservative or `action_required`                                                                                                                  |
| Automations become app-instance drift                                              | Keep durable behavior in repo-owned runbooks and keep app prompts tiny                                                                                                                   |
| Evals become benchmark theater                                                     | Require evals to measure completion rate, evidence quality, blocker classification, or PR lead-time impact                                                                               |

## Outcome KPIs

The first release is successful only if it improves Codex session flow, not just
schema coverage. Measure these before promoting D1-D7:

| KPI                           | Target for first slice                                                                                                            | Evidence source                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `blocker_classification_time` | A fresh Codex run can classify the primary blocker from `harness next --json` or closeout evidence in under 2 minutes             | focused acceptance run or eval transcript   |
| `actionable_next_step_rate`   | At least 80% of sampled blocked or action-required decisions include a concrete next command or next action                       | P1-P3 fixtures plus one live Codex workflow |
| `closeout_completeness_rate`  | At least 80% of closeout fixtures include outcome, primary friction, validation evidence or no-validation reason, and next action | closeout fixture validation                 |

KPI collection rule:

- Owner: the implementer of the P1-P3 PR records the first measurement.
- Storage: write the measurement into the Linear issue or PR handoff summary,
  and keep any machine-readable fixture/eval evidence under the same artifact
  path used by the focused validation for that PR.
- Sampling: use the P1-P3 fixtures plus one live Codex workflow when available.
  If no live workflow is available, record `blocked` with the exact reason and
  do not promote D1-D7.

D1-D7 promotion requires one of these KPIs to expose the next bottleneck or a
recorded Codex workflow to show that the deferred track is now the limiting
factor.

## Acceptance Traceability

| Acceptance ID | Requirement                                                                                      | Plan unit |
| ------------- | ------------------------------------------------------------------------------------------------ | --------- |
| `SFE1`        | Friction and delay classes are typed and reusable                                                | P1        |
| `SFE2`        | Existing `HarnessDecision` consumers remain compatible                                           | P1        |
| `SFE3`        | Next-action recommendations expose permission needs                                              | P2        |
| `SFE4`        | Recommendations include execution profile and startup-cost metadata                              | P2        |
| `SFE5`        | `harness next` annotates existing recommendations with the cheapest known safe execution profile | P2        |
| `SFE6`        | Session closeout records outcome and primary friction                                            | P3        |
| `SFE7`        | Done closeouts require validation evidence or explicit no-validation reason                      | P3        |
| `SFE8`        | Closeout artifacts include session and task identity                                             | P3        |
| `SFE9`        | First release defines and records outcome KPIs                                                   | P0-P3     |
| `SFE10`       | Deferred tracks include promotion entry criteria before implementation                           | D1-D7     |
| `SFE11`       | Deferred review and PR tracks define nil, empty, and error semantics before implementation       | D1-D2     |
| `SFE12`       | Deferred capability digest defines source order and partial-data states before implementation    | D3        |
| `SFE13`       | Deferred run index stays optional and non-blocking until measured need exists                    | D4        |
| `SFE14`       | Deferred automation runbooks keep app prompts tiny and repo-owned behavior reviewed              | D6        |
| `SFE15`       | Deferred resume/workout evals test loop completion, not command output alone                     | D7        |

## Resume Cursor

Current safe state for the next Codex instance:

- The first implementation issue is
  [JSC-249](https://linear.app/jscraik/issue/JSC-249/add-session-friction-and-evidence-contracts)
  and remains P1-P3 only.
- P2 is limited to the smallest metadata subset needed by existing
  `harness next` recommendations.
- P3 lives under `src/lib/session/**`; do not create a competing
  `src/lib/evidence/**` closeout abstraction in the first issue.
- D1-D7 are deferred tracks. Promote one only after P1-P3 KPI evidence or a
  recorded Codex workflow proves it is the next bottleneck.
- `docs/roadmap/north-star.md`, `harness.contract.json`,
  `src/lib/contract/types-core.ts`, and
  `src/lib/init/scaffold-contract-template.ts` now carry the Codex-native
  execution and distill-or-ablate boundary.
- `docs/automations/README.md` defines the safe repo-owned automation runbook
  convention for future heartbeat work.
- `evals/scenarios/north-star-agent-delivery/README.md` records the deferred
  resume, automation-runbook, and ablation eval shapes.
- Existing unrelated dirty e2e/eval files must be preserved unless explicitly
  adopted by the implementing issue.

## Handoff to he-work

Do not start implementation until a Linear issue is assigned or an explicit
waiver records why this follow-on remains untracked. Once tracked, implement in
the P0 to P3 order above. Keep the first merged slice small: P1 plus the
execution-profile and permission-plan subset of P2 is the best initial PR
because it improves `harness next` performance and permission clarity without
requiring PR, subagent, instruction-routing, capability-digest, or run-index
work. P2 must only annotate existing `harness next` recommendations; any new
recommendation logic or provider-backed inspection belongs in a deferred track.
Follow with P3 under `src/lib/session/**` so future reports can distinguish
done, blocked, partial, abandoned, and advisory-only sessions without splitting
session closeout logic across competing module homes.

Do not promote D1-D7 until the outcome KPIs or a recorded Codex workflow show a
real bottleneck that P1-P3 cannot handle.

Use the existing cockpit implementation as a dependency, not a target for broad
rewrites. Preserve the current dirty worktree unless those files are explicitly
adopted into this plan.
