---
last_validated: 2026-08-02
---

# Agent-First Status

## Table of Contents

- [Current Status](#current-status)
- [North-Star Boundary](#north-star-boundary)
- [What Is Known](#what-is-known)
- [Direct Observation Sample](#direct-observation-sample)
- [Controlled Readiness Comparison](#controlled-readiness-comparison)
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
read-only readiness sample, a version-matched controlled readiness comparison,
and a separate source-bound lifecycle sample are recorded below. The lifecycle
rows prove that real bounded changes reached review and merge, but they do not
provide complete intervention/time-to-proof observations. The controlled
comparison shows richer local routing output with sub-second overhead in this
sample; it does not establish a causal product-effectiveness outcome.

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

| Task / repository                         | `next` / `check` result                                                                | Time to first useful proof | Jamie interventions | Review/fix cycles | PR lead time | Observed effect                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------: | ------------------: | ----------------- | ------------ | ---------------------------------------------------------------- |
| Coding Harness clean source-main checkout | `pass` / `fail` (consumer v0.15.0 versus source v0.15.1; three contract errors)        |                      0.26s |                   0 | n.a. (read-only)  | n.a. (no PR) | delayed by consumer/dependency drift; the blocker was classified |
| Agent-Skills current four-file task       | `action_required` / `pass` with two warnings; emitted an exact validation-plan command |                      0.43s |                   0 | n.a. (read-only)  | n.a. (no PR) | accelerated routing; causal improvement is unproven              |
| Configs current four-path task            | `action_required` / `pass` with two warnings; emitted an exact validation-plan command |                      0.31s |                   0 | n.a. (read-only)  | n.a. (no PR) | accelerated routing; causal improvement is unproven              |
| Jamie Brain clean checkout                | `pass` / `fail` (no harness contract configured)                                       |                      0.25s |                   0 | n.a. (read-only)  | n.a. (no PR) | delayed by an explicit configuration blocker                     |
| Portfolio clean checkout                  | `pass` / `fail` (repo-local v0.1.0 versus installed v0.15.0)                           |                      0.25s |                   0 | n.a. (read-only)  | n.a. (no PR) | delayed by version drift; the blocker was classified             |

The exact command outcomes are reproducible from the named repository state;
the dirty paths in Agent-Skills and Configs remain owner-controlled and were
not modified. This sample does not satisfy the end-to-end acceptance condition
and must not be used to claim lower PR lead time, fewer interventions, less
rework, or general product effectiveness.

## Controlled Readiness Comparison

This bounded comparison was run on 2026-08-02 with the version-matched
published consumer `harness` v0.15.3. The treated route ran, from each target
repository, the exact read-only commands `harness next --json` followed by
`harness check --json`; dirty repositories used the explicit
`--worktree-role dirty-with-justification` option for `next`. The untreated
comparison was the read-only command `git status --short --branch; git diff
--name-only`. Both routes only observed repository state and made no writes.
The timings below are wall-clock seconds from `/usr/bin/time -p`; the baseline
is the Git snapshot command, not an equivalent task-routing experience.

The raw JSON, emitted validation-plan output, and changed-file path snapshots
from this observation were not persisted as a separate receipt. The table is
therefore an unverified observation note, not independently repeatable
execution evidence.
For rows where `next` selected a validation plan, the recorded command form
was `harness validation-plan --source .harness/learnings/coderabbit.local.json
--files <observed changed files> --json`; the concrete file list and command
output are unavailable for independent replay.

| Repository / observed HEAD                                | Treated `next`                                                        | Validation binding                                              | Treated wall time | `check` counts (ok / warn / fail) | Untreated Git snapshot | Interpretation                                                                |
| --------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------: | --------------------------------: | ---------------------: | ----------------------------------------------------------------------------- |
| Jamie Brain `90ee789eced74e6f1dd018b5a1d8259d9c04888b`    | `pass`; no changed files                                              | n.a. (no validation-plan command selected)                      |             0.53s |                         1 / 2 / 1 |                  0.02s | `check` exposed the missing Harness contract; no causal benefit claim         |
| Agent-Skills `4ced957e36ea6ebe4c65d8754db5328d3879fefb`   | `action_required`; 42 changed files and exact validation-plan command | unverified note: command form above; path snapshot not retained |             0.91s |                         3 / 2 / 0 |                  0.15s | structured next action and warnings; causal benefit unproven                  |
| Configs `2d87971e3c08906112d9a712db5220f29ed644a6`        | `action_required`; 31 changed files and exact validation-plan command | unverified note: command form above; path snapshot not retained |             0.61s |                         3 / 2 / 0 |                  0.03s | structured next action and warnings; causal benefit unproven                  |
| Portfolio `011183f961a32ebd77a7d773adb1dc5df3487cb6`      | `action_required`; 30 changed files and exact validation-plan command | unverified note: command form above; path snapshot not retained |             0.53s |                         3 / 1 / 1 |                  0.03s | `check` exposed repository-local version drift; no causal benefit claim       |
| Coding Harness `34e46f72e218e1314f0365c81877b7a0cbcd35ed` | `pass`; no changed files                                              | n.a. (no validation-plan command selected)                      |             0.62s |                         4 / 1 / 0 |                  0.03s | structured readiness boundary with version coherence; causal benefit unproven |

The recorded summary says that the route supplied a typed status, one next
action or command, warnings, execution boundary, and claims boundary in
roughly 0.5–0.9 seconds for these five observations, while the untreated
command supplied only Git state and paths. Because the raw output and path
snapshots were not retained, those values remain unverified notes. The two
`check` failures are configuration/version findings in the observed
repositories, not evidence that the Harness route itself failed. This is a
local proof comparison only: it does not measure PR lead time, review/rework,
Jamie intervention, retries, or production outcomes, and it does not prove
that the route caused any observed task result.

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

| Task / repository / PR                                                                                              | Head SHA                                   | Harness command recorded by task                                    |                              First PR / merged (UTC) | Files / commits / reviews | State validation                                         | Time to first proof | Jamie interventions | Observed effect               |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------: | ------------------------: | -------------------------------------------------------- | ------------------- | ------------------- | ----------------------------- |
| Agent-Skills #371 — [narrow local journey guidance](https://github.com/jscraik/Agent-Skills/pull/371)               | `25ff6eae9851fac513dc8d99de766765adf5341d` | `bash scripts/run-harness-gate.sh tooling-audit --path . --json`    |              2026-07-28 22:21:16 → 23:01:09 (39m53s) |                 4 / 1 / 3 | opened → merged; no `ReopenedEvent` in returned timeline | unknown             | unknown             | unknown; no untreated control |
| Agent-Skills #374 — [recover local proof journey](https://github.com/jscraik/Agent-Skills/pull/374)                 | `87ed91fd8359f145b5af087cf629688dc56cf8aa` | `bash scripts/run-harness-gate.sh tooling-audit --path . --json`    |            2026-07-29 12:31:36 → 14:32:07 (2h00m31s) |               18 / 10 / 5 | opened → merged; no `ReopenedEvent` in returned timeline | unknown             | unknown             | unknown; no untreated control |
| Configs #160 — [close runtime review gaps](https://github.com/jscraik/configs/pull/160)                             | `9345d108fec4e708189e3136aae49acee12e1a60` | `bash codex/scripts/verify-work.sh --fast`                          |               2026-07-31 16:58:03 → 17:07:42 (9m39s) |                 8 / 1 / 1 | opened → merged; no `ReopenedEvent` in returned timeline | unknown             | unknown             | unknown; no untreated control |
| Portfolio #17 — [repair environment and debt gates](https://github.com/jscraik/portfolio/pull/17)                   | `ef4522244c958fa002617b779f543464cb274433` | `bash scripts/run-harness-gate.sh docs-gate --mode required --json` | 2026-07-21 21:09:36 → 2026-07-22 05:55:55 (8h46m19s) |               13 / 8 / 19 | opened → merged; no `ReopenedEvent` in returned timeline | unknown             | unknown             | unknown; no untreated control |
| Coding Harness #502 — [record effectiveness observation sample](https://github.com/jscraik/coding-harness/pull/502) | `1a8d854089bd83a133887f7455c140d58eaabbd4` | `harness next --json`                                               |               2026-07-31 18:26:19 → 18:36:07 (9m48s) |                 1 / 1 / 1 | opened → merged; no `ReopenedEvent` in returned timeline | unknown             | unknown             | unknown; no untreated control |

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
