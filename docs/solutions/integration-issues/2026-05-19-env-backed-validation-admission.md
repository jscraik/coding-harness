---
schema_version: 1
status: active
applies_to:
  - docs/solutions/integration-issues/**
---

# Env-Backed Validation Admission

## Table of Contents

- [Problem](#problem)
- [Current-Session Admission Record](#current-session-admission-record)
- [Durable Rule](#durable-rule)
- [Enforcement Surface](#enforcement-surface)
- [Validation Evidence](#validation-evidence)
- [Review Condition](#review-condition)

## Problem

The agent reported deep validation as blocked by missing GitHub and Linear
credentials even though the credentials were available in GitHub-side
configuration and in the approved private shell surface `~/.codex/.env`.
That forced Jamie to give repeated high-signal steering that the agent should
have inferred from the repository's zero customer integration ceremony and
validation contract.

## Current-Session Admission Record

- Feedback class: current-session steering admission record; Jamie said the
  agent is not permitted to proceed until the environment is refined so the
  same feedback is not needed twice.
- Inferred principle: a local validation blocker is not proven until the agent
  has checked known repo/user environment surfaces and rerun the exact command
  with those surfaces loaded when they are available.
- Searched surfaces: `AGENTS.md`, `docs/agents/04-validation.md`,
  `docs/agents/02-tooling-policy.md`, `UBIQUITOUS_LANGUAGE.md`,
  `.harness/memory/LEARNINGS.md`, and
  `scripts/check-steering-feedback-contract.cjs`.
- Durable destination: root agent instructions, validation guidance, glossary
  prompt translation, Project Brain learning, and the steering feedback guard.
- Executable guard: `pnpm run docs:steering:guard` must fail if the
  env-backed validation recovery rule disappears from the governed surfaces.
- Forbidden recurrence behavior: do not report `missing credential` or
  `unavailable credential` for local validation until `~/.codex/.env` has
  been checked for required variable names without printing values and the
  exact command has been rerun with that env loaded when values are present.
- FIFO or other file-type metadata is not missing-credential evidence by
  itself. If the approved env surface exposes the required variable names, the
  blocker must be classified from the env-loaded rerun outcome, not from the
  file type.
- In this repository, `~/.codex/.env` may be a FIFO or a regular readable file.
  FIFO metadata is normal and is not itself a blocker. For FIFO env surfaces,
  use `op run --env-file ~/.codex/.env -- <command>`. For regular file env
  surfaces, source the env file in a shell before running the command (e.g.,
  `set -a && source ~/.codex/.env && set +a && <command>`). Classify the
  validation lane from the env-loaded command's attempted rerun outcome.

## Durable Rule

Env-Backed Validation Recovery is required before blocking a local credentialed
validation lane. The agent must:

1. Inspect `~/.codex/.env` for required variable names without printing values.
2. If `~/.codex/.env` is a FIFO or named pipe, rerun the exact validation
   command with `op run --env-file ~/.codex/.env -- <command>`.
3. If `~/.codex/.env` is a regular readable file, rerun the exact validation
   command in a shell that loads the env file.
4. Report the final command status from the env-loaded rerun.
5. Classify the lane as blocked only when the env file is missing, unreadable,
   incomplete, or the env-loaded rerun still fails.
6. Do not classify FIFO metadata as proof that credentials are unavailable when
   the variable-name probe succeeds; source the env surface through the bounded
   canonical command shape and report the command's actual failure.
7. If `op run --env-file ~/.codex/.env -- <command>` hangs, times out, or still
   lacks required credentials, classify the lane from that attempted rerun
   outcome and include the exact command evidence.

Canonical command shape:

```bash
op run --env-file ~/.codex/.env -- <command>
```

Example:

```bash
op run --env-file ~/.codex/.env -- pnpm test:deep
```

Closeout blocker claims must include the `op run --env-file ~/.codex/.env --`
attempt and its result. A statement such as `~/.codex/.env is a FIFO, so
credential-backed validation is blocked` is stale and invalid without that
attempted rerun evidence.

Non-hanging timeout probe for legacy source-style recovery only:

```bash
stat -f "%N type=%HT size=%z" ~/.codex/.env
perl -e 'alarm shift; exec @ARGV' 10 awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/ {print $1}' ~/.codex/.env
```

If either bounded command times out, the expected operator-visible outcome is
`blocked_env_fifo_timeout`; the next owner should provide a non-blocking env
source or rerun the same command in a shell where the FIFO has a writer.

## Enforcement Surface

Standalone prose is not enough. The durable enforcement path is:

- `AGENTS.md`: always-loaded operator rule.
- `docs/agents/04-validation.md`: validation recovery playbook.
- `UBIQUITOUS_LANGUAGE.md`: canonical term and prompt translation.
- `.harness/memory/LEARNINGS.md`: repo-scoped Project Brain learning.
- `scripts/check-steering-feedback-contract.cjs`: executable guard.

## Validation Evidence

Focused validation command:

```bash
pnpm run docs:steering:guard
```

The expected passing condition is that the steering guard confirms the
env-backed validation recovery rule remains present across the governed
instruction, validation, glossary, memory, and admission surfaces.

## Review Condition

This admission can be retired only when credentialed local validation commands
perform equivalent env discovery automatically or the repository replaces
`~/.codex/.env` with another approved private credential-discovery surface.
Until then, agents must prove the env-backed rerun before using a missing
credential blocker in closeout.
