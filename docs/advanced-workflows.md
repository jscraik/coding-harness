---
last_validated: 2026-04-18
---

# Advanced Workflows

## Table of Contents
- [Migrate CI with rollback and proof](#migrate-ci-with-rollback-and-proof)
- [Validate a Symphony workflow contract](#validate-a-symphony-workflow-contract)
- [Evaluate a pilot before expanding autonomy](#evaluate-a-pilot-before-expanding-autonomy)

## Migrate CI with rollback and proof

```bash
harness ci-migrate prepare --provider circleci --dry-run
harness ci-migrate prepare --provider circleci --apply
harness ci-migrate verify --snapshot <snapshot-id>
harness ci-migrate commit --snapshot <snapshot-id>
```

Use `abort` or `--rollback` if parity or external control-plane checks fail.
For cutover follow-through, the same command family also supports:

```bash
harness ci-migrate sync-branch-protection
harness ci-migrate promote-mode
```

## Validate a Symphony workflow contract

Coding Harness can scaffold a `WORKFLOW.md`, generate compact workflow specs,
and validate readiness for Symphony-style execution.

```bash
harness workflow:generate --source docs/specs/my-flow.md --output WORKFLOW.md
harness symphony-check
pnpm workflow:validate
```

To keep Linear metadata and findings aligned from the same CLI surface:

```bash
harness linear prepare --issue JSC-123
harness linear sync --findings findings.json --team JSC
```

This is one of the more understated parts of the project today: it is not only
scaffolding repo files, it also includes machinery for defining, checking, and
operating workflow contracts.

## Evaluate a pilot before expanding autonomy

```bash
harness pilot-evaluate --artifacts artifacts/pilot --lane health --output artifacts/pilot/result.json
harness pilot-rollback --mode manual
```

This part of the CLI is designed for artifact-backed rollout decisions, not
just dashboard reporting.
