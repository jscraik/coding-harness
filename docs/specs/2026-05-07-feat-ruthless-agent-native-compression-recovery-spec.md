---
schema_version: 1
title: Ruthless Agent-Native Compression Recovery
type: standard-spec
status: proposed
date: 2026-05-07
origin: he-spec refresh after he-compound diagnosis of prior spec and plan drift
risk: high
spec_depth: full
ui_required: false
linear_issue: JSC-248
linear_status: Not started
linear_url: https://linear.app/jscraik/issue/JSC-248/implement-agent-native-cockpit-control-loop-first-slice
traceability_required: true
supersedes_scope: command-surface and acceptance portions of the 2026-05-02 cockpit spec for remaining JSC-248 work
---

# Ruthless Agent-Native Compression Recovery

Status: proposed spec refresh for the remaining `JSC-248` cockpit work.

Purpose: turn the previous "agent-native cockpit" direction into an enforceable
compression contract. The product must feel smaller than the implementation:
fresh agents should start from `harness next --json`, receive a safe work
packet, and only learn deeper commands when the cockpit selects them.

## Table of Contents

- [Mode Decision](#mode-decision)
- [Current vs Latest Source Status](#current-vs-latest-source-status)
- [Problem Statement](#problem-statement)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Linear Work Item Contract](#linear-work-item-contract)
- [System Boundary](#system-boundary)
- [Historical Baseline Repo Evidence](#historical-baseline-repo-evidence)
- [Domain Model](#domain-model)
- [Compression Lifecycle](#compression-lifecycle)
- [Interfaces](#interfaces)
- [Invariants and Safety Requirements](#invariants-and-safety-requirements)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Observability and Evidence](#observability-and-evidence)
- [Acceptance Matrix](#acceptance-matrix)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [First Planning Slice](#first-planning-slice)
- [Open Questions](#open-questions)
- [Definition of Done](#definition-of-done)
- [he-plan Handoff](#he-plan-handoff)
- [Blackboard Delta](#blackboard-delta)

## Mode Decision

- **Mode:** `standard-spec`
- **Depth:** `full`
- **Reason:** this refresh changes the primary command-discovery contract,
  default help budget, documentation entrypoint, command admission rules, and
  acceptance evidence for agent-native work.
- **UI spec required:** no. This is a CLI, documentation, and artifact contract.
- **Tracked Linear issue:** `JSC-248`.
- **Spec relationship:** this refresh narrows and hardens the remaining
  command-surface and acceptance portions of
  `docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md`.

## Current vs Latest Source Status

The current strongest source is the May 7, 2026 he-compound diagnosis: previous
specs and plans named the right north star, but they did not force deletion,
hiding, or orchestration of first-contact clutter. They allowed additive
compatibility to outrank compression.

This spec refresh does not reject the 2026-05-02 cockpit spec. It makes the
missing rule explicit:

> No command, doc, gate, artifact, or policy surface may remain first-contact
> visible unless it is directly required by `next`, `pr-ready`, or `learn`.

The active tracker is `JSC-248`, whose Linear metadata is `Todo`/`unstarted` as
of 2026-05-07 even though the issue body and PR attachments show partial
cockpit work already exists. Existing related work remains supporting context:

- `docs/roadmap/north-star.md` defines why the harness exists.
- `docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md`
  defines the cockpit direction and `HarnessDecision` envelope.
- `docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`
  implemented the first slice, but scoped out command deletion, broad docs
  restructuring, and fresh-agent hero evaluation.
- `docs/plans/2026-05-02-feat-session-friction-evidence-contracts-plan.md`
  named ablation as useful, but did not make ablation proof mandatory.
- `docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md`
  made learning evidence real, but preserved adjacent standalone command
  surfaces.
- `README.md` currently presents the cockpit loop as one route among several
  hero workflows instead of the front door.

## Problem Statement

Coding Harness has become useful enough to matter, and that is exactly why it is
at risk. It now contains enough policy, gates, commands, docs, learning loops,
and review surfaces that a fresh agent can lose the product before finding the
workflow.

The previous plans failed because their acceptance criteria proved that new
pieces existed. They did not prove that old surfaces disappeared from first
contact, that a fresh agent could avoid bespoke command knowledge, or that every
remaining visible command was justified by a cockpit route.

The product contract must flip:

1. The visible interface is a small control loop.
2. The deep command catalog is implementation detail.
3. Every extra visible surface must pass an admission test.
4. Compression must be measured from live CLI and docs evidence.
5. A spec or plan cannot be marked complete when default help, README, or the
   agent catalog still teaches agents to browse the engine room first.

## Goals

1. Make `harness next --json` the only command a fresh agent must remember.
2. Budget default help, README first-contact docs, and agent command catalog
   exposure.
3. Require every first-contact command to be selected by `next`, embedded in
   `pr-ready`, embedded in `learn`, or explicitly classified as advanced.
4. Preserve safety, review, CI, Linear, Semgrep, CodeRabbit, SHA, and rollback
   requirements while moving them behind cockpit decisions.
5. Add executable acceptance evidence for surface reduction, not just metadata
   presence.
6. Require a fresh-agent evaluation that starts from zero repo-specific command
   knowledge.
7. Require ablation proof before standalone command or doc surfaces stay
   visible.
8. Keep expert and plumbing commands available through explicit discovery.
9. Convert north-star status from prose assertion into evidence generated from
   CLI, docs, and review-loop behavior.
10. Make "agent-native" mean lower cognitive load at first contact, not simply
    more JSON.

## Non-Goals

1. Delete the deep command implementations in this spec.
2. Remove expert escape hatches required for compatibility or incident recovery.
3. Weaken governance, review, security, Linear, or rollback controls.
4. Implement a graphical UI.
5. Advertise `pr-ready` or `learn` before those rails exist as registered
   cockpit commands or stable orchestration modes.
6. Treat documentation cleanup as sufficient without CLI evidence.
7. Treat command count reduction as success if the remaining visible commands
   still require bespoke interpretation.
8. Replace Linear as the tracked work system.

## Linear Work Item Contract

- Linear issue key: `JSC-248`
- Linear title: Implement agent-native cockpit control loop first slice
- Linear URL:
  <https://linear.app/jscraik/issue/JSC-248/implement-agent-native-cockpit-control-loop-first-slice>
- Linear team: `Jscraik`
- Linear project: `coding-harness`
- Priority: High
- Status snapshot: Todo/unstarted as of 2026-05-07
- PR linkage rule: use `Refs JSC-248` until the issue is fully completed.
- Spec linkage rule: after this file lands, Linear should list this spec as
  the refreshed source for the ruthless compression recovery slice.

## System Boundary

### Owns

- Default `harness --help` first-contact budget.
- `harness commands --json --for-agent` catalog budget.
- `harness commands --json` full catalog preservation and classification.
- README first-contact route and command index placement.
- Command metadata needed for cockpit selection.
- Acceptance gates proving first-contact compression.
- Fresh-agent evaluation fixture.
- Ablation proof for visible commands, docs, and gates.

### Does Not Own

- Rewriting internal command implementations unrelated to discovery.
- Removing safety gates from the actual verification path.
- Provider behavior for GitHub, Linear, CircleCI, CodeRabbit, or Semgrep.
- Full `pr-ready` or `learn` implementation unless selected as a planning
  slice.
- Downstream repo-specific docs outside harness-managed surfaces.

### Governed Surfaces

- `src/cli.ts`
- `src/commands/commands.ts`
- `src/commands/next.ts`
- `src/lib/cli/registry/command-capabilities.ts`
- `README.md`
- `docs/cli-reference.md`
- `docs/roadmap/agent-first-status.md`
- `docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`
- Any docs or tests added to prove fresh-agent behavior.

## Historical Baseline Repo Evidence

Historical evidence collected on 2026-05-07 before the JSC-282 command-truth
cleanup:

| Evidence command | Result | Interpretation |
| --- | --- | --- |
| `pnpm exec tsx src/cli.ts commands --json --for-agent` | `commandCount: 9` | Agent catalog is narrower, but still exposes `commands`, `init`, `fleet-plan`, `validation-plan`, and `review-context` as things an agent may think it must learn. |
| `pnpm exec tsx src/cli.ts commands --json` | `commandCount: 65` | Full catalog remains large and must stay behind explicit discovery or cockpit selection. |
| `pnpm exec tsx src/cli.ts --help` | Default help lists Agent Cockpit, Discovery, Bootstrap, Review, Linear, Pilot, and Drift groups before `--all-commands`. | Help is improved but still first-contact heavy. |
| `fd -e md . docs \| wc -l` | `148` docs markdown files | Docs volume requires a strict first-contact entrypoint and deletion or merge budget for new docs. |
| `README.md` | Cockpit loop is one common route beside bootstrap, issue start, and review submission. | README still presents cockpit as a workflow rather than the front door. |

The current shape proves progress and the remaining failure at the same time.
The catalog can classify commands, but the product has not yet made the
classification ruthless enough.

Current command-truth execution for JSC-282 lives in
`.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md`.
As of the May 8 source probe, `commands --json --for-agent` returns
`commandCount: 1` with only `next`, while the full catalog remains available
through explicit expert discovery.

## Domain Model

- **First-contact surface:** text or machine-readable output a fresh human or
  agent is expected to see before choosing a path. Includes default help, README
  opening workflow, quickstart, default command catalog, and agent catalog.
- **Cockpit rail:** a stable top-level route that selects deeper behavior
  without asking the caller to know the command catalog. Initial rail is
  `next`; planned rails are `pr-ready` and `learn`.
- **Engine-room command:** an implementation command that remains supported but
  is not first-contact visible.
- **Admission proof:** evidence that a visible surface is necessary, selected by
  a cockpit rail, and cheaper than hiding or merging it.
- **Ablation proof:** evidence that removing or hiding a surface would lose a
  required outcome that cockpit routing cannot preserve.
- **Fresh-agent eval:** a repeatable test where an agent starts with only repo
  root context and `harness next --json`, then reaches the expected next safe
  action without browsing docs or guessing command names.
- **Compression budget:** a numeric or enumerated limit on what may appear in
  first-contact surfaces.

## Compression Lifecycle

1. **Inventory:** collect default help, agent catalog, full catalog, README
   first-contact sections, and command index exposure.
2. **Classify:** mark every visible surface as cockpit rail, selected domain
   command, engine-room command, compatibility escape hatch, or candidate for
   deletion/merge.
3. **Ablate:** for each visible surface, prove that hiding it would remove a
   required outcome. If not proven, hide, merge, or delete.
4. **Route:** ensure retained domain commands are selected by `next`,
   future `pr-ready`, future `learn`, or an explicit advanced discovery flag.
5. **Measure:** run executable surface checks and fresh-agent eval.
6. **Document:** make README teach the cockpit first and point expert users to
   explicit discovery.
7. **Lock:** acceptance tests fail when first-contact budgets grow without an
   updated admission proof.

## Interfaces

### CLI Help

Default `harness --help` must prioritize one memory rule:

```text
Start here: harness next --json
```

It may then show a compact human bootstrap path, but it must not teach the full
governance catalog as the primary route. Expert discovery belongs behind
`--all-commands`, `harness commands --json`, or an advanced section after the
cockpit path.

### Agent Catalog

`harness commands --json --for-agent` must return only cockpit rails and
commands an agent is expected to invoke directly without prior `next`
selection. Commands selected by `next` may be present only when their metadata
states the rail that selects them and why direct invocation is safe.

### Full Catalog

`harness commands --json` must preserve the full command catalog for
compatibility and expert workflows. Every command must expose:

- `tier`
- `visibility`
- `primaryAudience`
- `agentMode`
- `mutability`
- `retryability`
- `requiredFlags`
- `orchestratedBy`
- `safeFirstAlternatives`

### README

The README first-contact path must make the cockpit the front door. Bootstrap,
issue start, review submission, CI migration, and pilot workflows should appear
as routes selected by the cockpit or as advanced human workflows, not as equal
hero paths an agent must choose among.

### Future Rails

`pr-ready` and `learn` may appear in metadata as planned orchestration concepts,
but they must not be advertised as commands until they exist, have stable JSON,
and have acceptance tests.

## Invariants and Safety Requirements

1. `harness next --json` remains read-only unless a future spec explicitly
   changes the contract.
2. Compression must never bypass required validation, review, CI, Semgrep,
   CodeRabbit, Linear, SHA, approval, or rollback controls.
3. Mutative commands must not become default first-contact agent commands.
4. A hidden command remains reachable through explicit expert discovery when
   compatibility requires it.
5. Every first-contact command must either be a cockpit rail or have an
   admission proof.
6. Every new first-contact doc must remove, merge, or hide at least one existing
   first-contact doc section unless the plan records an approved exception.
7. A status doc cannot claim north-star progress unless its evidence command
   generated the relevant metric.
8. The agent catalog must be stable JSON and must not require parsing help text.
9. Default help must not rely on color, prose-only caveats, or ordering tricks
   that agents cannot validate.
10. Missing learning artifacts must produce a setup instruction or explicit
    degraded mode, not vague warning-only output.

## Failure Model and Recovery

| Failure | Recovery |
| --- | --- |
| Default help grows beyond budget | Fail the surface-budget check and require admission proof or hiding. |
| Agent catalog exposes an engine-room command | Fail catalog lint unless the command is a cockpit rail or has direct-invocation proof. |
| README adds another hero workflow | Require merge into cockpit route or move to advanced docs. |
| `next` cannot decide from current state | Return a read-only blocked `HarnessDecision` with missing evidence and safe recovery command. |
| Required learning source is absent | Return setup/degraded-mode metadata and do not claim learning-backed validation. |
| A safety gate is hidden and forgotten | `next`, `pr-ready`, or validation-plan must still select it from changed-file risk. |
| Fresh-agent eval needs bespoke prompt hints | Fail the eval and treat the missing route as product work. |
| Full catalog compatibility breaks | Restore explicit discovery while keeping first-contact surfaces compressed. |

## Observability and Evidence

Implementation must produce or update executable evidence for:

- Default help command count and section count.
- Agent catalog command count and allowed command names.
- Full catalog command count and command classification coverage.
- README first-contact route check.
- Fresh-agent eval transcript or fixture result.
- Ablation decision table for each visible command/doc/gate.
- North-star status metrics generated from commands or artifacts.

Evidence should be machine-readable where possible. Prose can explain, but it
must not be the only proof.

## Acceptance Matrix

| ID | Acceptance criterion | Validation evidence |
| --- | --- | --- |
| SA1 | Default `harness --help` makes `harness next --json` the single agent memory rule before any command groups. | Snapshot or test over `pnpm exec tsx src/cli.ts --help`. |
| SA2 | Default help hides the broad command groups behind explicit advanced discovery or a compact budget approved in the plan. | Help-budget test checks section and command limits. |
| SA3 | `harness commands --json --for-agent` exposes only approved first-contact commands. | Catalog-budget test asserts allowed names. |
| SA4 | Full `harness commands --json` still exposes all supported commands with complete classification metadata. | Catalog coverage test asserts metadata fields for every command. |
| SA5 | Every first-contact command is either a cockpit rail or has an admission proof. | Machine-readable admission table or lint fixture. |
| SA6 | No mutative command appears in the agent catalog unless it is explicitly safe-first and justified. | Catalog lint checks `mutability`, `safeFirstAlternatives`, and `orchestratedBy`. |
| SA7 | README presents the cockpit as the front door, not one route among peer hero workflows. | README lint or focused assertion over first-contact section. |
| SA8 | New docs added for this work are offset by deleted, merged, or hidden first-contact docs unless an exception is recorded. | Docs delta table in plan and PR evidence. |
| SA9 | A fresh-agent eval starts with only `harness next --json` and reaches the next safe action without guessing command names. | Eval fixture output or recorded transcript. |
| SA10 | Each visible command/doc/gate has ablation proof; otherwise it is hidden, merged, or deleted. | Ablation table committed with plan or test fixture. |
| SA11 | `next` returns missing-evidence and degraded-mode metadata when learning artifacts are absent. | Focused `next` or `validation-plan` fixture with missing `.harness/learnings/coderabbit.local.json`. |
| SA12 | `pr-ready` and `learn` are not advertised as commands until implemented with stable JSON and tests. | Help/catalog tests reject unregistered future rails. |
| SA13 | Safety gates remain selected by cockpit or validation planning after being hidden from first contact. | Changed-file fixture proves required checks are still recommended. |
| SA14 | North-star status updates use generated evidence rather than manually maintained prose. | Command output or artifact path cited in status update. |
| SA15 | The plan cannot mark this recovery done unless live help, agent catalog, README, and fresh-agent eval pass. | he-plan done criteria includes all four evidence classes. |
| SA16 | Command admission rules are documented in the developer-facing command registry docs or equivalent source. | Docs or code reference in plan evidence. |
| SA17 | Compatibility escape hatches remain discoverable through explicit expert commands. | `--all-commands` or full catalog test. |
| SA18 | The first implementation slice does not broaden scope into unrelated command rewrites. | Diff review against governed surfaces. |

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Status |
| --- | --- | --- |
| `JSC-248` | `SA1`-`SA18` | Refreshed compression recovery contract for remaining cockpit work. |

## First Planning Slice

The next `he-plan` should avoid another broad plan. The first slice is:

1. Add a surface-budget fixture for default help and agent catalog.
2. Add a small command admission table or derive it from registry metadata.
3. Update `harness --help` to make `harness next --json` the only agent memory
   rule and move broad command groups behind advanced discovery.
4. Tighten `commands --json --for-agent` to approved first-contact commands.
5. Rewrite the README first-contact section around the cockpit front door.
6. Add a fresh-agent eval fixture that starts from `next --json`.
7. Record ablation decisions for every retained first-contact command.

Do not start by editing every old command. Make the front door enforceable
first.

## Open Questions

1. Should `init` remain in the agent catalog, or should `next` select `init`
   only when the repo is not initialized?
2. Should `commands` remain first-contact for agents, or should it be expert
   discovery only once `next` produces complete work packets?
3. Is `check` a direct cockpit rail or a command selected by `next`?
4. What numeric budget should default help use: command count, section count,
   line count, or a combined threshold?
5. Where should ablation proof live long term: registry metadata, docs, tests,
   or generated artifact?
6. Should `pr-ready` be a new command, a `next --mode pr` rail, or a
   `HarnessDecision` profile?

## Definition of Done

This spec refresh is done when:

- Linear linkage is resolved to `JSC-248`.
- The refreshed spec contains stable acceptance IDs.
- The spec distinguishes current active sources from older supporting sources.
- The spec defines first-contact budgets and ablation proof as mandatory.
- The next planning slice can proceed without reopening the product question.

The future implementation is done only when:

- `harness --help` passes the first-contact budget.
- `harness commands --json --for-agent` passes the catalog budget.
- README makes the cockpit the first route.
- The fresh-agent eval passes.
- Safety gates remain selected by cockpit or validation planning.

## he-plan Handoff

Use `$he-plan` next with this scope:

- Source spec:
  `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md`
- Linear issue: `JSC-248`
- First slice: help/catalog/README/fresh-agent eval/ablation proof.
- Required validation lanes:
  - focused unit or fixture tests for help and catalog budgets
  - `pnpm exec tsx src/cli.ts --help`
  - `pnpm exec tsx src/cli.ts commands --json --for-agent`
  - `pnpm exec tsx src/cli.ts commands --json`
  - README first-contact assertion
  - fresh-agent eval fixture
- Stop rule: do not plan broad command rewrites until the first-contact budget
  is executable.

## Blackboard Delta

```yaml
schema_version: he-blackboard-delta/v1
topic: ruthless-agent-native-compression
linear_issue: JSC-248
finding:
  previous_specs_failed_because: compression was advisory while additive compatibility was mandatory
  live_symptom:
    - default_help_exposes_broad_operational_catalog
    - README_treats_cockpit_as_one_route_among_many
    - full_catalog_has_65_commands
    - agent_catalog_has_9_commands_but_still_exposes_non_rail_surfaces
  recovery_stage: spec_refresh_written
  next_action: run he-plan for help/catalog/README/fresh-agent-eval first slice
  non_negotiable_rule: agents_should_only_need_to_remember_harness_next_json
retained_refs:
  - docs/roadmap/north-star.md
  - docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md
  - docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md
  - docs/plans/2026-05-02-feat-session-friction-evidence-contracts-plan.md
  - docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md
  - README.md
  - src/lib/cli/registry/command-capabilities.ts
  - src/commands/next.ts
```
