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

| Source | Role |
| --- | --- |
| `JSC-248` | Linear tracker and PR linkage authority |
| `docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md` | Behavioral source of truth |
| `src/cli.ts` | Current single-token dispatcher boundary |
| `src/lib/cli/registry/command-specs-core.ts` | Canonical registry source for command specs |
| `src/lib/cli/command-registry.ts` | Registry aggregation, dispatch, and command catalog source |
| `src/lib/cli/registry/command-capabilities.ts` | Existing command metadata surface |
| `src/lib/cli/registry/types.ts` | Existing `CommandSpec` type |
| `src/commands/review-context.ts` | Existing review-context command behavior |
| `src/commands/validation-plan.ts` | Existing validation-plan command behavior |

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

Initial `he-work` state before runtime implementation:

- **Phase:** `P0 - Baseline and Tracker Lock`
- **Checked at:** 2026-05-02
- **Branch:** `codex/north-star-artifact-surfaces`
- **Tracker:** `JSC-248`, status `Triage`, live assignee tracked in Linear,
  project `coding-harness`
- **Dirty worktree at start:** unrelated existing edits in `package.json`,
  `scripts/test-with-artifacts.sh`, one new evaluation scenario directory,
  and one new harness evaluation runner script; preserve these unless
  explicitly brought into the cockpit slice
- **P0 slice files:** this plan and the source spec only
- **Next implementation phase after P0 commit:** `P1 - HarnessDecision Contract`

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

## Dependency Graph

```text
P0 tracker/spec lock
  -> P1 HarnessDecision
    -> P2 command metadata
      -> P3 harness next
        -> P4 cockpit-first help
          -> P5 docs compression
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

| Risk | Control |
| --- | --- |
| `next` becomes a hidden executor | Unit tests assert recommendations only and no mutation |
| Help advertises unimplemented commands | Help derives from registered command specs only |
| Metadata breaks existing agents | Add fields additively; hard-fail only first-slice cockpit and directly orchestrated commands |
| `GateResult` gets displaced | Keep `HarnessDecision` separate and only reference gate output under `meta` |
| Docs sprawl returns | Limit docs changes to README, quickstart, and CLI reference |
| Single-token dispatch mismatch | Use canonical `next` and `pr-ready`; defer nested aliases |

## Acceptance Traceability

| Acceptance ID | Plan unit | Status |
| --- | --- | --- |
| `SA1` | P1 | Planned |
| `SA2` | P1 | Planned |
| `SA3` | P1 | Planned |
| `SA4` | P3 | Planned |
| `SA5` | P3 | Planned |
| `SA6` | P3 | Planned |
| `SA7` | P3 | Planned |
| `SA8` | P3 | Planned |
| `SA9` | P2, P4 | Planned |
| `SA10` | P2 | Planned for first-slice cockpit/directly orchestrated commands |
| `SA11` | P1, P2 | Planned |
| `SA12` | P5 | Planned for first-slice routing responsibilities |
| `SA13` | P3, P4 | Planned |
| `SA14` | Deferred | Out of first slice |
| `SA15` | Deferred | Out of first slice |
| `SA16` | P2 | Planned |
| `SA17` | P5 | Planned |
| `SA18` | Deferred | Out of first slice |
| `SA19` | Deferred | Out of first slice |
| `SA20` | Deferred | Out of first slice |

## Handoff to he-work

Implement `JSC-248` in the P0 to P5 order above. Start with the
`HarnessDecision` contract and first-slice metadata, then add read-only
`harness next --json` plus its minimal CLI reference entry, then wire help and
README/quickstart docs. Do not implement `pr-ready`, `fix-review`, `learn`,
telemetry persistence, command deletion, nested parser aliases, unknown-command
suggestion enrichment, full responsibility taxonomy cleanup, or hero-story
evaluations in this slice.

Re-check live Linear status and use `Refs JSC-248` in PR metadata until the
issue is fully complete.
