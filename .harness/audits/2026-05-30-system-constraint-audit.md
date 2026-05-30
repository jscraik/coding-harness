---
date: 2026-05-30
report_type: system-constraint-audit
status: advisory
repo: coding-harness
branch: codex/jsc-363-intermediary-receipt-coverage
---

# System Constraint Audit

## Table Of Contents

- [Purpose](#purpose)
- [Method](#method)
- [Current Constraint](#current-constraint)
- [Evidence](#evidence)
- [Cost](#cost)
- [What Feeds It](#what-feeds-it)
- [What Depends On It](#what-depends-on-it)
- [How To Increase Throughput](#how-to-increase-throughput)
- [Next Steps](#next-steps)
- [Do Not Optimize](#do-not-optimize)
- [Validation](#validation)

## Purpose

Find the current system constraint using live repository and tracker evidence.
Do not optimize non-constraints.

The audit checks:

- longest queue
- highest wait time
- most frequent blocker
- highest rework area

## Method

Evidence inspected:

- local branch and dirty-worktree state
- `.harness/active-artifacts.md`
- `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`
- `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`
- `.harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md`
- `.harness/review/coding-harness-architecture-review.md`
- `docs/roadmap/north-star.md`
- Linear `JSC` issues with the `coding-harness` label

Commands used for local evidence:

```bash
zsh -lc 'git status --short --branch'
zsh -lc 'find .harness -maxdepth 2 -type f -name "*.md" | awk -F/ "{print \$2}" | sort | uniq -c | sort -nr'
zsh -lc 'find .harness -maxdepth 3 -type f -name "*.md" -print0 | xargs -0 rg --no-filename -o "blocked|blocker|pending|waiting|unclaimed|unresolved|rework|reviewDecision|merge-readiness|Judge/PM|Linear scope alignment" | sort | uniq -c | sort -nr'
zsh -lc 'git diff --stat HEAD -- . ":(exclude)pnpm-lock.yaml"'
zsh -lc 'git diff --name-only HEAD -- . | awk -F/ "{print \$1 (NF>1?\"/\"\$2:\"\")}" | sort | uniq -c | sort -nr'
zsh -lc 'rg -n "PR lead time|review/rework|primary bottleneck|Current Active Route|Merge-readiness|final closeout remain unclaimed|Goal Governor route|complete only when" harness.contract.json docs/roadmap/north-star.md docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md .harness/active-artifacts.md .harness/review/coding-harness-architecture-review.md | head -120'
```

## Current Constraint

The current system constraint is readiness and evidence reconciliation at PR or
goal closeout.

More specifically: work can be implemented faster than the system can prove,
reconcile, and safely close it across local validation, PR checks,
review-thread state, Linear scope, runtime receipts, Judge/PM readiness, and
merge-readiness truth.

This is the constraint to optimize now.

## Evidence

### Longest Queue

The largest local `.harness` artifact queue is review:

| Queue | Count |
| --- | ---: |
| `.harness/review` | 28 |
| `.harness/specs` | 14 |
| `.harness/plan` | 14 |
| `.harness/research` | 12 |
| `.harness/media` | 11 |
| `.harness/evals` | 10 |
| `.harness/core` | 10 |

Interpretation: the largest durable work queue is review and reconciliation
evidence, not feature specification or planning.

### Highest Wait Time

Linear currently shows two active `coding-harness` in-progress issues:

| Issue | Started | Current wait | Constraint relevance |
| --- | --- | ---: | --- |
| JSC-330 `[coding-harness] Add boundary map and import guard for architecture/evidence alignment` | 2026-05-19 | about 11 days | Relevant but not the active route. |
| JSC-363 `[coding-harness] Implement Codex runtime evidence verifier cockpit Phase 1` | 2026-05-28 | about 2 days | Current active route. |

A third issue, JSC-98, has a longer in-progress age from 2026-05-13, but it is
low priority, roadmap-later, and about release eval timeout tuning. It is not
the current constraint.

Interpretation: the highest raw wait item is not the constraint. The relevant
wait is the active JSC-363 route, whose closeout is explicitly blocked on
multi-lane readiness proof rather than implementation alone.

### Most Frequent Blocker

Across `.harness` markdown files within depth 3, blocker language is
dominated by explicit blocked states:

| Term | Count |
| --- | ---: |
| `blocked` | 790 |
| `blocker` | 743 |
| `pending` | 105 |
| `rework` | 94 |
| `unresolved` | 90 |
| `Judge/PM` | 59 |
| `waiting` | 13 |
| `merge-readiness` | 7 |
| `reviewDecision` | 4 |
| `unclaimed` | 3 |
| `Linear scope alignment` | 3 |

Interpretation: the system's repeated failure mode is not lack of work
generation. It is blocked or unresolved readiness state.

### Highest Rework Area

The current checkout has 87 changed files with 7,383 insertions and 225
deletions against `HEAD`.

Changed-file concentration:

| Area | Changed files |
| --- | ---: |
| `src/lib` | 44 |
| `.harness/media` | 11 |
| `src/commands` | 6 |
| `.harness/research` | 4 |
| `docs/agents` | 3 |
| `src/templates` | 2 |
| `.harness/audits` | 2 |

Interpretation: rework is concentrated in `src/lib`, especially
runtime/evidence/project-brain/git/testing support, while `.harness`
artifacts are carrying substantial review and audit load. That matches a
system trying to turn repeated readiness failures into reusable evidence
primitives.

### Active Route Evidence

`.harness/active-artifacts.md` identifies JSC-363 as the current active Goal
Governor route and says the board governs the full lifecycle, not only Phase 1.

The same active artifact states that these remain unclaimed:

- merge-readiness
- Linear scope alignment
- review-thread truth
- Judge/PM readiness
- runtime producer emission
- delivery-truth consumption
- final closeout

`docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` says the goal is
complete only when lifecycle units through hardening, documentation accuracy,
PR triage, and Judge/PM-ready evidence are finished or explicitly blocked with
current evidence.

`docs/roadmap/north-star.md` names PR lead time as the primary north-star
metric and the review or rework loop as the primary bottleneck.

`.harness/review/coding-harness-architecture-review.md` repeats the same
domain diagnosis: the core domain is reducing PR lead time and review/rework
cost by turning repeated agent workflow failures into deterministic, portable,
evidence-backed governance.

## Cost

The constraint costs throughput in four ways:

1. Implemented work waits in review or closeout lanes because evidence is not
   yet composed into one trusted readiness picture.
2. Agents repeat manual reconciliation across GitHub, CircleCI, CodeRabbit,
   Linear, local validation, runtime cards, and `.harness` artifacts.
3. Local validation can pass while merge-readiness, review-thread truth,
   tracker truth, or Judge/PM readiness remains unproved.
4. The worktree accumulates broad WIP: 87 changed files in this snapshot, with
   the largest concentration under `src/lib`.

The practical cost is longer PR lead time and repeated closeout rework. That is
exactly the repo's declared north-star loss function.

## What Feeds It

The constraint is fed by:

- stacked PR state
- current-head SHA and branch divergence
- review-thread freshness
- CodeRabbit or Codex review artifacts
- CircleCI, Semgrep Cloud, Snyk, and other required-check conclusions
- Linear issue scope and relationship metadata
- local validation evidence
- runtime-card and evidence-bundle packets
- Project Brain and Local Memory freshness
- `.harness` audit, plan, spec, and review artifacts
- broad architecture-adjacent runtime cockpit changes under `src/lib`

## What Depends On It

These lanes depend on the constraint being relieved:

- JSC-363 full lifecycle completion
- PR closeout readiness
- Judge/PM readiness
- merge-readiness claims
- Linear status updates
- future runtime evidence cockpit slices
- delivery-truth consumption
- route recommendations from `harness next`
- agent-native confidence that a slice is done, waiting, blocked, or ready

## How To Increase Throughput

Increase throughput by reducing closeout reconciliation load, not by starting
more implementation.

Recommended actions:

1. Finish the JSC-363 readiness evidence path before starting adjacent feature
   work.
2. Make one command or report compose the active closeout lanes: local
   validation, PR checks, review threads, Linear scope, runtime evidence, and
   root/worktree state.
3. Convert repeated closeout blockers into fixtures and validators, especially
   skipped or neutral required checks, stale heads, missing reviewer artifacts,
   unresolved review threads, and stale Linear scope.
4. Keep work slices smaller until the closeout constraint is relieved. Each new
   broad slice adds more truth lanes to reconcile.
5. Promote evidence manifests over prose. If a claim matters for closeout, it
   should have a current evidence ref, source, timestamp, head SHA, and blocker
   class.
6. Treat `.harness/review` as the queue to drain first. Review artifacts are
   the largest local queue and directly gate readiness claims.

## Next Steps

1. Do not begin a new optimization lane.
2. Use JSC-363 as the active constraint-relief route.
3. Run a focused closeout-lane inventory for the current branch:
   - local validation state
   - PR state
   - CI state
   - review-thread state
   - Linear state
   - root/worktree state
   - runtime-card/evidence-bundle state
4. Identify the smallest missing composer or validator that would remove one
   manual reconciliation step.
5. Implement only that missing composer or validator.
6. Validate it with the narrowest fixture-backed command.
7. Update the active goal board receipt so future agents do not repeat the same
   reconciliation work.

## Do Not Optimize

Do not optimize these now:

- JSC-98 release eval timeout. It has high raw wait time, but it is
  low-priority and not feeding the active closeout queue.
- New planning artifacts. Specs and plans are not the longest queue.
- New feature surface area. More runtime cockpit features will increase WIP
  unless they directly reduce closeout reconciliation.
- Cosmetic shallow-module cleanup. It may be useful later, but it does not beat
  the current evidence-readiness constraint.
- Generic documentation polish. Documentation should change only when it
  removes a specific closeout ambiguity or feeds a validator.

## Validation

Command: `zsh -lc 'git status --short --branch'` -> pass (confirmed branch
and dirty-worktree boundary)

Command: `zsh -lc 'find .harness -maxdepth 2 -type f -name "*.md" | awk -F/ "{print \$2}" | sort | uniq -c | sort -nr'` -> pass (counted local
`.harness` artifact queues)

Command: `zsh -lc 'find .harness -maxdepth 3 -type f -name "*.md" -print0 | xargs -0 rg --no-filename -o "blocked|blocker|pending|waiting|unclaimed|unresolved|rework|reviewDecision|merge-readiness|Judge/PM|Linear scope alignment" | sort | uniq -c | sort -nr'` -> pass (counted blocker and rework terms)

Command: `zsh -lc 'git diff --stat HEAD -- . ":(exclude)pnpm-lock.yaml"'` ->
pass (measured local change volume)

Command: `zsh -lc 'git diff --name-only HEAD -- . | awk -F/ "{print \$1 (NF>1?\"/\"\$2:\"\")}" | sort | uniq -c | sort -nr'` -> pass (measured
changed-file concentration)

Command: Linear `list_issues` for team `JSC`, label `coding-harness`,
state `In Progress` -> pass (found JSC-363 and JSC-330 as active relevant
issues)

Command: Linear `list_issues` for team `JSC`, label `coding-harness`,
states `Todo`, `Triage`, `Backlog`, and `In Review` -> pass (no issues
returned in those states)

Validation limits: this audit did not refresh GitHub PR check state, CodeRabbit
review threads, CircleCI job logs, or Linear relationships for every referenced
issue. It identifies the system constraint from local control-plane evidence
plus current Linear queue evidence; it does not claim merge readiness or goal
completion.
