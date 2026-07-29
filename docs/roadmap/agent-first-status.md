---
last_validated: 2026-07-29
---

# Agent-First Status

## Table of Contents

- [Current Status](#current-status)
- [North-Star Boundary](#north-star-boundary)
- [What Is Known](#what-is-known)
- [Recovery Order](#recovery-order)
- [Historical Reporting](#historical-reporting)

## Current Status

**Status:** 🔶 Partial

Coding Harness is in a product-recovery programme. The immediate goal is a
small practical route that helps an agent understand a task, choose one useful
action, run repository-native proof, distinguish local proof from hosted truth,
and hand work back clearly.

Recovery slices 1 through 4 are merged to `main`: [#488](https://github.com/jscraik/coding-harness/pull/488)
made routine `harness next --json` task-first, [#489](https://github.com/jscraik/coding-harness/pull/489)
reduced the minimal installer, [#490](https://github.com/jscraik/coding-harness/pull/490)
reduced the command surface, and [#491](https://github.com/jscraik/coding-harness/pull/491)
collapsed the compact contract and active documentation. The prerequisite
[#494](https://github.com/jscraik/coding-harness/pull/494) is also merged to
`main` and makes Local Memory an explicit diagnostic rather than a routine
admission dependency. Optional
context maintenance is advisory; it is not the primary action for ordinary work.

The active slice is direct effectiveness observation. It has no current outcome
claim: the required observations have not yet been collected.

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

- The routine CLI route and its compact installer, command, and documentation
  contracts have merged through recovery PRs #488 through #491.
- The merged recovery PRs do not prove hosted release, installed-package
  behavior, independent acceptance, or real-world effectiveness.
- Product effectiveness is unknown until five real Harness-assisted tasks
  across at least three repositories are recorded with direct observations.

## Recovery Order

Each step is owned by Coding Harness maintainers. Start a step only after the
previous recovery PR is merged or explicitly rejected; use the
[validation route](../agents/04-validation.md) to report a failure and keep the
previous slice active rather than widening scope.

1. Make `harness next --json` task-first. **Success:** stale optional context is
   a warning and the routine output names one useful action. **Failure:** retain
   this slice and correct the focused command contract and tests.
2. Make `harness init --minimal --dry-run --json` genuinely small. **Success:**
   representative previews plan fewer than ten files. **Failure:** retain the
   installer slice and remove unselected scaffold outputs before promotion.
3. Reduce exposed commands to current-consumer capability. **Success:** each
   retained stable or expert command has a named consumer and behavioral proof.
   **Failure:** retain the command-reduction slice and restore any proven
   consumer before deleting a command.
4. Collapse duplicated contracts, scaffolding, and active documentation.
   **Success:** the retained route is compact and source-of-truth references are
   singular. **Failure:** retain this slice and remove duplication instead of
   adding another compatibility layer.
5. Collect direct, reproducible effectiveness observations; do not infer them
   from internal status documents. **Success:** five real tasks across at least
   three repositories have raw observations. **Failure:** leave effectiveness
   unknown.
6. Reconcile release and repository hygiene only after the reduced journey is
   proved from its delivered package. **Success:** source, package, and
   installed CLI version truth agree. **Failure:** retain the release slice and
   do not publish or clean branches/worktrees.

## Historical Reporting

Historical phase tables, scorecards, and numerical status claims are preserved
in Git history rather than treated as current product evidence. New metrics may
be added only with a raw, reproducible observation source that is independent
of this document.
