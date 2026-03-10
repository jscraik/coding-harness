---
title: "Gold-Standard Control Plane Hardening"
date: 2026-03-10
status: draft
spec_required: full
risk_level: high
complexity: large
---

# Gold-Standard Control Plane Hardening

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

A hardening program for `coding-harness` that makes the current control-plane layer gold-standard before adding the next provider-neutral orchestration layer.

The goal is to turn the current repo from "strong governance plus partial runtime composition" into a durable control plane that:

- emits canonical, machine-legible run truth across all important commands,
- enforces governance and instruction parity across `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and future equivalent instruction files,
- supports multiple coding agents through a shared adapter model rather than Codex-specific assumptions,
- measures agent effectiveness and safety with explicit evaluation signals,
- remains practical for a solo developer running Codex, Claude Code/Kimmy, Kimi Coding, Gemini-family tooling, and related agent clients across many projects.

This brainstorm is about the current layer only. It does not propose a new orchestration engine as the first move.

## Why It Matters

The repo already has several strong patterns:

- contract-backed governance,
- preflight policy gating,
- SHA-bound review freshness,
- evidence-backed verification,
- rollback-aware pilot controls,
- canonical run/eval work already underway.

But the current substrate still has unevenness that will matter more as additional agent providers are added:

- runtime truth is still fragmented across command-specific artifacts,
- parts of the enforcement model remain explicitly Codex-shaped,
- drift detection is useful but still narrow,
- adapter abstractions exist, but are not yet a complete provider-neutral operating layer.

If more providers are added before these are hardened, the repo risks becoming a collection of partial integrations rather than one reliable system.

## Problem Statement

`coding-harness` already governs repository behavior well, but it is not yet a gold-standard, provider-neutral control plane.

The key gap is not "missing more features." The key gap is that the current layer does not yet fully guarantee one canonical answer to:

1. What happened in an agent run?
2. Which policy and instruction surfaces governed it?
3. Which provider and actor produced it?
4. Whether the result is safe, promotable, and evidence-complete?
5. Whether instruction and governance parity stayed intact across all supported agent clients?

Until those questions are answered consistently, adding more orchestration or provider-specific capability increases surface area faster than trust.

## Users Affected

- Jamie as the primary solo maintainer and operator,
- downstream projects that install `coding-harness`,
- Codex-driven workflows,
- Claude Code / Kimmy / Claude-Kimi / Claude-Zai style workflows,
- Gemini-family and Kimi Coding style workflows where repo-local instructions must remain aligned,
- future adapters and review/eval consumers that depend on stable runtime truth.

## Options Considered

### Option 1: Add the next provider and orchestration layer now

Short description:
Prioritize new provider support, workflow integrations, and richer multi-agent behavior before hardening the current layer.

Pros:

- fast visible feature growth,
- easier to demonstrate breadth of ecosystem support,
- may accelerate experimentation.

Cons:

- compounds current substrate ambiguity,
- makes parity drift harder to reason about,
- increases adapter and runtime truth complexity before the control plane is stable,
- likely creates rework once canonical provider-neutral behavior is enforced.

Best fit:

- not recommended for this repo at the current stage.

### Option 2: Harden the current control-plane layer to gold-standard first

Short description:
Finish the current layer by standardizing runtime truth, instruction parity, adapter neutrality, and evaluation signals before adding the next provider/orchestration layer.

Pros:

- creates a durable foundation for every future provider,
- aligns with the repo's existing canonical run/eval direction,
- reduces future rework,
- improves solo-dev trust and debuggability,
- makes every later capability measurable instead of anecdotal.

Cons:

- less flashy than adding new integrations immediately,
- requires focused discipline on substrate work,
- may delay some short-term provider-specific experiments.

Best fit:

- recommended path for this repo.

### Option 3: Split the effort into "minimum hardening" plus immediate provider expansion

Short description:
Do only a narrow hardening pass, then immediately add the next provider layer in parallel.

Pros:

- can preserve momentum,
- may surface real adapter needs sooner.

Cons:

- encourages premature convergence on partial abstractions,
- likely weakens the discipline of finishing the current layer,
- increases the chance that "temporary" provider-specific logic becomes permanent.

Best fit:

- only as a fallback if time pressure outweighs substrate quality.

## Chosen Approach

### Recommendation

Choose **Option 2: harden the current control-plane layer to gold-standard first**, then use that hardened layer as the base for the next provider-neutral expansion.

### Why this is the right path

This path best matches both the repo evidence and the intended operating model:

- the canonical run/eval work is already the right architectural direction,
- the current strongest patterns are governance and safety oriented, not provider breadth,
- the repo is intended to enforce strictness across multiple agent clients,
- a solo developer benefits more from determinism and auditability than from early orchestration complexity.

### Proposed hardening scope

The hardening layer should focus on five areas:

1. **Canonical runtime truth**
   - every autonomy-relevant command emits a canonical manifest and event stream,
   - outcome semantics are normalized across success, hold, rollback, failure, cancellation, and policy denial,
   - promotion and evaluation consume canonical records first.

2. **Provider-neutral adapter model**
   - move from Codex-shaped assumptions to explicit agent/provider adapters,
   - normalize Codex, Claude-family, Gemini-family, Kimi-style, and future clients into one run contract,
   - treat provider-specific artifacts as inputs to a canonical layer, not as governance truth.

3. **Instruction parity across agent clients**
   - treat `AGENTS.md` as canonical repo truth,
   - validate linked parity across `CLAUDE.md`, `GEMINI.md`, and equivalent client-facing instruction files,
   - use `agents-md` style progressive disclosure as the maintenance pattern,
   - detect contradictions rather than assuming files stay aligned manually.

4. **Governance drift expansion**
   - broaden drift detection from command surface parity into full governance parity,
   - cover contract, workflows, branch protection expectations, instruction files, generated template outputs, and key docs,
   - keep deterministic, machine-readable reporting.

5. **Evaluation and scorecards**
   - add explicit metrics for intervention rate, stale review rate, rollback rate, evidence completeness, parity coverage, and unresolved adapter drift,
   - use external eval patterns where helpful, but keep stack-specific evaluation logic grounded in repo truth.

### Role of `evals-skills`

The `hamelsmu/evals-skills` repository is useful here as a supporting reference for evaluation hygiene, especially:

- audit-first evaluation thinking,
- structured error analysis,
- judge/evaluator quality checks,
- calibration discipline.

It should influence the evaluation layer of `coding-harness`, not replace the repo's own contracts or become the primary architecture. In other words:

- good as a pattern source,
- not the source of truth for harness runtime design,
- best applied after the canonical run/eval substrate is fully legible enough to evaluate.

## Key Decisions

- Harden the current control-plane layer before adding the next provider/orchestration layer.
- Keep the next milestone centered on substrate quality, not breadth.
- Treat canonical run/eval truth as the primary hardening axis.
- Replace Codex-only assumptions in core enforcement with provider-neutral agent metadata.
- Treat instruction parity across `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and peers as a first-class governance concern.
- Expand drift detection into governance parity, not just command/README parity.
- Use evaluation patterns from `evals-skills` as supporting heuristics, not core runtime authority.
- Keep worktree-heavy orchestration and deeper multi-agent patterns as a later layer, not the current milestone.

## Constraints / Non-Goals

### Constraints

- The hardened layer must remain practical for a solo maintainer.
- The system must stay deterministic enough for CI, replay, and promotion gating.
- The solution must support multiple agent clients without requiring one provider's runtime to be the authority.
- Existing safety constraints should be preserved, not weakened.

### Non-goals

- Do not build a new orchestration engine in this phase.
- Do not optimize first for multi-agent sophistication.
- Do not couple mergeability to proof that one specific agent or plugin was used.
- Do not turn external eval skills into a hard dependency for the core harness.
- Do not add provider breadth before the canonical control-plane layer is trustworthy.

## Success Criteria

- Canonical run/eval artifacts are the default truth for autonomy-relevant commands.
- Adapter registry evolves from a legacy bridge into an explicit provider-neutral adapter surface.
- Core enforcement no longer assumes only Codex-specific branch or closeout semantics.
- Governance drift checks cover instruction parity, contract/workflow parity, and generated scaffolding parity.
- The repo can measure parity coverage and unresolved adapter drift with machine-readable outputs.
- A future provider integration can be added by implementing an adapter against a stable control-plane contract, not by creating bespoke governance logic.
- The hardened layer is clear enough that the next phase can safely move to spec and then plan without reopening the architecture question.

## Resolved Questions

- Should the current layer be hardened before adding more capability?
  - Yes.
- Should cross-agent instruction parity be treated as part of the current layer?
  - Yes.
- Should `evals-skills` influence the roadmap?
  - Yes, as evaluation guidance rather than core architecture.
- Is the next step another brainstorm?
  - No, the next step should be a spec.

## Open Questions

- Which exact provider adapter names and artifact contracts should be supported in v1 of the provider-neutral layer?
- Should instruction parity treat `AGENTS.md` as canonical with downstream mirrors, or allow multiple canonical instruction sources with reconciliation rules?
- Which hardening checks should become required CI gates immediately versus staged advisory-first rollout?

These questions are important, but they do not block moving to a formal spec. They belong in the next artifact.

## Recommended Next Step

Proceed to a **full spec** for the hardening layer.

That spec should define:

- the provider-neutral canonical run model,
- adapter contract boundaries,
- instruction-parity truth model,
- expanded drift-gate scope,
- evaluation metrics and rollout gates,
- explicit non-goals for the current phase.

Recommended route:

- `/prompts:workflow-spec`

Suggested spec title:

- `Provider-Neutral Gold-Standard Control Plane Hardening`
