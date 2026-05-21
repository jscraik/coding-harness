# Setup Notes

- Created: 2026-05-21
- Status: ready for owner kickoff, no Worker implementation started.
- Native goal runtime: a paused native goal exists in this thread from an
  earlier accidental kickoff. The board records that runtime fact and requires
  reconciliation before Worker work.
- Linear tracker: JSC-331.
- Kickoff prompt convention:

```text
/goal Follow docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md
```

This is a prompt convention. Codex must read `goal.md`, `state.yaml`, and
`receipts.jsonl` first.
