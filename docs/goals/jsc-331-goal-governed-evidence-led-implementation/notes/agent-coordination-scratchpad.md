# Agent Coordination Scratchpad

Updated: 2026-05-21T12:59:36Z

## Current Goal

Goal board:

```text
docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md
```

Fresh native goal for this thread:

```text
019e4a4c-35cf-76a3-84a2-7ca9cbc64d63
```

Other thread or agent handle provided by Jamie:

```text
019e4a39-47f8-7ac0-b979-d52b7f02ec23
```

Native objective:

```text
Follow docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md for JSC-331. Continue board-governed Coding Harness evidence-led implementation from the 2026-05-20 audit. Start with board reconciliation and then S001 only: block summary_only phase-exit evidence from satisfying required evidence. Preserve existing replay-module work as a separate active slice; do not touch replay files unless the board is explicitly updated to that slice.
```

## Coordination Decision

Jamie decided:

1. Create a fresh native goal in this thread.
2. Treat existing replay-module edits as a separate active slice to preserve.

Direct agent messaging to `019e4a39-47f8-7ac0-b979-d52b7f02ec23` was attempted from this thread, but the runtime rejected it with `target agent is missing an agent_path`. This file is therefore the shared handoff/scratchpad for any other thread or agent working in the same checkout.

## Do Not Touch From S001

The following files appear to belong to the replay-module slice and must be preserved by S001 unless the board is explicitly updated to make replay the active slice:

```text
src/commands/replay-run-record.ts
src/commands/replay.test.ts
src/commands/replay.ts
src/lib/cli/registry/replay-command-spec.ts
src/commands/replay-output.ts
src/commands/replay-resolution.ts
src/commands/replay-types.ts
src/lib/replay/cli-args.ts
src/lib/replay/options.ts
```

Likely replay-adjacent shared files also need caution:

```text
.harness/implementation-notes/2026-05-19-module-layout.html
artifacts/architecture/module-layout.html
docs/architecture/module-boundaries.md
src/lib/architecture/module-boundaries.test.ts
```

## S001 Boundary

Proposed S001:

```text
S001-gap-004-summary-only-phase-exit-required-evidence
```

Objective:

```text
Block summary-only phase-exit evidence from satisfying required evidence before expanding issue-loop or PR closeout autonomy.
```

Allowed files for S001 should stay narrow:

```text
src/lib/runtime/runtime-evidence-bundle.ts
src/lib/runtime/runtime-evidence-producer.ts
src/lib/runtime/runtime-evidence-adapter.ts
src/lib/runtime/git-environment.ts
src/lib/runtime/**/*.test.ts
src/commands/runtime-card.test.ts
src/commands/next.test.ts
docs/goals/jsc-331-goal-governed-evidence-led-implementation/**
.harness/implementation-notes/2026-05-21-coding-harness-goal-governed-evidence-led-implementation-notes.html
```

## Current S001 Closeout State

Fresh closeout worktree: /private/tmp/coding-harness-jsc331-s001-closeout

Fresh closeout branch: codex/JSC-331-s001-phase-exit-evidence

Post-commit guardrail repair: the repo-approved shared Git config repair removed
the accidental `core.worktree` entry, and the runtime-card environment scrubber was
moved into `src/lib/runtime/git-environment.ts` so
`src/lib/runtime/local-runtime-card.ts` remains below its module-boundary line
budget. Push and draft PR creation remain gated on amended-commit validation.

Draft PR: https://github.com/jscraik/coding-harness/pull/271

Remote closeout state: PR #271 is open as a draft and mergeStateStatus is
BLOCKED. The PR template body was edited and validated again with
`pr-template-gate` after CircleCI flagged the unchecked cleanup item. The
remaining known remote blocker is `consistency-drift-health`, reproduced
locally as an existing `preflight-gate` cadence breach in
`harness.contract.json`; that cadence refresh is outside the S001 allowed-file
set and should be handled as a separate governance/health slice unless Jamie
explicitly authorizes mixing it into this PR.

## Message To Replay Agent

Your replay-module edits are being treated as a separate active slice to preserve. S001 must not rewrite, stage, or normalize your replay files. If you need to continue replay work, update this scratchpad with your active files, focused validation command, and current blocker before touching shared architecture/module-layout files.

## Message To S001 Agent

Start from the goal board and this scratchpad. Do not touch replay files. If a required runtime-evidence fix needs a shared file already modified by replay work, stop and record a conflict instead of editing through it.
