---
title: JSC-311 Runtime Card Blocking Proof
date: 2026-05-16
module: src/commands
problem_type: runtime-evidence
evidence:
  - src/commands/runtime-card.ts
  - src/commands/next-runtime-card.ts
  - src/lib/runtime/
  - README.md
  - docs/cli-reference.md
  - /private/tmp/coding-harness-runtime-card-JSC-311-status.json
project_brain_sync: .harness/memory/LEARNINGS.md
tags: [jsc-311, runtime-card, harness-next, linear, github, phase-exit]
---

# JSC-311 Runtime Card Blocking Proof

## Command Summary

BLUF: This artifact records the runtime-card learning for JSC-311 so future agents treat live PR, Linear, git, and active-artifact evidence as the blocking cockpit input before claiming readiness. The proof matters because local specs, plans, and chat summaries can be directionally correct while the current PR is still blocked, which would make the operator believe the harness is safer than it is. The next action is to keep `runtime-card/v1` and `harness next --runtime-card` in the decision path, resolve PR #250 CI blockers, then admit session-collector evidence as a later typed source instead of relying on manual recap.

Decision Needed: Keep runtime-card evidence as a blocking input to `harness next`
for JSC-311 closeout and future cockpit work.

Top Risks: PR and CI state can drift after local validation; session-collector
evidence still exists outside the runtime-card source model; stale `.harness`
status notes can make completed historical work look active.

Next Action: Fix the current PR blockers, rerun focused validation, then decide
whether the session-collector adapter is the next JSC-311 follow-up slice.

## Problem

The JSC-311 thread had enough local implementation and validation evidence to
sound close to complete, but live runtime state still blocked continuation.
Spec, plan, and chat context alone could answer the north-star question, but
they could not safely decide whether the branch was ready to close.

The concrete failure mode was visible after generating a live runtime card:

- `runtime-card/v1` read git state, `.harness/active-artifacts.md`, GitHub PR
  state, and Linear state for `JSC-311`;
- GitHub reported PR #250 as open and `mergeStateStatus: BLOCKED`;
- Linear reported `JSC-311` as `In Progress`;
- `harness next --runtime-card` correctly returned `status: blocked` with
  `failureClass: runtime_card_blocked`.

## Evidence

- Command:
  `set -a; source ~/.codex/.env; set +a; pnpm exec tsx src/cli.ts runtime-card --json --live --issue JSC-311 --out /private/tmp/coding-harness-runtime-card-JSC-311-status.json`
  -> pass.
- Runtime-card output:
  - `schemaVersion: runtime-card/v1`
  - `issueKey: JSC-311`
  - `lifecycle: blocked`
  - `pullRequest.number: 250`
  - `pullRequest.mergeStateStatus: BLOCKED`
  - `linear.status: In Progress`
  - blocker: `GitHub PR merge state is BLOCKED; resolve PR blockers before continuing.`
- Command:
  `set -a; source ~/.codex/.env; set +a; pnpm exec tsx src/cli.ts next --json --runtime-card /private/tmp/coding-harness-runtime-card-JSC-311-status.json`
  -> pass with intentional blocked decision.
- `gh pr checks 250 --repo jscraik/coding-harness` showed CircleCI failures
  for `check`, `lint`, `pr-template`, and `test`, while CodeRabbit and several
  security/dependency checks passed.

## Root Cause

The harness previously had strong local artifacts but not enough runtime
admission control. A plan/spec/eval stack can prove the intended slice and a
local validation run can prove code behavior, but neither proves current PR
mergeability, current Linear state, or current operator-safe continuation.

This creates a recurring agent failure: answer from remembered implementation
progress, then discover later that PR, CI, Linear, or artifact visibility still
blocks real delivery.

## Fix Or Durable Guidance

For cockpit and closeout work, make a live runtime card before claiming that the
work is ready, done, or safe to continue.

Use this decision order:

1. Generate `runtime-card/v1` from git state, active `.harness` artifacts, and
   live providers when credentials are available.
2. Feed that card into `harness next --runtime-card`.
3. Treat `blocked`, `fail`, `not_run`, stale provider state, or missing required
   sources as a stop condition.
4. Report the live blocker instead of converting local validation success into a
   closeout claim.
5. Keep session-collector evidence as a future typed adapter until it is part of
   the runtime-card source model.

## Validation

- Command:
  `set -a; source ~/.codex/.env; set +a; pnpm exec tsx src/cli.ts runtime-card --json --live --issue JSC-311 --out /private/tmp/coding-harness-runtime-card-JSC-311-status.json`
  -> pass.
- Command:
  `set -a; source ~/.codex/.env; set +a; pnpm exec tsx src/cli.ts next --json --runtime-card /private/tmp/coding-harness-runtime-card-JSC-311-status.json`
  -> pass; returned `status: blocked` as expected.
- Command: `gh pr checks 250 --repo jscraik/coding-harness` -> pass for
  inspection; found failing CircleCI checks that justify the runtime-card
  blocker.

## Prevention

- Do not answer JSC closeout or readiness questions from `.harness` artifacts
  alone when a live PR exists.
- Do not treat `pnpm check`, `pnpm test:deep`, or eval pass as merge-readiness
  proof when PR checks are red.
- Keep `runtime-card/v1` as the bridge between local artifact truth and live
  provider truth.
- Admit session-collector evidence only through a typed adapter with freshness,
  redaction, and provenance rules.
- When `.harness/active-artifacts.md` and `.harness/linear/*` disagree, refresh
  the artifact index before selecting new work.

## Project Brain / Routing

The distilled repo learning was appended to `.harness/memory/LEARNINGS.md`.
This solution artifact remains the detailed causal record. It is discoverable
under `.harness/solutions/**` and should be referenced before future JSC-311
runtime-card, phase-exit, session-collector, or PR-readiness work.

## Related Artifacts

- `.harness/active-artifacts.md`
- `.harness/linear/coding-harness-linear-plan.md`
- `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md`
- `.harness/plan/2026-05-13-JSC-311-he-phase-exit-evidence-gates-plan.md`
- `src/commands/runtime-card.ts`
- `src/commands/next-runtime-card.ts`
- `src/lib/runtime/`
