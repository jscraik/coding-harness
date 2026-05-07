---
schema_version: 1
title: Agent-Native Cockpit Control Loop First Slice Plan
type: feat
status: active
date: 2026-05-02
plan_id: feat-agent-native-cockpit-control-loop-first-slice
source_spec: docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md
source_spec_refresh: docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md
linear_issue: JSC-248
linear_status: in_progress
route: fresh
plan_depth: deepened
run_type: planning-artifact
traceability_required: true
last_validated: 2026-05-07
plan_revision: ruthless-compression-recovery
deepened: 2026-05-07
---

# Agent-Native Cockpit Control Loop First Slice Plan

## Enhancement Summary

**Planned on:** 2026-05-02
**Mode:** `targeted-confidence`
**Source spec:** [Agent-Native Cockpit Control Loop](../specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md)
**Source spec refresh:** [Ruthless Agent-Native Compression Recovery](../specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md)
**Linear issue:** `JSC-248`
**Implementation slice:** enforce the remaining cockpit work as a subtractive
compression slice: first-contact help budget, agent catalog budget, command
admission proof, README front-door rewrite, fresh-agent eval, and ablation
decisions.

This deepening pass updates the plan after the May 7 he-spec refresh. Earlier
units already created the cockpit machinery; the remaining work must now prove
that the product got smaller at first contact. Metadata, command classification,
and docs routing no longer count as success unless the live help, agent catalog,
README entrypoint, and fresh-agent eval show the clutter was actually removed
from the agent's path.

## Table of Contents

- [Overview](#overview)
- [Source Traceability](#source-traceability)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Current Repo Evidence](#current-repo-evidence)
- [HE Plan Refresh](#he-plan-refresh)
- [Ruthless Compression Refresh](#ruthless-compression-refresh)
- [Scope Boundaries](#scope-boundaries)
- [Execution Rules](#execution-rules)
- [Execution State](#execution-state)
- [Compression Admission Contract](#compression-admission-contract)
- [First-Contact Budget Decision](#first-contact-budget-decision)
- [Resolved Spec Questions](#resolved-spec-questions)
- [Implementation Units](#implementation-units)
- [Dependency Graph](#dependency-graph)
- [Validation Plan](#validation-plan)
- [Rollback and Recovery](#rollback-and-recovery)
- [Risk Controls](#risk-controls)
- [Acceptance Traceability](#acceptance-traceability)
- [Handoff to he-work](#handoff-to-he-work)

## Overview

The first slice turns the cockpit idea into an executable agent contract:

```text
harness next --json
  -> inspect local repo state
  -> classify safety and risk
  -> recommend an existing command
  -> emit HarnessDecision JSON
  -> leave execution to the caller
```

The value is compression. Agents should not need bespoke parsing for every gate
before they can answer "what should I do next?" Humans should see the same
system through plainer output and cockpit-first help.

## Source Traceability

| Source                                                                 | Role                                                       |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| `JSC-248`                                                              | Linear tracker and PR linkage authority                    |
| `docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md` | Behavioral source of truth                                 |
| `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md` | Refreshed compression acceptance contract for remaining command-surface work |
| `src/cli.ts`                                                           | Current single-token dispatcher boundary                   |
| `src/lib/cli/registry/command-specs-core.ts`                           | Canonical registry source for command specs                |
| `src/lib/cli/command-registry.ts`                                      | Registry aggregation, dispatch, and command catalog source |
| `src/lib/cli/registry/command-capabilities.ts`                         | Existing command metadata surface                          |
| `src/lib/cli/registry/types.ts`                                        | Existing `CommandSpec` type                                |
| `src/commands/review-context.ts`                                       | Existing review-context command behavior                   |
| `src/commands/validation-plan.ts`                                      | Existing validation-plan command behavior                  |

## Linear Work Item Contract

- Linear issue key: `JSC-248`
- Linear title: Implement agent-native cockpit control loop first slice
- Linear URL:
  <https://linear.app/jscraik/issue/JSC-248/implement-agent-native-cockpit-control-loop-first-slice>
- Linear team: `Jscraik`
- Linear project: `coding-harness`
- Linear issue status snapshot: In Progress as of 2026-05-07
- Plan linkage status: resolved
- PR linkage rule: use `Refs JSC-248` until the issue is fully completed.

## Current Repo Evidence

Live inspection before this plan found these relevant constraints:

- `src/cli.ts` dispatches the first command token, so first-slice cockpit
  commands must be canonical single tokens such as `next` and `pr-ready`.
- `src/lib/cli/registry/command-specs-core.ts` defines the canonical command
  specs that `src/lib/cli/command-registry.ts` aggregates and exposes through
  `harness commands --json`.
- `src/lib/cli/registry/command-capabilities.ts` already models category,
  mutability, required flags, expected artifacts, retry behavior, and safe-first
  alternatives.
- `review-context` and `validation-plan` already require `--files`; `next` must
  not inherit that requirement because it is meant to infer local context.
- Existing `GateResult` and gate payloads must remain authoritative for gate
  output. `HarnessDecision` is an orchestration envelope, not a replacement.

## HE Plan Refresh

**Refreshed on:** 2026-05-03
**Reason:** `$he-plan` found that this plan still described several
already-landed surfaces as future work.

Live repo evidence now shows:

- `src/lib/decision/harness-decision.ts` exists and defines the
  `harness-decision/v1` envelope, `critical` risk tier, friction and delay
  classes, and execution metadata validation.
- `src/commands/next.ts` exists and implements a read-only `harness next`
  producer with `--json`, `--mode`, `--files`, git status parsing, and safe
  recommendations.
- `src/lib/session/session-closeout.ts` exists as the session-closeout contract
  dependency that JSC-249 uses for P3.
- Linear `JSC-248` is `In Progress` and has PR attachments, so this plan should
  no longer instruct agents to start from a blank P1 implementation.

Current outstanding work is technical hardening against the deepened spec, not a
restart of P1-P5:

1. Re-run focused tests to confirm which legacy cockpit criteria from the
   May 2 spec are already satisfied on the active branch.
2. Add deterministic `DecisionSource` and `RecommendationCandidate` handling
   only where missing.
3. Add `meta.sourceErrors` behavior for missing, empty, invalid, stale, blocked,
   and network-unavailable sources.
4. Add bounded current-head run selection for `.harness/runs/**` if `next`
   consumes recent run evidence.
5. Keep follow-on flags such as `--explain`, `--include-alternatives`, and
   `--no-network` out of CLI help until parser support and tests exist.

Do not implement Codex `developer_instructions`, `compact_prompt`, or
`experimental_compact_prompt_file` from this issue. The source spec tracks those
as follow-on config steering evidence under `SA36`-`SA38`.

Do not implement Codex Auto-review activation from this issue. The source spec
tracks approval reviewer behavior under `SA39`-`SA45`; the only JSC-248 overlap
is ensuring future `harness next --json` has a clear place to carry
`approvalPlan` metadata without confusing it with branch protection or
independent PR review.

Do not implement Codex `/goal` or app-server goal integration from this issue.
The source spec tracks goal continuation behavior under `SA46`-`SA52`, owned by
deferred child issue `JSC-279`; the only JSC-248 overlap is ensuring future
`harness next --json` has a clean place to carry `goalContext` metadata without
treating runtime goals as more durable than Linear, the source spec, the plan,
or closeout artifacts.

## Ruthless Compression Refresh

**Deepened on:** 2026-05-07
**Reason:** the May 7 he-compound diagnosis found that previous specs and plans
named agent-native compression but let additive compatibility stay mandatory
while compression stayed advisory.

The refreshed source spec changes the remaining `JSC-248` work from "prove the
cockpit exists" to "prove the first-contact surface is smaller." The
non-negotiable rule is:

```text
Agents should only need to remember: harness next --json
```

Live evidence collected for the refresh:

- `pnpm exec tsx src/cli.ts commands --json --for-agent` returns
  `commandCount: 9`.
- `pnpm exec tsx src/cli.ts commands --json` returns `commandCount: 65`.
- `pnpm exec tsx src/cli.ts --help` still renders a broad operational catalog
  in default help before expert discovery is requested.
- `fd -e md . docs | wc -l` reports `148` documentation markdown files.
- `README.md` still presents the cockpit loop as one route beside bootstrap,
  issue start, and review submission.

Plan implication: the next implementation pass must start with subtractive proof
and admission gates. Do not spend the next slice deepening more metadata,
status prose, or command taxonomy until first-contact help, agent catalog,
README, fresh-agent eval, and ablation evidence are executable.

## Scope Boundaries

### In Scope

- Preserve and verify the already-landed `HarnessDecision` and `next` surfaces.
- Add first-contact surface-budget tests for default help and agent catalog.
- Add or derive a command admission table from registry metadata.
- Tighten `harness commands --json --for-agent` to approved first-contact
  commands only.
- Update default help so `harness next --json` is the single agent memory rule
  before any command groups.
- Rewrite the README first-contact path so the cockpit is the front door, not a
  peer hero workflow.
- Add a fresh-agent eval fixture that starts from `harness next --json`.
- Record ablation decisions for every retained first-contact command, doc, and
  gate.
- Preserve full expert discovery through `--all-commands` and
  `harness commands --json`.

### Out of Scope

- Full `harness pr-ready` orchestration or a new `pr-ready` command.
- Nested `harness pr ready` parser support.
- Mutative `harness fix-review`.
- First-class `harness learn` product work.
- Telemetry persistence under `.harness/decisions/**`.
- Broad command implementation rewrites unrelated to discovery and routing.
- Deleting expert command implementations before compatibility is proven.
- Weakening safety, review, CI, Semgrep, CodeRabbit, Linear, SHA, approval, or
  rollback controls.

## Execution Rules

1. Start with subtractive proof: help budget, agent catalog budget, README
   first-contact route, fresh-agent eval, and ablation table.
2. Do not advertise unimplemented cockpit commands as runnable in default help.
3. Keep `--json` output on stdout parseable; diagnostics belong on stderr or in
   structured error payloads.
4. `harness next` must recommend existing commands only and must not execute
   them.
5. `--files` and `--mode` are optional overrides for `next`, not required flags.
6. Any recommendation that writes files must set `writesFiles: true`.
7. Any network/API recommendation must set `requiresNetwork: true`.
8. If first-slice cockpit metadata is missing or contradictory, fail closed with
   `blocked` instead of inventing commands.
9. Docs updates must remove, merge, or hide at least as much first-contact prose
   as they add unless the plan records an explicit exception.
10. PR metadata must use `Refs JSC-248` until the Linear issue is fully done.
11. Before PR handoff, re-check live `JSC-248` status, owner, and scope; update
    this plan and the spec if Linear drifted.
12. Safety metadata takes precedence over tier placement: recommendations with
    `writesFiles`, `requiresNetwork`, or `requiresHuman` uncertainty must be
    conservative or `blocked`.
13. A command is not first-contact eligible merely because it has useful JSON or
    helpful metadata.
14. Every retained first-contact command must be a cockpit rail, selected by
    `next`, selected by future `pr-ready` or `learn`, or backed by explicit
    admission proof.

## Execution State

Current `he-work` state before the next runtime implementation pass:

- **Phase:** `P9 - Ruthless Compression Recovery`
- **Checked at:** 2026-05-07 snapshot; refresh before executing
- **Branch snapshot:** `jscraik/feature/branch-salvage-cleanup`; refresh before
  executing or PR prep
- **Tracker:** `JSC-248`, status `In Progress`, assignee
  `jscraik@brainwav.io`, project `coding-harness`, as returned by Linear on
  2026-05-07; refresh before executing
- **Existing implementation:** `HarnessDecision`, `harness next`, and
  session-closeout contract modules are present in the live tree
- **Dirty worktree at refresh:** unrelated existing edits in
  `.vale/styles/config/vocabularies/Harness/accept.txt`, `package.json`, and
  `pnpm-lock.yaml`; preserve these unless explicitly adopted
- **Plan/spec files updated by this refresh:** this plan and
  `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md`
- **Next implementation phase:** implement the refreshed compression acceptance
  criteria `SA1`-`SA18`, starting with executable surface-budget tests and
  command admission proof

## Compression Admission Contract

Every first-contact surface must be classified before code changes:

| Surface type | First-contact allowed when | Otherwise |
| --- | --- | --- |
| Cockpit rail | It is registered, stable, read-only or safe-first, and has JSON evidence. | Hide until implemented. |
| Domain command | `next`, future `pr-ready`, or future `learn` selects it for a concrete state. | Move to advanced or plumbing. |
| Mutative command | It has safe-first alternatives and explicit human/safety metadata. | Hide from agent catalog and default help. |
| Documentation section | It helps a fresh agent start from `harness next --json`. | Merge, demote, or delete. |
| Gate or policy surface | It is selected by cockpit or validation planning from changed-file risk. | Keep operational, but remove from first contact. |
| Expert escape hatch | Compatibility or incident recovery requires it. | Expose only through `--all-commands` or full catalog. |

The admission table should live in code or a test fixture, not only in prose, so
CI can fail when first-contact exposure grows without a recorded reason.

## First-Contact Budget Decision

This plan resolves the initial budget for the implementation slice. Future
changes may widen it only by updating admission proof and tests in the same
patch.

| Surface | Initial budget | Notes |
| --- | --- | --- |
| Agent memory rule | `harness next --json` only | This must be the first command an agent sees in default help and README first contact. |
| Default help command groups before advanced discovery | `1` cockpit group maximum | Human bootstrap recovery may appear as prose after the cockpit rule, but broad grouped catalogs must require `--all-commands` or advanced discovery. |
| Default help listed command names before advanced discovery | `next` only | `check`, `doctor`, and `init` belong behind `next` recommendations, human recovery prose, or advanced discovery. |
| Agent catalog direct names | `next` only | The default agent catalog should prove the golden path. `commands --json` remains available only as explicit machine/expert discovery. |
| Agent catalog demotions from current live state | `commands`, `init`, `health`, `fleet-plan`, `validation-plan`, `review-context` | Keep in the full catalog. They should be selected by `next`, future readiness and learning rails, or explicit expert discovery instead of being first-contact agent commands. |
| Future rails | none | `pr-ready` and `learn` stay out of help/catalog until registered with stable JSON and tests. |

## Resolved Spec Questions

This plan resolves the open questions from the refreshed spec for the first
implementation slice. If implementation evidence contradicts one of these
answers, update this table, the admission proof, and the matching tests in the
same patch.

| Spec question | Plan decision |
| --- | --- |
| Should `init` remain in the agent catalog? | No. `next` should select `init` only when setup evidence proves initialization is the safe next action. |
| Should `commands` remain first-contact for agents? | No. Keep `commands --json` as explicit machine/expert discovery, but remove it from the default agent catalog so it cannot become the onboarding route. |
| Is `check` direct or selected by `next`? | Selected by `next` for this slice. Keep it in full expert discovery and allow human recovery prose, but do not budget it as a direct agent first-contact command. |
| What numeric budget should default help use? | Combined budget: one cockpit group maximum and the listed command name `next` before advanced discovery. |
| Where should ablation proof live? | In executable registry/test fixtures first, with generated or cited docs evidence only as supporting context. |
| Should `pr-ready` be a command or `next` profile? | Deferred. Do not advertise it until a later spec chooses the rail shape and adds stable JSON tests. |

## Implementation Units

### P0 - Baseline and Tracker Lock

Goal: anchor the work before runtime edits.

Primary files:

- `docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md`
- `docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`

Completion criteria:

- `JSC-248` is linked in the spec and plan.
- First-slice scope and deferred scope are explicit.
- Current branch and dirty worktree state are recorded in handoff notes before
  implementation starts.

Validation:

- `pnpm exec markdownlint-cli2 docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`

### P1 - HarnessDecision Contract

Goal: create the shared decision envelope before any command emits it.

Primary files:

- future stable decision module under `src/lib/**`
- focused unit test beside the module
- optional fixture under `tests/fixtures/**` if local patterns support it

Completion criteria:

- Type covers `schemaVersion`, `producer`, `status`, `summary`, `nextAction`,
  `nextCommand`, safety booleans, `evidenceRef`, `failureClass`, `retry`,
  `riskTier`, and additive `meta`.
- `status` is constrained to `pass`, `fail`, `blocked`, and `action_required`.
- Fixture validation proves a valid `harness-decision/v1` payload.
- No existing `GateResult` behavior changes.

Validation:

- focused unit test for valid and invalid decision fixtures
- `pnpm typecheck`

### P2 - Command Metadata Tiers

Goal: make the command catalog tell agents which registered first-slice
cockpit commands and directly orchestrated commands are safe to prefer.

Primary files:

- `src/lib/cli/registry/command-capabilities.ts`
- `src/lib/cli/registry/types.ts`
- `src/lib/cli/command-registry.test.ts`

Completion criteria:

- `CommandCapability` includes additive `tier`, `primaryAudience`, and
  `orchestratedBy` fields.
- `harness commands --json` includes those fields for registered first-slice
  cockpit commands and directly orchestrated commands.
- Missing tier or audience metadata fails tests for registered first-slice
  cockpit commands and directly orchestrated commands.
- Full-catalog hard failure is deferred to a follow-on migration slice.
- Existing capability fields stay backwards-compatible and additive.

Validation:

- `pnpm exec vitest run src/lib/cli/command-registry.test.ts`

### P3 - Read-Only `harness next`

Goal: add the first agent-native cockpit command.

Primary files:

- future `src/commands/next.ts`
- `src/lib/cli/registry/command-specs-core.ts`
- `src/lib/cli/command-registry.ts` as aggregation and dispatch verification
- future `src/commands/next.test.ts`
- `docs/cli-reference.md` for the minimal parity entry required when `next` is
  registered

Completion criteria:

- `harness next --json` emits a valid `HarnessDecision`.
- `harness next --json` works without `--files` or `--mode`.
- Optional `--files <paths>` overrides changed-file detection.
- Optional `--mode local|pr|ci` changes context posture without requiring
  network by default.
- The command recommends existing commands only.
- The command does not mutate files by default.
- Blocked states include `failureClass`, `nextAction`, `retry`, and
  `evidenceRef`.
- Minimal CLI reference parity for `next` lands in the same unit as command
  registration.
- `next.test.ts` includes these paths:
  - happy path with a safe recommendation,
  - no changed files,
  - empty `--files` override,
  - git inspection failure,
  - invalid `--mode`.
- Every `next.test.ts` path asserts `status`, `failureClass` where applicable,
  `nextAction`, `retry`, `evidenceRef`, and no file mutation.

Validation:

- `pnpm exec vitest run src/commands/next.test.ts`
- `pnpm exec vitest run src/lib/cli/command-registry.test.ts`
- `pnpm exec markdownlint-cli2 docs/cli-reference.md`

### P4 - Cockpit-First Help

Goal: make first contact smaller without hiding advanced machinery.

Primary files:

- `src/lib/cli/help-renderer.ts`
- `src/cli.test.ts`
- `src/lib/cli/command-registry.test.ts`

Completion criteria:

- Default help renders cockpit-tier commands first.
- Full command help remains available through `--all` or the current equivalent.
- Help does not list future unregistered commands as runnable.
- Default help cockpit entries are derived strictly from registered runnable
  specs for this slice.

Validation:

- `pnpm exec vitest run src/cli.test.ts src/lib/cli/command-registry.test.ts`

### P5 - Docs Compression

Goal: explain the new loop in high-traffic docs only.

Primary files:

- `README.md`
- `docs/agents/quickstart.md`
- `docs/cli-reference.md`

Completion criteria:

- README introduces `harness next --json` as the agent-native cockpit entrypoint.
- Quickstart gives one complete agent loop without adding separate hero-story
  workflow sections.
- README and quickstart route to the existing CLI reference entry for `next`.
- AGENTS shared-vocabulary guidance and the relevant governance guides stay in
  sync with the cockpit command-evidence contract.
- Responsibility text is limited to the follow-up commands that first-slice
  `next` can actually recommend.

Validation:

- `pnpm exec markdownlint-cli2 README.md docs/agents/quickstart.md docs/cli-reference.md`
- `bash scripts/run-harness-gate.sh docs-gate --mode required --json`

### P6 - Technical Hardening Refresh

Goal: align the existing cockpit implementation with the deepened 2026-05-03
spec review without restarting already-landed P1-P5 work.

Primary files:

- `src/lib/decision/harness-decision.ts`
- `src/commands/next.ts`
- `src/commands/next.test.ts`
- any focused helper module under `src/lib/decision/**` if the hardening would
  otherwise bloat `next.ts`

Completion criteria:

- Legacy cockpit behavior from the May 2 spec is verified first; only failing
  or missing behavior is changed.
- `DecisionSource` and `RecommendationCandidate` are represented in code or
  deliberately deferred with a test-backed reason.
- `meta.sourceErrors` captures missing, empty, invalid, stale, blocked, and
  network-unavailable sources without corrupting stdout JSON.
- Incomplete or unknown `approvalPlan` or `goalContext` metadata cannot reduce
  top-level safety posture; affected decisions must set `requiresHuman: true`
  or fail closed to blocked/action-required with an explicit `failureClass`.
- Identical repo state, inputs, environment flags, and artifacts produce
  identical `nextCommand`, evidence refs, and alternative ordering.
- Parser-exposed flags match implemented parser support; follow-on flags are
  not advertised as runnable.
- If recent run evidence is consumed, current-head run selection is deterministic
  and stale or invalid artifacts are reported as source errors.

Validation:

- `pnpm exec vitest run src/lib/decision/harness-decision.test.ts src/commands/next.test.ts`
- fixture assertion for deterministic replay with identical inputs
- fixture assertion for missing, empty, invalid, stale, blocked, and
  network-unavailable `meta.sourceErrors`
- fixture assertion for fail-closed incomplete or unknown `approvalPlan` and
  `goalContext` metadata
- `pnpm typecheck`
- `bash scripts/validate-codestyle.sh --fast`

### P7 - Approval Reviewer Contract Follow-On

Goal: turn the Auto-review research and fork evidence into a future cockpit
permission contract without widening the current JSC-248 implementation slice.

Primary files when promoted:

- `src/lib/decision/harness-decision.ts`
- `src/commands/next.ts`
- `src/commands/next.test.ts`
- focused config or artifact helpers only if `approvalPlan` needs them

Completion criteria before promotion:

- Real permission prompts or closeout artifacts show approval friction that P6
  source-error and permission metadata cannot explain.
- The implementation can distinguish `user`, `auto_review`, legacy
  `guardian_subagent`, `none`, and `unknown` reviewer states without enabling
  Auto-review globally.
- `ApprovalPlan` output fails closed when policy, reviewer, authorization, or
  sandbox state is unknown.
- Documentation and fixtures state that Auto-review is not branch protection,
  independent PR review, Semgrep, CodeRabbit, or a deterministic security
  guarantee.

Validation when promoted:

- focused `next` fixture tests for `approvalPlan`
- docs assertion that generated examples prefer `auto_review`
- failure fixture for timeout, malformed output, reviewer failure, and unknown
  policy state
- small eval comparing sampled permission prompts against human decisions

### P8 - Goal Continuation Contract Follow-On

Goal: turn Codex `/goal` and app-server goal evidence into a future `JSC-279`
cockpit resume contract without widening the current JSC-248 implementation
slice.

Primary files when promoted:

- `src/lib/decision/harness-decision.ts`
- `src/commands/next.ts`
- `src/commands/next.test.ts`
- `src/lib/session/session-closeout.ts`
- focused goal-context helpers only if `goalContext` needs them

Completion criteria before promotion:

- Real resumes, compacted sessions, or stale-plan handoffs show that P6 source
  errors and JSC-249 closeout evidence do not preserve the active objective
  clearly enough.
- The implementation can distinguish `codex_goal`, `linear`, `plan`,
  `user_prompt`, and `unknown` objective sources.
- Runtime goal context is linked to plan and Linear evidence when possible and
  marked stale or unknown when it conflicts with durable project truth.
- Completion recommendations require prompt-to-artifact evidence and never rely
  on elapsed effort, token budget exhaustion, plausible intent, or passing tests
  that do not cover the objective.
- Official docs and generated examples state that app-server goal APIs are
  experimental and that the live TUI `/goal` command may not be present in
  stable slash-command docs.

Validation when promoted:

- focused `next` fixture tests for `goalContext`
- stale-plan and mismatched-goal fixtures
- completion-audit fixture covering named files, commands, tests, gates, and
  deliverables
- closeout fixture proving token budget and elapsed time become friction
  evidence, not completion proof
- small resume eval comparing next-action fidelity with and without goal
  context

### P9 - Surface Budget Fixtures

Goal: make compression fail in tests before any help or catalog changes are
accepted.

Primary files:

- `src/cli.test.ts`
- `src/lib/cli/command-registry.test.ts`
- `src/lib/cli/registry/command-capabilities.ts`
- optional focused fixture under `tests/fixtures/**` or an existing CLI fixture
  location if the repo already has one

Completion criteria:

- A default-help test asserts `harness next --json` appears as the single agent
  memory rule before command groups.
- A default-help budget test fails when broad command groups or legacy command
  lists return to first-contact help without `--all-commands`.
- An agent-catalog budget test asserts the exact approved first-contact command
  names.
- A full-catalog test asserts expert discovery still returns the complete
  catalog and classification metadata.
- Budget limits are named and easy to update through one source when an
  admission proof changes them.

Validation:

- `pnpm exec vitest run src/cli.test.ts src/lib/cli/command-registry.test.ts`

### P10 - Command Admission and Catalog Compression

Goal: classify every first-contact command and demote anything that lacks a
direct cockpit reason.

Primary files:

- `src/lib/cli/registry/command-capabilities.ts`
- `src/lib/cli/registry/types.ts`
- `src/lib/cli/command-registry.test.ts`
- `docs/cli-reference.md` only if public catalog behavior changes

Completion criteria:

- Every command in `commands --json --for-agent` is either a cockpit rail or has
  explicit direct-invocation admission proof.
- Mutative commands are absent from the agent catalog unless the admission proof
  explains their safe-first path and human/safety requirements.
- Commands selected by `next`, future `pr-ready`, or future `learn` can remain
  in the full catalog without being first-contact visible.
- `pr-ready` and `learn` are not advertised as runnable commands until parser
  support, stable JSON, and tests exist.
- The full catalog remains backward-compatible for expert discovery.

Validation:

- `pnpm exec vitest run src/lib/cli/command-registry.test.ts`
- `pnpm exec tsx src/cli.ts commands --json --for-agent`
- `pnpm exec tsx src/cli.ts commands --json`

### P11 - Help and README Front Door

Goal: make first contact teach the cockpit, not the command catalog.

Primary files:

- `src/lib/cli/help-renderer.ts`
- `src/cli.ts`
- `src/cli.test.ts`
- `README.md`
- `docs/cli-reference.md`

Completion criteria:

- Default `harness --help` opens with the memory rule
  `harness next --json`.
- Default help does not render the broad operational catalog unless advanced
  discovery is requested.
- `README.md` presents the cockpit as the front door before bootstrap, issue
  start, review submission, CI migration, or pilot workflows.
- Command index material in README is moved behind explicit discovery language
  or trimmed to the budget approved by P9.
- CLI reference preserves expert details without becoming the onboarding route.

Validation:

- `pnpm exec vitest run src/cli.test.ts`
- `pnpm exec tsx src/cli.ts --help`
- `pnpm exec markdownlint-cli2 README.md docs/cli-reference.md docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`

### P12 - Fresh-Agent Eval

Goal: prove the compressed interface works from a new-agent posture.

Primary files:

- existing eval or fixture location discovered during implementation
- `src/commands/next.test.ts` if the repo keeps the scenario at unit level
- docs or artifacts only when the eval framework requires durable output

Completion criteria:

- The scenario starts with only the repo root and the instruction to run
  `harness next --json`.
- The agent reaches a safe next command without reading README command tables or
  guessing command names.
- The eval records whether missing learning artifacts produce actionable setup
  or explicit degraded-mode output.
- The eval fails when the path depends on broad default help, command browsing,
  or undocumented command-specific knowledge.

Validation:

- focused eval command discovered from the repo's existing eval harness, or a
  focused Vitest fixture if no eval harness exists yet
- `pnpm exec vitest run src/commands/next.test.ts`

### P13 - Ablation Evidence and North-Star Proof

Goal: make retained visible surfaces justify their carrying cost.

Primary files:

- command admission fixture or generated ablation table from P9/P10
- `docs/roadmap/agent-first-status.md` only if status claims change
- README or CLI reference only when ablation decisions affect public docs

Completion criteria:

- Every retained first-contact command, doc section, and gate has an ablation
  decision: keep visible, route through cockpit, move to advanced, merge, or
  delete.
- North-star progress claims cite generated CLI, catalog, eval, or review-loop
  evidence rather than manual status prose.
- Safety gates hidden from first contact are still selected by `next`,
  `validation-plan`, or the future readiness rail when changed-file risk
  requires them.
- The implementation handoff lists any surfaces intentionally left visible
  despite incomplete proof as explicit owner-approved risk.

Validation:

- generated ablation/admission fixture check from P9/P10
- `pnpm exec tsx src/cli.ts next --json`
- `pnpm exec tsx src/cli.ts validation-plan --files src/cli.ts src/lib/cli/registry/command-capabilities.ts README.md --json`
- `bash scripts/run-harness-gate.sh docs-gate --mode required --json` when docs
  surfaces change

## Dependency Graph

```text
P0 tracker/spec lock
  -> P1 HarnessDecision
    -> P2 command metadata
      -> P3 harness next
        -> P4 cockpit-first help
          -> P5 docs compression
            -> P6 technical hardening refresh
              -> P7 approval reviewer contract follow-on
              -> P8 goal continuation contract follow-on
            -> P9 surface budget fixtures
              -> P10 command admission and catalog compression
                -> P11 help and README front door
                  -> P12 fresh-agent eval
                    -> P13 ablation evidence and north-star proof
```

P3 must include the minimal `docs/cli-reference.md` entry for `next` because
the current registry tests enforce command-reference parity. P4 may begin once
P2 has stable tier metadata, but it should not merge before P3 registers the
real `next` command. P5 describes the original docs compression slice.

P9-P13 are the current recovery path. They may reuse earlier P2-P5 files, but
they must not be treated as already done just because metadata, help ordering,
or docs references exist. Their success condition is live compression evidence.

## Validation Plan

Focused validation during implementation:

- `pnpm exec vitest run src/cli.test.ts src/lib/cli/command-registry.test.ts`
- `pnpm exec vitest run src/lib/cli/command-registry.test.ts`
- `pnpm exec vitest run src/commands/next.test.ts`
- `pnpm exec vitest run src/cli.test.ts`
- `pnpm exec tsx src/cli.ts --help`
- `pnpm exec tsx src/cli.ts commands --json --for-agent`
- `pnpm exec tsx src/cli.ts commands --json`
- `pnpm exec tsx src/cli.ts next --json`
- `pnpm exec markdownlint-cli2 README.md docs/agents/quickstart.md docs/cli-reference.md docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`
- live `JSC-248` status and owner check before PR handoff
- fresh-agent eval fixture or documented blocker if the repo has no suitable
  eval harness yet
- ablation/admission fixture check from P9/P10

Broader validation before PR handoff:

- `pnpm typecheck`
- `pnpm test`
- `pnpm check`
- `bash scripts/validate-codestyle.sh --fast`
- `bash scripts/verify-work.sh --fast`
- `bash scripts/validate-codestyle.sh`
- `bash scripts/verify-work.sh`

Docs-gate validation when high-traffic docs change:

- `bash scripts/run-harness-gate.sh docs-gate --mode required --json`

Traceability validation for the deepened plan:

- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`

If broader gates fail because of unrelated dirty worktree changes, record the
exact blocker and preserve focused validation evidence for the cockpit slice.

## Rollback and Recovery

Rollback should be additive and low-drama if the sequence is preserved:

- Revert `next` command registration and implementation.
- Revert help ordering changes if tier metadata causes display regressions.
- Keep or revert `HarnessDecision` based on whether any public command emits it
  at rollback time.
- Restore previous README, quickstart, and CLI reference text.
- Do not touch existing gate behavior unless a test proves the cockpit slice
  changed it.

Recovery rules:

- If JSON output becomes non-parseable, stop at P3 and fix stdout/stderr
  separation before continuing.
- If command metadata creates a compatibility break in `harness commands --json`,
  keep fields additive and update tests before continuing.
- If the agent catalog budget breaks compatibility for an agent workflow, keep
  the full catalog behavior stable and add a `next` recommendation or admission
  proof before restoring first-contact visibility.
- If default help becomes too terse for humans, add compact bootstrap text after
  the `harness next --json` memory rule rather than restoring broad command
  groups.
- If README loses necessary governance guidance, move it behind the cockpit
  route or advanced workflows instead of returning it to first contact.
- If fresh-agent eval fails because no eval harness exists, add the smallest
  fixture-level proof and record the missing broader eval as a follow-up
  blocker.
- If `next` cannot infer changed files reliably, return `blocked` or
  `riskTier: "unknown"` rather than requiring `--files`.
- If tier placement and safety metadata disagree, safety metadata wins and `next`
  returns a conservative recommendation or `blocked`.

## Risk Controls

| Risk                                                          | Control                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `next` becomes a hidden executor                              | Unit tests assert recommendations only and no mutation                                            |
| Help advertises unimplemented commands                        | Help derives from registered command specs only                                                   |
| Metadata breaks existing agents                               | Add fields additively; hard-fail only first-slice cockpit and directly orchestrated commands      |
| `GateResult` gets displaced                                   | Keep `HarnessDecision` separate and only reference gate output under `meta`                       |
| Docs sprawl returns                                           | Limit docs changes to README, quickstart, and CLI reference                                       |
| Single-token dispatch mismatch                                | Use canonical `next` and `pr-ready`; defer nested aliases                                         |
| Already-landed work is implemented again from stale plan text | Start P6 with a focused verification audit and change only failing or missing acceptance criteria |
| Auto-review becomes implied self-approval                     | Keep P7 deferred until evidence and fixtures prove fail-closed reviewer semantics                 |
| Compression becomes metadata-only                             | P9-P13 require live help, catalog, README, eval, and ablation evidence                            |
| Agent catalog hides a command still needed directly           | Require admission proof or route it through `next` before restoring visibility                    |
| Safety gates disappear from first contact and from execution  | P13 must prove hidden gates are still selected by cockpit or validation planning                  |
| Fresh-agent eval becomes a scripted happy path                | Eval must start from only `harness next --json` and fail on bespoke command hints                 |

## Acceptance Traceability

The active acceptance namespace for the remaining `JSC-248` work is the
refreshed compression spec:
`docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md`.
The earlier cockpit spec remains architectural context, but its `SA*` rows must
not be used as the source of truth for P9-P13 completion.

### Legacy Cockpit Acceptance Context

The May 2 cockpit plan units P1-P8 are already-landed or deferred context.
Workers may verify those surfaces before editing, but they must not reopen them
unless a P9-P13 compression acceptance check proves a regression or missing
dependency.

| Legacy scope | Current handling |
| --- | --- |
| P1-P5 cockpit machinery | Verify as supporting implementation; do not restart. |
| P6 technical hardening | Keep as prior hardening context unless compression fixtures expose a live gap. |
| P7 approval reviewer contract | Deferred; out of JSC-248 unless measured approval friction promotes it. |
| P8 goal continuation contract | Deferred to `JSC-279` unless measured resume or stale-plan friction promotes it. |
| Promoted command-surface ideas from prior review | Admit only through refreshed `SA1`-`SA18` and `CA1`-`CA18`. |

### Refreshed Compression Acceptance Traceability

| Source acceptance ID | Plan unit | Compression ID | Required evidence |
| --- | --- | --- | --- |
| `SA1` | P9, P11 | `CA1` | Default help snapshot or test proves `harness next --json` is the first agent memory rule. |
| `SA2` | P9, P11 | `CA2` | Help-budget test proves broad command groups require advanced discovery. |
| `SA3` | P9, P10 | `CA3` | Agent-catalog test asserts approved first-contact command names only. |
| `SA4` | P9, P10 | `CA4` | Full-catalog test proves all commands remain discoverable with classification metadata. |
| `SA5` | P10 | `CA5` | Admission fixture proves each first-contact command is a cockpit rail or justified direct command. |
| `SA6` | P10 | `CA6` | Catalog lint rejects mutative first-contact commands without safe-first proof. |
| `SA7` | P11 | `CA9` | README assertion proves cockpit is the front door. |
| `SA8` | P11, P13 | `CA10` | Docs delta records removal, merge, demotion, or approved exception. |
| `SA9` | P12 | `CA11` | Fresh-agent eval starts from only `harness next --json` and reaches a safe next action. |
| `SA10` | P13 | `CA7` | Ablation table covers every retained visible command, doc, and gate. |
| `SA11` | P12 | `CA12` | Missing-learning fixture returns setup guidance or explicit degraded mode. |
| `SA12` | P10 | `CA14` | Help and catalog tests reject unimplemented `pr-ready` and `learn` command advertising. |
| `SA13` | P13 | `CA15` | Changed-file fixture proves hidden safety gates are still selected by cockpit or validation planning. |
| `SA14` | P13 | `CA16` | North-star status cites generated CLI, catalog, eval, or review-loop evidence. |
| `SA15` | P12 | `CA13` | Done criteria require passing help, catalog, README, and fresh-agent eval evidence. |
| `SA16` | P10, P13 | `CA8` | Command admission rules are executable through tests or fixtures and documented at the registry boundary. |
| `SA17` | P10 | `CA17` | Expert discovery through `--all-commands` or full catalog remains intact. |
| `SA18` | P13 | `CA18` | Focused diff review proves the implementation stayed inside governed compression surfaces. |

### Linear / Spec / Plan / PR Traceability

| Linear issue | Source acceptance IDs | Plan units | Acceptance IDs | PR evidence |
| --- | --- | --- | --- | --- |
| `JSC-248` | `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md` `SA1`-`SA4` | P9, P10, P11 | `CA1`-`CA4` | Help and catalog budget tests plus CLI snapshots |
| `JSC-248` | `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md` `SA5`-`SA6`, `SA10`, `SA16` | P10, P13 | `CA5`-`CA8` | Admission and ablation fixture output |
| `JSC-248` | `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md` `SA7`-`SA8` | P11, P13 | `CA9`-`CA10` | README first-contact assertion and docs delta table |
| `JSC-248` | `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md` `SA9`, `SA11`, `SA15` | P12 | `CA11`-`CA13` | Fresh-agent eval and missing-learning degraded-mode fixture |
| `JSC-248` | `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md` `SA12`-`SA14`, `SA17`-`SA18` | P10, P13 | `CA14`-`CA18` | Future-rail rejection tests, safety-selection proof, full-catalog compatibility, and focused diff review |

### Compression Acceptance IDs

| Acceptance ID | Plan unit | Status |
| --- | --- | --- |
| `CA1` | P9, P11 | Default help makes `harness next --json` the first agent memory rule. |
| `CA2` | P9, P11 | Default help hides broad command groups unless explicit advanced discovery is requested. |
| `CA3` | P9, P10 | Agent catalog exposes only approved first-contact commands. |
| `CA4` | P9, P10 | Full catalog preserves all commands with complete classification metadata. |
| `CA5` | P10 | Every first-contact command has cockpit-rail status or admission proof. |
| `CA6` | P10 | Mutative commands are absent from agent catalog unless safe-first proof exists. |
| `CA7` | P13 | Every visible command, doc, and gate has ablation evidence. |
| `CA8` | P10, P13 | Command admission rules are executable through tests or fixtures. |
| `CA9` | P11 | README makes cockpit the front door. |
| `CA10` | P11, P13 | Docs delta records removal, merge, demotion, or approved exception for new first-contact prose. |
| `CA11` | P12 | Fresh-agent eval reaches a safe next action from only `harness next --json`. |
| `CA12` | P12 | Missing learning artifacts produce setup guidance or explicit degraded mode. |
| `CA13` | P12 | Plan cannot be marked done until help, catalog, README, and fresh-agent eval pass. |
| `CA14` | P10 | `pr-ready` and `learn` are rejected from help/catalog until implemented. |
| `CA15` | P13 | Hidden safety gates remain selected by cockpit or validation planning. |
| `CA16` | P13 | North-star status uses generated evidence for compression claims. |
| `CA17` | P10 | Expert compatibility remains available through `--all-commands` or full catalog. |
| `CA18` | P13 | Implementation diff stays inside governed compression surfaces. |

## Handoff to he-work

Do not restart `JSC-248` from P1. The next worker should treat P1-P5 as
already-landed cockpit machinery, P6-P8 as deferred or prior hardening context,
and P9-P13 as the active recovery slice.

Implement the subtractive slice first:

1. Add help and agent-catalog budget tests.
2. Add command admission proof.
3. Compress default help and agent catalog.
4. Rewrite the README front door.
5. Add fresh-agent eval proof.
6. Record ablation evidence.

Do not implement `pr-ready`, `fix-review`, `learn`, telemetry persistence,
nested parser aliases, unknown-command suggestion enrichment, full
responsibility taxonomy cleanup, Codex config generation, session-friction
fixtures, or Auto-review activation in this slice.

Re-check live Linear status and use `Refs JSC-248` in PR metadata until the
issue is fully complete.
