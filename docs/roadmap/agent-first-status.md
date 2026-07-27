---
last_validated: 2026-07-27
---

# Agent-First Status

## Current Status

**Status:** 🔶 Partial

Coding Harness is in a product-recovery programme. The immediate goal is a
small practical route that helps an agent understand a task, choose one useful
action, run repository-native proof, distinguish local proof from hosted truth,
and hand work back clearly.

The current recovery slice makes routine `harness next --json` task-first.
Optional context maintenance is advisory; it is not the primary action for
ordinary work. The candidate is awaiting its separate PR, CI, review, and merge
evidence lanes.

## North-Star Boundary

- Primary outcome metric: PR lead time.
- Primary bottleneck: review/rework loop cost.
- Safety floor: deterministic evidence, current-head SHA discipline, and clear
  rollback paths.
- Autonomy boundary: low and medium-risk work may be automated; higher-risk
  work remains human-mediated.

No current numerical outcome, trend, pass-rate, intervention, retry, or
guardrail-effectiveness value is published here. The prior values did not bind
to raw observations independent of this status surface, so they were removed
rather than refreshed cosmetically.

## What Is Known

- The routine CLI route has local behavioural evidence in the active recovery
  PR.
- Hosted CI, provider review, independent acceptance, merge, release, and
  real-world effectiveness remain separate claims.
- Product effectiveness is unknown until five real Harness-assisted tasks
  across at least three repositories are recorded with direct observations.

## Recovery Order

1. Make `harness next --json` task-first.
2. Make `harness init --minimal --dry-run --json` genuinely small.
3. Reduce exposed commands to current-consumer capability.
4. Collapse duplicated contracts, scaffolding, and active documentation.
5. Collect direct, reproducible effectiveness observations; do not infer them
   from internal status documents.
6. Reconcile release and repository hygiene only after the reduced journey is
   proved from its delivered package.

## Historical Reporting

Historical phase tables, scorecards, and numerical status claims are preserved
in Git history rather than treated as current product evidence. New metrics may
be added only with a raw, reproducible observation source that is independent
of this document.
