---
last_validated: 2026-05-03
automation_id: jsc-249-phased-friction-evidence-work
linear_issue: JSC-249
target_plan: docs/plans/2026-05-02-feat-session-friction-evidence-contracts-plan.md
---

# JSC-249 Phased Friction Evidence Work

## Table of Contents

- [Purpose](#purpose)
- [Source Of Truth](#source-of-truth)
- [Current Cursor](#current-cursor)
- [Wake-Up Procedure](#wake-up-procedure)
- [Phase Order](#phase-order)
- [Phase Exit Gate](#phase-exit-gate)
- [Review And Security Gate](#review-and-security-gate)
- [Commit And PR Gate](#commit-and-pr-gate)
- [Safety Gates](#safety-gates)
- [Stop Conditions](#stop-conditions)
- [Wake-Up Report](#wake-up-report)

## Purpose

Continue the JSC-249 Session Friction Evidence Contracts plan through the
approved Harness Engineering work cycle. Keep the Codex app automation prompt
small; this runbook is the durable workflow contract.

## Source Of Truth

- Repository: current checkout root
- Plan:
  `docs/plans/2026-05-02-feat-session-friction-evidence-contracts-plan.md`
- Linear issue: `JSC-249`
- Branch: discover from `git status --short --branch`
- PR: discover from branch metadata or GitHub before PR handoff

Do not rely on private chat history as the resume source. Re-read live repo,
plan, branch, PR, and validation state on every wake-up.

## Current Cursor

Use the plan `Resume Cursor` and live git state to select the next incomplete
phase.

Known safe cursor as of 2026-05-03:

- P1 and the smallest useful P2-lite slice were implemented, validated,
  committed, and pushed on `codex/north-star-artifact-surfaces`.
- Continue with P3 unless live state proves P1/P2-lite needs repair.
- Keep P3 under `src/lib/session/**`.
- Do not create a competing `src/lib/evidence/**` closeout abstraction.
- Preserve unrelated dirty eval, e2e, contract, and documentation files unless
  the user explicitly adopts them into this issue.

## Wake-Up Procedure

1. Read live state first:
   `git status --short --branch`, the target plan, `AGENTS.md`, `CODESTYLE.md`,
   relevant codestyle modules, package scripts, and current validation evidence.
2. Classify dirty files before editing. Preserve unrelated user or eval-suite
   changes.
3. Use the Harness Engineering work cycle in plan-led mode for the first
   incomplete phase.
4. Make the smallest implementation slice that satisfies the active phase.
5. Run focused validation from the plan before broad gates.
6. Stop at deterministic blockers and report exact evidence.

## Phase Order

1. P1 plus P2-lite: friction/delay taxonomy and permission/execution metadata
   only for existing `harness next` recommendations.
2. P3: session closeout contract under `src/lib/session/**`.
3. Stop after P3 and KPI evidence capture unless the user explicitly promotes
   deferred tracks D1-D7.

## Phase Exit Gate

Before leaving a phase, complete all of these:

- focused implementation validation from the plan
- smallest meaningful repo gate for the touched behavior
- exact pass, fail, or blocked outcome recorded in the handoff
- no unrelated dirty files staged or committed
- blocker classified if validation, permissions, credentials, or unrelated
  dirty state prevent completion

## Review And Security Gate

At the end of each phase, run these in order over the phase diff:

1. Simplify pass: run the smallest repo simplification and formatting checks
   that cover the changed files. Use `pnpm lint`, `pnpm typecheck`, and the
   plan's focused test command for implementation files; use
   `pnpm exec markdownlint-cli2 <changed-docs>` for docs-only phases.
2. Harness Engineering code review: run the agent-native evidence commands that
   apply to the phase diff, starting with
   `harness review-context --source .harness/learnings/coderabbit.local.json --files <changed-files> --json`
   and `harness ci-ownership-gate --json` when CI, required-check, or ownership
   surfaces changed.
3. Codex Security scan: run the repo security surface through the Codex Security
   review workflow and capture its finding summary. For local CLI evidence, run
   `pnpm audit` and, after push, confirm external security checks with
   `gh pr checks --json name,state,link --jq '.[] | select(.name=="security-scan" or .name=="semgrep-cloud-platform/scan")'`.

Apply only behavior-preserving simplifications and verified fixes. Re-run the
smallest validation that proves the final phase diff.

## Commit And PR Gate

Once the phase is green:

- Commit only the completed phase files.
- Use an atomic Conventional Commit message.
- Include exact validation evidence that actually ran.
- End the commit message with exactly one final trailer:
  `Co-authored-by: Codex <noreply@openai.com>`.
- Push the branch.
- Create or update the GitHub PR with the repository GitHub workflow.
- Follow the repository PR template exactly.
- Do not auto-merge.

## Safety Gates

- Do not auto-merge, force-push, delete branches, close review threads, or
  mutate Linear state beyond safe progress comments without explicit approval.
- Do not run destructive cleanup without explicit approval.
- Do not implement PR providers, run indexing, capability digest, routed
  instruction discovery, new command families, command deletion, or deferred
  D1-D7 tracks without explicit user promotion.
- If the same deterministic permission, credential, network, or environment
  blocker repeats twice, stop.
- If unrelated dirty files block validation, staging, committing, or pushing,
  preserve them and report exact evidence instead of reverting.

## Stop Conditions

- P1/P2-lite and P3 are implemented, reviewed, security-checked, validated,
  committed, pushed, and represented in a GitHub PR.
- A deterministic blocker repeats twice.
- The plan, branch, PR, or JSC-249 scope drifts enough that continuing would
  exceed approved scope.
- The user asks to pause or stop.

## Wake-Up Report

Return a concise update with:

- live state checked
- selected phase
- actions taken
- validation outcome
- simplify, code-review, and security outcome
- commit and PR state
- blocker, if any
- next expected phase
