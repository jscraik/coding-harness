# Goal Boards

## Table of Contents

- [Layout](#layout)
- [Native Goal Boundary](#native-goal-boundary)

Goal boards provide durable coordination for long-running Codex work.

## Layout

Use `docs/goals/<goal-slug>/` with:

- `goal.md` for objective, scope, completion contract, and boundaries.
- `state.yaml` for current task and native-goal reconciliation state.
- `receipts.jsonl` for append-only RuntimeAction evidence.

Receipts should name the task id, actor, action type, changed files, validation, blocker class when blocked, and next action.

## Native Goal Boundary

Native `/goal` state is useful live runtime context, but this directory is the durable repo-owned coordination surface.
Keep native state reconciled into `state.yaml` and preserve source evidence in append-only receipts.
