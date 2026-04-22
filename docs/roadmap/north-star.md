---
last_validated: 2026-04-20
---

# North Star

This document is the canonical north-star contract for Coding Harness.
Other narrative surfaces should derive from this file rather than re-explain the
project from scratch.

## Table of Contents

- [Mission](#mission)
- [Primary Metric](#primary-metric)
- [Primary Bottleneck](#primary-bottleneck)
- [Autonomy Boundary](#autonomy-boundary)
- [Safety Floor](#safety-floor)
- [Operating Principles](#operating-principles)
- [Non-Goals](#non-goals)
- [What This Means For Product Decisions](#what-this-means-for-product-decisions)

## Mission

Coding Harness exists to let humans steer and agents execute safely, with PR
lead time as the primary north-star metric.

## Primary Metric

- Primary north-star metric: `PR lead time` from open to merge.
- Primary quality constraint: improvements must not come from weakening review,
  evidence, or rollback safety.
- Supporting metrics:
  - review or rework retries per PR
  - manual interventions per agent-driven change
  - time spent blocked on merge-readiness or review coordination
  - rollback reliability when automation must be reversed

## Primary Bottleneck

The primary bottleneck is the review or rework loop.

Coding Harness should therefore optimize for:

- shrinking time between finding and acceptable fix
- reducing repeated human review comments on the same failure pattern
- reducing manual glue work between review, remediation, verification, and merge
- keeping PRs open for less time so merge conflicts and stale context are less
  likely

## Autonomy Boundary

- Low and medium-risk autonomy should be automated where evidence is
  deterministic and rollback is clear.
- High-risk changes remain human-mediated.
- Autonomy should expand only when the system demonstrates lower review cost,
  lower manual coordination cost, or better reliability than the previous mode.

## Safety Floor

The harness safety floor is:

- deterministic evidence over intuition
- strict current-head SHA discipline
- bounded auto-remediation instead of open-ended write access
- explicit rollback paths for higher-risk automation
- independent review surfaces that do not collapse back into self-approval

## Operating Principles

- Treat code as abundant and human attention as scarce.
- Move repeated review feedback into durable guardrails, tests, prompts, or
  policy checks.
- Keep repo structures legible to agents by making patterns uniform and local to
  a subtree wherever possible.
- Prefer a small number of excellent guardrails and skills over a broad taxonomy
  that nobody maintains.
- Favor systems that reduce synchronous human coordination instead of adding new
  policy surface for its own sake.
- If the same failure happens twice, the repo should gain a durable guardrail.

## Non-Goals

Coding Harness should not optimize for:

- governance surface area as a proxy for progress
- feature count without measurable throughput or reliability benefit
- manual coordination steps that recur every run or every PR
- broad autonomy expansion without evidence that the review or rework loop got
  cheaper
- docs, artifacts, or dashboards that do not reduce ambiguity, shorten
  decision-making time, or remove manual glue work

## What This Means For Product Decisions

Any new feature, command, policy surface, or document should answer these
questions clearly:

1. Does this reduce PR lead time directly, or strengthen the path to lower PR
   lead time by reducing review or rework cost?
2. Does this remove repeated manual glue work rather than normalizing it?
3. Does this make acceptable output easier for agents to produce reliably?
4. Does this preserve strict evidence, SHA discipline, and rollback safety?

If the answer is no, the work is either out of scope or needs a stronger
justification before it becomes part of the control plane.
