---
title: "Docs Gate for Governance Parity"
date: 2026-03-10
status: draft
spec_required: full
risk_level: medium
complexity: medium
last_validated: 2026-04-18
---

# Docs Gate for Governance Parity

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

A dedicated `docs-gate` feature for coding-harness that checks whether required documentation surfaces stay aligned when code, config, workflow, or governance files change.

The feature should:

- map changed implementation surfaces to required documentation surfaces,
- verify those documentation surfaces are updated and internally aligned,
- run as a required CI gate before merge,
- optionally run in local git hooks before push,
- recommend `docs-expert` and `agents-md` as authoring routes without making skill provenance part of merge policy.

This is a governance and reliability improvement, not a general documentation rewrite initiative.

## Why It Matters

The repo already has real documentation drift risk:

- `docs:lint` validates Markdown shape, but not whether the right docs changed.
- `drift-gate` currently checks a narrow parity slice, especially CLI vs README command index.
- governance truth is spread across contract, workflows, generated templates, README, CONTRIBUTING, and AGENTS guidance.
- recent repo state already showed a live mismatch where workflow/contract required `linear-gate` while `AGENTS.md` still listed the older required CI set.

That means a change can be technically correct and still leave the repo in a split-brain state for contributors, reviewers, or downstream adopters.

## Problem Statement

Coding-harness can currently prove that documentation is well-formed, but it cannot reliably prove that documentation is complete or correctly updated for a given behavior or governance change.

The missing capability is a gate that answers:

1. What documentation surfaces are required for this kind of change?
2. Did those surfaces change when they should have?
3. Do those surfaces agree with the current implementation and governance policy?

Without that gate, documentation correctness remains mostly convention-driven, which is too weak for a repo that acts as a control plane and scaffolding source for other projects.

## Users Affected

- coding-harness maintainers updating contract, workflow, or scaffolding behavior,
- contributors changing CLI, governance checks, or docs,
- reviewers who need confidence that policy/docs stayed aligned,
- downstream repos that install harness templates and expect docs to match enforced behavior.

## Options Considered

### Option 1: Extend drift-gate only, keep docs enforcement advisory

Short description:
Expand the existing `drift-gate` rules to cover more documentation surfaces, but keep results advisory-only.

Pros:

- smallest change to the current architecture,
- builds directly on the existing consistency-gate workflow,
- lower rollout risk and lower false-positive blast radius.

Cons:

- does not satisfy the goal of enforcing documentation updates before merge,
- keeps docs correctness in a "health signal" lane instead of a required lane,
- easy for contributors to ignore if advisory findings are noisy.

Best fit:

- a short-lived intermediate step if the team wants to measure rule quality before blocking merges.

### Option 2: Add a dedicated docs-gate command and required CI check

Short description:
Create a separate `docs-gate` command that maps changed files to required documentation surfaces and fails when required docs are missing, stale, or contradictory.

Pros:

- matches the user goal directly,
- keeps policy explicit instead of burying doc enforcement inside a generic drift tool,
- gives `init`, branch protection, and CI a clean required-check identity,
- supports local pre-push usage without conflating docs health with broader consistency reporting.

Cons:

- introduces a new policy surface that must be designed carefully to avoid false positives,
- requires a clear source-of-truth model for each documentation surface,
- needs rollout design so downstream repos are not surprised by sudden merge blockers.

Best fit:

- the recommended path when the goal is enforceable documentation parity, not just observability.

### Option 3: Enforce documentation skill provenance

Short description:
Require that doc-relevant changes be produced through `docs-expert` and `agents-md`, or fail policy if those skills were not used.

Pros:

- encourages consistent authoring workflows,
- nudges contributors toward the right playbooks.

Cons:

- validates process provenance instead of repository truth,
- brittle and easy to game,
- penalizes correct outcomes produced by other valid workflows,
- couples mergeability to agent runtime behavior rather than repo artifacts.

Best fit:

- not recommended for this repo.

## Chosen Approach

### Recommendation

Choose **Option 2: a dedicated `docs-gate` command and required CI check**, while reusing parts of the existing `drift-gate` logic where it is already strong.

### Why this is the right path

This gives the repo an explicit answer to the real governance problem: not "are docs formatted?" and not "did an agent use the right skill?", but "did the required docs change and do they agree with the implementation?"

It also fits the repo's existing design style:

- explicit commands with stable check names,
- contract-backed policy surfaces,
- generated scaffolding through `init`,
- CI enforcement plus optional local hooks,
- advisory-first patterns where useful, but clear promotion to required checks when confidence is high.

### Proposed feature shape

`docs-gate` should:

- accept changed files as input,
- classify them into doc-impact categories,
- resolve required documentation surfaces for each category,
- validate required-surface presence and targeted parity rules,
- emit machine-readable results plus a short human-readable summary,
- support both CI and local execution.

Example doc-impact categories:

- CLI/command surface changes -> `README.md`, `src/cli.ts` help surface, command docs as applicable.
- Contract/policy changes -> `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, relevant `docs/agents/*`.
- Workflow/required-check changes -> `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `init` template outputs.
- AGENTS/instruction routing changes -> `AGENTS.md`, linked `docs/agents/*`, and any referenced instruction-map docs.

## Key Decisions

- Enforce **artifact correctness**, not **skill provenance**.
- Keep `docs-expert` and `agents-md` as recommended skills for producing the changes.
- Introduce a dedicated `docs-gate` required check instead of overloading `drift-gate`.
- Reuse existing drift/parity utilities where possible rather than creating a second unrelated rules engine.
- Start with governance-critical surfaces first:
  - `README.md`
  - `CONTRIBUTING.md`
  - `AGENTS.md`
  - key `docs/agents/*` governance docs
  - scaffold/template surfaces emitted by `init`
- Prefer a source-of-truth model for each surface so the gate can distinguish:
  - missing required updates,
  - contradictory updates,
  - out-of-scope docs that should not block a PR.

## Constraints / Non-Goals

### Constraints

- The gate must be deterministic and low-noise enough to become a required CI check.
- It must work for both this repo and downstream repos initialized by harness.
- It must not require online services or agent runtime provenance to validate results.
- It should align with existing contract/init/workflow patterns instead of inventing a parallel governance system.

### Non-goals

- Do not require that a contributor literally invoke `docs-expert` or `agents-md`.
- Do not turn all documentation drift into a hard block on day one.
- Do not attempt repo-wide semantic doc correctness for every Markdown file in v1.
- Do not bundle broad documentation rewrites into this feature.
- Do not replace `drift-gate`; `docs-gate` should complement it.

## Success Criteria

- A new `docs-gate` command exists with a stable CLI and machine-readable output.
- The command maps code/config/workflow/governance changes to explicit required documentation surfaces.
- Governance-critical docs are covered in v1:
  - `README.md`
  - `CONTRIBUTING.md`
  - `AGENTS.md`
  - selected `docs/agents/*` docs
- CI includes a required `docs-gate` check for pull requests and merge queue where applicable.
- `init` scaffolding can generate the required `docs-gate` wiring for downstream repos.
- Optional local pre-push integration exists, but merge enforcement remains CI-authoritative.
- The repo can detect and fail on missing doc updates for policy/workflow/command-surface changes.
- The repo does not require proof that a particular skill was used to produce those docs.

## Resolved Questions

- The desired enforcement target is repository truth, not agent-skill provenance.
- Governance-critical documentation should be in scope from the first version.
- `docs-gate` should be its own command/check, not just a naming change for `drift-gate`.
- Local hooks are optional support; CI is the authoritative blocker.

## Open Questions

- None that block a specification. The remaining uncertainty is rollout tuning, not product direction.

## Recommended Next Step

Proceed to **spec**, not directly to planning.

Reason:

- this feature spans command design, contract policy, init scaffolding, CI, local hooks, and rule semantics,
- false-positive behavior and source-of-truth ownership need to be explicit,
- rollout posture likely needs phases such as advisory shadow mode, limited blocking scope, then broader enforcement.

Recommended classification:

- `spec_required: full`
- `risk_level: medium`
- `complexity: medium`

The spec should define:

- the `docs-gate` contract and output schema,
- the mapping model from changed files to required doc surfaces,
- source-of-truth ownership for each governed surface,
- fail/open behavior and rollout phases,
- CI and `init` integration expectations,
- validation fixtures for missing-doc, stale-doc, and contradiction cases.
