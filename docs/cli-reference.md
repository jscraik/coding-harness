---
schema_version: 1
doc_schema: coding-harness-doc/v1
doc_type: product
authority: canon
canon_class: canonical
distribution: source-only
audience: [human-operator, codex-agent, coding-harness-maintainer]
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-07-31
last_reviewed: 2026-07-31
review_cadence: command-change
maintenance_trigger: [harness-command-change]
semver_impact: minor
validated_by: [src/lib/cli/command-registry.test.ts]
depends_on: [README.md, docs/agents/quickstart.md]
---

# Coding Harness CLI reference

Coding Harness has five routine commands. Start with `next`; choose a different
command only when it directly answers the current question. Local command
output does not prove hosted CI, review, merge, release, or production state.

| Command | Purpose | Default effect |
| --- | --- | --- |
| `next` | Return one task-first next action and warnings. | Read-only |
| `init` | Preview or apply a deliberately selected scaffold. | Preview first; writes only when requested |
| `check` | Diagnose local repository health. | Read-only |
| `verify-work` | Run the repository's focused proof route. | Runs declared validation commands |
| `pr-closeout` | Report PR, CI, review, finding, and merge lanes separately. | Reads hosted state when available |

## First contact

```bash
harness next --json
```

The default response is compact: status, one useful action or command,
warnings, the material execution boundary, and its claims boundary. Optional
maintenance is a warning; it is never the primary action.

## Install preview

```bash
harness init --minimal --dry-run --json
```

Review the planned files before any write. `--minimal` is for a small,
opt-in starting point; it does not install CI, release, memory, telemetry, or
workflow machinery that the repository has not selected.

## Diagnose and verify

```bash
harness check --json
harness verify-work --fast
```

`check` diagnoses the local environment. `verify-work` uses the repository's
validation mapping. Both commands report only the checks they could actually
run; credential, service, or provider gaps remain explicit blockers.

## Pull-request truth

```bash
harness pr-closeout --pr <number> --json
```

Use this after a PR exists to keep local proof, hosted checks, review threads,
approval, mergeability, merge, and release as distinct lanes. It cannot create
an approval or make a PR mergeable.

## Source and package use

Use the installed `harness` binary in a consumer repository. For source-tree
changes in this repository, use:

```bash
node --import tsx src/cli.ts <command>
```

Build and test the package separately before making package or release claims.

## Expert and internal behaviour

The public routine stops at the five commands above. Internal compatibility and
expert operations are not a default workflow and require an explicit consumer
or task scope.
