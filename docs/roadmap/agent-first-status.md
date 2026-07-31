---
last_validated: 2026-07-31
---

# Agent-First Status

## Table of Contents

- [Current Status](#current-status)
- [North-Star Boundary](#north-star-boundary)
- [What Is Known](#what-is-known)
- [Direct Observation Sample](#direct-observation-sample)
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
reduced the command surface, [#491](https://github.com/jscraik/coding-harness/pull/491)
reduced the compact minimal contract, and [#501](https://github.com/jscraik/coding-harness/pull/501)
completed the remaining active contract and documentation collapse. The prerequisite
[#494](https://github.com/jscraik/coding-harness/pull/494) is also merged to
`main` and makes Local Memory an explicit diagnostic rather than a routine
admission dependency. Optional
context maintenance is advisory; it is not the primary action for ordinary work.

The active slice is direct effectiveness observation. A five-repository
read-only readiness sample is recorded below, but it is not the required
end-to-end effectiveness evidence: no bounded change, review/fix cycle, or PR
lifecycle was observed in that sample. The product therefore has no current
effectiveness outcome claim.

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
  contracts have merged through recovery PR #501 (with #491 as the compact
  minimal-contract sub-slice).
- The merged recovery PRs do not prove hosted release, installed-package
  behavior, independent acceptance, or real-world effectiveness.
- Product effectiveness is unknown until five real Harness-assisted tasks
  across at least three repositories are recorded with direct observations that
  include a bounded change, review/fix cycle, and PR lifecycle. The sample below
  establishes routing and failure classification only.

## Direct Observation Sample

These five live observations were run on 2026-07-31 at approximately 18:07Z
with the installed `harness` v0.15.0. Each used the exact read-only commands
`harness next --json` and `harness check --json`; the durations are wall-clock
seconds emitted by `/usr/bin/time -p`. They are raw command observations, not
a causal comparison against an untreated control.

| Task / repository | `next` / `check` result | Time to first useful proof | Jamie interventions | Review/fix cycles | PR lead time | Observed effect |
| --- | --- | ---: | ---: | --- | --- | --- |
| Coding Harness clean source-main checkout | `pass` / `fail` (consumer v0.15.0 versus source v0.15.1; three contract errors) | 0.26s | 0 | n.a. (read-only) | n.a. (no PR) | delayed by consumer/dependency drift; the blocker was classified |
| Agent-Skills current four-file task | `action_required` / `pass` with two warnings; emitted an exact validation-plan command | 0.43s | 0 | n.a. (read-only) | n.a. (no PR) | accelerated routing; causal improvement is unproven |
| Configs current four-path task | `action_required` / `pass` with two warnings; emitted an exact validation-plan command | 0.31s | 0 | n.a. (read-only) | n.a. (no PR) | accelerated routing; causal improvement is unproven |
| Jamie Brain clean checkout | `pass` / `fail` (no harness contract configured) | 0.25s | 0 | n.a. (read-only) | n.a. (no PR) | delayed by an explicit configuration blocker |
| Portfolio clean checkout | `pass` / `fail` (repo-local v0.1.0 versus installed v0.15.0) | 0.25s | 0 | n.a. (read-only) | n.a. (no PR) | delayed by version drift; the blocker was classified |

The exact command outcomes are reproducible from the named repository state;
the dirty paths in Agent-Skills and Configs remain owner-controlled and were
not modified. This sample does not satisfy the end-to-end acceptance condition
and must not be used to claim lower PR lead time, fewer interventions, less
rework, or general product effectiveness.

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
