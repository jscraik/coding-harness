---
schema_version: 1
title: Agent-Native Cockpit Control Loop First Slice Plan
type: feat
status: active
date: 2026-05-02
plan_id: feat-agent-native-cockpit-control-loop-first-slice
source_spec: docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md
linear_issue: JSC-248
route: fresh
plan_depth: deepened
run_type: planning-artifact
last_validated: 2026-05-04
plan_revision: he-plan-refresh
---

# Agent-Native Cockpit Control Loop First Slice Plan

## Enhancement Summary

**Planned on:** 2026-05-02
**Mode:** `deepened-plan`
**Source spec:** [Agent-Native Cockpit Control Loop](../specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md)
**Linear issue:** `JSC-248`
**Implementation slice:** shared `HarnessDecision`, read-only `harness next --json`, command metadata tiers, cockpit-first help, and high-traffic docs compression.

This plan implements the smallest useful agent-native cockpit slice. It does
not implement the full product vision. The first deliverable is a reliable
control loop that helps an agent inspect the repo, decide the next safe command,
and produce machine-readable evidence without executing mutative work.

## Table of Contents

- [Overview](#overview)
- [Source Traceability](#source-traceability)
- [Current Repo Evidence](#current-repo-evidence)
- [HE Plan Refresh](#he-plan-refresh)
- [Scope Boundaries](#scope-boundaries)
- [Execution Rules](#execution-rules)
- [Execution State](#execution-state)
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
| `src/cli.ts`                                                           | Current single-token dispatcher boundary                   |
| `src/lib/cli/registry/command-specs-core.ts`                           | Canonical registry source for command specs                |
| `src/lib/cli/command-registry.ts`                                      | Registry aggregation, dispatch, and command catalog source |
| `src/lib/cli/registry/command-capabilities.ts`                         | Existing command metadata surface                          |
| `src/lib/cli/registry/types.ts`                                        | Existing `CommandSpec` type                                |
| `src/commands/review-context.ts`                                       | Existing review-context command behavior                   |
| `src/commands/validation-plan.ts`                                      | Existing validation-plan command behavior                  |

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

1. Re-run focused tests to confirm which `SA1`-`SA17` criteria are already
   satisfied on the active branch.
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

## Scope Boundaries

### In Scope

- Add a shared `HarnessDecision` contract and fixture validation.
- Extend command capability metadata with first-slice cockpit tiers and
  routing fields.
- Register top-level `harness next`.
- Implement `harness next --json` as read-only local orchestration.
- Update default help to prioritize cockpit commands.
- Update README, quickstart, and CLI reference only enough to route users and
  agents to the cockpit loop.

### Out of Scope

- Full `harness pr-ready` orchestration.
- Nested `harness pr ready` parser support.
- Mutative `harness fix-review`.
- First-class `harness learn` product work.
- Telemetry persistence under `.harness/decisions/**`.
- Command deletion, deprecation, or broad docs restructuring.
- Fresh-agent hero-story evaluation implementation.

## Execution Rules

1. Keep every implementation unit additive until the tests prove the new
   contract is stable.
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
9. Docs updates must compress or route existing guidance rather than adding a
   parallel hero-story documentation layer.
10. PR metadata must use `Refs JSC-248` until the Linear issue is fully done.
11. Before PR handoff, re-check live `JSC-248` status, owner, and scope; update
    this plan and the spec if Linear drifted.
12. Safety metadata takes precedence over tier placement: recommendations with
    `writesFiles`, `requiresNetwork`, or `requiresHuman` uncertainty must be
    conservative or `blocked`.

## Execution State

Current `he-work` state before the next runtime implementation pass:

- **Phase:** `P6 - Technical Hardening Refresh`
- **Checked at:** 2026-05-04 snapshot; refresh before executing
- **Branch snapshot:** `main...origin/main [ahead 4, behind 2]`; refresh before
  executing
- **Tracker:** `JSC-248`, status `In Progress`, assignee
  `jscraik@brainwav.io`, project `coding-harness`; refresh before executing
- **Existing implementation:** `HarnessDecision`, `harness next`, and
  session-closeout contract modules are present in the live tree
- **Dirty worktree at refresh:** unrelated existing edits in
  `.vale/styles/config/vocabularies/Harness/accept.txt`, `CHANGELOG.md`,
  `docs/agents/02-tooling-policy.md`, `package.json`, and
  `docs/benchmarks/runs/swe-20260503-171626.json`; preserve these unless
  explicitly adopted
- **Plan/spec files updated by this refresh:** this plan, the source spec, and
  the JSC-249 session-friction plan
- **Next implementation phase:** audit the existing implementation against
  `SA1`-`SA17`, then implement only missing `SA28`-`SA35` technical hardening

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

- Existing `SA1`-`SA17` behavior is verified first; only failing or missing
  acceptance criteria are changed.
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
```

P3 must include the minimal `docs/cli-reference.md` entry for `next` because
the current registry tests enforce command-reference parity. P4 may begin once
P2 has stable tier metadata, but it should not merge before P3 registers the
real `next` command. P5 should remain last so README and quickstart describe
implemented behavior rather than aspiration.

## Validation Plan

Focused validation during implementation:

- `pnpm exec vitest run src/lib/cli/command-registry.test.ts`
- `pnpm exec vitest run src/commands/next.test.ts`
- `pnpm exec vitest run src/cli.test.ts`
- `pnpm exec markdownlint-cli2 README.md docs/agents/quickstart.md docs/cli-reference.md docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`
- live `JSC-248` status and owner check before PR handoff

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

## Acceptance Traceability

| Acceptance ID | Plan unit                            | Status                                                                                                                                                   |
| ------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SA1`         | P1                                   | Implemented in live tree; verify before further edits                                                                                                    |
| `SA2`         | P1                                   | Implemented in live tree; verify before further edits                                                                                                    |
| `SA3`         | P1                                   | Implemented in live tree; verify before further edits                                                                                                    |
| `SA4`         | P3                                   | Implemented in live tree; verify before further edits                                                                                                    |
| `SA5`         | P3                                   | Implemented in live tree; verify before further edits                                                                                                    |
| `SA6`         | P3                                   | Implemented in live tree; verify before further edits                                                                                                    |
| `SA7`         | P3                                   | Implemented in live tree; verify before further edits                                                                                                    |
| `SA8`         | P3                                   | Implemented in live tree; verify before further edits                                                                                                    |
| `SA9`         | P2, P4                               | Implemented or partially implemented; verify help snapshot                                                                                               |
| `SA10`        | P2                                   | Implemented or partially implemented; verify command catalog JSON                                                                                        |
| `SA11`        | P1, P2                               | Implemented in live tree; verify regression coverage                                                                                                     |
| `SA12`        | P5                                   | Implemented or partially implemented; verify docs routing                                                                                                |
| `SA13`        | P3, P4                               | Implemented or partially implemented; verify snapshots                                                                                                   |
| `SA14`        | Deferred                             | Out of first slice                                                                                                                                       |
| `SA15`        | Deferred                             | Out of first slice                                                                                                                                       |
| `SA16`        | P2                                   | Implemented or partially implemented; verify catalog validation                                                                                          |
| `SA17`        | P5                                   | Implemented or partially implemented; verify README/quickstart                                                                                           |
| `SA18`        | Deferred                             | Out of first slice                                                                                                                                       |
| `SA19`        | Deferred                             | Out of first slice                                                                                                                                       |
| `SA20`        | Deferred                             | Out of first slice                                                                                                                                       |
| `SA28`-`SA35` | P6                                   | Outstanding technical hardening                                                                                                                          |
| `SA36`-`SA38` | Deferred                             | Codex config steering evidence; out of JSC-248 implementation                                                                                            |
| `SA39`-`SA45` | P7 deferred                          | Approval reviewer contract; out of JSC-248 unless promoted by measured approval friction                                                                 |
| `SA46`-`SA52` | P8 / `JSC-279` deferred              | Goal continuation contract; out of JSC-248 unless promoted by measured resume or stale-plan friction                                                     |
| `SA53`-`SA54` | Promoted command-surface compression | Agent-mode visibility and public agent command discovery after explicit user promotion                                                                   |
| `SA55`        | Promoted work-packet deepening       | `HarnessDecision` carries phase, objective, evidence, stop conditions, escalation, follow-up commands, and hidden plumbing after explicit user promotion |
| `SA56`        | Promoted validation-plan ladder      | `validation-plan` returns ranked command buckets and falls back to path-based planning when optional learning artifacts are absent                       |
| `SA57`        | Promoted review-context handoff      | `review-context` emits reviewer handoff fields after explicit user promotion                                                                             |
| `SA58`-`SA61` | Deferred command-surface compression | PR-ready and session-friction contracts; out of JSC-248 unless explicitly promoted                                                                       |

## Handoff to he-work

Do not restart `JSC-248` from P1. The next worker should first verify the
already-landed P1-P5 surfaces, then implement P6 technical hardening only where
the deepened spec is still unmet. Do not implement `pr-ready`, `fix-review`,
`learn`, telemetry persistence, command deletion, nested parser aliases,
unknown-command suggestion enrichment, full responsibility taxonomy cleanup,
hero-story evaluations, Codex config generation, session-friction fixtures, or
Auto-review activation in this slice.

Re-check live Linear status and use `Refs JSC-248` in PR metadata until the
issue is fully complete.
