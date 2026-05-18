# Steering Feedback Admission

## Table of Contents

- [Problem](#problem)
- [Durable Rule](#durable-rule)
- [Current-Session Admission](#current-session-admission)
- [Stale Heartbeat Admission](#stale-heartbeat-admission)
- [Enforcement Surface](#enforcement-surface)
- [Review Condition](#review-condition)
- [Evidence](#evidence)

## Problem

Repeated high-signal user steering was staying in the active chat instead of being converted into the harness operating system. That made the user repeat the same corrections about terminology, gate ownership, skill freshness, workflow proof, and meta-level behavior.

The expected outcome is broader than better local behavior: Coding Harness must
become a portable agent operating system that makes Codex behave like a software
engineer, not merely a code generator, across greenfield and brownfield projects
with zero customer integration ceremony.

## Durable Rule

Repeated steering is a stop-the-line environment defect. Ordinary feature work must not continue until the correction is admitted into the repo operating system or rejected with a tracked reason.

When a correction, PR comment, failing check, benchmark-style success, workflow-skill miss, or line-level edit request points beyond one local patch, use the agent engineering proof loop:

1. Observe the concrete signal and recover relevant context, including reflected context when the signal crosses compaction, harness, repo, machine, or environment boundaries.
2. Orient by translating the signal into its design principle and searching sibling implementations, tests, docs, skills, PRs, issues, automations, and stacked trajectories.
3. Decide whether the scope is local, pattern-wide, stack-aware, organization-aware, reflected-context-backed, or `Unobserved Horizon`.
4. Act through the narrowest durable destination: executable gate, schema, scaffold, documented validation rule, Project Brain decision, Linear follow-up, or explicit exception.
5. Close out with the principle, searched scope, destination, validation surface, maintainability impact, traceability, handoff evidence, and review or deletion condition.

This is the distinction between code production and software engineering proof. A patch can pass a constrained task while still failing the engineering loop.

Line-level design feedback requires a pattern scope inventory before closeout. The agent must name the inferred design principle, list the sibling implementations searched, state which siblings changed, state which siblings were intentionally left unchanged with reasons, and record deferred follow-ups. Otherwise the harness has only optimized the example line, not the class of misbehavior the feedback exposed. This is the general rule: a concrete example is evidence of the user's design model, not proof that the correction is local. For example, "return a named sentinel error instead of a success/failure boolean" must trigger an API-pattern search for sibling boolean result contracts before closeout.

The trigger set is intentionally semantic, not phrase-bound. Example-based
feedback, named-function feedback, review comments, single-line corrections,
and language such as "generally", "same pattern", "similar class", or
"across everything" all require a pattern-generalization pass unless the
inventory proves the correction is intentionally local.

For high-level workflow skills, the proof loop must define a capture-the-flag-style win condition and retain the session or trace evidence that proves the agent closed the loop. A skill workout is complete only when Codex has attempted the workflow, reflected on failures, committed targeted skill or harness improvements, and rerun against the flag or named a concrete blocker.

For PR and automation work, green checks are validation evidence, not closeout
completion. A lane is complete only after PR state, merge or auto-merge state,
branch/worktree state, Linear state, next-lane routing, and continuation or
heartbeat state are classified. If the PR is open but blocked on merge,
approval, review, or waiting owner, the lane is waiting; deleting the heartbeat
without that classification repeats the failure this solution records.

For repeated troubleshooting failures, do not fight errors. When the same
command, test, or runtime error happens twice, stop local retries, research
trusted web or upstream sources, list 3-5 candidate fixes, choose the most
efficient repo-fit fix, implement it, and record the repeated-error research
evidence in PR closeout.

Standalone prose is not enough. If the loop produces only advice, record the missing enforcement destination as a follow-up instead of treating the rule as admitted.

Minimum repeat-feedback admission evidence:

- feedback repeated
- principle inferred
- related surfaces searched
- durable destination or tracked exception
- executable guard or required evidence field
- meta-behavior proof field naming the durable repo/system change
- pattern scope inventory field when a correction reveals a broader design principle
- repeated-error research field when the same error happened twice
- focused validation command
- pattern scope inventory when the correction implies a broader code pattern

## Current-Session Admission

If Jamie says the agent is not permitted to proceed, the next action is a
current-session steering admission record. The record must make the active
correction load-bearing before the agent resumes feature work:

- feedback class and the exact repeated behavior it describes
- inferred operating principle
- repo, docs, skill, gate, memory, and tracker surfaces searched
- durable destination chosen, or tracked exception with owner and reason
- executable guard, required evidence field, template field, or validation
  command that prevents silent recurrence
- behavior now forbidden for the agent in this repo
- validation command and outcome

The record can live in Project Brain, .harness/memory/LEARNINGS.md, a solution
record, a gate, a schema, a PR template field, or a tracked Linear follow-up.
It is not enough to say the agent will remember.

## Stale Heartbeat Admission

The PR #261 closeout heartbeat exposed a second-order failure in the agent
engineering proof loop. The PR lane was complete, but the continuation
automation kept firing and the agent repeatedly returned quiet status instead
of repairing the scheduling surface. That wasted tokens and forced Jamie to
steer the same systems point again.

Findings:

| Finding | Root cause | Durable change |
|---|---|---|
| Quiet heartbeat replies repeated after the stop condition was true | The closeout loop treated `DONT_NOTIFY` as an acceptable terminal response even when the automation itself was obsolete | Automation runbooks now require deletion or update of stale continuations when the lane is done or superseded |
| App automation deletion failed with `No handler registered for tool: automation_update` | The tool path was unavailable from the active session, so the intended cleanup control did not execute | The runbook now defines a fallback to the repo-owned automation file after exact-ID discovery |
| The stale automation lived outside the active repo at `dev/configs/codex/automations/continue-pr-260-closeout` | The active coding-harness lane depended on a control-plane file in the configs repo | Closeout evidence must classify automation state explicitly and name the cleanup surface when it is outside the working tree |
| Repeated checking risked increasing open process pressure | The session already had repeated unified-exec warnings, so more live PR polling was lower value than deleting the stale trigger | Stale-heartbeat cleanup should use bounded exact-ID searches and one focused mutation, not repeated PR revalidation |

Operating rule: once a heartbeat's stop condition is satisfied, the next agent
action is automation cleanup, not another quiet status. If the primary
automation API is blocked, classify the API failure and use the narrowest
repo-owned fallback that removes only the matching automation record.

Closeout proof for this incident:

- PR lane: PR #261 had already merged, with CodeRabbit and required CircleCI
  checks previously verified green.
- Stale automation ID: `continue-pr-260-closeout`.
- Primary cleanup failure: app automation delete returned `No handler
  registered for tool: automation_update`.
- Fallback cleanup: removed
  `/Users/jamiecraik/dev/configs/codex/automations/continue-pr-260-closeout/automation.toml`
  and then removed the empty automation directory with `rmdir`.
- Verification: exact-ID search for `continue-pr-260-closeout` across
  `/Users/jamiecraik/dev/configs/codex` and `/Users/jamiecraik/.codex`
  returned no matches.

## Enforcement Surface

- AGENTS.md defines agent engineering proof as the compact operating rule for steering feedback, line-level corrections, OODA horizons, reflected context, and benchmark-vs-engineering proof.
- docs/agents/04-validation.md defines the agent engineering proof loop and its closeout evidence.
- docs/automations/README.md defines the heartbeat closeout and deletion contract, including the exact-ID fallback when the app automation API is unavailable.
- UBIQUITOUS_LANGUAGE.md defines Steering Feedback, Workflow Skill, Capture-The-Flag Eval, Skill Workout, Win Condition, Pattern-Generalization Pass, Pattern Scope Inventory, OODA Horizon, Horizontal Horizon, Vertical Horizon, Reflected Context, Unobserved Horizon, Code Production, and Software Engineering Proof as canonical terms.
- .harness/memory/LEARNINGS.md records current-session steering admission when a run exposes an operating failure that must not recur.
- The GitHub pull request template requires pattern scope inventory evidence when steering feedback, review comments, or line-level corrections imply a broader principle.
- pr-template-gate rejects line-level or design-pattern correction admissions that lack a pattern scope inventory with the inferred principle, sibling search, siblings changed, and siblings intentionally unchanged or deferred with reasons.
- The GitHub pull request template requires meta-behavior proof when repeated steering or high-signal correction is admitted, so the PR names the durable repo/system change instead of leaving the learning in chat.
- The GitHub pull request template requires repeated-error research when the same error happens twice, so the PR names web/upstream research, 3-5 candidate fixes, the chosen efficient fix, and what was implemented.
- The GitHub pull request template requires explicit closeout state so PR
  evidence cannot collapse green checks into workflow completion.
- `pr-template-gate` rejects PR bodies that mention repeated steering or steering feedback but leave `Meta-behavior proof` or `Learning / reinforcement` as `none`, `n.a.`, or another non-durable answer.
- `pr-template-gate` rejects PR bodies that mention the same error twice or repeated failure but leave `Repeated-error research` without research options and a chosen implemented fix.

## Review Condition

Review this rule when steering feedback becomes noisy or ceremonial. Delete or narrow it if a typed gate or command contract fully replaces the documentation path.

## Evidence

This solution was created after repeated feedback that the harness must prevent the same correction from being given twice, that coding-harness gates belong to coding-harness rather than HE, and that reliable workflow skills need explicit win conditions with iterative self-reflection rather than instruction prose alone.
