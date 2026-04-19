---
last_validated: 2026-04-18
---

# Audit trail policy

## Required artifacts

Every non-trivial repo task should produce:

- task-level summary,
- command execution evidence,
- decisions made when instructions conflict,
- next-step and follow-up status.

## What to log in-closeout

- Files changed.
- Commands run and exact results.
- Validation status for required gates.
- Blockers/environmental constraints.
- Any rollback or follow-up action.

## Evidence integrity

Do not alter documented outcomes after checks are complete without rerunning the affected check and updating the evidence.

## Traceability

For process changes, link to:

- relevant docs in `docs/plans/*` and `todos/*`,
- issue/PR context if applicable,
- any decision records created in memory.

## Command blocker rule

If a command is missing (for example `pnpm`), note:

- when blocked,
- by what environment,
- what validation is deferred,
- and what is required to rerun.

## Long-term retention

Keep audit notes with enough detail to rerun: command(s), scope, and outcome summary.
