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

## Promotion Rule

If an automation fails twice for the same deterministic reason, distill the
failure into one of:

- a tighter stop condition
- a focused eval
- a Harness guardrail
- a Project Brain or LEARNINGS.md rule
- an explicit documented skip reason
