---
last_validated: 2026-04-22
---

# Architecture bootstrap

## Table of Contents
- [Purpose](#purpose)
- [One-task-at-a-time intake](#one-task-at-a-time-intake)
- [Artifact validation gates](#artifact-validation-gates)
- [Refresh workflow](#refresh-workflow)
- [Deterministic Fingerprints](#deterministic-fingerprints)
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
harness docs-gate --mode advisory --json
```

If either command fails, refresh artifacts before proceeding.
When `docs-gate` reports required documentation surfaces for the same change category, update the listed operator guides in that PR before merge.

## Refresh workflow

Use this sequence when artifacts are missing or stale:

```bash
bash scripts/refresh-diagram-context.sh --dry-run
bash scripts/refresh-diagram-context.sh --force
jq -r '.generated_at, .diagram_count, .changed' AI/context/diagram-context.meta.json
```

The local `make hooks-pre-push` path also runs `scripts/check-diagram-freshness.sh`. That gate now skips refresh work unless architecture-sensitive implementation paths changed, and it ignores test-only source changes to keep the local loop tighter.

## Deterministic Fingerprints

`scripts/refresh-diagram-context.sh` normalizes node identities before sorting to keep generated artifacts stable:

- `rawNodeFingerprint(rawId)` extracts the trailing fingerprint suffix with `/_([0-9a-f]{8})$/i` (case-insensitive).
- If a suffix is present, the canonical key is the matched 8-hex fingerprint converted to lower case.
- If no suffix is present, normalization falls back to `rawId.toLowerCase()`.
- Deterministic ordering uses this canonical key, so output ordering can change when fingerprint suffixes or raw node IDs change.

## Stop conditions

Stop and ask for direction when any gate fails:
- `scripts/refresh-diagram-context.sh` exits non-zero.
- `AI/context/diagram-context.md` is missing after refresh.
- Diagram output does not include the command or module area touched by your change.
