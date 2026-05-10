---
schema_version: 1
title: JSC-282 Command Truth Cockpit Plan
type: architecture
status: complete
date: 2026-05-08
plan_id: jsc-282-command-truth-cockpit
origin: docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md
repo: coding-harness
linear_issue: JSC-282
linear_issue_url: https://linear.app/jscraik/issue/JSC-282/coding-harness-reconcile-command-truth-for-pr-loop-cockpit
linear_project: coding-harness
linear_milestone: Agent Cockpit Compression Slice
linear_blocks:
  - JSC-283
source_plan: docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md
source_spec: docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md
source_skill: .agents/skills/coding-harness/SKILL.md
traceability_required: true
---

# JSC-282 Command Truth Cockpit Plan

## Table Of Contents

- [Plan Summary](#plan-summary)
- [Current Live Evidence](#current-live-evidence)
- [Loophole Review State](#loophole-review-state)
- [Authority And Scope](#authority-and-scope)
- [Technical Direction](#technical-direction)
- [First-Contact Budget](#first-contact-budget)
- [Implementation Steps](#implementation-steps)
- [Acceptance Criteria](#acceptance-criteria)
- [Validation Plan](#validation-plan)
- [Rollback Plan](#rollback-plan)
- [Dependencies And Sequencing](#dependencies-and-sequencing)
- [Human Review Points](#human-review-points)
- [Out Of Scope](#out-of-scope)
- [Traceability Matrix](#traceability-matrix)
- [Pre-work Handoff](#pre-work-handoff)

## Plan Summary

JSC-282 is the command-truth cleanup slice for the agent cockpit. Its job is not
to invent a new command model. Its job is to ensure the already-landed cockpit
compression is truthful across runtime help, machine catalogs, docs, tests, and
the packaged skill contract before JSC-283 proves installed behavior.

The live branch has already crossed the most important compression threshold:

- `pnpm exec tsx src/cli.ts commands --json --for-agent` emits one command,
  `next`.
- `pnpm exec tsx src/cli.ts --help` starts with `harness next --json` and hides
  the expert command list behind `--all-commands`.
- Registry tests now encode `AGENT_COMMAND_RAIL_NAMES = ["next"]`.

The remaining work is therefore proof and drift cleanup, not broad redesign.
JSC-282 should close only after source docs and skill references stop teaching
older command-truth rules, and after validation proves that future changes
cannot widen first-contact surfaces accidentally.

## Current Live Evidence

| Evidence | Observed runtime or source truth | Plan implication |
| --- | --- | --- |
| `pnpm exec tsx src/cli.ts commands --json --for-agent` | `commandCount: 1`, command name `next`, visibility `default` | The agent catalog budget is already satisfied in live source. Preserve it. |
| `pnpm exec tsx src/cli.ts --help` | Help starts with `Start here: harness next --json` and lists only `next` before expert discovery | Default help budget is already satisfied in live source. Preserve it. |
| `src/lib/cli/registry/command-capabilities.ts` | `FIRST_CONTACT_COMMAND_NAMES` is `["next"]` | First-contact admission currently has one explicit code authority. |
| `src/lib/cli/command-registry.ts` | `--for-agent` returns the filtered agent catalog unless `--all` or `--plumbing` is supplied | Full catalog compatibility remains available while agent catalog stays compressed. |
| `src/lib/cli/command-registry.test.ts` | Agent rail and help-row tests assert `["next"]` | Regression tests exist and should be the closure proof baseline. |
| `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md` | The May 7 command-count rows are now explicitly historical pre-JSC-282 evidence and point back to this plan for current truth | The legacy spec remains useful context without reopening solved runtime work. |
| `docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md` | The May 7 refresh evidence is now explicitly historical pre-JSC-282 evidence and points back to this plan for current truth | The source plan can still explain why compression was needed without pretending its old baseline is current. |
| `.agents/skills/coding-harness/SKILL.md` | Skill guidance now distinguishes `next`, focused help, full catalog, and public agent rails | Downstream agents should not infer full capability truth from focused help alone. |
| `pnpm exec tsx src/cli.ts drift-gate --mode advisory --json` | Warns about 64 baseline README-vs-dispatch findings with `status: warn` and 0 errors | This is residual command-doc drift evidence. JSC-282 eval must classify it instead of hiding it, but it does not invalidate the one-rail source probes. |

## Loophole Review State

This plan was re-reviewed after the initial blocker fixes because the first
draft still left factual loopholes:

| Loophole | Fix now encoded in this plan |
| --- | --- |
| The plan still described legacy docs and skill guidance as stale after they were edited. | Current evidence now records the fixed state and keeps the remaining eval proof explicit. |
| Packaged skill guidance still contained old "help is command truth" language. | Skill and contract guidance now split first-contact help from full catalog truth. |
| Validation used `pnpm exec harness plan-gate`, which can prove the installed package instead of the current source tree. | Source-repo validation now uses `pnpm exec tsx src/cli.ts plan-gate`; packaged parity remains a separate JSC-283 proof target. |
| Full compatibility could be lost while only the compressed agent catalog was checked. | Acceptance and validation require full `commands --json`, `commands --json --for-agent --all`, and `--help --all-commands` probes. |
| Existing `drift-gate` command-surface warnings could be ignored. | The JSC-282 eval must record and classify those warnings before JSC-283 is unblocked. |
| Package parity could be mistaken for JSC-282 closure. | JSC-282 is source-truth closure only; packaged binary/install parity is explicitly JSC-283 and must not be claimed here. |
| Eval closure could degrade into unit-test evidence only. | IU-005 now requires a real command transcript from source CLI probes; tests alone are insufficient for done-state. |

## Authority And Scope

Selected execution slice:

- Linear issue: `JSC-282`
- Milestone: `Agent Cockpit Compression Slice`
- Blocking relationship: `JSC-282` must complete before `JSC-283`

Source context:

- `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md`
- `docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`
- `src/lib/cli/registry/command-capabilities.ts`
- `src/lib/cli/command-registry.ts`
- `src/lib/cli/help-renderer.ts`
- `src/cli.ts`
- `.agents/skills/coding-harness/SKILL.md`

Scope rule:

JSC-282 may adjust command truth, docs truth, skill truth, and tests that prove
those surfaces match. It must not add new cockpit commands, broaden the
catalog, or implement JSC-283 packaged-install proof.

## Technical Direction

The architecture should keep one source of first-contact truth and one source
of full capability truth:

| Truth layer | Authority | Required behavior |
| --- | --- | --- |
| First-contact command set | `FIRST_CONTACT_COMMAND_NAMES` in `src/lib/cli/registry/command-capabilities.ts` | Only `next` is exposed to fresh agents by default. |
| Focused help | `src/cli.ts` plus `getRegistryCommandHelpRows()` | Help teaches `harness next --json` first and requires `--all-commands` for expert discovery. |
| Agent catalog | `getRegistryAgentCommandCatalogDocument()` | `commands --json --for-agent` returns only approved first-contact rails. |
| Full catalog | `getRegistryCommandCatalogDocument()` | `commands --json`, `commands --json --all`, and help `--all-commands` preserve expert compatibility. |
| Skill guidance | `.agents/skills/coding-harness/SKILL.md` | Skill must teach the split between first-contact help and machine catalog truth. |
| Docs reference | `README.md`, `docs/cli-reference.md`, source spec/plan notes | Docs must describe current runtime behavior, or explicitly mark older baseline text as historical evidence. |

Design constraint:

Do not create a second admission table unless the code needs richer policy than
`FIRST_CONTACT_COMMAND_NAMES`. If richer admission becomes necessary, the table
must live in code or generated fixtures and tests must fail when visible command
sets grow without admission proof.

## First-Contact Budget

The budget for this slice is intentionally narrow:

| Surface | Budget |
| --- | --- |
| Agent memory rule | `harness next --json` only |
| Default help listed commands | `next` only |
| `commands --json --for-agent` direct names | `next` only |
| Expert help | Available only through `harness --help --all-commands` or `--all` |
| Full machine catalog | Available through `harness commands --json` and `harness commands --json --all` |
| Future rails | `pr-ready`, `fix-review`, and `learn` remain hidden until registered, tested, and admitted by a new plan |

Any future command added to first contact must update this plan or a successor
ADR, update the code-level admission fixture, and add a regression test proving
why `next` alone is insufficient.

## Implementation Steps

Implementation state after the May 8 loophole review:

| Unit | State | Remaining closure gate |
| --- | --- | --- |
| IU-001 | Source probes have been run during review. | Persist summarized metrics in the eval artifact. |
| IU-002 | Implemented: legacy source docs now mark the old command-count snapshot as historical and point back to this plan. | Docs lint plus eval evidence. |
| IU-003 | Implemented: skill and contract guidance now teach the `next` / focused help / full catalog split. | Markdown/YAML validation plus JSC-283 packaged proof. |
| IU-004 | Existing registry and CLI tests already assert the one-rail budget. | Focused Vitest pass before closure. |
| IU-005 | Pending. | Write `.harness/evals/coding-harness-jsc-282-command-truth-eval.md` before unblocking JSC-283. |

### IU-001 - Freeze Live Command Baseline

Objective:

Capture the current command truth as machine-readable evidence before editing
docs or skill guidance.

Affected systems:

- `src/lib/cli/command-registry.ts`
- `src/lib/cli/registry/command-capabilities.ts`
- `src/cli.ts`
- `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`

Required probes:

```bash
pnpm exec tsx src/cli.ts commands --json --for-agent
pnpm exec tsx src/cli.ts commands --json
pnpm exec tsx src/cli.ts commands --json --for-agent --all
pnpm exec tsx src/cli.ts --help
pnpm exec tsx src/cli.ts --help --all-commands
```

Closure proof:

- Agent catalog command count is `1`.
- Agent catalog command names equal `["next"]`.
- Default help includes `Start here: harness next --json`.
- Default help does not list advanced command groups.
- Full catalog and expert help still expose non-first-contact commands.

### IU-002 - Reconcile Source Docs And Historical Baselines

Objective:

Prevent stale planning/spec text from acting as false current truth.

Affected systems:

- `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md`
- `docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`
- this `.harness/plan` artifact

Required change:

Add a dated current-state note to legacy source docs or replace stale baseline
tables with "historical baseline before JSC-282 compression" language. The goal
is not to rewrite the full legacy spec; it is to stop future agents from seeing
`commandCount: 9` or broad help as current state.

Closure proof:

- Searching for `commandCount: 9` or "still first-contact heavy" clearly lands
  in historical context, not active acceptance criteria.
- Legacy docs point at this `.harness/plan` artifact for current JSC-282
  command-truth execution.

### IU-003 - Reconcile Packaged Skill Command Truth

Objective:

Make the packaged skill guidance match the split between first-contact help and
machine-readable catalog truth.

Affected systems:

- `.agents/skills/coding-harness/SKILL.md`
- `.agents/skills/coding-harness/references/contract.yaml`
- downstream packaged skill validation in JSC-283

Required change:

Replace the broad rule "treat `harness --help` as command truth" with the
current split:

- use `harness next --json` for fresh-agent entry,
- use focused `harness --help` for first-contact command truth,
- use `harness commands --json` for full machine-readable capability truth,
- use `harness commands --json --for-agent` for the public agent rail set.

Closure proof:

- The skill no longer tells agents to derive full command truth from focused
  help alone.
- The skill still keeps docs subordinate to runtime/source evidence.
- JSC-283 can use this wording as its packaged-install expected behavior.

### IU-004 - Lock Regression Tests Around The One-Rail Budget

Objective:

Ensure future command additions cannot accidentally widen first-contact
surfaces.

Affected systems:

- `src/lib/cli/command-registry.test.ts`
- `src/cli.test.ts`
- optional fixture under `tests/fixtures/**` only if needed

Required checks:

- `getRegistryAgentCommandCatalogDocument()` command names equal `["next"]`.
- `getRegistryCommandHelpRows()` default names equal `["next"]`.
- `getRegistryCommandHelpRows({ includeExpert: true })` still exposes full
  canonical command names and aliases.
- `--help --all-commands` remains wired to expert help.

Closure proof:

- Tests fail if `check`, `init`, `commands`, `health`, `review-context`,
  `validation-plan`, or any mutative command returns to first contact without
  an explicit test update.

### IU-005 - Write Eval Artifact And Closure Notes

Objective:

Record before/after proof for JSC-282 and leave JSC-283 a deterministic
packaged-skill proof target.

Affected systems:

- `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`
- Linear `JSC-282`
- Linear `JSC-283`

Eval must include:

- command outputs or summarized JSON metrics from IU-001,
- a real source-CLI command transcript for `next`, focused help, full catalog,
  public agent rails, expert help, source `plan-gate`, and source `drift-gate`,
- tests run and exact outcomes,
- docs/skill reconciliation summary,
- the `drift-gate --mode advisory --json` status and a classification of the
  baseline README-vs-dispatch warnings,
- remaining work intentionally deferred to JSC-283,
- rollback notes if a later install or package build proves divergence.

Closure proof:

- The eval artifact says whether JSC-282 is ready to unblock JSC-283.
- The eval artifact does not claim packaged binary/install parity.
- JSC-283 has an exact runtime and packaged skill behavior to prove.

## Acceptance Criteria

| ID | Requirement | Evidence |
| --- | --- | --- |
| AC-001 | Fresh-agent first contact is `harness next --json` only. | Runtime help and README/CLI docs evidence. |
| AC-002 | `commands --json --for-agent` returns only `next`. | Runtime JSON probe and command-registry test. |
| AC-003 | Full expert discovery remains available. | `commands --json`, `commands --json --for-agent --all`, and `--help --all-commands` probes. |
| AC-004 | Stale legacy plan/spec baselines are marked historical or corrected. | Focused doc diff and docs lint. |
| AC-005 | Packaged skill guidance teaches first-contact vs full-catalog truth correctly. | Skill diff and markdown/yaml validation where available. |
| AC-006 | Regression tests fail on accidental first-contact widening. | Focused Vitest command-registry and CLI tests. |
| AC-007 | JSC-283 receives a deterministic packaged behavior target. | Eval artifact and Linear closure note. |
| AC-008 | Existing command-doc drift warnings are not hidden. | `drift-gate --mode advisory --json` captured and classified in the eval artifact. |
| AC-009 | Eval closure is based on real source CLI probes, not tests alone. | Eval artifact includes command transcript or summarized command metrics for every validation surface. |
| AC-010 | Packaged parity is not overclaimed. | Eval explicitly defers packaged binary/install proof to JSC-283. |

## Validation Plan

Run the narrowest proof first, then widen only if runtime or docs behavior
changed:

```bash
pnpm exec tsx src/cli.ts commands --json --for-agent
pnpm exec tsx src/cli.ts commands --json
pnpm exec tsx src/cli.ts commands --json --for-agent --all
pnpm exec tsx src/cli.ts --help
pnpm exec tsx src/cli.ts --help --all-commands
pnpm exec vitest run src/lib/cli/command-registry.test.ts src/cli.test.ts
pnpm docs:lint .harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md
pnpm exec tsx src/cli.ts plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json
pnpm exec tsx src/cli.ts drift-gate --mode advisory --json
```

If docs or packaged skill files are edited, also run the relevant focused docs
or skill validation available in the repo. If behavior changes, run
`bash scripts/validate-codestyle.sh --fast` before handoff.

Use `pnpm exec harness ...` only as packaged parity evidence. In this source
repository, source-truth validation must run through `pnpm exec tsx src/cli.ts`
so version and dispatch evidence come from the working tree under review.

## Rollback Plan

Runtime rollback:

- Restore `FIRST_CONTACT_COMMAND_NAMES` and help rendering to the previous
  tested state if agent catalog or help output becomes broader without
  admission proof.
- Restore full catalog exposure if compatibility probes fail.

Docs rollback:

- Revert only the stale-baseline wording or skill guidance change that caused
  drift; do not revert unrelated cockpit implementation already in source.

Stop conditions:

- `commands --json --for-agent` grows beyond `["next"]` without a matching
  plan/ADR/test update.
- `--help --all-commands` loses full command discoverability.
- Packaged skill wording directs agents back to broad command exploration
  before `next`.

## Dependencies And Sequencing

| Unit | Depends on | Blocks | Can run in parallel |
| --- | --- | --- | --- |
| IU-001 | none | IU-002, IU-003, IU-005 | no |
| IU-002 | IU-001 | IU-005 | yes, after baseline capture |
| IU-003 | IU-001 | JSC-283 | yes, after baseline capture |
| IU-004 | IU-001 | IU-005 | yes, if tests are already present |
| IU-005 | IU-001, IU-002, IU-003, IU-004 | JSC-283 | no |

## Human Review Points

Human review is required for:

- changing the first-contact budget from `next` only,
- deciding whether to edit legacy source specs versus appending historical
  baseline notes,
- changing packaged skill guidance that downstream repos consume,
- unblocking JSC-283.

Agent-safe work:

- runtime baseline capture,
- focused doc baseline notes,
- skill wording reconciliation,
- focused tests and eval artifact generation.

## Out Of Scope

- Implementing `pr-ready`, `fix-review`, or `learn`.
- Adding new command aliases for cockpit rails.
- Reworking command dispatch architecture.
- Deleting full catalog commands.
- Proving installed package or globally installed binary behavior in a downstream fixture. That is JSC-283.
- Reopening the broader JSC-248 cockpit implementation unless tests prove a
  current regression.

## Traceability Matrix

| Source | Requirement | Plan unit | Closure evidence |
| --- | --- | --- | --- |
| JSC-282 | Reconcile command truth for PR-loop cockpit | IU-001 through IU-005 | Eval artifact plus tests |
| JSC-283 | Prove packaged skill behavior | IU-003, IU-005 | Deterministic expected behavior handed off |
| Agent-native compression contract | Golden path must be `harness next --json` | IU-001, IU-004 | Runtime probes and regression tests |
| `src/lib/cli/registry/command-capabilities.ts` | Code-level first-contact authority | IU-001, IU-004 | `FIRST_CONTACT_COMMAND_NAMES` remains `["next"]` |
| `.agents/skills/coding-harness/SKILL.md` | Downstream agent guidance | IU-003 | Skill guidance aligns with runtime truth |
| Legacy May 7 spec/plan | Historical compression context | IU-002 | Stale baseline marked historical or replaced |

## Pre-work Handoff

Start with IU-001. Do not edit behavior until the current runtime baseline is
captured.

If the baseline still matches the observed May 8 state, continue with docs and
skill truth reconciliation. If it does not match, stop and classify whether the
branch moved, package execution drifted, or tests are reading a different
catalog path.

Recommended first command batch:

```bash
pnpm exec tsx src/cli.ts commands --json --for-agent
pnpm exec tsx src/cli.ts --help
pnpm exec vitest run src/lib/cli/command-registry.test.ts src/cli.test.ts
```
