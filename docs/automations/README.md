---
last_validated: 2026-06-04
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - coding-harness-maintainer
  - automation-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - automation-runbook-change
  - feedback-loop-change
  - recurring-workflow-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/lifecycle/issue-to-main.md
  - docs/guardrails/delivery-truth.md
  - .harness/README.md
---

# Automation Runbooks

Automation prompts should stay tiny. Durable automation behavior belongs in
repo-owned runbooks so the work can be reviewed, versioned, resumed, and
improved like any other Harness contract.

## Table of Contents

- [Purpose](#purpose)
- [Machine Identity](#machine-identity)
- [Source and Decision Rules](#source-and-decision-rules)
- [Runbook Contract](#runbook-contract)
- [Runbooks](#runbooks)
- [Codex App Prompt Shape](#codex-app-prompt-shape)
- [Review Rules](#review-rules)
- [Feedback Loop](#feedback-loop)
- [Closeout and Deletion](#closeout-and-deletion)
- [Promotion Rule](#promotion-rule)

## Purpose

Harness automations are long-running Codex operating loops. They should preserve
enough state that autocompaction, thread handoff, or a later wake-up can resume
without relying on private chat context.

Use this convention when an automation needs repeated execution, phase-by-phase
commits, external service checks, or safety stop conditions.

## Machine Identity

Every long-running automation needs a stable machine identity before it can be
trusted as lifecycle infrastructure.

Record these fields in the runbook or the automation definition:

- stable automation ID
- human-readable name
- owning repository or workspace
- owning issue, plan, PR, or Project Brain artifact
- expected wake-up cadence or trigger
- durable cursor path
- stop condition
- deletion or pause authority

Comments, status posts, and generated reports should include the stable
automation ID when they are intended to be machine-read later. Human-friendly
prose may change; the ID must not drift silently.

## Source and Decision Rules

Automation prompts are not source-of-truth documents. A runbook may instruct an
automation only when it names the durable source that decides the next action.

Use this precedence order:

1. Explicit user instruction in the current wake-up.
2. Active Linear, PR, spec, plan, or Project Brain artifact named by the
   runbook.
3. Current repository evidence such as git state, validation output, manifests,
   or generated lifecycle receipts.
4. Prior automation status only as supporting context.

If the active source is missing, stale, contradictory, or points to a merged or
closed lane, the automation must classify the blocker instead of inventing a
new next action.

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

## Runbooks

| Runbook | Use when |
| --- | --- |
| [CI green sweep](./ci-green-sweep.md) | A recurring workflow checks PR required checks, CI status, or merge-readiness support. |
| [CodeRabbit review sweep](./coderabbit-review-sweep.md) | A recurring workflow classifies CodeRabbit findings, review threads, or review-lane handoff. |
| [Linear sync](./linear-sync.md) | A recurring workflow aligns Linear state with PR, blocker, handoff, or merge evidence. |
| [Dependency and toolchain refresh](./dependency-and-toolchain-refresh.md) | A recurring workflow updates dependencies, package managers, Node/pnpm, toolchain, CI, or scaffold runtime contracts. |

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

## Feedback Loop

Automation findings feed the Lifecycle Harness learning loop. Do not leave
repeatable findings only in chat or transient comments.

Route feedback by failure class:

| Signal | Durable destination |
| --- | --- |
| Repeated workflow ambiguity | This runbook, a workflow SOP, or a glossary prompt translation |
| Repeated validation failure | A validator, fixture, or validation-lane update |
| Repeated review finding | A guardrail, Project Brain learning, or review-context fact |
| Repeated source confusion | A manifest dependency, docs lifecycle entry, or context-map update |
| Obsolete lane activity | Stop condition update and automation deletion or pause |

Each feedback-loop update should include the observed signal, the durable
destination, the validation command that proves the change, and any intentionally
deferred follow-up.

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
