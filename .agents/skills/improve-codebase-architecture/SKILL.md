---
name: improve-codebase-architecture
description: Use inside coding-harness when the user wants to find architecture deepening opportunities, reduce shallow/pass-through modules, improve testability, or make the Codex-first harness easier for agents to navigate while staying aligned with docs/roadmap/north-star.md.
---

# Improve Codebase Architecture

Project-local architecture review skill for `coding-harness`.

Use this skill to find deepening opportunities: refactors that move repeated
coordination, policy glue, fragile tests, or scattered behavior behind clearer
interfaces. The goal is not architectural neatness for its own sake. The goal is
lower PR lead time by reducing the review/rework loop while preserving
deterministic evidence, current-head SHA discipline, bounded autonomy, and
rollback safety.

## Table of Contents

- [Source Material](#source-material)
- [Vocabulary](#vocabulary)
- [Workflow](#workflow)
- [Candidate Output](#candidate-output)
- [Deepening Loop](#deepening-loop)
- [Constraints](#constraints)
- [References](#references)

## Source Material

This is a local adaptation of Matt Pocock's `improve-codebase-architecture`
skill at commit `60aa99c0230fbac087514ba5fca2ae6e519965fe`, narrowed for this
repo's Codex-first harness contract.

## Vocabulary

Use the architecture vocabulary in
[`references/language.md`](./references/language.md). In particular:

- Say **module**, not component, service, or unit.
- Say **interface**, not API, when describing everything a caller must know.
- Say **seam**, not boundary, when describing where behavior can vary.
- Evaluate **depth** as leverage at the interface, not lines of code hidden.
- Explain benefits through **leverage** for callers and **locality** for
  maintainers.

Use project vocabulary from:

- [`docs/roadmap/north-star.md`](../../../docs/roadmap/north-star.md)
- [`docs/roadmap/agent-first-status.md`](../../../docs/roadmap/agent-first-status.md)
- `CONTEXT.md` or `CONTEXT-MAP.md` if either exists later
- existing ADRs in `docs/adr/` only as legacy/read-only decision context
- Linear issues as the canonical durable tracker for new architecture decisions,
  rejected refactors, policy gaps, and follow-up work across Jamie's projects

## Workflow

1. **Read the contract first**
   - Read `docs/roadmap/north-star.md`.
   - Read `docs/roadmap/agent-first-status.md`.
   - Read `docs/agents/13-linear-production-workflow.md` before proposing any
     durable follow-up record.
   - Read existing ADRs in `docs/adr/` only when a candidate could conflict
     with an older recorded decision.
   - If `CONTEXT.md` or `CONTEXT-MAP.md` exists, read the relevant context.
   - If those context files do not exist, proceed silently; do not propose
     creating them before there is a concrete naming decision.

2. **Explore from throughput pressure**
   - Start with surfaces that shape the review/rework loop: CLI commands,
     gates, validation scripts, init scaffolding, contract policy, agent-facing
     docs, PR/review automation, and tests.
   - Trace how a user or agent gets from a repeated failure to a durable
     guardrail.
   - Prefer executable evidence: run or inspect the smallest relevant path when
     feasible before calling a module shallow, duplicated, or hard to test.

3. **Look for shallow modules**
   - Apply the deletion test: if deleting the module removes complexity, it was
     pass-through; if complexity reappears across callers, it was earning its
     keep.
   - Flag places where understanding one harness behavior requires bouncing
     through many small modules with no single interface that explains the
     workflow.
   - Flag seams with only one adapter unless the second adapter is clearly
     justified by tests, rollback, or runtime variation.
   - Flag policy surface that adds concepts without removing manual glue work.

4. **Classify dependencies**
   - Use [`references/deepening.md`](./references/deepening.md) to classify
     dependencies as in-process, local-substitutable, remote-owned, or external.
   - Let the dependency category decide whether the deepened module needs no
     adapter, an internal test seam, a production/test port pair, or a mockable
     external adapter.

5. **Return candidates, not implementation**
   - Present a ranked list of deepening opportunities.
   - Do not propose final interfaces yet.
   - Ask which candidate the user wants to explore.

## Candidate Output

For each candidate, include:

- **Files**: exact files and line references where possible.
- **Problem**: why the current module shape increases review/rework cost,
  agent navigation cost, or repeated manual glue.
- **Solution**: the plain-English deepening move.
- **North-star link**: how this reduces PR lead time, review retries, manual
  intervention, or merge-readiness block time.
- **Testing effect**: what tests become stronger, simpler, or removable because
  the interface becomes the test surface.
- **Risk**: migration risk, rollback path, and any existing decision conflict.
- **Tracking**: whether this needs a new or updated Linear issue, and why.

Order candidates by expected throughput impact, not by aesthetic preference.

## Deepening Loop

When the user picks a candidate:

1. Grill the design before editing: constraints, callers, invariants, error
   modes, rollback path, and what behavior belongs behind the seam.
2. If the candidate needs alternative interface shapes, use
   [`references/interface-design.md`](./references/interface-design.md).
3. If a new project term becomes load-bearing, update `CONTEXT.md` lazily using
   [`references/context-and-decisions.md`](./references/context-and-decisions.md).
4. If the user rejects a candidate for a durable architectural reason, offer to
   create or update a Linear issue so future agents do not re-suggest the same
   refactor without the missing context.
5. Do not offer to create an ADR unless the user explicitly asks for an ADR or
   a repo-specific instruction says ADRs are still authoritative.

## Constraints

- Keep the north star load-bearing: architecture work must reduce review/rework
  cost or strengthen the path to lower PR lead time.
- Do not optimize for governance surface area, taxonomy, or policy expansion
  unless it removes repeated manual glue.
- Preserve current-head SHA discipline, deterministic evidence, and rollback
  safety.
- Do not collapse independent review into self-approval.
- Do not use architecture vocabulary as decoration; use it to make trade-offs
  sharper.

## References

- [`references/language.md`](./references/language.md)
- [`references/deepening.md`](./references/deepening.md)
- [`references/interface-design.md`](./references/interface-design.md)
- [`references/context-and-decisions.md`](./references/context-and-decisions.md)
