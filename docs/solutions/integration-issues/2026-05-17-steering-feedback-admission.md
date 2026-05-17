# Steering Feedback Admission

## Table of Contents

- [Problem](#problem)
- [Durable Rule](#durable-rule)
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

Line-level design feedback requires a pattern scope inventory before closeout. The agent must name the inferred design principle, list the sibling implementations searched, state which siblings changed, state which siblings were intentionally left unchanged with reasons, and record deferred follow-ups. Otherwise the harness has only optimized the example line, not the class of misbehavior the feedback exposed.

For high-level workflow skills, the proof loop must define a capture-the-flag style win condition and retain the session or trace evidence that proves the agent closed the loop. A skill workout is complete only when Codex has attempted the workflow, reflected on failures, committed targeted skill or harness improvements, and rerun against the flag or named a concrete blocker.

For PR and automation work, green checks are validation evidence, not closeout
completion. A lane is complete only after PR state, merge or auto-merge state,
branch/worktree state, Linear state, next-lane routing, and continuation or
heartbeat state are classified. If the PR is open but blocked on merge,
approval, review, or waiting owner, the lane is waiting; deleting the heartbeat
without that classification repeats the failure this solution records.

Standalone prose is not enough. If the loop produces only advice, record the missing enforcement destination as a follow-up instead of treating the rule as admitted.

Minimum repeat-feedback admission evidence:

- feedback repeated
- principle inferred
- related surfaces searched
- durable destination or tracked exception
- executable guard or required evidence field
- focused validation command
- pattern scope inventory when the correction implies a broader code pattern

## Enforcement Surface

- AGENTS.md defines agent engineering proof as the compact operating rule for steering feedback, line-level corrections, OODA horizons, reflected context, and benchmark-vs-engineering proof.
- docs/agents/04-validation.md defines the agent engineering proof loop and its closeout evidence.
- UBIQUITOUS_LANGUAGE.md defines Steering Feedback, Workflow Skill, Capture-The-Flag Eval, Skill Workout, Win Condition, Pattern-Generalization Pass, Pattern Scope Inventory, OODA Horizon, Horizontal Horizon, Vertical Horizon, Reflected Context, Unobserved Horizon, Code Production, and Software Engineering Proof as canonical terms.
- .github/PULL_REQUEST_TEMPLATE.md requires pattern scope inventory evidence when steering feedback, review comments, or line-level corrections imply a broader principle.
- .github/PULL_REQUEST_TEMPLATE.md requires explicit closeout state so PR
  evidence cannot collapse green checks into workflow completion.

## Review Condition

Review this rule when steering feedback becomes noisy or ceremonial. Delete or narrow it if a typed gate or command contract fully replaces the documentation path.

## Evidence

This solution was created after repeated feedback that the harness must prevent the same correction from being given twice, that coding-harness gates belong to coding-harness rather than HE, and that reliable workflow skills need explicit win conditions with iterative self-reflection rather than instruction prose alone.
