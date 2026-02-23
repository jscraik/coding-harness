# Release and change-control checks

## Scope

Use this document before milestones, release-tagged branches, or behavior-changing policy edits.

## Required pre-release checklist

1. Run and pass `pnpm check` on current HEAD.
2. Confirm no open contradictions remain in operational docs.
3. Verify command contract still matches `package.json` and lockfile.
4. Ensure process docs (`docs/plans/*`, `FORJAMIE.md` where present) match the actual workflow used.

## Change-control flow

1. Record intent and impacted paths.
2. Apply minimal implementation.
3. Validate against required gates.
4. Update process artifacts if workflow changed.
5. Confirm rollback behavior (or document as not applicable).

## Rollback policy

- For reversible changes: revert specific commit and rerun validation.
- For irreversible operations: avoid one-step destructive edits and use staged changes first.
- For uncertain changes: pause, document impact, and request explicit approval.

## Post-change validation

- Confirm docs and plans still reference executable, current commands.
- Verify audit trail entries include command outcomes.

## Release blockers

Block release completion if:

- Required validation commands are missing/unrunnable in CI environment,
- Command authority conflicts remain unresolved,
- High-risk behavior changed without rollback notes.
