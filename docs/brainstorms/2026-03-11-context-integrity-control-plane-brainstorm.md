---
title: "Context Integrity Control Plane"
date: 2026-03-11
status: draft
spec_required: full
risk_level: medium
complexity: large
last_validated: 2026-04-18
---

# Context Integrity Control Plane

## Table of Contents

- [What We're Building](#what-were-building)
- [Why It Matters](#why-it-matters)
- [Problem Statement](#problem-statement)
- [Users Affected](#users-affected)
- [Options Considered](#options-considered)
- [Chosen Approach](#chosen-approach)
- [Key Decisions](#key-decisions)
- [Constraints / Non-Goals](#constraints--non-goals)
- [Success Criteria](#success-criteria)
- [Resolved Questions](#resolved-questions)
- [Open Questions](#open-questions)
- [Recommended Next Step](#recommended-next-step)

## What We're Building

A focused v1 context-integrity feature set for `coding-harness` that makes the repo's most authoritative guidance easier for agents to retrieve, harder for contradictory guidance to survive, and easier for maintainers to measure over time.

The feature should combine three capabilities into one coherent improvement lane:

- broaden the retrievable corpus beyond brainstorms and plans so agents can pull from canonical sources such as ADRs, specs, governance docs, root docs, and architecture context packs,
- detect context clashes across governed surfaces before they compound into inconsistent agent behavior,
- expose a small context-health scorecard so maintainers can tell whether the system is actually reducing drift rather than only storing more artifacts.

This is a control-plane reliability improvement for the code factory, not a general knowledge-management platform.

## Why It Matters

The current harness already has strong progressive-disclosure patterns:

- repo-local instruction routing through `AGENTS.md`, `CLAUDE.md`, and `docs/agents/*`,
- hybrid lexical and semantic retrieval,
- stale-doc detection,
- governance rollout metrics,
- local-memory discipline.

The gap is that these pieces do not yet fully reinforce each other:

- the most authoritative context is still not fully retrievable by the harness,
- contradiction handling is documented but not yet fully enforced in machine checks,
- context health is only partially measurable from the perspective that matters most: agent outcomes across repeated sessions.

Without closing those gaps, the code factory risks looking context-aware on paper while still letting agents miss canonical guidance, bounce between conflicting instructions, and re-discover decisions that should already be durable.

## Problem Statement

`coding-harness` already behaves like a control plane for agentic work, but its context architecture is uneven across retrieval, contradiction handling, and outcome telemetry.

Today:

1. authoritative context exists in multiple places, but only part of it is indexed for retrieval,
2. contradiction workflows exist in docs/specs, but not all of that policy is enforced in runtime checks,
3. some quality metrics exist, but they do not yet prove whether the agent loop is asking fewer repeated questions, finding the right context earlier, or staying more consistent across sessions.

The missing feature is a focused context-integrity lane that answers:

1. Which context sources are authoritative and retrievable for agent work?
2. When two governed sources disagree, how is that surfaced before it reaches users?
3. What metrics tell us whether the context system is compounding value instead of drifting?

## Users Affected

- `coding-harness` maintainers evolving command behavior, policy, rollout, and scaffolding,
- agents running inside this repo that need better access to canonical guidance,
- contributors and reviewers who need clearer consistency between implementation, governance docs, and retrieved context,
- downstream harness-managed repos that may eventually inherit the same context-integrity patterns.

## Options Considered

### Option 1: Retrieval-first expansion only

Short description:
Expand the indexing corpus and ranking model so `harness context` and `harness search` can retrieve canonical sources, but leave contradiction checks and context-health telemetry mostly unchanged for now.

Pros:

- smallest scope and lowest rollout risk,
- directly addresses the highest-value retrieval gap,
- builds on existing `index-context` and `search` primitives.

Cons:

- improves recall without proving retrieved context is internally consistent,
- does not close the documented contradiction-governance gap,
- leaves limited visibility into whether retrieval improvements actually improve agent outcomes.

Best fit:

- a narrow infrastructure milestone when the primary goal is immediate retrieval quality improvement.

### Option 2: Focused context-integrity control plane v1

Short description:
Ship a focused v1 that expands authoritative retrieval, adds machine-detected contradiction checks for governed surfaces, and introduces a small context-health scorecard tied to agent-facing outcomes.

Pros:

- directly addresses the three strongest gaps found in the review,
- keeps scope coherent without turning into a platform rewrite,
- matches the repo's existing design style: explicit policy, staged rollout, machine-readable artifacts, and advisory-to-required promotion paths,
- gives future memory and graph work a cleaner foundation.

Cons:

- touches multiple subsystems instead of a single command,
- requires careful definition of source-of-truth precedence and metric semantics,
- likely needs a spec because rollout behavior and failure posture matter.

Best fit:

- the recommended path when the goal is to make the code factory more reliable without attempting a full context-platform redesign.

### Option 3: Broad context-engineering platform

Short description:
Treat this as a larger subsystem investment that adds richer memory capture, graph-like relationships, broader note taxonomy, and more ambitious cross-session governance.

Pros:

- aligns most closely with the article's maximal vision,
- could eventually support richer retrieval and compounding context behavior,
- opens the door to stronger multi-repo context architecture.

Cons:

- too broad for the immediate reliability gap,
- risks mixing infrastructure, UX, ontology, and governance changes into one milestone,
- much higher coordination and false-positive risk,
- likely delays the most useful near-term wins.

Best fit:

- a later strategy track if the focused v1 proves valuable and the team wants to invest in a broader platform.

## Chosen Approach

### Recommendation

Choose **Option 2: Focused context-integrity control plane v1**.

### Why this is the right path

This is the smallest approach that closes the most meaningful gaps from the review:

- retrieval coverage becomes aligned with actual authority,
- contradiction policy becomes more than documentation,
- context health becomes something the harness can measure instead of infer.

It also preserves YAGNI:

- no large-scale knowledge graph migration,
- no giant document rename campaign,
- no attempt to solve every memory problem in one release,
- no need to invent a separate platform when the repo already has useful primitives.

### Proposed feature shape

The v1 feature should define one coherent "context integrity" lane with three parts:

1. **Authoritative retrieval expansion**
   - Include canonical repo surfaces in the indexed corpus:
     - `docs/adr/*`
     - `docs/specs/*`
     - `docs/agents/*`
     - `README.md`
     - `CONTRIBUTING.md`
     - `AI/context/diagram-context.md`
   - Add metadata that helps ranking prefer authoritative surfaces over lower-confidence notes when both match.

2. **Governed contradiction detection**
   - Detect contradictions across core instruction and governance surfaces:
     - `AGENTS.md`
     - `CLAUDE.md`
     - `README.md`
     - `CONTRIBUTING.md`
     - `package.json` script truth
     - required-check and governance policy surfaces
   - Record contradiction counts and machine-readable findings rather than leaving the lane documented-only.

3. **Context-health scorecard**
   - Track a small set of agent-facing outcome metrics such as:
     - retrieval coverage of authoritative sources,
     - repeated-question or repeated-lookup proxy rate,
     - stale-context hit rate,
     - decision-consistency proxy across governed runs,
     - unresolved contradiction count.
   - Keep this intentionally small in v1 so the metrics remain interpretable and operationally useful.

## Key Decisions

- Build a **focused v1**, not a broad context platform.
- Treat **authoritative retrieval**, **contradiction detection**, and **context-health telemetry** as one product lane because each is weaker without the others.
- Prefer **source-of-truth ranking** over trying to index every possible note equally.
- Keep **governed contradiction checks** scoped to high-value surfaces first instead of attempting universal prose-diff semantics.
- Use **existing harness patterns** where possible:
  - command-backed artifacts,
  - advisory-first rollout when needed,
  - machine-readable reports,
  - explicit policy docs,
  - downstream-safe promotion paths.
- Do not require a graph-first rewrite in v1; introduce better metadata and durable notes first, then reassess.

## Constraints / Non-Goals

### Constraints

- The feature must fit the repo's current control-plane style and not become a parallel governance system.
- It must be understandable to maintainers operating both locally and in CI.
- It must avoid high-noise contradiction checks that create policy fatigue.
- It should support future downstream adoption, even if this repo is the first rollout target.

### Non-goals

- Do not build a full company knowledge graph or universal wiki system in this milestone.
- Do not rename the documentation corpus into claim-style note titles wholesale.
- Do not attempt automatic meeting mining or transcript ingestion in v1.
- Do not overfit to one model provider or one agent runtime.
- Do not turn every documentation inconsistency into a hard block on day one.

## Success Criteria

- The harness can retrieve authoritative context from ADRs, specs, governance docs, root docs, and architecture context packs rather than only brainstorm/plan sources.
- Retrieval outputs include enough metadata for operators or downstream automation to distinguish authoritative sources from supporting notes.
- Contradiction findings are emitted for high-value governed surfaces and no longer report a placeholder zero-state for the whole lane.
- A context-health artifact exists with a stable, explainable metric set that can be tracked over repeated runs.
- Maintainers can tell whether retrieval quality and contradiction hygiene are improving without reading raw session logs.
- The repo has a clear rollout path for enabling stronger enforcement or broader adoption later.

## Resolved Questions

- **Scope choice:** optimize for a focused v1, not a broader context-engineering platform.
- **Feature shape:** keep retrieval, contradiction checks, and context-health telemetry in one lane rather than treating them as unrelated backlog items.
- **Ambition level:** strengthen existing control-plane primitives before considering graph-first architecture changes.

## Open Questions

- None that block a specification. The remaining decisions are design and rollout details, not product-direction ambiguity.

## Recommended Next Step

Proceed to **spec**, not directly to planning.

Reason:

- this feature spans retrieval, governance checks, artifact design, and metric semantics,
- failure posture and rollout shape matter as much as the happy path,
- the feature touches enough subsystems that a spec should lock the contract before implementation sequencing begins.
