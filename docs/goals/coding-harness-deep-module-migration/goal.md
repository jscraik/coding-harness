# Finish Coding Harness Deep Module Migration

## Table of Contents

- [Goal Governor Prompt](#goal-governor-prompt)
- [Objective](#objective)
- [Source Artifacts](#source-artifacts)
- [Operational Failure Signal](#operational-failure-signal)
- [Repository Constraints](#repository-constraints)
- [Completion Contract](#completion-contract)
- [Slice Queue](#slice-queue)
- [Per-Slice Operating Loop](#per-slice-operating-loop)
- [Module Layout Record Contract](#module-layout-record-contract)
- [Review Gate Contract](#review-gate-contract)
- [Background PR Green Sweep](#background-pr-green-sweep)
- [Stop Conditions](#stop-conditions)
- [Final Completion Audit](#final-completion-audit)

## Goal Governor Prompt

`/goal Follow docs/goals/coding-harness-deep-module-migration/goal.md is a prompt convention`.

Create or continue this Goal Governor-governed objective for finishing the
Coding Harness deep-module migration. Read `goal.md`, `state.yaml`, and
`receipts.jsonl` before Worker work. If board health is unclear, use
verification recovery before implementation.

Repo-canonical validation command:

- Per-slice focused proof: the narrowest existing test or direct production
  command for the moved module.
- Per-slice safety: `bash scripts/validate-codestyle.sh --fast`.
- Before push or PR handoff: `bash scripts/verify-work.sh --fast`.
- Before final readiness or broad shared-surface changes: `pnpm check`.

## Objective

Finish the remaining non-Effect deep-module migration in small, reviewable,
buildable slices. Each slice must deepen a real module boundary, reduce agent
context load, preserve behavior, update enforcement, update the live module
layout visual, run focused validation, pass review gates, and be committed and
pushed before the next slice starts.

Effect layers are intentionally deferred to a later goal unless Jamie changes
that priority.

## Source Artifacts

- `AGENTS.md`
- `CODESTYLE.md`
- task-relevant `codestyle/*.md`
- `.harness/review/2026-05-20-module-boundary-taste-review.md`
- `.harness/implementation-notes/2026-05-19-module-layout.html`
- `artifacts/architecture/module-layout.html`
- `docs/architecture/module-boundaries.md`
- `src/lib/**`
- `tests/**`

## Operational Failure Signal

This migration has stalled because repeated heartbeat continuation was treated
as task progress without one durable completion contract, slice ledger, PR-green
owner, and current-state board. Treat that as an operating-system failure, not
as an isolated delay.

Durable improvement for this goal:

- Keep this board as the source of truth for current, next, remaining,
  blocked, and deferred work.
- Record every slice in `receipts.jsonl`.
- Keep PR and CI triage separate but continuously reported back here.
- Do not start another split from conversation memory.

## Repository Constraints

- Target repository: `/Users/jamiecraik/dev/coding-harness`.
- Start every slice from live git state, not memory.
- Do not use `core.worktree`.
- Preserve unrelated user work.
- If the worktree is dirty, classify every dirty path before editing.
- Use `apply_patch` for manual edits.
- Stage only files intentionally changed for the active slice.
- Keep command facades thin and move responsibility into named control
  surfaces.
- Do not introduce Effect imports in this goal.
- Keep the module-layout visual current after each module move.

## Completion Contract

```yaml
completion_contract:
  outcome:
    - "All remaining non-Effect deep-module slices are complete or explicitly deferred with owner-approved reason."
    - "Each completed slice has boundary enforcement, focused validation, visual evidence, review-gate evidence, commit SHA, and PR handoff evidence."
    - "The live module-layout visual shows complete, current, next, remaining, enforced, not-enforced, agent-safe, and human-review areas."
    - "Related PRs are green, reviewed, comments resolved or classified, and merged or blocked with live evidence."
  verification_surface:
    - "docs/goals/coding-harness-deep-module-migration/receipts.jsonl"
    - "docs/goals/coding-harness-deep-module-migration/state.yaml"
    - ".harness/implementation-notes/2026-05-19-module-layout.html"
    - "artifacts/architecture/module-layout.html"
    - "focused tests named in each slice receipt"
    - "bash scripts/validate-codestyle.sh --fast"
    - "bash scripts/verify-work.sh --fast"
    - "pnpm check before final readiness or broad shared-surface changes"
    - "GitHub PR state, current head SHA, review threads, and mergeability"
    - "CircleCI status loaded with ~/.codex/.env when credentials are required"
  constraints:
    - "One active implementation slice at a time."
    - "Effect layers are out of scope."
    - "No unrelated refactor, broad rewrite, unapproved destructive cleanup, or force push."
    - "No completion claim from summaries without live evidence."
  boundaries:
    - "Declare allowed files before each slice."
    - "Declare focused tests before each slice."
    - "Keep edits inside the active slice unless validation proves a shared guard must change."
    - "Classify generated artifact churn before staging."
  iteration_policy:
    - "After each split or module move, run simplify, unslopify, improve-codebase-architecture, testing, and codex-review gates."
    - "Fix actionable findings or record deferrals before commit."
    - "Commit, push, and update GitHub before continuing to the next slice."
    - "Append a receipt after every slice."
  blocked_stop_condition:
    - "Stop if validation fails twice for the same reason."
    - "Stop if branch, PR, CI, or review-thread state cannot be observed."
    - "Stop if unrelated dirty worktree files are unclassified."
    - "Stop if required credentials are missing after probing ~/.codex/.env without printing values."
    - "Stop if a split would violate the module-boundary objective."
```

## Slice Queue

Initial queue from the taste review:

1. `drift-gate`
2. `replay`
3. `remediate`
4. `observability-gate`
5. `artifact-gate`
6. `plan-gate`
7. `prompt-gate`
8. `gap-case`
9. `simulate`
10. `ci-migrate`
11. `init`
12. `upgrade`
13. `brain`

Completed baseline slices to preserve:

- `verify-work`
- `memory-gate`

## Per-Slice Operating Loop

1. Read `goal.md`, `state.yaml`, and `receipts.jsonl`.
2. Confirm branch and worktree state with live git output.
3. Refresh PR state, head SHA, review threads, and CI status when a PR exists.
4. Declare the active slice, allowed files, expected tests, expected docs, and
   expected visual updates.
5. Implement the smallest real module-boundary move.
6. Add or update boundary tests, import guards, size ratchets, or fixtures when
   applicable.
7. Update `.harness/implementation-notes/2026-05-19-module-layout.html` and
   `artifacts/architecture/module-layout.html` using the module layout record
   contract when the module map changes.
8. Run the review gate contract.
9. Run focused validation and repo safety validation.
10. Commit with the required trailer, push, update GitHub, and append a receipt.

## Module Layout Record Contract

The module-layout HTML is both Jamie's live operating view and the durable
record for future agents. It must be informative as a control surface, not only
accurate as a diagram.

Every slice that changes a module boundary must update both:

- `.harness/implementation-notes/2026-05-19-module-layout.html`
- `artifacts/architecture/module-layout.html`

The layout must let Jamie answer these questions within 10 seconds:

- What is complete?
- What is current?
- What is next?
- What is remaining?
- What is blocked?
- Which boundaries are enforced by tests, size ratchets, import guards, or
  contract fixtures?
- Which boundaries are documented but not yet enforced?
- Which files are agent-safe edit zones?
- Which files need human taste review?
- What changed in the latest slice?
- Which PR, commit, validation commands, and receipts prove the current state?

Required visual structure:

1. A top status strip with current slice, next slice, branch, PR, head SHA,
   latest receipt id, and validation state.
2. A progress lane that separates complete, current, next, remaining, blocked,
   and Effect-later work.
3. A module map that labels public facades, internal modules, provider
   adapters, Effect-later surfaces, and human-review surfaces.
4. Enforcement badges for size ratchet, import guard, contract test, fixture
   coverage, direct production-path proof, and not-enforced.
5. A latest-change panel naming files changed, behavior preserved or changed,
   tests run, review gates run, and the commit SHA.
6. A record panel linking the matching `receipts.jsonl` entry and any PR/CI
   evidence.

If the HTML is technically updated but cannot answer those questions clearly,
record the visual update as `blocked_visual_quality` and repair the layout
before the slice is complete.

## Review Gate Contract

Every implementation slice must run or explicitly classify:

- `$simplify`: confirm the diff is the smallest clear shape.
- `$unslopify`: check dead exports, stale imports, orphaned helpers, and
  generated churn.
- `$improve-codebase-architecture`: verify the boundary improves agent
  navigation, local reasoning, testability, and ubiquitous language.
- `$testing`: prove the exact production path touched by the slice.
- `$codex-review`: review the diff for correctness, regressions, missing
  tests, and unsafe assumptions.

Accepted review outcomes:

- `pass`
- `pass_with_followups`
- `blocked`
- `skipped_with_reason`

## Background PR Green Sweep

Run exactly one background PR-green-sweep worker for the active PR or PR stack.
Do not create duplicates.

The worker owns:

- GitHub PR state, review threads, current head SHA, mergeability, and stacked
  PR relationships.
- CircleCI failure triage using `~/.codex/.env` when credentials are required,
  without printing secret values.
- CodeRabbit review state and actionable thread comments.
- `$autofix` for outstanding CodeRabbit and Codex review comments.
- Requesting `@coderabbitai review pr` for stacked PRs when a fresh review is
  required.
- Merge-conflict diagnosis with live GitHub state and repo GitHub helpers under
  `src/lib/github/` when implementation repair is needed.

The worker reports back to this board after every triage pass.

## Stop Conditions

- Board health is invalid or stale.
- Native goal state and board state conflict.
- Dirty worktree files are unclassified.
- Validation is red for an unexplained or unrelated reason.
- PR, CI, or review state cannot be observed.
- A review gate finds a correctness or boundary issue requiring scope expansion.
- Merge conflict resolution would touch unrelated user work.

## Final Completion Audit

Do not mark this goal complete until a final Judge or PM-style audit receipt
states `decision: complete` and proves:

- No remaining non-Effect slice is unclassified.
- Effect work is recorded as deferred, not hidden remaining work.
- All completed slices have receipts and validation evidence.
- The module-layout visual is current.
- All PR review threads are resolved or classified.
- CI is green or blocked with live evidence.
- The target branch is merged or blocked with live evidence.
- The local worktree is clean or intentionally classified.
