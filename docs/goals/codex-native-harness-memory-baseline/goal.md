# Codex-Native Harness Memory Baseline Goal

## Table of Contents

- [Native Goal Prompt](#native-goal-prompt)
- [Objective](#objective)
- [Why This Exists](#why-this-exists)
- [Scope](#scope)
- [Native Platform Alignment](#native-platform-alignment)
- [Required Baseline](#required-baseline)
- [Implementation Shape](#implementation-shape)
- [Completion Contract](#completion-contract)
- [Activation Boundary](#activation-boundary)
- [Startup Checklist](#startup-checklist)

## Native Goal Prompt

Use this exact native prompt when starting or restoring the goal:

```text
/goal Follow docs/goals/codex-native-harness-memory-baseline/goal.md
```

`/goal Follow <path>` is a prompt convention. The agent must read this file, `state.yaml`, and `receipts.jsonl` before acting.

Native goal state is attached to this Codex thread. The board stays repo-visible so downstream greenfield and brownfield projects can inherit the same operating surface instead of relying only on chat memory.

## Objective

Implement a Codex-native harness memory, artifact, and goal baseline in `coding-harness` and the Harness Engineering plugin so every downstream project that receives the harness gets the same operational surface from day zero.

The baseline must make durable project truth explicit across:

- native Codex Goals and continuation behavior
- `.harness` goal boards and runtime receipts
- Project Brain knowledge and decision files
- Local Memory search and learned-fix surfaces
- Chronicle evidence as observational input, never unchecked truth
- artifact registries for rendered/runtime outputs
- memory citation and evidence-routing expectations

## Why This Exists

Codex is becoming a persistent operational workspace with live artifacts, durable threads, inline steering, side-panel review, native goals, and scheduled follow-up. The harness should treat that as the default operating model, not a one-off enhancement.

Because all projects will receive `coding-harness`, this is a cross-project baseline. Greenfield projects should start with the surface already present. Brownfield projects should get an inventory and migration path that classifies existing surfaces before modifying them.

## Scope

Primary implementation repo:

- `/Users/jamiecraik/dev/coding-harness`

Plugin source to update:

- `/Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering`

Reference-only inputs:

- `/Users/jamiecraik/dev/codex`
- `/Users/jamiecraik/dev/configs`
- `/Users/jamiecraik/.codex/memories/extensions/chronicle`

Do not edit `/Users/jamiecraik/dev/codex` or `/Users/jamiecraik/dev/configs` unless Jamie explicitly expands the write scope.

## Native Platform Alignment

Preserve these native Codex facts in the design:

- native Goals are a stable/default-enabled state surface
- artifact tools are present in platform source but may be under-development or default-off depending on config
- app-server goal APIs and steering endpoints are relevant runtime behavior
- continuation must respect active turns and queued user work
- persisted/materialized thread state matters for reliable restoration
- memory citations on agent messages are a bridge between platform memory and repo-visible evidence

Model runtime actions explicitly instead of collapsing them into another prompt:

```ts
type RuntimeAction =
  | "interrupt"
  | "queue"
  | "retry"
  | "recover"
  | "verify"
  | "block";
```

## Required Baseline

Greenfield projects must receive:

- `.harness/memory/LEARNINGS.md`
- `.harness/knowledge/**`
- `.harness/decisions/**`
- `.harness/review-log.md`
- `.harness/active-artifacts.md`
- `.harness/artifacts/**`
- a goal-board convention under the repo's documented goal location
- Project Brain tags for project, type, domain, and area
- a sync receipt format that separates Project Brain, vault, Local Memory CLI, Local Memory MCP, Chronicle, native citation, artifact state, source evidence, redaction, and reason fields

Brownfield projects must receive:

- an inventory of existing memory, artifact, goal, review, and decision surfaces
- classification of each surface as canonical, mirror, legacy, optional, or blocked
- conflict handling before replacing or moving existing durable context
- a migration receipt that explains what was adopted, mapped, deferred, or blocked

## Implementation Shape

Update `coding-harness` first so the generator/template source owns the baseline. Then update the Harness Engineering plugin memory enforcement so routed HE work checks the same surfaces and receipt fields.

The implementation should prefer repo-canonical validation over ad hoc checks. The repo-canonical validation command is:

```bash
pnpm check
```

Use focused validation while iterating, but completion must name whether `pnpm check` passed, failed, or was not run, with exact blocker text when blocked.

## Completion Contract

Outcome:

- `coding-harness` contains a reusable Codex-native memory/artifact/goal baseline for downstream greenfield and brownfield project setup.
- Harness Engineering plugin memory enforcement requires the same baseline and emits machine-checkable sync receipts.
- The baseline is documented in Project Brain-compatible repo surfaces and discoverable by future agents without relying on this chat.

Verification surface:

- `PYTHONDONTWRITEBYTECODE=1 python3 /Users/jamiecraik/dev/agent-skills/Skills/agent-ops/goal-governor/scripts/check_goal_board.py docs/goals/codex-native-harness-memory-baseline`
- `pnpm check`
- focused tests or validators for any changed generator/template/plugin code
- diff review proving no unrelated dirty worktree changes were absorbed

Constraints:

- preserve user and in-flight JSC-331 worktree changes
- keep the baseline source-owned, not copied into downstream repos by hand
- treat Chronicle as evidence intake only, not canonical truth
- avoid workspace-global assumptions; scope surfaces to the project unless a repo contract says otherwise
- do not claim completion without verification evidence

Boundaries:

- do not commit, push, open PRs, or update Linear without explicit owner instruction
- do not edit `/Users/jamiecraik/dev/codex` or `/Users/jamiecraik/dev/configs` without explicit write-scope expansion
- do not start Worker implementation until the activation phrase is present
- do not replace brownfield memory/artifact surfaces without inventory and conflict classification

Iteration policy:

- Scout first, then Worker, then Judge/PM audit. Each completed task appends a receipt with changed files, evidence, validation, and next action. Repeated steering or the same failure twice must be converted into a durable rule, validator, or documented stop condition.

Blocked stop condition:

- Stop and report if the board is invalid, native goal state conflicts with the board, the write scope would touch protected repos, existing dirty work overlaps required files, required validation cannot run, or brownfield migration would overwrite unresolved project truth.

## Activation Boundary

This package is prepared for later kickoff. Do not begin Worker implementation until Jamie explicitly says:

```text
KICK OFF CODEX-NATIVE HARNESS MEMORY BASELINE
```

Before that phrase appears, allowed work is limited to setup validation, board repair, native goal reconciliation, and answering questions about the package.

## Startup Checklist

1. Read the nearest `AGENTS.md`, `CODESTYLE.md`, and relevant instruction map entries.
2. Read this `goal.md`, `state.yaml`, and `receipts.jsonl`.
3. Reconcile native goal state against the board.
4. Confirm the current worktree and avoid absorbing unrelated JSC-331 changes.
5. Run the Goal Governor board check.
6. Only after the activation phrase, assign the first Worker slice with explicit `allowed_files`, `verify`, and `stop_if`.
