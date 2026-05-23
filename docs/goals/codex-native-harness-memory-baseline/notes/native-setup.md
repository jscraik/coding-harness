# Native Setup Notes

## Table of Contents

- [Current State](#current-state)
- [Start Command](#start-command)
- [Activation Phrase](#activation-phrase)
- [First Continuation Behavior](#first-continuation-behavior)

## Current State

This goal package is prepared as a parked setup surface. It is safe to review and repair, but it must not start Worker implementation until Jamie explicitly activates it.

Native Codex goal status:

- thread id: `019e4a37-1ee4-7f10-b181-93a4bad6171f`
- status: `active`
- created: `2026-05-21T12:02:19Z`
- updated: `2026-05-21T15:41:44Z`

## Start Command

Use this prompt convention when restoring or manually starting the work:

```text
/goal Follow docs/goals/codex-native-harness-memory-baseline/goal.md
```

The native goal should read `goal.md`, `state.yaml`, and `receipts.jsonl` before acting.

## Activation Phrase

Worker implementation is blocked until Jamie says:

```text
KICK OFF CODEX-NATIVE HARNESS MEMORY BASELINE
```

Before that, allowed actions are board validation, native state reconciliation, setup repair, and explanation.

## First Continuation Behavior

The first continuation should:

1. Re-read the board and nearest project instructions.
2. Confirm whether the native goal status still matches `state.yaml`.
3. Check the dirty worktree and preserve the active JSC-331 lane.
4. Run the Goal Governor board check.
5. Propose the first Worker slice with explicit `allowed_files`, `verify`, and `stop_if`.
