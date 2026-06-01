# JSC-363 Full Lifecycle Scope Note

schemaVersion: linear-scope-note/v1
issue: JSC-363
createdAt: 2026-06-01T08:55:15Z
producer: codex
sourceGoal: docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
sourcePlan: .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md
intent: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json
verdict: tracker_scope_note_attached_fields_stale

## Purpose

This note records the current scope relationship between Linear issue JSC-363
and the repo-owned Codex Runtime Evidence Verifier Cockpit goal.

The Linear issue title and body were created for a Phase 1 implementation lane.
The repo-owned goal and plan now govern the full lifecycle: PU-000 through
PU-016, the adopted 2026-05-26 evidence-led audit gaps, the adopted Codex
ecosystem operational review findings, and the adopted system-prompt gap matrix.

## Current Tracker Classification

JSC-363 remains the tracker anchor for planning and ownership, but this
attachment does not rewrite the issue title or description. Until the Linear
issue fields are updated, or an owner explicitly accepts attachment-only
mitigation as sufficient, tracker alignment must be reported as:

\`tracker_scope_note_attached_fields_stale\`

That status means:

- Linear contains an owner-visible scope note for the full lifecycle.
- The issue title and description still contain Phase 1 wording.
- Linear remains planning and ownership truth only.
- Linear does not prove implementation correctness, runtime evidence,
  delivery-truth support, CI state, review-thread state, PR mergeability,
  root hygiene, or Judge/PM readiness.

## What This Note Does Not Claim

- It does not close JSC-363.
- It does not claim SA-001 through SA-018 completion.
- It does not claim PR stack merge completion.
- It does not claim runtime producer emission.
- It does not claim delivery-truth consumption.
- It does not claim review-thread resolution for any future closeout window.
- It does not claim Judge/PM readiness.
- It does not make stale issue fields current.

## Evidence Policy

Any future closeout, Judge/PM audit, or tracker-alignment claim must refresh
JSC-363 live and report these lanes separately:

- issue title and description scope
- attachment or comment scope notes
- implementation evidence
- local validation evidence
- remote PR and CI checks
- review-thread state
- root hygiene
- delivery-truth verdicts
- merge readiness
- Judge/PM audit readiness

## Supersession Policy

This note supersedes earlier Linear scope notes only when a later receipt records
all of the following:

- the newer note digest
- the Linear attachment id or URL
- post-mutation Linear fetch evidence
- the issue-field status at the time of that fetch

If the issue title and description are later updated to match the full
lifecycle, the next receipt should replace this verdict with a stronger
tracker-alignment classification and cite the live Linear fetch evidence.
