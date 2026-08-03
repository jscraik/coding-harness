---
last_validated: 2026-08-03
---

# Agent-First Status

## Table of Contents

- [Current Status](#current-status)
- [North-Star Boundary](#north-star-boundary)
- [What Is Known](#what-is-known)
- [Direct Observation Sample](#direct-observation-sample)
- [Source-Bound Observation Cohort](#source-bound-observation-cohort)
- [Lifecycle Evidence Sample](#lifecycle-evidence-sample)
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
read-only readiness sample, a source-bound observation cohort, and a separate
source-bound lifecycle sample are recorded below. The lifecycle rows prove
that real bounded changes reached review and merge, but they do not provide
complete intervention/time-to-proof observations. The cohort records local
routing output and tool timing; it does not establish a causal
product-effectiveness outcome.

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
- Five real task lifecycles across four repositories are now bound below to
  immutable heads, created/merged timestamps, changed-file and commit counts,
  review evidence, and Harness commands recorded by each PR. Missing
  intervention and time-to-first-proof measurements remain explicitly unknown;
  these rows must not be promoted to a causal effectiveness claim.

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

## Source-Bound Observation Cohort

A fresh source-bound cohort was captured on 2026-08-03 from five named task
worktrees across Agent Skills, Configs, Portfolio, and Coding Harness. The raw
local evidence remains in the private OC evidence lane as
`real-task-observations.json`, SHA-256
`fef485416dd21d01d281691e8879f078e31699a33deaba180724f043a1a70272`.
It is intentionally not a tracked receipt or a new schema family. The digest
binds that local observation, but a normal repository checkout cannot
independently retrieve or replay the private bytes.

The source runner was Coding Harness `main` at
`f0f405adf0b405ec821f58e564d3d3f5927cfffc`. The recorded invocation used two
roots: the Coding Harness source checkout supplied `src/cli.ts`, while each
task worktree was the working directory for `next --json`; `check <repo-root>
--json` ran from the source checkout with the task root as its explicit
argument. A Git status/diff snapshot was captured first, and all five task
worktrees were clean at observation time. This arrangement is a local
execution record, not a portable command that can be replayed from a target
repository without the source checkout and private evidence lane.

| Task worktree / observed HEAD | `next` result | `check` counts (ok / warn / fail) | Local interpretation |
| --- | --- | ---: | --- |
| Agent Skills shape-debt retirement `9c485ef0de3ed0baced0e0555577b6d618908685` | `pass` (~1.88s tool wall) | 3 / 2 / 0 | Structured route; repo-local install warning |
| Agent Skills evaluator guard wording `15a2c6396ad2b90968cf8f91fbd8229fa4a37fb7` | `blocked` (~1.63s tool wall) | 3 / 2 / 0 | Branch is behind `origin/main`; Harness stopped rather than guessing |
| Configs OSS-cloud executable binding `c6859cff9ee9bd15425aebc1c60f9ed71bae802e` | `pass` (~1.41s tool wall) | 3 / 2 / 0 | Structured route; no repo-local runner warning |
| Portfolio public registry resolution `68dafea692b8105e01c8ff8930fad98539f85a4d` | `pass` (~1.43s tool wall) | 3 / 1 / 1 | Check exposed repo-local/global version drift |
| Coding Harness v0.15.3 release preparation `bdf27054f87b73b5e18eaf5bd986d04b9e2bf59e` | `pass` (~1.46s tool wall) | 3 / 1 / 1 | Check exposed source/global version drift |

The cohort proves clean-lane local routing and fail-closed handling of a
branch-currency problem. It does not prove that a user task was accelerated,
that Jamie intervention or review/fix cycles decreased, or that PR lead time
improved. Intervention, review/fix, and PR-lead-time fields remain unknown;
the read-only observation itself must not be counted as a task outcome.
This is local evidence only and does not prove hosted CI, review, acceptance,
merge, release, package publication, or production effectiveness.

## Lifecycle Evidence Sample

This is a post-hoc, source-bound sample collected on 2026-07-31 from the
authoritative GitHub PR records with read-only `gh pr view` queries. Each row is
a real bounded change that reached review and merge. The recorded Harness
command is copied from each PR validation/behavior-proof text; because these
rows do not link raw output or an independent receipt, execution status is
unknown. The command is therefore a recorded task claim, not proof that the
Harness route ran or caused the observed outcome. `changedFiles`, `commits`, and
`reviews` are lifecycle facts, not review/fix-cycle counts. `unknown` is
intentional where the source record does not contain a raw observation.

| Task / repository / PR | Head SHA | Harness command recorded by task | First PR / merged (UTC) | Files / commits / reviews | State validation | Time to first proof | Jamie interventions | Observed effect |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| Agent-Skills #371 — [narrow local journey guidance](https://github.com/jscraik/Agent-Skills/pull/371) | `25ff6eae9851fac513dc8d99de766765adf5341d` | `bash scripts/run-harness-gate.sh tooling-audit --path . --json` | 2026-07-28 22:21:16 → 23:01:09 (39m53s) | 4 / 1 / 3 | opened → merged; no `ReopenedEvent` in returned timeline | unknown | unknown | unknown; no untreated control |
| Agent-Skills #374 — [recover local proof journey](https://github.com/jscraik/Agent-Skills/pull/374) | `87ed91fd8359f145b5af087cf629688dc56cf8aa` | `bash scripts/run-harness-gate.sh tooling-audit --path . --json` | 2026-07-29 12:31:36 → 14:32:07 (2h00m31s) | 18 / 10 / 5 | opened → merged; no `ReopenedEvent` in returned timeline | unknown | unknown | unknown; no untreated control |
| Configs #160 — [close runtime review gaps](https://github.com/jscraik/configs/pull/160) | `9345d108fec4e708189e3136aae49acee12e1a60` | `bash codex/scripts/verify-work.sh --fast` | 2026-07-31 16:58:03 → 17:07:42 (9m39s) | 8 / 1 / 1 | opened → merged; no `ReopenedEvent` in returned timeline | unknown | unknown | unknown; no untreated control |
| Portfolio #17 — [repair environment and debt gates](https://github.com/jscraik/portfolio/pull/17) | `ef4522244c958fa002617b779f543464cb274433` | `bash scripts/run-harness-gate.sh docs-gate --mode required --json` | 2026-07-21 21:09:36 → 2026-07-22 05:55:55 (8h46m19s) | 13 / 8 / 19 | opened → merged; no `ReopenedEvent` in returned timeline | unknown | unknown | unknown; no untreated control |
| Coding Harness #502 — [record effectiveness observation sample](https://github.com/jscraik/coding-harness/pull/502) | `1a8d854089bd83a133887f7455c140d58eaabbd4` | `harness next --json` | 2026-07-31 18:26:19 → 18:36:07 (9m48s) | 1 / 1 / 1 | opened → merged; no `ReopenedEvent` in returned timeline | unknown | unknown | unknown; no untreated control |

`First PR / merged` maps GitHub `createdAt` to `first_pr_at` and `mergedAt`
to `merged_at`. State validation used the same read-only GraphQL record for
`createdAt`, `mergedAt`, and up to 100 `timelineItems`; absence of a
`ReopenedEvent` is reported as observed API evidence, not as proof that a PR
could never have been reopened outside that returned timeline.

The five rows satisfy the lifecycle/sample-count boundary, but not the
effectiveness conclusion. A future controlled sample must record time to first
useful proof and Jamie interventions at execution time, then compare a
Harness-assisted task with an explicitly selected untreated baseline. Until
that exists, PR lead time is descriptive only.

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
