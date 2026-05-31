# PR #322 Base Drift Final Review

## Scope
- `src/commands/pr-closeout/git-branch.ts`
- `src/commands/pr-closeout/live.ts`
- `src/commands/pr-closeout.test.ts`

## Findings (severity-ranked)
- No material findings.

## Verification Notes
- Branch drift evidence now targets PR base refs, not `@{upstream}`.
  - Evidence: `src/commands/pr-closeout/git-branch.ts:22-47` builds candidate base refs from `baseRefName`, preferring `refs/remotes/origin/<base>` and adding discovered remote refs.
  - Evidence: `src/commands/pr-closeout/git-branch.ts:78-84` executes `git rev-list --left-right --count <baseRef>...HEAD`.
  - Evidence: `src/commands/pr-closeout/live.ts:315-320` passes `pullRequest.baseRefName` into `inspectGitBranch(...)`.
- Fallback behavior is covered when `origin/<base>` is missing.
  - Evidence: `src/commands/pr-closeout.test.ts:1500-1589` validates retry from `refs/remotes/origin/main...HEAD` to `refs/remotes/upstream/main...HEAD` and preserves `worktreeRole: "implementation"` when not behind.
- Implementation-safe classification now requires clean worktree plus observed non-behind base evidence.
  - Evidence: `src/commands/pr-closeout/git-branch.ts:96-104` forces `behindBase = null` when drift cannot be observed and sets `worktreeRole` to `implementation` only when `clean === true && behindBase === false`.
  - Evidence: `src/commands/pr-closeout.test.ts:1343-1410` verifies unobserved base drift yields `worktreeRole: "orientation"`.
- Local validation truth remains lane-separated from PR/CI/review truth.
  - Evidence: `src/commands/pr-closeout/live.ts` keeps branch evidence in `inspectGitBranch` and PR/review/checks from GH adapters; no cross-lane collapse introduced in this patch.

## Gate/Validation Ownership Classification
- No new gate concern identified in the scoped diff.
- Ownership classification: `n/a`.

## Residual Risk
- Low: in repos with many remotes that share the same base branch name, fallback selection is first-success across discovered refs rather than an explicit preferred-remote policy. Current behavior is safe for drift detection but could be non-deterministic if multiple candidate refs diverge in different directions.

## Accountability Receipt
- status: complete
- artifact_paths:
  - `artifacts/reviews/pr-322-base-drift-final-best-practices.md`
- manifest_path: `n/a (coordinator did not request run-manifest creation for this single review artifact)`
- findings:
  - `none_material`
- failures_or_blockers:
  - `none`
- improvement_opportunities:
  - Consider deterministic remote preference order beyond `origin` fallback (for example, configurable preferred remotes) if multi-remote drift ambiguity becomes a recurring issue.
- strengths:
  - Regression tests explicitly lock intent: no `@{upstream}` comparison, positive base-ref comparison, and discovered-ref fallback.
  - Classification logic now correctly guards against false `implementation` classification when drift evidence is unavailable.
- validation_evidence:
  - `git diff -- src/commands/pr-closeout/git-branch.ts src/commands/pr-closeout/live.ts src/commands/pr-closeout.test.ts`
  - `nl -ba src/commands/pr-closeout/git-branch.ts`
  - `nl -ba src/commands/pr-closeout/live.ts`
  - `nl -ba src/commands/pr-closeout.test.ts | sed -n "1336,1625p"`
- next_action:
  - Coordinator can merge this review lane as `no material findings` and proceed with standard closeout synthesis.
- useful_findings: `yes (verified branch-base drift contract and fallback behavior)`
- avoided_false_positive: `yes (did not flag expected advisory lane separation as defect)`
- evidence_quality: `high`
- followed_scope: `strict`
- reusable_learning: `Prefer PR base ref drift checks over upstream drift in closeout signals; treat unobserved drift as orientation-only.`
- coordinator_score: `5/5`

WROTE: artifacts/reviews/pr-322-base-drift-final-best-practices.md
