---
name: coding-harness
description: "Use when a repository needs a small, evidence-bound Coding Harness routine: orient, diagnose, preview installation, verify local work, or distinguish pull-request truth."
skill_kind: advisory
owned_workflow: coding-harness-routine-jobs
validation_command: pnpm skill:validate
doc_schema: coding-harness-doc/v1
doc_type: skill
authority: canon
canon_class: canonical
distribution: packaged-skill
audience:
  - codex-agent
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-07-31
review_cadence: on-change
maintenance_trigger:
  - harness-command-change
  - downstream-install-change
semver_impact: minor
validated_by:
  - pnpm skill:validate
depends_on:
  - .agents/skills/coding-harness/references/setup-and-commands.md
---

# Coding Harness

Use Coding Harness to make one bounded delivery step legible. It provides local
orientation and proof; GitHub, CI, reviews, and merge are separate sources of
truth.

## Routine jobs

1. Orient with `harness next --json`.
2. Preview a small installation with `harness init --minimal --dry-run --json`.
3. Diagnose repository health with `harness check --json`.
4. Run repository-native proof with `harness verify-work --fast`.
5. Inspect a pull request without conflating local and hosted evidence with
   `harness pr-closeout --pr <number> --json`.

## Workflow

1. Ask the routine command that directly answers the present question.
2. Make only the bounded repository change it identifies.
3. Run the target repository's focused proof and report its exact boundary.

Run the smallest command that answers the current question. Preview writes
before applying them. Preserve unknown work, credentials, and provider state.

## Source checkout

For an unbuilt source change, run `node --import tsx src/cli.ts <command>`.
For the published package, use the installed `harness` binary. Do not infer
package, hosted, review, or merge truth from a source checkout.

## Validation

Use the target repository's documented focused proof first. Report results as:

```text
Command: <exact command> -> pass|fail|blocked (<reason>)
```

`pnpm skill:validate` checks that this skill and its reference keep the same
five-command routine. It does not prove an installation, external credentials,
CI, review, or merge state.

## Reference

- [Routine command reference](./references/setup-and-commands.md)

## Boundaries

This skill does not create credentials, bypass branch protection, change
provider configuration, delete user work, or turn a missing external check into
a pass. Commands outside the five routine jobs are internal or explicitly
scoped expert work, not default agent guidance.
