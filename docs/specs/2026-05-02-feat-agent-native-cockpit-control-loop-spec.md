---
schema_version: 1
title: Agent-Native Cockpit Control Loop
type: standard-spec
status: draft
date: 2026-05-02
origin: user critique and he-spec prompt on agent-native-first harness reduction + 2026-05-03 blunt product critique
risk: high
spec_depth: full
ui_required: false
traceability_required: true
last_validated: 2026-05-04
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
- [Approval Reviewer Contract](#approval-reviewer-contract)
- [Goal Continuation Contract](#goal-continuation-contract)
- [Technical Contract Details](#technical-contract-details)
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

Current strongest source is the 2026-05-03 blunt product critique: Coding
Harness is directionally right because it makes the repo, review loop, evidence
model, and rollback path more legible for agents, but it is not yet fully
agent-native because the product exposes too much governance before the default
execution loop is obvious.

The 2026-05-02 source spec and plan remain current. This update sharpens the
same cockpit direction rather than replacing it.

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

Live evidence from the critique pass:

- `node dist/cli.js commands --json` reported 64 registered commands.
- `node dist/cli.js --help` and `node dist/cli.js next --json` worked from the
  built CLI path.
- `pnpm exec tsx src/cli.ts --help` and `pnpm exec tsx src/cli.ts next --json`
  failed with `listen EPERM` on `/tmp/tsx-501/...pipe` in the sandbox.
- `docs/roadmap/agent-first-status.md` contains the right PR lead-time and
  review/rework metrics, but the product is more compelling when those metrics
  are derived from executable evidence rather than maintained status prose.

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

The product must therefore make the implementation feel smaller than it is:
agents operate through one obvious cockpit loop, while deeper governance remains
available as engine-room capability.

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
9. Prefer built CLI and repo wrapper execution paths for operational guidance so
   known `tsx` IPC failures do not leak into the default agent path.
10. Make PR lead-time and review/rework metrics executable evidence before they
    are used as product proof.
11. Promote the repeated-failure rule as the core story: when the same review or
    validation failure happens twice, the repo should gain a durable guardrail.
12. Treat Codex Auto-review as a measurable approval reviewer option that can be
    surfaced through the cockpit without weakening human-required boundaries.
13. Treat Codex goals as optional runtime objective cursors for long-running
    work, without replacing Linear, specs, plans, or closeout artifacts as the
    durable source of truth.

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
9. Deleting advanced commands in the first slice.
10. Treating manually maintained metric prose as sufficient proof of product
    impact.
11. Enabling Codex Auto-review globally or treating it as a deterministic
    security guarantee.
12. Creating, replacing, pausing, resuming, or completing Codex goals
    automatically from inferred project intent.

## Linear Work Item Contract

This draft is attached to Linear issue `JSC-248`.

Implementation planning must keep this Linear contract current:

- Linear issue key: `JSC-248`
- Linear title: Implement agent-native cockpit control loop first slice
- owner/team: Linear project owner
- status snapshot: Triage as of 2026-05-02; refresh live Linear state before
  using this field for execution
- parent/child relationship: none assigned for the first slice
- PR linkage rule: use `Refs JSC-248` until the issue is fully completed

### Linear Acceptance Traceability

| Linear item | Acceptance IDs | Status |
| --- | --- | --- |
| `JSC-248` | `SA1`-`SA13`, `SA16`, `SA17` | First implementation slice |
| Deferred follow-on | `SA14`, `SA15`, `SA18`-`SA20` | Out of first slice |
| Deferred product-compression follow-on | `SA21`-`SA27` | Out of first slice |
| Technical hardening follow-on | `SA28`-`SA35` | Follow-on unless needed to make `next` deterministic |
| Deferred Codex config and approval follow-on | `SA36`-`SA45` | Out of first slice; may be split across `JSC-248` and `JSC-249` |
| `JSC-279` | `SA46`-`SA52` | Deferred goal-continuation child issue under `JSC-249` |

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
- Built CLI execution works where direct `tsx` execution can fail in sandboxed
  agent contexts, so operational surfaces must avoid making `tsx` the default
  agent path.

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
| `riskTier` | enum | `low`, `medium`, `high`, `critical`, or `unknown` |
| `meta` | object | Additive command-specific metadata |

The envelope may wrap or point to existing `GateResult` payloads. It must not
break existing `GateResult` consumers.

Precedence invariant: top-level `HarnessDecision.requiresHuman` is the
aggregate human-approval result for the whole decision. If any nested metadata,
including `ApprovalPlan` or `GoalContext`, requires a human, cannot prove
approval posture, or reports incomplete/unknown safety state, the top-level
value must be `true` or the decision must fail closed to a safer
blocked/action-required state with an explicit `failureClass`. Nested metadata
must never make the top-level decision less restrictive.

### `DecisionSource`

Normalized source record used by `harness next` before a recommendation is
selected.

Required fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `kind` | enum | `git`, `contract`, `catalog`, `run`, `learning`, `linear`, `pr`, or `config` |
| `ref` | string | Stable file, command, URL, or artifact reference |
| `freshness` | enum | `current`, `stale`, `missing`, or `unknown` |
| `sha` | string or null | Git SHA the source applies to when known |
| `status` | enum | `usable`, `empty`, `invalid`, or `blocked` |
| `failureClass` | string or null | Stable reason when the source cannot be used |

The decision engine must carry unusable sources into `meta.sourceErrors` rather
than silently ignoring them.

### `RecommendationCandidate`

Internal candidate produced before final ranking.

Required fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `command` | string or null | Exact command if runnable |
| `reason` | string | Plain operational reason for the candidate |
| `sourceRefs` | string array | Decision sources that produced the candidate |
| `score` | number | Deterministic ranking score |
| `riskTier` | enum | `low`, `medium`, `high`, `critical`, or `unknown` |
| `safeToRun` | boolean | Candidate safety posture |
| `requiresHuman` | boolean | Candidate approval posture |
| `requiresNetwork` | boolean | Candidate network posture |
| `writesFiles` | boolean | Candidate mutation posture |

Scores are implementation detail. The externally observable contract is stable
ordering for identical inputs and source refs.

### `MetricEvidence`

Executable metric record used when the harness claims product impact.

Required fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `metric` | enum | `pr_lead_time`, `review_retry_rate`, `manual_interventions`, or `merge_block_time` |
| `window` | string | Time window, e.g. `30d` |
| `source` | string | GitHub, Linear, CI, or local artifact source |
| `sampleSize` | number | Number of PRs, reviews, or runs included |
| `status` | enum | `complete`, `partial`, `unavailable`, or `manual_only` |
| `value` | number or null | Computed value when available |
| `evidenceRef` | string array | Commands, artifacts, or URLs used |

Manual status prose may explain direction, but only `complete` or explicitly
qualified `partial` metric evidence can be used as proof of impact.

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

Conceptual cockpit commands may appear in specs and plans, but runnable cockpit
commands are the only commands that default help, `commands --json`, or
`harness next` may recommend without a registered implementation.

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

### `AgentSnapshot`

One-call summary of the repo state an agent needs before acting. The first slice
may satisfy this through `harness next --json` metadata instead of a separate
command, but the contract should be explicit.

Required content:

- project and package-manager identity
- git branch, head SHA, and changed-file summary
- contract and command-catalog status
- selected next command and ranked alternatives
- required checks and known blockers
- Linear/PR linkage status when supplied or discoverable without network
- validation-plan and review-context refs when available
- rollback or resume notes when recent run evidence exists

### `GuardrailRoute`

Durable outcome recommendation when repeated failures are detected.

Valid destinations:

| Destination | Use when |
| --- | --- |
| `test` | A deterministic regression can catch the repeated failure |
| `lint` | The failure is structural, syntactic, or policy-checkable |
| `docs_gate` | Reviewer confusion is caused by missing or stale required docs |
| `review_context` | Reviewers need repeated context before merge |
| `scaffold` | New repos should inherit a file, script, or config |
| `project_brain` | The finding is durable operating knowledge |
| `skip_reason` | The repeated pattern is intentionally not enforced |

`skip_reason` is valid only when evidence explains why enforcement would create
more noise than safety.

### `ApprovalPlan`

Decision metadata that explains whether the recommended action can run inside
the current sandbox, needs a reviewer, or must stop for a human.

Required keys:

| Field | Type | Purpose |
| --- | --- | --- |
| `approvalPolicy` | string or null | Effective Codex or Harness approval policy when known |
| `approvalsReviewer` | enum | `user`, `auto_review`, `guardian_subagent`, `none`, or `unknown` |
| `permissionProfile` | string or null | Effective sandbox or permission profile when known |
| `autoReviewEligible` | boolean | Whether the action is eligible for Auto-review instead of synchronous human review |
| `strictAutoReviewSuggested` | boolean | Whether extra turn-level review is recommended after a permission grant |
| `requiresHuman` | boolean | Whether the recommendation still needs human input or approval |
| `riskTier` | enum | `low`, `medium`, `high`, `critical`, or `unknown` |
| `userAuthorization` | enum | `unknown`, `low`, `medium`, or `high` |
| `decisionSource` | enum | `sandbox`, `codex_auto_review`, `harness_policy`, `human_required`, or `unknown` |
| `reason` | string | Plain operational reason for the approval posture |

`guardian_subagent` is accepted only as Codex compatibility vocabulary.
Harness-authored docs, generated config examples, and recommendations should
prefer `auto_review`.

`none` means no reviewer is configured or discoverable; it must not mean
"approval is unnecessary." If `approvalsReviewer` is `none` or `unknown` for an
action that might require approval, the decision must set top-level
`requiresHuman: true` or fail closed to a safer blocked/action-required state.

Missing `approvalPolicy` or `permissionProfile` values must be represented as
`null`; implementations must not fabricate placeholder strings to satisfy the
shape.

### `GoalContext`

Optional decision metadata that captures a Codex thread goal, Linear issue, or
plan objective as the active runtime cursor for long-running work.

Required core fields when the `goalContext` object is present:

| Field | Type | Purpose |
| --- | --- | --- |
| `objective` | string or null | Explicit objective text supplied by the user, runtime, Linear, or plan |
| `status` | enum | `absent`, `active`, `paused`, `budget_limited`, `complete`, or `unknown` |
| `source` | enum | `codex_goal`, `linear`, `plan`, `user_prompt`, or `unknown` |

Conditional fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `goalRef` | string or null | Runtime goal id, thread id, or artifact ref when available |
| `linkedPlan` | string or null | Harness plan id or path when matched |
| `linkedLinearIssue` | string or null | Linear issue key when matched |
| `tokenBudget` | number or null | Token budget when the runtime exposes one |
| `tokensUsed` | number or null | Tokens consumed against the active goal when known |
| `timeUsedSeconds` | number or null | Elapsed time against the active goal when known |
| `completionEvidence` | string[] | Evidence refs required before treating the goal as complete |
| `nextContinuationAction` | string or null | Next safe action toward the active objective |

Rules:

- A Codex goal is a runtime continuation cursor, not a replacement for Linear,
  source specs, plans, PR state, or closeout artifacts.
- Harness must not create, replace, pause, resume, clear, or complete a Codex
  goal unless the user, system, or developer instruction explicitly authorizes
  that exact goal action.
- Harness must not mark a goal complete unless concrete validation, file, PR,
  Linear, or artifact evidence covers every explicit requirement in the
  objective.
- Unknown, stale, mismatched, or unreachable goal state should degrade to
  `unknown` or `absent` metadata and should not block first-slice cockpit
  recommendations.
- For `absent` or `unknown` status, `objective` may be null and conditional
  fields may be omitted, null, or empty arrays according to the JSON schema.
  Implementations must not fabricate placeholder evidence to satisfy shape.
- `completionEvidence` is required only when a decision recommends treating the
  objective as complete. It may be empty for active, paused, budget-limited,
  absent, or unknown goal context.
- If `goalContext` is present but stale, conflicting, incomplete, or unknown,
  any recommendation that depends on that context must set top-level
  `requiresHuman: true` or fail closed to a safer blocked/action-required state
  with an explicit `failureClass`.

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

### Decision Source Precedence

`harness next` must read sources in a deterministic order and keep source errors
visible in output metadata.

Precedence:

1. Git root, branch, head SHA, and changed files.
2. `harness.contract.json` and generated harness install state.
3. Command catalog metadata from registered commands.
4. Recent run artifacts under `.harness/runs/**` that match the current head
   SHA.
5. Learning, review-context, and validation-plan artifacts that match changed
   files.
6. Optional Linear or PR metadata only when supplied, cached, or explicitly
   network-enabled.

If two sources conflict, the more specific current-head source wins. If neither
source can be tied to the current head SHA, the decision must mark the
conflict under `meta.sourceErrors` and prefer the safer action.

Recent run selection is bounded:

- consider only parseable run summaries with a timestamp and head SHA
- prefer current-head runs over stale-head runs
- within the same SHA, prefer the newest run by timestamp
- if timestamps tie, prefer the lexicographically smallest artifact path
- ignore invalid run artifacts as decision inputs but report them as source
  errors

### Recommendation Algorithm

The recommendation algorithm must be deterministic for identical repo state,
inputs, environment flags, and available artifacts.

Candidate ordering:

1. Blockers that prevent reliable inspection.
2. Safety, contract, or tooling diagnostics.
3. Focused validation for changed production code.
4. Review/readiness evidence for PR-shaped work.
5. Learning or guardrail routing for repeated failures.
6. Broader verification gates.

Tie-break order:

1. lower `riskTier`
2. `safeToRun: true` before unsafe
3. `requiresHuman: false` before human-required
4. `requiresNetwork: false` before network-required
5. `writesFiles: false` before mutative
6. higher command metadata specificity for changed files
7. lexicographic command name
8. lexicographic evidence refs

First-slice output should omit alternatives by default unless they are necessary
to explain a tie or a blocked state. When alternatives are emitted, they must
appear under `meta.alternatives` and use the same deterministic order as the
candidate ranking. The follow-on `--include-alternatives` flag may later expose
more complete candidate lists after parser support exists.

### Source Error Handling

| Source condition | Required handling |
| --- | --- |
| Missing optional source | Continue; add `freshness: missing` only when it affects the recommendation |
| Empty source | Continue if emptiness is valid; otherwise add `status: empty` source error |
| Invalid JSON or schema | Ignore as input, add `status: invalid`, and prefer safer action |
| Current-head mismatch | Mark source `stale`; use only as contextual evidence |
| Required local source blocked | Return `blocked` unless a safer diagnostic command exists |
| Network source unavailable | Do not fail offline mode; return local recommendation and mark network source unavailable |

Source errors must not corrupt stdout JSON. They belong in `meta.sourceErrors`.

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

Required for machine-readable output:

- `--json` for machine-readable output

First-slice optional overrides:

- `--files <paths>` for explicit file override
- `--mode local|pr|ci` for context override

Follow-on optional flags. Do not document in CLI help until parser support and
tests exist:

- `--explain`
- `--include-alternatives`
- `--no-network`

Operational guidance must prefer the built CLI or repo wrapper path:

- `node dist/cli.js next --json`
- `bash scripts/harness-cli.sh next --json` when the wrapper exists
- package scripts that invoke the built CLI

Direct `pnpm exec tsx src/cli.ts next --json` is a development path, not the
default agent path, because sandboxed IPC can fail before harness logic runs.

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

### Follow-On Metrics Commands

Impact metrics should eventually be executable command output, not static prose.

Target commands:

```bash
harness metrics pr-lead-time --since 30d --json
harness metrics review-rework --since 30d --json
```

Each command must emit `MetricEvidence` records with source completeness. When
required APIs or artifacts are unavailable, output must say `unavailable` or
`manual_only` instead of implying measured improvement.

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

## Approval Reviewer Contract

Codex Auto-review is useful prior art because it makes approval review a
separate, auditable role at the sandbox boundary. Harness should adopt the
contract shape, not the assumption that AI approval replaces human governance.

Source-backed Codex behavior:

- Auto-review routes boundary-crossing approval requests to a separate reviewer
  when approval policy and `approvals_reviewer` allow it.
- Manual user review remains the safe default unless profile or runtime
  requirements select Auto-review.
- The reviewer receives compact task context plus the exact planned action and
  returns strict structured output with outcome, risk, authorization, and
  rationale.
- Timeout, malformed output, or reviewer execution failure must fail closed.
- Repeated denials should stop the trajectory or route back to the human rather
  than encouraging repeated escalation attempts.

Harness adaptation:

- `harness next --json` should eventually include `approvalPlan` under `meta`
  or as a promoted field when the schema is revised.
- `auto_review` may be recommended only when the action is bounded, intent is
  clear, required local policy allows it, and the failure mode is safer than
  blind full-access execution.
- `requiresHuman: true` remains mandatory for destructive data deletion,
  credential or secret exposure, security weakening, production deploys,
  broad filesystem writes, ambiguous user intent, and any action whose local
  policy requires human judgement.
- Auto-review outcomes should be captured as evidence when available:
  `reviewId`, target item, action type, risk level, user authorization,
  outcome, terminal status, decision source, rationale, and source refs.
- Auto-review is a friction-reduction and monitoring mechanism, not a branch
  protection bypass, CodeRabbit replacement, Semgrep replacement, or reviewer
  independence substitute.

Initial `ApprovalPlan` output should be conservative. If Harness cannot prove
the approval policy, reviewer, sandbox, or authorization state, it should emit
`unknown` values and prefer the safer recommendation.

## Goal Continuation Contract

Codex `/goal` is useful prior art because it turns "what are we trying to keep
working toward?" into a persisted runtime object with status, budget, token
usage, and continuation behavior. It directly addresses the plan-staleness and
resume-friction problem, but only if Harness treats it as a cursor over durable
truth rather than a new source of truth.

Source-backed Codex behavior:

- The live Codex fork defines `Feature::Goals` as an experimental feature with
  key `goals`, default disabled, and the menu description "Set a persistent
  goal Codex can continue over time".
- The live TUI implements `/goal`, `/goal <objective>`, `/goal clear`,
  `/goal pause`, and `/goal resume` behind the `goals` feature flag.
- Official OpenAI app-server docs expose experimental `thread/goal/set`,
  `thread/goal/get`, and `thread/goal/clear` API calls for loaded threads,
  requiring `capabilities.experimentalApi`.
- Current official slash-command docs do not list `/goal`, so generated Harness
  docs should describe it as live experimental Codex prior art rather than a
  stable public slash-command contract.
- Codex goal tools allow the model to read the current goal, create one only
  when explicitly requested by the user or higher-priority instructions, and
  mark it `complete` only when no required work remains.
- Codex continuation prompts require a completion audit against actual files,
  command output, tests, PR state, or other evidence before calling
  `update_goal`.

Harness adaptation:

- `harness next --json` should eventually expose optional `goalContext`
  metadata when a Codex goal, Linear issue, or plan objective is available.
- Goal context should help rank the next safe action and explain why a
  recommendation advances the active objective.
- Goal context should be copied into closeout artifacts and Linear comments as
  resume evidence when available.
- Harness should compare runtime goal text against the linked plan and Linear
  issue; mismatches should be reported as stale or unknown context instead of
  silently overriding the plan.
- Completion requires prompt-to-artifact evidence: every explicit requirement,
  named file, command, test, gate, issue, or deliverable must map to evidence
  before Harness treats the active objective as complete.
- Token budget and elapsed time should feed session-friction evidence, not drive
  completion by themselves.

This contract is deferred. The first slice should only leave a clean schema
home for `goalContext`; it should not call Codex app-server goal APIs, enable
experimental features, or generate `/goal` instructions for downstream repos by
default.

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

## Technical Contract Details

### Schema Compatibility

`HarnessDecision` is additive around existing output contracts.

Rules:

- `schemaVersion` must remain `harness-decision/v1` for the first production
  release of this envelope.
- Required top-level fields must not be removed or renamed inside v1.
- New command-specific fields must live under `meta`.
- Existing `GateResult` payloads may be referenced or embedded under `meta`,
  but gate commands must not be forced to emit `HarnessDecision` in the first
  slice unless `harness next` directly wraps them.
- Fixture tests must cover at least one success, one blocked diagnostic, and one
  action-required recommendation.

### Runtime Invocation Contract

Agent-facing docs and generated command suggestions must prefer operational
paths that run the built CLI or repository wrappers. The direct TypeScript
development path may appear in contributor docs, but it must not be the default
recommended path for agents.

`harness next` recommendations must also be runnable from the current working
directory. If the recommended command requires a different directory, the command
string must include the directory change or return a human action instead.

### Network and Permission Semantics

Network use is opt-in for the first slice.

Rules:

- Local git, contract, catalog, and file-system evidence may be read by default.
- PR and Linear metadata may be used only when supplied as local artifacts,
  present in cached harness state, or explicitly enabled by mode/flag in a
  follow-on slice.
- A command that requires GitHub, Linear, CodeRabbit, CircleCI, or Semgrep
  service access must set `requiresNetwork: true`.
- A command that could write local files must set `writesFiles: true` even when
  it also supports dry-run behavior.
- A command that requires approval, credentials, or unresolved user intent must
  set `requiresHuman: true`.

### Metric Completeness Semantics

PR lead-time and review/rework metrics are product proof only when the source
and completeness are explicit.

Metric output must distinguish:

- `complete`: all required sources for the requested window were available
- `partial`: at least one required source was missing, but the sample is still
  useful and disclosed
- `unavailable`: measurement cannot be computed
- `manual_only`: value comes from maintained prose or manual status, not
  executable evidence

Docs may cite manual-only values as planning context, but not as validation that
the cockpit reduced lead time.

### Guardrail Promotion Semantics

When repeated failures are detected, cockpit output should recommend one durable
destination instead of only reporting the failure again.

Promotion rules:

- If a repeated failure has a deterministic reproduction, prefer `test`.
- If it is policy-checkable without running product code, prefer `lint`.
- If the failure is caused by stale or missing required docs, prefer
  `docs_gate`.
- If reviewers need context rather than enforcement, prefer `review_context`.
- If new repos should inherit the fix, prefer `scaffold`.
- If the rule is operational knowledge, prefer `project_brain`.
- If enforcement would be noisy or counterproductive, require an explicit
  `skip_reason` with evidence.

The recommendation should include the source evidence that proves the failure
repeated. If repetition cannot be proven, the output should recommend collecting
evidence rather than promoting a guardrail.

### Codex-Native Config Evidence

Live `~/dev/codex` inspection and `codex-repo` MCP evidence confirm that
Codex already has first-class config surfaces for global developer steering,
compaction steering, and approval-review routing:

- `developer_instructions` is loaded from config/overrides, stored on session
  configuration, and injected into developer message sections. Harness should
  treat it as a high-priority global instruction layer for stable machine-wide
  behavior, not as another repo policy dump.
- `compact_prompt` is loaded from config/overrides and used by Codex compaction
  when building the synthetic compaction input. Harness should treat it as a
  native resume hook for long-running agent loops.
- `experimental_compact_prompt_file` is present in the current Codex config
  schema and loader path. It reads a non-empty file into `compact_prompt`, so a
  repo- or config-owned compact prompt file is a valid candidate for reviewed,
  versioned compaction instructions.
- `approvals_reviewer = "auto_review"` is the product-facing approval reviewer
  value. The legacy `guardian_subagent` value remains accepted by Codex for
  compatibility and should be treated as an alias, not the Harness-preferred
  term.
- `[auto_review].policy` is the Codex policy hook for reviewer behavior. Harness
  may inspect or validate this setting in a follow-on config steering lane, but
  must not generate it blindly.

Harness adaptation:

- The cockpit should not generate or own these Codex settings in the first
  slice.
- If a downstream Codex control plane adopts them, Harness should validate that
  they are short, global, version-gated, and not duplicating AGENTS or skill
  content.
- `compact_prompt` and `experimental_compact_prompt_file` should feed the
  deferred resume/compaction evidence track before becoming required bootstrap
  output.
- `developer_instructions` should be recommended only for stable global
  defaults such as naming, negative prompts, permission posture, and compaction
  survival rules.
- Approval reviewer guidance should live in permission and execution metadata,
  not in copied prose. The actionable cockpit surface is `approvalPlan`, not a
  long instruction paragraph.

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
| `cockpit` | `check`, `next` when registered; `pr-ready`, `fix-review`, and `learn` only after their registered command specs exist |
| `domain` | `init`, `contract`, `review-gate`, `docs-gate`, `ci-migrate`, `linear`, `validation-plan`, `review-context` |
| `plumbing` | `drift-gate`, `artifact-gate`, `source-outline`, `index-context`, `replay`, `simulate`, individual policy checks |
| `legacy` | deprecated aliases and compatibility-only command names |

Default help should show cockpit commands first. Full command help remains
available through `--all` or equivalent. First-slice help must derive runnable
cockpit entries from registered command specs, not from conceptual follow-on
commands.

For `JSC-248`, acceptance for help and catalog behavior is bound only to
runnable cockpit commands: existing `check` plus `next` after it is registered.
The target cockpit product set remains `check`, `next`, `pr-ready`,
`fix-review`, and `learn`, but target-set membership alone is not enough to
advertise or recommend a command.

Advanced and maintainer commands should remain callable, but they should be
visually de-emphasized in first-contact help unless they are the selected next
action. The intent is product compression, not command deletion.

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
12. Identical repo state, inputs, environment flags, and artifacts must produce
    identical `nextCommand`, status, source-error ordering, and alternative
    ordering.
13. First-contact help must never list conceptual cockpit commands as runnable
    unless they are backed by registered command specs.
14. Product-impact claims must distinguish executable metrics from manual
    status prose.

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
| Direct `tsx` IPC failure | Recommend built CLI or repo wrapper path before retrying development path |
| Metric source unavailable | Emit `MetricEvidence.status: unavailable` or `manual_only`; do not claim measured impact |
| Repeated failure lacks guardrail route | Recommend evidence collection or explicit `skip_reason`; do not silently drop the learning loop |

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
- metric evidence status when product-impact metrics are requested
- guardrail destination when repeated failures are detected

Telemetry must not include secrets, tokens, raw PR bodies with sensitive data,
or private review text beyond local artifact refs.

North-star evidence should be reportable as executable metrics before it is used
as product proof:

- PR lead time p50/p90 by measured PR lifecycle window
- review retry rate by number of review cycles per PR
- manual intervention count by blocked/human-required decision outcomes
- merge block time by duration spent waiting on required checks or review
- repeated-failure promotion rate by guardrail destination

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
| `SA21` | Follow-on | Agent-facing docs prefer built CLI or repo wrapper execution paths over direct `tsx` operational commands. | Docs assertion |
| `SA22` | Follow-on | PR lead-time metric output distinguishes executable evidence from manual status prose. | Metrics fixture test |
| `SA23` | Follow-on | Review/rework metric output exposes sample size, time window, and source completeness. | Metrics fixture test |
| `SA24` | Follow-on | Repeated review or validation failures map to one durable guardrail destination or an explicit skip reason. | Learning fixture test |
| `SA25` | Follow-on | `harness next --json` can return an agent snapshot with branch, SHA, changed files, known blockers, selected command, and evidence refs. | CLI fixture test |
| `SA26` | Follow-on | Advanced commands remain callable while default first-contact help emphasizes runnable cockpit commands. | CLI snapshot test |
| `SA27` | Follow-on | Static product claims about PR lead-time improvement are backed by a command, artifact, or explicit manual-only label. | Docs and metrics assertion |
| `SA28` | Technical hardening | `riskTier` accepts existing `critical` values and preserves compatibility with the decision library. | Typecheck and unit test |
| `SA29` | Technical hardening | Parser-exposed flags for `harness next` are limited to implemented options; follow-on flags are not documented as runnable until supported. | CLI usage test |
| `SA30` | Technical hardening | Missing, empty, invalid, stale, and blocked sources are classified under `meta.sourceErrors` without corrupting JSON stdout. | Fixture test |
| `SA31` | Technical hardening | Identical inputs and artifacts produce identical `nextCommand`, evidence refs, and alternative ordering. | Replay determinism test |
| `SA32` | Technical hardening | Recent run selection prefers parseable current-head artifacts, newest timestamp, then lexicographic artifact path. | Run-selection unit test |
| `SA33` | Technical hardening | First-slice help derives runnable cockpit entries from registered command specs only. | Catalog/help consistency test |
| `SA34` | Technical hardening | First-slice alternatives are omitted by default unless required to explain a tie or blocked state. | CLI fixture test |
| `SA35` | Technical hardening | Network-disabled mode avoids live PR/Linear/API calls and reports unavailable network sources explicitly. | Offline fixture test |
| `SA36` | Technical hardening | Codex-native `developer_instructions`, `compact_prompt`, and `experimental_compact_prompt_file` are documented as confirmed evidence but not required first-slice cockpit output. | Docs assertion |
| `SA37` | Follow-on | Any Harness guidance that recommends Codex config steering distinguishes global developer instructions from repo-local AGENTS, skills, and Project Brain policy. | Docs and fixture review |
| `SA38` | Follow-on | Compact-prompt adoption is version-gated and tied to a resume/compaction eval before becoming generated bootstrap config. | Resume eval scenario |
| `SA39` | Follow-on | `harness next --json` can expose an `ApprovalPlan` with policy, reviewer, permission profile, Auto-review eligibility, strict-review suggestion, human requirement, risk, authorization, and reason. | CLI fixture test |
| `SA40` | Follow-on | Harness docs and generated examples prefer `auto_review` while accepting `guardian_subagent` only as a Codex compatibility alias. | Docs and config assertion |
| `SA41` | Follow-on | Auto-review is never presented as a deterministic security guarantee or as a replacement for branch protection, independent review, Semgrep, CodeRabbit, or human-required actions. | Docs assertion |
| `SA42` | Follow-on | Approval-review outcomes, when available, are captured as evidence with review id, target item, action, risk, authorization, outcome, terminal status, decision source, rationale, and refs. | Artifact fixture test |
| `SA43` | Follow-on | Timeout, malformed reviewer output, reviewer execution failure, `none` reviewer state, unknown authorization, or unknown policy state fails closed to human-required or safer local diagnostic action. | Failure fixture test |
| `SA44` | Follow-on | Strict Auto-review is recommended only as turn-scoped extra scrutiny after a permission grant, not as a session-wide permission expansion. | Permission-plan fixture test |
| `SA45` | Follow-on | A small evaluation compares real permission prompts against human decisions before Auto-review guidance becomes a default Harness recommendation. | Eval report |
| `SA46` | Follow-on | `harness next --json` can expose optional `goalContext` metadata without requiring experimental Codex app-server access. | CLI fixture test |
| `SA47` | Follow-on | Imported Codex goal context is linked to the active plan and Linear issue when possible, and marked stale or unknown when it conflicts with durable planning evidence. | Fixture test |
| `SA48` | Follow-on | Harness never creates, replaces, pauses, resumes, clears, or completes Codex goals unless an explicit user, system, or developer instruction authorizes that action. | Policy fixture test |
| `SA49` | Follow-on | Goal completion requires prompt-to-artifact evidence covering every explicit requirement before any completion recommendation is emitted. | Completion-audit fixture |
| `SA50` | Follow-on | Goal token budget, tokens used, and elapsed time feed session-friction evidence without being treated as completion proof. | Closeout fixture test |
| `SA51` | Follow-on | Harness docs distinguish documented experimental app-server goal APIs from the live fork's experimental `/goal` TUI command. | Docs assertion |
| `SA52` | Follow-on | A resume evaluation compares next-action fidelity with and without `goalContext` before goal guidance becomes default bootstrap output. | Resume eval report |

## Source Parity Notes

- The March structured-output spec already defines `GateResult`; this spec must
  extend rather than replace that contract.
- The April reliability orchestration spec already defines verification run
  state and failure classes; this spec should reuse those concepts.
- The April north-star realignment spec already constrains product-surface
  growth; this spec applies that constraint to cockpit command tiers.
- The April CodeRabbit learnings spec already owns operational learning
  evidence; this spec exposes it through the cockpit rather than duplicating it.
- The 2026-05-03 blunt product critique is the source for product compression,
  built CLI preference, executable metrics, and the repeated-failure guardrail
  story added in this revision.
- Live `~/dev/codex` plus `codex-repo` MCP evidence confirms Codex-native
  developer, compaction, and approval-review steering knobs. This spec records
  them as useful follow-on integration points, not as first-slice generated
  Harness config.

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
- live metrics implementation
- standalone `agent-snapshot` command unless `harness next --json` cannot carry
  the required snapshot metadata cleanly

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
6. Should `harness agent-snapshot --json` become a separate command?
   Recommendation: defer. First try to carry snapshot metadata in
   `harness next --json`; split only if the payload becomes too broad.
7. Should live metric commands be part of the cockpit first slice?
   Recommendation: no. Specify the contract now, but ship metrics after the
   deterministic local decision loop is stable.

## Definition of Done

- A planner can sequence implementation from this spec without inventing
  product decisions.
- Acceptance IDs `SA1` through `SA52` are stable.
- The first slice is small enough to implement without rewriting existing gates.
- Existing `GateResult`, verify-run, north-star, and learnings contracts remain
  authoritative in their domains.
- The default product direction is agent-native first: every visible surface
  helps an agent decide, act, prove, or learn.
- Technical review findings on cockpit tier ambiguity, deterministic replay,
  alternatives, run freshness, parser support, and source-error handling are
  either addressed in this spec or explicitly deferred with acceptance coverage.

## he-plan Handoff

Use this spec as the WHAT contract for planning. The first plan should avoid
big-bang refactors and should not add hero-story docs as new feature surface.

Recommended planning stance:

- Start with `HarnessDecision` and read-only `harness next`.
- Treat cockpit help and command metadata as part of the same first slice.
- Keep PR readiness and learning-loop product work as later slices.
- Validate through focused CLI and catalog tests before broader gates.
- Treat `pr-ready`, `fix-review`, `learn`, metrics, and standalone
  `agent-snapshot` as follow-on product-compression work unless a registered
  implementation already exists.
- Add technical gates for replay determinism, parser/help parity, run selection,
  and source-error classification before claiming `harness next` is
  agent-native.
