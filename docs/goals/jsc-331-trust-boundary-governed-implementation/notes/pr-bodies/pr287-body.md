# Pull request checklist

## Summary

- What changed (brief): Publishes the JSC-331 T013 symlink-boundary follow-up after PR #286 merged before the T013 repair landed.
- Why this change was needed: The reviewer-coverage and audit-reference validators accepted in-repo symlinks whose real targets escaped the repository boundary, which weakened the trust-boundary proof model.
- Risk and rollback plan: Risk is limited to validator classification and focused regression tests. Roll back by reverting this branch; no runtime data migration or external state migration is included. Merge remains blocked until required checks, review truth, and Judge/PM audit are current.

## Work performed

- Plan IDs: JSC-331; `.harness/plan/2026-05-23-JSC-331-coding-harness-evidence-memory-telemetry-trust-boundary-plan.md`; `.harness/specs/2026-05-22-coding-harness-evidence-memory-telemetry-master-spec.md`; `docs/goals/jsc-331-trust-boundary-governed-implementation/goal.md`
- Linear reference: Refs JSC-331
- Phase / slice: T013 symlink-boundary repair follow-up. PR #286 merged at `2eff66217b8dce635dda0beb4bf86a78749eb1b2`; this PR carries the T013 follow-up as `f3d9c8e11a1284c5cfb9c6d704bf36c65403ec0d` plus the R018 receipt/body synchronization.
- Session IDs: Native goal thread `019e560b-fd21-7483-a243-96b844a7d4c7`; goal-board receipts through `R018`.
- Trace IDs: Follow-up PR #287 at `https://github.com/jscraik/coding-harness/pull/287`; original merged PR #286 at `https://github.com/jscraik/coding-harness/pull/286`; T013 review artifact `artifacts/reviews/t013-symlink-boundary-triage.md`.
- AI session / traceability: Goal-board state and receipts map the Codex implementation session to the T013 repair, the review-thread triage artifact, the follow-up branch, and this PR boundary.
- Completed work: Added canonical realpath containment before reviewer artifact proof is read; added canonical realpath containment before audit references and source artifacts can satisfy proof; added symlink-outside regression coverage for both validators; recorded the follow-up PR boundary in the goal board.
- Affected surfaces: `scripts/validate-reviewer-coverage.cjs`, `scripts/validate-audit-references.cjs`, `src/lib/reviewer-coverage-receipt.test.ts`, `src/dev/validate-audit-references-script.test.ts`, and JSC-331 goal-board docs.
- Expected outcome alignment: Keeps Coding Harness portable by ensuring local evidence validators trust canonical repository-contained files, not path strings that merely appear to be inside the checkout.
- Pattern scope inventory: Principle: repo-scoped proof must validate the canonical filesystem target before treating a path as trusted evidence. Searched reviewer artifact loading, audit-reference resolution, source audit artifact loading, T013 review-thread evidence, and goal-board PR-boundary records. Changed the two validators and focused tests; broader runtime-card evidence work remains in merged PR #286.
- Meta-behavior proof: The user correction requiring subagent triage and commit/PR boundaries is preserved by the T013 triage artifact, `R015`, and this follow-up `R018` PR boundary.
- Repeated-error research: n.a. No same command or test failure repeated twice in this follow-up lane.
- Acceptance trace: T013 maps to `R015`; the stale merged-PR boundary and follow-up branch creation map to `R018`; live PR #287 review-thread observation reports zero unresolved current or outdated threads.
- Validation evidence: Focused tests, validator real-input runs, focused Biome, codestyle-fast, goal-board validation, PR body gates, and live PR checks are listed in Testing.
- Review artifacts: `artifacts/reviews/t013-symlink-boundary-triage.md` exists and was produced after the required artifact-only retry.
- Runtime impact: Dev/CI validator-only. Runtime product behavior is unchanged.
- CodeRabbit mode coverage: CodeRabbit status on PR #287 is currently reported as skipped/pass; GraphQL review-thread observation reports zero unresolved current/outdated review threads.
- Closeout state: PR #287 is open non-draft from `codex/jsc-331-t013-symlink-boundary`; merge state is blocked while some remote checks are pending. PR #286 is already merged and is historical for this follow-up. Linear JSC-331 is unmodified in this follow-up. Next lane is T010 Judge/PM audit after current PR, CI, review, branch, and Linear truth is fresh.
- Learning / reinforcement: Durable reinforcement is recorded in `docs/goals/jsc-331-trust-boundary-governed-implementation/receipts.jsonl` as `R018`; no memory update was requested.
- Deferred work: Full standalone closeout gates, final required-check observation after this receipt sync commit, T010 Judge/PM audit, Linear closeout/update, and merge readiness.

## Checklist

- [x] I did not push directly to `main`; this PR is from a dedicated branch.
- [x] Branch name follows policy (`codex/*` for agent-created branches).
- [ ] **(Pending)** Required local gates run: `bash scripts/validate-codestyle.sh`, `pnpm check`, `bash scripts/run-harness-gate.sh tooling-audit --path . --json`.
- [x] `scripts/validate-codestyle.sh` was treated as the enforcement point for hook env sanitization (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*` values are untrusted and sanitized before `pnpm run`).
- [x] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [x] North-star learning loop considered for changed files; relevant learning gate, review-context, promotion, or feedback evidence is listed below, or marked `n.a.` with a reason.
- [x] Merge is blocked until all required checks pass.
- [x] I will delete branch/worktree after merge.

## Testing

<!-- vale Vale.Spelling = NO -->
- verification_commands: exact commands run are listed below.
- verification_outcomes: Focused T013 checks passed locally. PR #287 live body gates pass after this body sync. Some remote checks were pending at the R018 observation, so merge readiness is not claimed.
- blocked_steps_reason: Full standalone closeout gates and Judge/PM audit are pending before final handoff.
<!-- vale Vale.Spelling = YES -->
- Command: `bash scripts/validate-codestyle.sh` -> blocked (standalone full gate pending before final handoff)
- Command: `pnpm check` -> blocked (not rerun for this docs-only R018 sync; prior branch proof exists in PR #286 receipts)
- Command: `bash scripts/run-harness-gate.sh tooling-audit --path . --json` -> blocked (standalone wrapper gate pending before final handoff)
- Setup: `CHANGED_FILES="scripts/validate-reviewer-coverage.cjs,scripts/validate-audit-references.cjs,src/lib/reviewer-coverage-receipt.test.ts,src/dev/validate-audit-references-script.test.ts,docs/goals/jsc-331-trust-boundary-governed-implementation/state.yaml,docs/goals/jsc-331-trust-boundary-governed-implementation/receipts.jsonl,docs/goals/jsc-331-trust-boundary-governed-implementation/notes/pr-bodies/pr287-body.md"`
- Command: `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> blocked (not rerun for this docs-only sync; no imported CodeRabbit finding applies to the new PR body artifact)
- Command: `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> blocked (not rerun for this docs-only sync)
- Command: `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json` -> blocked (not rerun for this docs-only sync)
- Command: `harness pr-closeout --pr 287 --gates artifacts/pr-closeout/closeout-gates.json --json` -> n.a. (PR closeout is deferred until CI, review truth, and Judge/PM audit are current)
- Any other command(s):
  - Command: `pnpm vitest run src/lib/reviewer-coverage-receipt.test.ts src/dev/validate-audit-references-script.test.ts` -> pass
  - Command: `node scripts/validate-reviewer-coverage.cjs --manifest artifacts/reviews/reviewer-coverage-manifest.json --reviews-dir artifacts/reviews --json` -> pass
  - Command: `node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json` -> pass
  - Command: `pnpm exec biome check scripts/validate-reviewer-coverage.cjs scripts/validate-audit-references.cjs src/lib/reviewer-coverage-receipt.test.ts src/dev/validate-audit-references-script.test.ts` -> pass
  - Command: `bash scripts/validate-codestyle.sh --fast` -> pass
  - Command: `PYTHONDONTWRITEBYTECODE=1 python3 /Users/jamiecraik/dev/agent-skills/Skills/agent-ops/goal-governor/scripts/check_goal_board.py docs/goals/jsc-331-trust-boundary-governed-implementation` -> pass
  - Command: `gh pr view 287 --repo jscraik/coding-harness --json headRefOid,mergeStateStatus,mergeable,reviewDecision,isDraft,url,title` -> pass
  - Command: `gh api graphql ... reviewThreads for PR #287` -> pass
  - Command: `PR_TEMPLATE_BODY="$(gh pr view 287 --repo jscraik/coding-harness --json body --jq .body)" PR_TITLE="$(gh pr view 287 --repo jscraik/coding-harness --json title --jq .title)" bash scripts/run-harness-gate.sh pr-template-gate --json` -> pass
  - Command: `PR_BODY="$(gh pr view 287 --repo jscraik/coding-harness --json body --jq .body)" PR_TITLE="$(gh pr view 287 --repo jscraik/coding-harness --json title --jq .title)" bash scripts/run-harness-gate.sh linear-gate --json` -> pass
  - Command: `gh pr checks 287 --repo jscraik/coding-harness --watch=false` -> blocked (remote checks pending at R018 observation)

## Review artifacts

- Review status:
  - CodeRabbit review: status context is skipped/pass on PR #287; thread-level observation reports zero unresolved current/outdated threads.
  - Independent reviewer: pending Judge/PM audit.
  - Codex review: T013 symlink-boundary triage artifact completed after artifact-only retry.
- CodeRabbit: PR #287 status context and GraphQL review-thread observation.
- Independent reviewer evidence: pending T010 Judge/PM audit.
- Codex: `artifacts/reviews/t013-symlink-boundary-triage.md`
- CodeRabbit Semgrep: n.a. for this validator follow-up; no CodeRabbit Semgrep finding is open on PR #287 at current observation.
- Additional evidence (if any): `docs/goals/jsc-331-trust-boundary-governed-implementation/receipts.jsonl`, `docs/goals/jsc-331-trust-boundary-governed-implementation/state.yaml`

## Notes

This PR is the bounded T013 follow-up created because PR #286 merged before the symlink-boundary repair landed. It is not merge-ready until final remote checks settle and the required Judge/PM audit is recorded.
