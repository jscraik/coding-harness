---
last_validated: 2026-05-03
---

# Automation Runbooks

Automation prompts should stay tiny. Durable automation behavior belongs in
repo-owned runbooks so the work can be reviewed, versioned, resumed, and
improved like any other Harness contract.

## Table of Contents

- [Purpose](#purpose)
- [Runbook Contract](#runbook-contract)
- [Codex App Prompt Shape](#codex-app-prompt-shape)
- [Review Rules](#review-rules)
- [Closeout and Deletion](#closeout-and-deletion)
- [Promotion Rule](#promotion-rule)

## Purpose

Harness automations are long-running Codex operating loops. They should preserve
enough state that autocompaction, thread handoff, or a later wake-up can resume
without relying on private chat context.

Use this convention when an automation needs repeated execution, phase-by-phase
commits, external service checks, or safety stop conditions.

## Runbook Contract

Each automation runbook should define:

- name and stable automation ID
- purpose and target repository or plan
- cadence or trigger
- current progress cursor and source of truth
- next-step rule
- validation evidence required before advancing
- stop conditions
- safety and approval gates
- reporting format

The progress cursor should point to durable state such as a plan checklist,
Linear comment, run artifact, PR, or closeout file. Chat history is supporting
context, not the source of truth.

## Codex App Prompt Shape

Codex app automation prompts should usually be two sentences:

```text
You are the <automation-name> agent.
Follow the reviewed runbook at docs/automations/<automation-name>.md.
```

If the automation needs a specific workspace, thread, or issue ID, keep that
metadata in the app schedule and the runbook. Do not duplicate a full workflow
inside the app prompt.

## Review Rules

- Treat runbooks as code-reviewed workflow contracts.
- Keep destructive actions, network requirements, and human-approval gates
  explicit.
- Prefer plain repo commands and Harness evidence refs over bespoke automation
  grammars.
- Record exact validation outcomes and blockers at each wake-up.
- Preserve unrelated dirty files and commit only the phase under execution.

## Closeout and Deletion

Heartbeat and continuation automations must stop once their stop condition is
true. A merged or closed PR, resolved blocker handoff, or superseded lane is not
a reason to keep emitting quiet status messages.

Before closeout, classify the live lane state:

- PR or issue state: open, waiting, merged, closed, superseded, or missing
- required checks and review-thread state when the lane is PR-backed
- branch and worktree state
- tracker or roadmap state when the lane has one
- next-lane routing, deferred owner, or explicit no-next-lane reason
- automation state: keep active, update prompt, pause, or delete

If the lane is done or obsolete, delete or disable the automation in the same
turn. If the app automation API is unavailable, non-returning, or reports a
missing handler, fall back to the repo-owned automation file only after
identifying the exact automation ID and path. Remove only the matching
`automation.toml`, remove the now-empty directory with `rmdir`, and verify with
an exact-ID search. Do not keep answering stale heartbeats after the stop
condition is already true.

## Promotion Rule

If an automation fails twice for the same deterministic reason, distill the
failure into one of:

- a tighter stop condition
- a focused eval
- a Harness guardrail
- a Project Brain or LEARNINGS.md rule
- an explicit documented skip reason
