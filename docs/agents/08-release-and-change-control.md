# Release and change-control checks

## Table of Contents

- [Scope](#scope)
- [Required pre-release checklist](#required-pre-release-checklist)
- [Benchmark cadence requirements](#benchmark-cadence-requirements)
- [Change-control flow](#change-control-flow)
- [Rollback policy](#rollback-policy)
- [Post-change validation](#post-change-validation)
- [Release blockers](#release-blockers)

## Scope

Use this document before milestones, release-tagged branches, or behavior-changing policy edits.

## Required pre-release checklist

1. Run and pass `pnpm check` on current HEAD.
2. Confirm no open contradictions remain in operational docs.
3. Verify command contract still matches `package.json` and lockfile.
4. Ensure process docs (`docs/plans/*`, `FORJAMIE.md` where present) match the actual workflow used.
5. Confirm benchmark evidence is fresh per the benchmark cadence policy.

## Benchmark cadence requirements

- Canonical benchmark instructions: `docs/benchmarks/README.md`.
- Minimum cadence:
  - One SWE track run per week on `main`.
  - One fresh SWE track run before release tagging.
- Store each run record in JSON that validates against
  `docs/benchmarks/schema/benchmark-run.schema.json`.

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
- High-risk behavior changed without rollback notes,
- Benchmark cadence evidence is missing for the release window.
