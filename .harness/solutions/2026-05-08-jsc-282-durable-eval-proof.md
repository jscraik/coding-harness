---
schema_version: 1
title: JSC-282 Durable Eval Proof
date: 2026-05-08
status: solved
domain: governance
owner: agent-ops
freshness_review: 2026-06-08
project_brain_status: updated
project_brain_evidence:
  source: ".harness/solutions/2026-05-08-jsc-282-durable-eval-proof.md"
  target: ".harness/knowledge/governance/knowledge.md"
  reason: "Eval proof durability changed the repository closeout contract."
---

# JSC-282 Durable Eval Proof

## Table Of Contents

- [Problem](#problem)
- [Resolution](#resolution)
- [Evidence](#evidence)
- [Reusable Rule](#reusable-rule)
- [Maintenance](#maintenance)
- [Project Brain Sync](#project-brain-sync)

## Problem

JSC-282 had source-command behavior proof, but the closure eval initially lived
under `.harness/evals/`, which was ignored by `.gitignore`. That made the proof
valid locally but non-durable for future agents and Linear closure review.

## Resolution

Eval reports are now tracked as governed harness markdown artifacts:

- `.gitignore` allows `.harness/evals/` and `.harness/evals/**.md`.
- `.harness/evals/coding-harness-jsc-282-command-truth-eval.md` is tracked.
- `.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md`
  is marked `status: complete`.
- The eval report validates against the canonical `he-eval-report` validator.

## Evidence

- Plan:
  `.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md`
- Review:
  `.harness/review/2026-05-08-JSC-282-command-truth-cockpit-technical-review.md`
- Eval:
  `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`
- Commits:
  `d08a6c59 docs(skill): clarify authz validation target`,
  `04893c5a docs(harness): persist JSC-282 eval proof`
- Validation:
  `he-eval-report` validator passed, `docs:lint` passed, strict source
  `plan-gate` passed, and `bash scripts/validate-codestyle.sh --fast` passed.

## Reusable Rule

An eval artifact is not closure proof until it is both validator-clean and
durable. For harness-managed proof, future agents must verify:

1. The eval file passes its validator.
2. The eval file is tracked by git or explicitly attached to Linear.
3. The active plan status matches the eval recommendation.
4. Out-of-scope package, install, credential, or downstream proof is not claimed.

## Maintenance

Owner: agent-ops.

Refresh this solution if `.harness/evals/**` tracking moves, if eval reports
move to another governed directory, or if Linear becomes the sole durable proof
store for closure artifacts.

## Project Brain Sync

Status: updated.

Target:

- `.harness/knowledge/governance/knowledge.md`
- `.harness/knowledge/INDEX.md`

Reason:

The solved problem changes the governance closeout contract: proof must be
recoverable by future agents, not merely present in the local working tree.
