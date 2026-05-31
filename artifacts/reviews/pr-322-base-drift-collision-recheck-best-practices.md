# PR 322 Base-Drift Collision Recheck (Best Practices)

## Scope
- `src/commands/pr-closeout/git-branch.ts`
- `src/commands/pr-closeout.test.ts`

## Findings (Severity-ranked)
- No material findings.

## Specific Question Responses
- Fallback remote-base selection now avoids false implementation-safe classification from unrelated refs like `refs/remotes/upstream/release/main` when `baseRefName` is `main`.
  - Evidence: `src/commands/pr-closeout/git-branch.ts:41` through `src/commands/pr-closeout/git-branch.ts:46` computes `branchName` as the remote-trimmed branch path segment after the first slash and requires `branchName === trimmed`; `upstream/release/main` yields `release/main`, not `main`.
  - Impacted behavior: Prevents selecting unrelated remote refs that merely share a suffix with the base branch name.
  - Remediation: None required.
  - Confidence: High.
  - Validation ownership: introduced by current patch (positive fix).
- Regression test coverage is sufficient and not overfit for the reported bug class.
  - Evidence: `src/commands/pr-closeout.test.ts:1592` adds an explicit suffix-collision case, asserts only origin base attempt is used, and asserts the non-exact `upstream/release/main` probe is not attempted at `src/commands/pr-closeout.test.ts:1667`.
  - Impacted behavior: Locks in exact-branch matching semantics while preserving valid fallback behavior tested separately at `src/commands/pr-closeout.test.ts:1500`.
  - Remediation: Optional future hardening only: add a tiny unit-level test around `remoteBaseRefs` extraction behavior for unusual remote names or nested branch paths if this function is later reused beyond PR closeout.
  - Confidence: High.
  - Validation ownership: introduced by current patch (positive coverage).

## Remaining Material Blockers Before Commit
- None identified in scoped files.

## Accountability Receipt
- status: complete
- manifest_path: `artifacts/agent-runs/best-practices-researcher-019e7c57-773b-77c0-84ae-10aa9eb89769/manifest.json`
- artifact_paths:
  - `artifacts/reviews/pr-322-base-drift-collision-recheck-best-practices.md`
- findings:
  - `none_material`
- failures_or_blockers:
  - `none`
- improvement_opportunities:
  - Add optional micro-test for `remoteBaseRefs` branch-path extraction edge cases if function scope broadens.
- strengths:
  - Exact-match ref filtering removes suffix-collision false positives while preserving fallback discovery for valid remotes.
  - Tests cover both positive fallback and negative suffix-collision behavior.
- validation_evidence:
  - `pnpm vitest run src/commands/pr-closeout.test.ts` (reported pass, 47 tests).
  - `pnpm run quality:git-env-sanitizer` (reported pass).
  - `git diff --check` (reported pass).
  - `bash scripts/validate-codestyle.sh --fast` (reported pass).
  - Local review evidence:
    - `zsh -lc 'rg -n "baseRefName|refs/remotes|upstream|main|implementation_safe|fallback|origin" src/commands/pr-closeout/git-branch.ts src/commands/pr-closeout.test.ts'`
    - `zsh -lc 'nl -ba src/commands/pr-closeout/git-branch.ts | sed -n "1,140p"'`
    - `zsh -lc 'nl -ba src/commands/pr-closeout.test.ts | sed -n "1488,1705p"'`
- next_action:
  - Proceed to commit from coordinator lane.
- useful_findings:
  - Collision class (`*/main`) is directly guarded by exact branch-name comparison.
- avoided_false_positive:
  - Did not treat generic multi-segment remote refs as valid fallback candidates unless exact branch name matched.
- evidence_quality:
  - High: direct code-line inspection plus targeted regression assertions.
- followed_scope:
  - Strictly limited to the two requested files.
- reusable_learning:
  - For remote-ref fallback, compare normalized branch name equality, not suffix containment.
- coordinator_score:
  - 9/10

WROTE: artifacts/reviews/pr-322-base-drift-collision-recheck-best-practices.md
