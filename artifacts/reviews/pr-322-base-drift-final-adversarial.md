# Adversarial Review - PR #322 Base Drift Final

## Scope
- `src/commands/pr-closeout/git-branch.ts`
- `src/commands/pr-closeout/live.ts`
- `src/commands/pr-closeout.test.ts`

## Depth
- Standard (targeted branch-state/data-mutation lane with worktree readiness impact).

## Findings

### 1. Medium - False implementation-safe classification when an unrelated remote branch shares the same base suffix
- Severity: medium
- Validation ownership: introduced by current patch
- Evidence:
  - `src/commands/pr-closeout/git-branch.ts:41` accepts any remote ref ending in `/${baseRefName}` (for example `refs/remotes/origin/feature/main` when base is `main`).
  - `src/commands/pr-closeout/git-branch.ts:78` iterates discovered refs and accepts the first rev-list result with parseable counts.
  - `src/commands/pr-closeout/git-branch.ts:101` marks `worktreeRole = "implementation"` when clean and `behindBase === false`.
- Constructed failure scenario:
  1. Trigger: `refs/remotes/origin/main` is missing (fresh shallow checkout, stale remotes, or non-origin primary), while an unrelated branch ref like `refs/remotes/upstream/release/main` exists.
  2. Path: `remoteBaseRefs()` includes that unrelated ref because suffix match is purely `endsWith("/main")`.
  3. Path: `inspectGitBranch()` computes drift against this unrelated ref and gets `behindBy=0`.
  4. Outcome: `behindBase=false` and clean worktree produce `worktreeRole="implementation"`.
  5. Failure: closeout reports implementation-safe status based on a semantically wrong comparator, masking true drift from the actual PR base branch.
- Impacted behavior:
  - Worktree lifecycle classification can become a false positive, weakening closeout safety for base-drift gates.
- Remediation:
  - Restrict fallback candidates to canonical remote base refs only (exact `<remote>/<baseRefName>`) and prefer the remote associated with the PR base repo.
  - If no canonical candidate can be validated, keep drift unobserved (`behindBase=null`) and force `orientation`.
- Confidence: 75

## Positive Coverage
- `src/commands/pr-closeout/live.ts:318` now passes `pullRequest.baseRefName` into branch inspection, removing the prior `@{upstream}` coupling.
- Tests assert origin-first comparator usage and explicit fallback attempt:
  - `src/commands/pr-closeout.test.ts:1478` (origin base comparator used),
  - `src/commands/pr-closeout.test.ts:1574` (fallback to discovered upstream base ref).

## Residual Risks
- Fallback selection remains name-based rather than PR-base-repo identity based; multi-remote repos can still produce comparator ambiguity.

## Testing Gaps
- Missing regression that proves non-canonical suffix refs (for example `refs/remotes/upstream/release/main`) are excluded from fallback selection.

## Accountability Receipt
- status: completed_with_findings
- artifact_paths:
  - artifacts/reviews/pr-322-base-drift-final-adversarial.md
- findings:
  - 1 medium finding (fallback comparator ambiguity can produce false implementation-safe classification)
- failures_or_blockers:
  - `agents/contracts.json` and `agents/templates/review-artifact.md` were not found in this checkout; report written using requested artifact conventions.
- improvement_opportunities:
  - tighten fallback ref filter to canonical `<remote>/<base>` only and bind to PR base repo remote identity.
- strengths:
  - base-ref-aware comparison replaced upstream heuristic; tests now pin behavior around origin and fallback.
- validation_evidence:
  - Diff inspection: `git diff -- src/commands/pr-closeout/git-branch.ts src/commands/pr-closeout/live.ts src/commands/pr-closeout.test.ts`
  - Line evidence inspection: `nl -ba src/commands/pr-closeout/git-branch.ts`
  - Upstream validation reported by coordinator: vitest targeted suite, git-env sanitizer, diff-check, codestyle fast lane all passing.
- next_action:
  - Add one adversarial unit test for suffix-collision fallback and tighten candidate selection accordingly.
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e7c53-a697-7de0-b153-d5597aee310f/manifest.json

WROTE: artifacts/reviews/pr-322-base-drift-final-adversarial.md
