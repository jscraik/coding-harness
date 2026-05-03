---
schema_version: 1
title: Agent-Native Cockpit Control Loop
type: standard-spec
status: draft
date: 2026-05-02
origin: user critique and he-spec prompt on agent-native-first harness reduction
risk: high
spec_depth: full
ui_required: false
traceability_required: false
last_validated: 2026-05-02
---

# Agent-Native Cockpit Control Loop

Status: draft specification for compressing Coding Harness around an
agent-native control loop instead of adding more standalone workflow surface.

Purpose: make Coding Harness feel smaller, clearer, and more useful by treating
decisions, next actions, evidence, and learning as the product. Existing command
families remain the engine room; the default user and agent experience becomes a
small cockpit that decides what to do next and explains why.

## Table of Contents

- [Mode Decision](#mode-decision)
- [Current vs Latest Source Status](#current-vs-latest-source-status)
- [Problem Statement](#problem-statement)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Linear Work Item Contract](#linear-work-item-contract)
- [System Boundary](#system-boundary)
- [Baseline Repo Evidence](#baseline-repo-evidence)
- [Domain Model](#domain-model)
- [Control Loop Lifecycle](#control-loop-lifecycle)
- [Command Surface Contract](#command-surface-contract)
- [Agent Decision Envelope](#agent-decision-envelope)
- [Command Tiers](#command-tiers)
- [Readiness Responsibility Split](#readiness-responsibility-split)
- [Human Rendering Contract](#human-rendering-contract)
- [Invariants and Safety Requirements](#invariants-and-safety-requirements)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Observability and Evidence](#observability-and-evidence)
- [Acceptance Matrix](#acceptance-matrix)
- [Source Parity Notes](#source-parity-notes)
- [First Planning Slice](#first-planning-slice)
- [Open Questions](#open-questions)
- [Definition of Done](#definition-of-done)
- [he-plan Handoff](#he-plan-handoff)

## Mode Decision

- **Mode:** `standard-spec`
- **Depth:** `full`
- **Reason:** this work changes the primary CLI product model, agent-facing
  machine-readable contracts, help discovery, and readiness semantics
  across multiple commands.
- **UI spec required:** no. This is a CLI and artifact contract; no dedicated UI
  components, tokens, visual states, or responsive layout are in scope.
- **Tracked Linear issue:** `JSC-248` for the first implementation slice.

## Current vs Latest Source Status

Current strongest source is the user-provided product critique in this session.
Existing related specs are supporting context, not replacements:

- `docs/specs/2026-03-24-feature-structured-output-auto-fix-spec.md`
  established canonical `GateResult` output and remediation fields.
- `docs/specs/2026-04-08-feat-coding-harness-reliability-orchestration-spec.md`
  established verification run state, failure classes, and resume behavior.
- `docs/specs/2026-04-20-feat-north-star-contract-product-surface-realignment-spec.md`
  made the north-star contract load-bearing.
- `docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md`
  defined the learning loop that turns repeated review feedback into evidence.

This spec does not supersede those artifacts. It composes them into a narrower
agent-native cockpit contract and should become the source for the next planning
slice.

## Problem Statement

Coding Harness has many useful commands, gates, docs, and policy concepts. The
underlying architecture is capable, but the default product surface still makes
humans and agents work too hard to answer the basic operating questions:

1. Where am I?
2. What changed?
3. What is risky?
4. What should I do next?
5. What command proves it?
6. Can I run that safely?
7. What evidence did I produce?
8. What should be remembered?

The project should not add three more hero workflows as separate features or doc
sections. The hero stories should be an acceptance test for compression:
anything that does not help a repo become safer for Codex, prove PR readiness,
or turn repeated review pain into a guardrail should be reduced, hidden, merged,
or reshaped.

The current risk is command and concept sprawl. Agents can consume some stable
JSON surfaces today, but they still need command-specific knowledge to interpret
readiness, recovery, safety, and next action. Humans see too much governance
language before they feel the product payoff.

## Goals

1. Define a shared agent decision envelope for high-value commands and gates.
2. Add a read-only `harness next --json` orchestrator that recommends the next
   safest existing command instead of performing mutative work.
3. Make default CLI help and command metadata emphasize a small cockpit surface
   before exposing the full command catalog.
4. Clarify readiness responsibilities across `check`, `health`, `doctor`,
   `verify-work`, `validation-plan`, `review-context`, and PR readiness.
5. Preserve the existing deep command families as implementation detail while
   making decisions, next actions, evidence, and learning the user-facing
   product.
6. Keep human output plain and operational while retaining stable canonical IDs
   and structured metadata for agents.
7. Prevent new standalone gates or narrative docs unless they reduce review or
   rework cost and can be consumed by the cockpit loop.
8. Provide acceptance criteria that prove a fresh agent can follow the cockpit
   loop without bespoke command parsing.

## Non-Goals

1. Rewriting all existing commands in one change.
2. Deleting existing expert commands before usage and compatibility are known.
3. Replacing canonical `GateResult` output for existing gates.
4. Weakening evidence, SHA, review, Linear, CI, CodeRabbit, Semgrep, or rollback
   requirements.
5. Adding new long-form hero-story docs that duplicate the cockpit contract.
6. Implementing mutative auto-remediation inside `harness next`.
7. Creating a graphical UI.
8. Creating a new tracker or replacing Linear as the system of record.

## Linear Work Item Contract

This draft is attached to Linear issue `JSC-248`.

Implementation planning must keep this Linear contract current:

- Linear issue key: `JSC-248`
- Linear title: Implement agent-native cockpit control loop first slice
- owner/team: Linear project owner
- status: Triage as of 2026-05-02
- parent/child relationship: none assigned for the first slice
- PR linkage rule: use `Refs JSC-248` until the issue is fully completed

### Linear Acceptance Traceability

| Linear item | Acceptance IDs | Status |
| --- | --- | --- |
| `JSC-248` | `SA1`-`SA13`, `SA16`, `SA17` | First implementation slice |
| Deferred follow-on | `SA14`, `SA15`, `SA18`-`SA20` | Out of first slice |

## System Boundary

### Owns

- Shared decision envelope for agent-native command consumption.
- Read-only `harness next` recommendation behavior.
- Cockpit command tiers and default help presentation.
- Responsibility split between readiness, diagnosis, verification, PR
  readiness, and learning commands.
- Human rendering rules for decision output.
- Acceptance tests and evaluations for agent-native cockpit workflows.

### Does Not Own

- Internal business logic of every existing command.
- External CI provider behavior.
- CodeRabbit, Semgrep, GitHub, or Linear service internals.
- Full remediation execution.
- Downstream repo-specific custom workflows beyond the harness-managed
  contract.

### Governed Surfaces

- `src/lib/output/**`
- `src/lib/cli/registry/**`
- `src/cli.ts`
- `src/commands/check.ts`
- `src/commands/health.ts`
- `src/commands/doctor.ts`
- `src/commands/review-gate*.ts`
- `src/commands/validation-plan.ts`
- `src/commands/review-context.ts`
- future `src/commands/next.ts`
- future PR readiness command surface
- `README.md`
- `docs/agents/quickstart.md`
- `docs/cli-reference.md`
- `.agents/skills/coding-harness/**`
- `harness.contract.json`

## Baseline Repo Evidence

Current repo evidence already supports the direction:

- `harness commands --json` exposes a machine-readable command catalog.
- Command capability metadata already includes category, mutability,
  required flags, expected artifacts, retry behavior, and safe-first
  alternatives.
- Gate JSON envelopes already expose `status`, `reason`, `action_now`,
  `action_later`, and `evidence_ref`.
- `verify-work` records run state under `.harness/runs/`.
- `review-context`, `validation-plan`, and `learnings` already encode the
  review and learning loops that the cockpit should orchestrate.
- The north-star contract already defines PR lead time, review/rework cost,
  agent reliability, and safety floor decision questions.

The missing product contract is not more raw capability. It is one default loop
that converts this evidence into the next safe action.

## Domain Model

### `HarnessDecision`

Canonical decision envelope for agent-native command output.

Required fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `schemaVersion` | string | Stable envelope version, e.g. `harness-decision/v1` |
| `producer` | string | Command or gate producing the decision |
| `status` | enum | `pass`, `fail`, `blocked`, or `action_required` |
| `summary` | string | Short human-readable result |
| `nextAction` | string | Immediate next action in plain language |
| `nextCommand` | string or null | Exact recommended command when available |
| `safeToRun` | boolean | Whether an agent may run the command without new approval |
| `requiresHuman` | boolean | Whether human input or approval is required |
| `requiresNetwork` | boolean | Whether network/API access is expected |
| `writesFiles` | boolean | Whether the recommended command mutates local files |
| `evidenceRef` | string array | Artifact, file, run, or URL references |
| `failureClass` | string or null | Stable failure/recovery class when applicable |
| `retry` | enum | `safe`, `conditional`, or `manual` |
| `riskTier` | enum | `low`, `medium`, `high`, or `unknown` |
| `meta` | object | Additive command-specific metadata |

The envelope may wrap or point to existing `GateResult` payloads. It must not
break existing `GateResult` consumers.

### `CockpitCommand`

Small command surface intended for first-contact human and agent use.

Target cockpit set:

| Command | Role |
| --- | --- |
| `harness check` | Fast current repo readiness |
| `harness next` | Decide the next safest command |
| `harness pr-ready` | Prove merge readiness |
| `harness fix-review` | Drive bounded review-fix loops |
| `harness learn` | Turn repeated review feedback into guardrails |

First-slice runnable cockpit commands are limited to registered command specs.
For `JSC-248`, default help and command metadata must not advertise
`pr-ready`, `fix-review`, or `learn` as runnable unless those commands already
exist as registered command specs in the implementation branch.

Implementation may initially expose aliases or command families while preserving
existing command names such as `learnings`, `review-gate`, and
`validation-plan`.

### `ExpertCommand`

Existing command families that remain directly callable but are not the default
first-contact interface.

Examples: `docs-gate`, `drift-gate`, `artifact-gate`, `source-outline`,
`index-context`, `replay`, `simulate`, and individual policy checks.

### `HeroStory`

An acceptance scenario that proves cockpit compression rather than adding a
separate workflow.

Required hero stories:

1. Make this repo safe for Codex.
2. Tell me why this PR is not ready.
3. Turn repeated review pain into a guardrail.

## Control Loop Lifecycle

```text
inspect state
  -> classify risk
  -> decide next safe action
  -> execute/check through existing command
  -> produce evidence
  -> learn from repeated failures
  -> return to inspect state
```

### State Model

| State | Description |
| --- | --- |
| `S0_INPUT` | User, agent, or CI invokes a cockpit command |
| `S1_CONTEXT` | Harness reads repo root, git state, contract, and command catalog |
| `S2_CLASSIFY` | Harness classifies changed files, risk, and available evidence |
| `S3_DECIDE` | Harness selects the next safest command or human action |
| `S4_RENDER` | Harness emits `HarnessDecision` JSON and human text |
| `S5_EXECUTE_EXTERNAL` | Caller executes the recommended command when safe |
| `S6_RECORD` | Existing command writes evidence or run artifacts |
| `S7_LEARN` | Repeated findings become review context, validation plans, or guardrails |

`harness next` owns `S1` through `S4` only. It does not own `S5` execution.

## Command Surface Contract

### `harness next`

`harness next` is read-only by default.

Inputs:

- current working directory
- git status and changed files
- `harness.contract.json`
- command capability catalog
- recent `.harness/runs/**` summaries
- known learning artifacts when present
- optional PR/Linear metadata when provided

Outputs:

- one `HarnessDecision`
- optional ranked alternatives
- exact next command when available
- evidence refs used for the recommendation

Required flags:

- `--json` for machine-readable output

Optional overrides:

- `--files <paths>` for explicit file override
- `--mode local|pr|ci` for context override
- `--explain`
- `--include-alternatives`
- `--no-network`

### Follow-On `harness pr-ready`

`harness pr-ready` proves merge readiness by orchestrating existing checks:

- current-head SHA discipline
- required checks
- CodeRabbit review evidence
- Semgrep/security evidence
- docs-gate
- review-gate
- Linear linkage
- validation evidence
- review context freshness when required

It must emit a `HarnessDecision` and may embed or link to `GateResult` outputs.
This command is out of the `JSC-248` first slice.

### Follow-On `harness fix-review`

`harness fix-review` drives bounded review-fix loops. It must not become
open-ended autonomous write access.

Required behavior:

- identify actionable review findings
- map each finding to changed files and validation commands
- recommend or execute only bounded fixes with explicit approval posture
- produce evidence refs for each fix attempt
- stop when review findings are resolved or the failure class requires human
  input

This command is out of the `JSC-248` first slice.

### Follow-On `harness learn`

`harness learn` is the human/agent-friendly product surface over existing
`learnings` commands.

Required behavior:

- import repeated review evidence when provided
- show relevant learnings for changed files
- recommend enforcement destination
- distinguish guardrail, validation, review-context, scaffold, and memory-only
  outcomes
- produce PR-ready evidence refs

This command is out of the `JSC-248` first slice.

## Agent Decision Envelope

### JSON Example

```json
{
  "schemaVersion": "harness-decision/v1",
  "producer": "next",
  "status": "action_required",
  "summary": "Review-gate behavior changed and needs focused tests.",
  "nextAction": "Run the focused review-gate tests before broader validation.",
  "nextCommand": "pnpm vitest run src/commands/review-gate.test.ts",
  "safeToRun": true,
  "requiresHuman": false,
  "requiresNetwork": false,
  "writesFiles": false,
  "evidenceRef": ["git:changed-files", "harness.contract.json"],
  "failureClass": null,
  "retry": "safe",
  "riskTier": "medium",
  "meta": {
    "changedFiles": ["src/commands/review-gate.ts"],
    "alternatives": ["bash scripts/validate-codestyle.sh --fast"]
  }
}
```

### Compatibility

- Existing `GateResult` stays canonical for gate outputs.
- `HarnessDecision` may include a `gateResultRef` or `gateResult` field under
  `meta`.
- Commands that already emit `GateResult` do not need to change in the first
  slice unless they are mapped into `harness next`.
- JSON output must use stdout only. Human diagnostics must not corrupt JSON.

## Command Tiers

Command metadata should gain:

| Field | Values | Purpose |
| --- | --- | --- |
| `tier` | `cockpit`, `domain`, `plumbing`, `legacy` | Default help and agent routing |
| `primaryAudience` | `agent`, `human`, `both` | Rendering and docs priority |
| `orchestratedBy` | string array | Cockpit commands that call or recommend it |

Initial tiers:

| Tier | Commands |
| --- | --- |
| `cockpit` | `check`, `next`, `pr-ready`, `fix-review`, `learn` |
| `domain` | `init`, `contract`, `review-gate`, `docs-gate`, `ci-migrate`, `linear`, `validation-plan`, `review-context` |
| `plumbing` | `drift-gate`, `artifact-gate`, `source-outline`, `index-context`, `replay`, `simulate`, individual policy checks |
| `legacy` | deprecated aliases and compatibility-only command names |

Default help should show cockpit commands first. Full command help remains
available through `--all` or equivalent. First-slice help must derive runnable
cockpit entries from registered command specs, not from conceptual follow-on
commands.

## Readiness Responsibility Split

Readiness commands must have distinct jobs:

| Surface | Responsibility |
| --- | --- |
| `harness check` | Fast repo readiness and obvious setup gaps |
| `harness next` | Next safe action selection |
| `harness verify-work` | Canonical repo verification gate |
| `harness pr-ready` | Merge readiness proof |
| `harness doctor` | Installation, config, tooling, and diagnostic recovery |
| `harness validation-plan` | Commands that prove the current change |
| `harness review-context` | Reviewer briefing from changed files and learnings |
| `harness health` | Aggregate gate scorecard and auto-fix surface |

No command should duplicate another surface's primary responsibility in human
output. It may call or recommend the other command.

## Human Rendering Contract

Human output should render operational language first and canonical IDs second.

Preferred translations:

| Internal term | Human rendering |
| --- | --- |
| `north-star evidence` | why this helps review or merge speed |
| `governed surface` | important repo surface |
| `artifact provenance` | generated file proof |
| `review context` | reviewer briefing |
| `validation plan` | commands to prove this change |
| `admission declaration` | why this change belongs |
| `product surface` | harness-owned capability |

Machine output must keep stable canonical IDs.

## Invariants and Safety Requirements

1. `harness next` is read-only unless an explicit future flag changes that
   contract.
2. Mutative recommendations must set `writesFiles: true`.
3. Network/API recommendations must set `requiresNetwork: true`.
4. Human approval requirements must set `requiresHuman: true`.
5. The next command must be exact and copy-paste runnable when present.
6. JSON stdout must remain machine-parseable.
7. Existing `GateResult` consumers must not break.
8. The cockpit must preserve strict evidence, SHA, review, and rollback
   discipline.
9. New standalone gates require a cockpit-consumption justification.
10. New narrative docs must replace, compress, or route existing docs rather
    than adding parallel guidance.
11. When command metadata conflicts, safety fields win over tier placement:
    `writesFiles`, `requiresNetwork`, and `requiresHuman` must force a
    conservative recommendation or `blocked` status before display priority is
    considered.

## Failure Model and Recovery

| Failure | Required behavior |
| --- | --- |
| Git state unavailable | Return `blocked`, no next command, evidence ref to diagnostic |
| Contract missing | Recommend `harness init --dry-run` or `harness contract init` depending on repo state |
| Contract invalid | Recommend `harness contract validate --json` or `harness doctor --json` |
| Command catalog unavailable | Return `blocked`; do not invent commands |
| Changed files unavailable | Fall back to repo readiness; mark risk `unknown` |
| Recent run failed | Recommend resume or focused failed gate command when safe |
| Network required but disabled | Return human/network blocker and offline alternative when available |
| Multiple equal next actions | Return ranked alternatives with reasons |
| Unsafe mutative action | Recommend dry-run or human approval path first |
| Parser incompatibility | Fail closed with `failureClass: decision_output_invalid` |

Recovery output must include `nextAction`, `retry`, and `evidenceRef`.

## Observability and Evidence

`harness next` should not create large artifacts by default. It should emit
evidence references to sources used for the decision.

Future optional artifact path:

```text
.harness/decisions/next/<timestamp>-decision.json
```

Decision telemetry should track:

- producer
- status
- selected command
- risk tier
- safe-to-run posture
- failure class
- evidence refs count
- whether a later command produced a passing run artifact

Telemetry must not include secrets, tokens, raw PR bodies with sensitive data,
or private review text beyond local artifact refs.

## Acceptance Matrix

| ID | Slice | Acceptance criterion | Verification |
| --- | --- | --- | --- |
| `SA1` | `JSC-248` | A shared `HarnessDecision` type exists in a stable library path. | Typecheck and unit test |
| `SA2` | `JSC-248` | `HarnessDecision.status` supports `pass`, `fail`, `blocked`, and `action_required`. | Unit test |
| `SA3` | `JSC-248` | `HarnessDecision` includes next-action, safety, network, mutation, retry, evidence, and risk fields. | Typecheck and fixture test |
| `SA4` | `JSC-248` | `harness next --json` emits valid `HarnessDecision` JSON to stdout. | CLI test |
| `SA5` | `JSC-248` | `harness next` does not mutate files by default. | Git-status fixture test |
| `SA6` | `JSC-248` | `harness next` recommends a focused validation command for changed source files when command metadata supports it. | Fixture test |
| `SA7` | `JSC-248` | `harness next` recommends diagnostic recovery when contract or tooling state is blocked. | Fixture test |
| `SA8` | `JSC-248` | `harness next` marks network-required recommendations explicitly. | Fixture test |
| `SA9` | `JSC-248` | Default help shows registered runnable cockpit commands before domain and plumbing commands. | CLI snapshot test |
| `SA10` | `JSC-248` | `harness commands --json` includes tier, primary audience, and orchestrated-by metadata for first-slice cockpit and directly orchestrated commands. | Catalog schema test |
| `SA11` | `JSC-248` | Existing `GateResult` outputs remain parseable after cockpit metadata changes. | Regression tests |
| `SA12` | `JSC-248` | Docs distinguish only the responsibilities needed for `next` to route to first-slice follow-up commands. | Docs lint plus targeted assertion |
| `SA13` | `JSC-248` | Human output renders plain operational wording while JSON keeps canonical IDs. | Snapshot test |
| `SA16` | `JSC-248` | New standalone gates require metadata proving cockpit consumption or are categorized as plumbing/legacy. | Catalog validation test |
| `SA17` | `JSC-248` | README and quickstart present the cockpit loop without adding parallel hero-story workflows. | Docs review and markdown lint |
| `SA14` | Follow-on | PR readiness cockpit command or alias produces a `HarnessDecision` that links to review, docs, required checks, Linear, and validation evidence. | CLI fixture test |
| `SA15` | Follow-on | Learning cockpit command or alias maps repeated review evidence to an enforcement destination recommendation. | Fixture test |
| `SA18` | Follow-on | A fresh-agent evaluation can complete "make repo safe for Codex" using `harness next --json` recommendations. | Evaluation scenario |
| `SA19` | Follow-on | A fresh-agent evaluation can identify why a PR is not ready using cockpit recommendations. | Evaluation scenario |
| `SA20` | Follow-on | A fresh-agent evaluation can route repeated review pain into learnings/review-context/validation-plan evidence. | Evaluation scenario |

## Source Parity Notes

- The March structured-output spec already defines `GateResult`; this spec must
  extend rather than replace that contract.
- The April reliability orchestration spec already defines verification run
  state and failure classes; this spec should reuse those concepts.
- The April north-star realignment spec already constrains product-surface
  growth; this spec applies that constraint to cockpit command tiers.
- The April CodeRabbit learnings spec already owns operational learning
  evidence; this spec exposes it through the cockpit rather than duplicating it.

## First Planning Slice

Planning should start with the smallest slice that proves the cockpit can
compress existing behavior:

1. Add `HarnessDecision` types and fixture helpers.
2. Add command metadata fields for `tier`, `primaryAudience`, and
   `orchestratedBy`.
3. Implement read-only `harness next --json` for local git/contract/changed-file
   context.
4. Recommend existing commands only; do not execute them.
5. Add focused tests for no-mutation behavior and JSON stability.
6. Update CLI help to show cockpit commands first.
7. Update README and quickstart only enough to route users and agents to the
   cockpit loop.

Out of first slice:

- full PR readiness orchestration
- mutative review fixing
- broad docs restructuring
- command deletion/deprecation
- telemetry persistence

## Open Questions

1. Should `harness next` be a top-level command or a `check next` subcommand?
   Recommendation: top-level, because it is the agent entrypoint.
2. Should `harness pr-ready` later support a human-friendly nested alias?
   Recommendation: defer aliasing until parser impact is clear; the first slice
   should use canonical kebab-case because the current dispatcher resolves one
   command token.
3. Should `learn` replace `learnings` or become an alias? Recommendation: add
   `learn` as the cockpit command while preserving `learnings` as the expert
   command family.
4. Should `HarnessDecision` be published as JSON Schema in the first slice?
   Recommendation: TypeScript type and fixture validation first; JSON Schema in
   a later compatibility slice.
5. Should `harness next` inspect remote PR/Linear state by default?
   Recommendation: no. Start local/offline, then add explicit network-enabled
   modes.

## Definition of Done

- A planner can sequence implementation from this spec without inventing
  product decisions.
- Acceptance IDs `SA1` through `SA20` are stable.
- The first slice is small enough to implement without rewriting existing gates.
- Existing `GateResult`, verify-run, north-star, and learnings contracts remain
  authoritative in their domains.
- The default product direction is agent-native first: every visible surface
  helps an agent decide, act, prove, or learn.

## he-plan Handoff

Use this spec as the WHAT contract for planning. The first plan should avoid
big-bang refactors and should not add hero-story docs as new feature surface.

Recommended planning stance:

- Start with `HarnessDecision` and read-only `harness next`.
- Treat cockpit help and command metadata as part of the same first slice.
- Keep PR readiness and learning-loop product work as later slices.
- Validate through focused CLI and catalog tests before broader gates.
