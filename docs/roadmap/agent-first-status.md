---
last_validated: 2026-08-11
---

# Agent-First Status

## Table of Contents

- [Current Status](#current-status)
- [North-Star Boundary](#north-star-boundary)
- [What Is Known](#what-is-known)
- [Direct Observation Sample](#direct-observation-sample)
- [Controlled Baseline And Treatment](#controlled-baseline-and-treatment)
- [Source-Bound Observation Cohort](#source-bound-observation-cohort)
- [Lifecycle Evidence Sample](#lifecycle-evidence-sample)
- [Recovery Order](#recovery-order)
- [Historical Reporting](#historical-reporting)

## Current Status

**Status:** ✅ Reduced route locally evidenced; causal productivity metrics remain unknown

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

The 2026-08-10 weekly review also includes the dependency remediation merged in
[#515](https://github.com/jscraik/coding-harness/pull/515) and the public npm
release-contract alignment merged in
[#514](https://github.com/jscraik/coding-harness/pull/514). Those maintenance
slices improve dependency and future release readiness, but they add no new
effectiveness observation or package-publication evidence. The controlled
observation below supplies the missing local proof-clarity evidence; causal
productivity metrics remain explicitly unknown.

The direct effectiveness slice now has a controlled local observation in
addition to the earlier readiness, cohort, and lifecycle samples. The
controlled sample records a repository-only baseline and the built current CLI
for five real task snapshots across four repositories. It demonstrates clearer
structured proof with a bounded sub-second built-CLI observation, while
keeping intervention, review/fix, and PR-lead-time outcomes explicitly
unknown. This is sufficient for the local proof-clarity boundary, not a causal
product-effectiveness claim.

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

### Fresh source-bound observation (2026-08-11)

A new read-only observation was captured from revision
`e6aefbff4f0e08cb18f1d5b4d804a27b9c7bce5f`; that revision is not retained as a
reachable ref, so replay is bound to reachable `origin/main` at
`e94794c2b8f117d6bad16b4d11ec98b28d38da02`, whose tree was proven identical
before the observation was recorded. The private raw artifact is
`/private/tmp/coding-harness-effectiveness-observations-20260811.json`, SHA-256
`aedf5538a7753d561f45d09f9e2be286d27ae358a741fa01462b3110ddf92464`.
Each row used `harness next --json --worktree-role dirty-with-justification`
from the task root and `harness check <task-root> --json` from the source
checkout. The dirty-worktree role preserved owner-controlled changes; it did
not authorize edits or make the task clean.

| Task / repository | Task HEAD | `next` result / seconds | `check` counts (ok / warn / fail) | Local interpretation |
| --- | --- | --- | --- | --- |
| Agent-Skills | `6c3c83bdf236ce8badd97e5e86eedcbb8388d1e2` | `action_required` / 1.996 | 3 / 2 / 0 | Exact validation-plan command; dirty changes preserved |
| Configs | `f56b308cc0bb872c36ed344afb5a8b6032f910b2` | `action_required` / 1.819 | 3 / 2 / 0 | Exact validation-plan command; untracked automation preserved |
| Portfolio | `3c735ee8928619b23af6b7ee54f3d509beb5a61f` | `action_required` / 1.769 | 3 / 1 / 1 | Exact validation-plan command; one repository check failed |
| Jamie Brain | `90ee789eced74e6f1dd018b5a1d8259d9c04888b` | `action_required` / 1.854 | 1 / 2 / 1 | Exact validation-plan command; configuration check failed |
| Coding Harness | `e94794c2b8f117d6bad16b4d11ec98b28d38da02` | `pass` / 0.944 | 3 / 1 / 1 | Routed to `harness check`; source/version drift remained visible |

The raw artifact binds command text, exit codes, stdout, stderr, task HEADs,
and wall time. Because it is retained only in the private OC evidence lane,
reviewers cannot independently retrieve it; this table therefore records an
unverified local observation note rather than proof or a public receipt. It
does not provide an untreated baseline, Jamie intervention counts, review/fix
cycles, or a causal effectiveness result; the controlled sample below is the
source for the bounded local proof-clarity result.

## Controlled Baseline And Treatment

On 2026-08-11, five real task snapshots across Agent-Skills, Configs,
Portfolio, and Coding Harness were run read-only from immutable task heads.
The baseline was `git status --short --branch` followed by `git diff --stat -- .`.
The treatment was the current built Coding Harness `0.15.3` entrypoint,
`node dist/cli.js next --json`, built from source head
`344774d0760fc56b0cd8d336d80d483afb798507`. The exact raw source is retained
at [agent-first-effectiveness-observation-2026-08-11.json](./agent-first-effectiveness-observation-2026-08-11.json),
SHA-256
`51dc6a2264101ad99cd27abb53930b7b5f8dd1711751835b4ea13d0b2f5150ce`,
17,008 bytes.

| Task snapshot | Baseline (s) | Built `next` (s) | Result | Local effect |
| --- | ---: | ---: | --- | --- |
| Coding Harness current main | 0.0161 | 0.5588 | pass | Structured next action and claims boundary with bounded overhead |
| Agent-Skills OSS-cloud boundary | 0.0811 | 0.6095 | blocked | Correctly stopped on branch currency instead of guessing |
| Agent-Skills post-merge stabilization | 0.0886 | 0.6437 | pass | Added actionable warnings and safe execution boundary |
| Configs brace-expansion task | 0.0152 | 0.4588 | pass | Added actionable warnings and safe execution boundary |
| Portfolio route-rhythm task | 0.0128 | 0.4289 | pass | Added actionable warnings and safe execution boundary |

The built route completed in 0.4289–0.6437 seconds and returned structured
`nextAction`, execution-boundary, and claims-boundary fields on every row;
the one non-zero result was the expected fail-closed branch-currency stop.
The repository-only baseline exposed branch/status and diff state but no
bounded next action or claims boundary. This is materially clearer local proof
with a bounded sub-second orientation overhead in this sample; that range is
an observation, not a product-wide latency target or a guarantee of no delay.
No row measures Jamie intervention, review/fix cycles, PR lead time, or causal productivity.
The evidence therefore satisfies the raw five-task local proof-clarity
boundary while leaving those outcome metrics unknown.

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
argument. The exact command shape and working-directory arrangement were:

```bash
set -euo pipefail

# Set these to the pinned Node/tsx paths and the two roots recorded by the
# private observation artifact before replaying a row.
NODE_BIN=/path/to/node-26.3.0/bin/node
TSX_LOADER=/path/to/coding-harness/node_modules/tsx/dist/loader.mjs
HARNESS_SOURCE=/path/to/coding-harness
TASK_ROOT=/path/to/task-worktree
EXPECTED_SOURCE_SHA=f0f405adf0b405ec821f58e564d3d3f5927cfffc
# Select the matching task HEAD from the table above.
EXPECTED_TASK_SHA=<observed HEAD from the selected table row>

assert_recorded_tree() {
  local root=$1
  local expected=$2
  test "$(git -C "$root" rev-parse HEAD)" = "$expected"
  test -z "$(git -C "$root" status --porcelain=v1)"
}

# The source checkout is owned by Coding Harness maintainers. The task
# worktree is owned by the repository that supplied the selected row.
assert_recorded_tree "$HARNESS_SOURCE" "$EXPECTED_SOURCE_SHA"
assert_recorded_tree "$TASK_ROOT" "$EXPECTED_TASK_SHA"

# cwd: TASK_ROOT
(cd "$TASK_ROOT" && "$NODE_BIN" --import "$TSX_LOADER" \
  "$HARNESS_SOURCE/src/cli.ts" next --json)

# cwd: HARNESS_SOURCE; TASK_ROOT is the explicit check target
(cd "$HARNESS_SOURCE" && "$NODE_BIN" --import "$TSX_LOADER" \
  "$HARNESS_SOURCE/src/cli.ts" check "$TASK_ROOT" --json)
```

The private artifact records the host-specific absolute command strings,
working directories, exit codes, wall times, and raw output. A replay must
retain the source commit and task HEAD from the row, capture both stdout and
stderr, and preserve the exit code. A non-zero command exit blocks the row;
`check` output with any `fail` count also remains a failed observation even
when the process exits zero. The Coding Harness and Portfolio rows each had
one failed check and therefore remain drift observations, not readiness
passes. A Git status/diff snapshot was captured first, and all five task
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

The one failed check in each of those two rows is the `check` command's
repo-local versus installed/global version-drift check. Its expected status for
this observation is `fail`; it is accepted as a classified drift observation,
never as a readiness pass. The Portfolio row is owned by Portfolio maintainers,
and the Coding Harness row by Coding Harness maintainers. Remediation is to
align the source and installed versions, then rerun the exact source-bound
`next --json` and `check <repo-root> --json` commands above. Until the rerun has
no failed checks and a zero exit status, preserve the row as a drift observation
and do not promote it to readiness or effectiveness evidence. Capture stdout,
stderr, and the exit code; if the rerun fails, retain the failure classification
and stop promotion rather than treating the row as passed.

The private cohort records clean-lane local routing and fail-closed handling of
a branch-currency problem as an unverified observation note. Because its raw
bytes are not repo-retained or independently accessible, it does not establish
reviewer-replayable evidence. It does not prove that a user task was accelerated,
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
