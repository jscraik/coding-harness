# Gap Register Ratchet Program Goal

## Table of Contents

- [Native Goal Prompt](#native-goal-prompt)
- [Objective](#objective)
- [Source Artifacts](#source-artifacts)
- [Report-Derived Gap Queue](#report-derived-gap-queue)
- [Token Budget Policy](#token-budget-policy)
- [Operating Flow](#operating-flow)
- [Gap Slice Contract](#gap-slice-contract)
- [Ratchet Ladder](#ratchet-ladder)
- [Testing And Eval Flow](#testing-and-eval-flow)
- [Simplify Gate](#simplify-gate)
- [Commit And PR Green Sweep Gate](#commit-and-pr-green-sweep-gate)
- [Completion Contract](#completion-contract)
- [Blocked Stop Conditions](#blocked-stop-conditions)
- [Startup Checklist](#startup-checklist)

## Native Goal Prompt

Use this exact native prompt when starting or restoring the goal:

    /goal Follow docs/goals/gap-register-ratchet-program/goal.md

The goal follow prompt is a convention. The agent must read this file,
state.yaml, and receipts.jsonl before acting. Native goal state is live runtime
context; this board is the durable repo-owned coordination surface.

## Objective

Turn the 2026-06-30 evidence-led gap register into a governed ratchet program
that closes gaps one at a time, preserves claim/evidence lane separation, and
prevents each closed failure class from recurring through a validator, schema,
test, command contract, or documented fail-closed consumer.

This board does not close the gaps by itself. It defines the flow future agents
must use before implementing, testing, simplifying, committing, and triaging
each gap-fix slice.

## Source Artifacts

- Gap audit:
  .harness/research/audits/2026-06-30-evidence-led-codebase-gap-audit.md
- Evidence extraction:
  .harness/research/deep/2026-06-30-tessl-agent-evidence.md
- Gap-register working recommendation:
  Incorporated into the tracked gap audit and this goal board. Future
  continuations must use the repo-owned audit and board files above instead of
  local attachment state.
- Project north star:
  docs/roadmap/north-star.md
- Agent-first status:
  docs/roadmap/agent-first-status.md
- CI required-check authority:
  docs/agents/17-ci-required-checks.md

## Report-Derived Gap Queue

The initial queue is derived from
.harness/research/audits/2026-06-30-evidence-led-codebase-gap-audit.md. Future
agents must refresh that report or cite a newer adopted source before changing
this priority order.

| Order | Gap | Report priority basis | First ratchet target |
|---:|---|---|---|
| 1 | GAP-001 prompt-context drift evidence is stale against live HEAD | Highest-leverage fix rank 1 and immediate next action | prompt-context drift lifecycle and freshness validation |
| 2 | GAP-003 CLI reference advertises an invalid next mode | Safest first patch and highest-leverage fix rank 2 | executable orient command example or CLI mode test |
| 3 | GAP-002 required-check and workflow authority drift | Highest-risk missing system and highest-leverage fix rank 3 | scripts/check-ci-required-check-source-parity.mjs |
| 4 | GAP-004 agent-native ratchet checks are not part of the default static lane | Best validation command to add first | proposed pnpm run agent-native:validate with current fallback commands |
| 5 | GAP-006 CLI JSON contract manifest is narrower than public agent command surface | Highest-leverage fix rank 5 | expanded CLI JSON contract manifest and validator |
| 6 | GAP-007 architecture warnings are baselined without visible repair metadata | Highest-leverage fix rank 6 | architecture checker baseline metadata |
| 7 | GAP-005 root AGENTS.md is overloaded | Highest-leverage fix rank 7 | front-door density or duplicate-policy guard |
| 8 | GAP-008 research audit artifacts need clearer advisory authority | Highest-leverage fix rank 8 | research-audit authority banner and promotion path |

The report also names two cross-cutting ratchets:

- claim-boundary consumer tests proving advisory ratchets cannot satisfy PR,
  CI, review, tracker, or merge-readiness claims
- run-loop/v1 only after context, command, CI authority, and command-contract
  drift are resolved

## Token Budget Policy

Each continuation must declare and track a token budget before Worker
implementation starts. Budget pressure is routing evidence, not completion
evidence.

Default budget envelope:

| Lane | Token budget | Required checkpoint |
|---|---:|---|
| Scout gap selection | 20,000 | Stop at 75 percent if no single gap is selected. |
| Worker implementation slice | 80,000 | Stop at 50 percent if no focused ratchet exists; stop at 75 percent if no proof command has run. |
| Judge validation and review synthesis | 30,000 | Stop at 75 percent if testing, eval classification, or simplify evidence is missing. |
| PM PR green-sweep triage | 40,000 | Stop at 75 percent if live PR truth cannot be refreshed. |

Each slice receipt must record:

- starting token budget
- tokens used when known
- checkpoint crossed, if any
- budget-limited or usage-limited native state, if observed
- whether the next action is continue, split slice, ask owner, or block

If native runtime reports budgetLimited, budget_limited, usageLimited, or
usage_limited, do not treat that as completion evidence. Record the stop state,
write a receipt, and route to PM or Judge recovery before Worker continuation.

## Operating Flow

Every gap slice must follow this sequence:

1. Governor orientation:
   read goal.md, state.yaml, and receipts.jsonl; confirm exactly one active
   task; reconcile native goal state if present; record current branch, current
   HEAD, dirty worktree ownership, active artifact scope, and token budget
   remaining when available.
2. Gap intake:
   select exactly one gap or one tightly coupled pair; copy the gap id,
   severity, unsafe claim, expected evidence, and proposed validation command
   into the slice receipt; stop if the gap cannot be closed without mixing
   unrelated local changes.
3. Architecture and depth check:
   use the project-local improve-codebase-architecture vocabulary: module,
   interface, seam, depth, leverage, and locality. Prefer the smallest deep
   module or validator seam that removes manual glue.
4. Agent-native ratchet design:
   name the unsafe claim, name the evidence required before that claim is
   allowed, and pick the smallest ratchet: test, schema, validator, command
   contract, fail-closed consumer, docs gate, or PR-template check.
5. Implementation:
   patch only the slice allowed files and keep local validation, generated
   artifacts, CI, review threads, tracker state, and merge readiness separate.
6. Testing:
   run the narrowest repo-native proof that exercises the changed behavior. If
   behavior changed and no focused proof exists, add or update a regression test
   or retained fixture before widening validation.
7. Eval classification:
   use evals-router only when the slice changes an LLM, RAG, judge, or
   review-tool evaluation surface. If evals are not applicable, record
   eval_route: not_applicable with the reason.
8. Simplify pass:
   review the scoped diff for behavior-preserving cleanup. Apply only changes
   backed by reference, import, or test evidence.
9. Validation closeout:
   run changed-file policy routing, then every required gate for the changed
   files or record a blocker. Keep proposed commands separate from currently
   executable fallback checks.
10. Commit gate:
    commit only after local proof, simplify pass, and required docs/evidence
    checks have explicit outcomes.
11. PR green-sweep triage:
    after PR creation, use live PR truth for checks, review threads,
    mergeability, and branch state. Do not claim local validation proves hosted
    checks, reviews, tracker state, or merge readiness.

## Gap Slice Contract

Each gap slice receipt must include:

- gap id
- token budget and checkpoint status
- unsafe claim
- current evidence
- expected evidence
- selected ratchet
- files allowed
- files intentionally excluded
- current executable validation commands
- proposed validation commands when any command does not exist yet
- testing lane
- eval lane or not-applicable reason
- simplify result
- PR green-sweep result after PR creation
- remaining truth-lane separation

## Ratchet Ladder

Use this ladder for every accepted gap:

1. Observation: failing command, stale artifact, contradiction, invalid docs, or
   missing authority map.
2. Narrow correction: smallest code, docs, schema, or config change.
3. Focused proof: exact command proving the changed surface.
4. Regression ratchet: test, schema, validator, script, or docs gate.
5. Route wiring: package script or workflow gate only when the proof is stable
   and cheap enough for that lane.
6. Closeout boundary: explicit list of truth lanes not proven.

Do not skip from observation to broad gate wiring. A failed broad gate without a
focused ratchet creates noise, not leverage.

## Testing And Eval Flow

Testing owns deterministic proof:

- structural proof: schemas, manifests, JSON contracts, package scripts
- behavior proof: CLI command, runtime path, validator, fixture, or focused test
- regression retention: fixture or test that fails before the fix when feasible
- closeout evidence: exact command text plus pass, fail, or blocked outcome

Evals-router owns only eval-shaped work:

- judge prompt changes
- synthetic eval cases
- RAG support maps
- failed trace analysis
- review-tool verdict schema

If the gap does not touch those surfaces, the eval lane is
not_applicable: deterministic validator/test route is sufficient.

## Simplify Gate

Before commit, run a scoped simplify pass over the slice diff:

- remove duplicate predicates or one-off helper drift only when behavior proof
  remains intact
- extract a helper only when it improves interface depth or locality
- do not rename public terms or move seams without a test-backed reason
- preserve broad refactors for a separate slice

The simplify pass must produce either simplify_result: applied with files
changed and validation rerun, or simplify_result: no_change with inspected scope
and skipped reasons.

## Commit And PR Green Sweep Gate

Before commit:

- git status --short --branch
- pnpm run coding-policy:route:changed
- focused validation for the changed behavior
- required changed-file gates
- simplify result
- goal-board validation when this board changes

After commit and PR creation:

- refresh PR URL, head SHA, draft state, mergeability, required checks, and
  review-thread state
- classify failures as current patch, pre-existing, unrelated dirty worktree,
  environment/tooling, or owner decision
- fix only evidence-backed in-scope blockers
- do not delete branches or worktrees without explicit cleanup authority

## Completion Contract

outcome: Every accepted 2026-06-30 gap-register item is closed, explicitly
blocked, or converted into a tracked implementation slice with a durable
ratchet and current evidence.

verification_surface:

- docs/goals/gap-register-ratchet-program/goal.md
- docs/goals/gap-register-ratchet-program/state.yaml
- docs/goals/gap-register-ratchet-program/receipts.jsonl
- .harness/research/audits/2026-06-30-evidence-led-codebase-gap-audit.md
- slice-specific tests, validators, or schemas
- slice-specific simplify output
- slice-specific eval classification
- slice-specific PR green-sweep evidence after PR creation

constraints:

- One gap slice at a time unless Jamie explicitly authorizes a named exception.
- Do not conflate local validation with CI, review, tracker, or merge-readiness
  truth.
- Do not introduce a new validator, script, skill, or gate when an existing
  nearby mechanism can be improved.
- Do not treat research-audit findings as accepted governance until promoted
  through a goal, spec, ADR, or implementation slice.
- Preserve unrelated dirty worktree files.

boundaries:

- This board authorizes flow creation and future gap-slice governance, not bulk
  implementation of all gaps.
- A gap is not closed by prose alone.
- A proposed command is not validation evidence until it exists and runs.
- PR green-sweep may classify live PR state, but merge and destructive cleanup
  still require explicit authority.

iteration_policy: Scout selects one gap, Worker implements the smallest
ratchet-backed slice only after board activation, Judge verifies testing, eval
classification, simplify output, and validation evidence, then PM runs PR
green-sweep and records live PR truth before the next gap starts.

blocked_stop_condition: Stop if the board is invalid, native and board state
conflict, the selected gap lacks a concrete unsafe claim, validation cannot run,
eval evidence is missing for an eval-shaped change, simplify cannot preserve
behavior, PR truth is stale, dirty work overlaps required files, or the slice
crosses a token-budget checkpoint without the required evidence.

## Blocked Stop Conditions

Stop before implementation when:

- no single gap is selected
- current worktree includes unrelated dirty files in candidate allowed files
- the proposed ratchet is only another reminder in prose
- the validation command does not exist and no current fallback is named
- the slice requires external auth or hosted settings not available locally
- review, CI, or tracker truth is needed but has not been refreshed
- token budget is above its checkpoint threshold without the corresponding
  gap-selection, ratchet, proof, validation, or PR-truth evidence

## Startup Checklist

1. Read this file, state.yaml, and receipts.jsonl.
2. Run the board validator.
3. Run git status --short --branch.
4. Read the 2026-06-30 audit gap register.
5. Use the report-derived gap queue unless a newer adopted source changes it.
6. Select one gap and write the slice contract before editing.
7. Confirm current executable validation commands.
8. Implement the smallest ratchet.
9. Run testing, eval classification, simplify, validation, commit, and PR
   green-sweep gates in order.
