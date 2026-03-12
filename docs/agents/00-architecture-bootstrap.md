# Architecture bootstrap

## Table of Contents
- [Purpose](#purpose)
- [One-task-at-a-time intake](#one-task-at-a-time-intake)
- [Artifact validation gates](#artifact-validation-gates)
- [Refresh workflow](#refresh-workflow)
- [Stop conditions](#stop-conditions)

## Purpose

Use this guide first when a task changes architecture, policy flow, or cross-command behavior.

## One-task-at-a-time intake

1. Confirm architecture artifacts exist:
   - `AI/diagrams/manifest.json`
   - `AI/context/diagram-context.md`
2. Read `AI/diagrams/manifest.json` to identify generated diagram types and timestamp.
3. Read only the relevant sections in `AI/context/diagram-context.md` for the task.
4. Route to deeper SOPs in `docs/agents/` after architecture context is loaded.

## Artifact validation gates

Run these checks before architecture-sensitive edits:

```bash
jq -r '.generatedAt, (.diagrams | length)' AI/diagrams/manifest.json
rg -n '^## ' AI/context/diagram-context.md
```

If either command fails, refresh artifacts before proceeding.

## Refresh workflow

Use this sequence when artifacts are missing or stale:

```bash
bash scripts/refresh-diagram-context.sh --dry-run
bash scripts/refresh-diagram-context.sh --force
jq -r '.generated_at, .diagram_count, .changed' AI/context/diagram-context.meta.json
```

The local `make hooks-pre-push` path also runs `scripts/check-diagram-freshness.sh`. That gate now skips refresh work unless architecture-sensitive implementation paths changed, and it ignores test-only source changes to keep the local loop tighter.

## Stop conditions

Stop and ask for direction when any gate fails:
- `scripts/refresh-diagram-context.sh` exits non-zero.
- `AI/context/diagram-context.md` is missing after refresh.
- Diagram output does not include the command or module area touched by your change.
