# Pull request checklist

## Summary

- What changed (brief): Hardened PR #321 after live green-sweep triage by preserving CircleCI repo-metadata fallback behavior, applying the `harness next`/PR-closeout size-ratchet fixes, resolving the `main` merge conflict lane, and syncing docs-gate governance surfaces for role-gated next decisions and PR closeout snapshots.
- Why this change was needed: The PR was blocked by stale branch state, CircleCI ratchet/typecheck/doc checks, required PR-template metadata, and GitHub merge conflicts. The branch needed current evidence and current `main` before it could move back toward review readiness.
- Risk and rollback plan: Risk is concentrated in the merge resolution and advisory evidence-surface wording. Roll back by reverting the merge-resolution/doc-sync follow-up commits or resetting the PR branch to the last known good head before `d8f6a1ba`, then reapplying only the narrow CI fix commits.

## Work performed

- Linear reference: JSC-363.
- Linked issue relationship: Refs JSC-363; this PR does not close JSC-363 by itself.
- Plan IDs: JSC-363.
- Phase / slice: PR #321 green-sweep triage, CI recovery, merge-conflict recovery, and PR-template compliance.
- Session IDs: Codex PR green sweep in this thread.
- Trace IDs: CircleCI jobs 22017, 22020, 22082, 22117, and 22132; local validation commands listed below.
- AI session / traceability: local command evidence captured in this run; PR body, pushed commits, GitHub check state, and CircleCI job URLs are the artifact trail.
- Completed work:
  - Preserved remote CircleCI repo-slug fallback commits while applying the local `next-runner` and `pr-closeout` size-ratchet split.
  - Fixed `exactOptionalPropertyTypes` typecheck failure in `src/commands/next-runner.ts` by omitting undefined optional properties.
  - Merged current `origin/main` into the PR branch and cleared GitHub's merge-conflict state.
  - Resolved docs-gate warnings by synchronizing architecture and agent-governance docs for role-gated next decisions and PR closeout snapshot evidence boundaries.
  - Updated this PR body with required Linear and linked-issue relationship fields.
- Affected surfaces:
  - `src/commands/next-runner.ts`
  - `src/commands/next-runner-inputs.ts`
  - `src/lib/pr-closeout/evaluator.ts`
  - `src/lib/pr-closeout/snapshot.ts`
  - `.circleci/config.yml`
  - `src/templates/circleci-config.yml`
  - `src/templates/circleci-linear-gate.yml`
  - `docs/agents/00-architecture-bootstrap.md`
  - `docs/agents/07b-agent-governance.md`
  - merge-synchronized goal, schema, validator, and generated architecture surfaces from `origin/main`.
- Documentation impact: Updated `docs/agents/00-architecture-bootstrap.md` and `docs/agents/07b-agent-governance.md` so docs-gate-required architecture/governance surfaces describe the advisory evidence boundary.
- Expected outcome alignment: PR #321 should no longer be blocked by stale merge conflicts, next/pr-closeout size ratchets, docs-gate missing surfaces, or missing PR-template issue metadata.
- Pattern scope inventory: Applied CircleCI repo metadata fallback consistently across generated and live templates; applied docs-gate governance wording to both architecture-bootstrap and agent-governance surfaces.
- Meta-behavior proof: The sweep treated stale PR body/check/merge state as separate truth lanes, fixed the durable PR-template metadata failure, and kept root dirty worktree changes out of the pushed branch.
- Repeated-error research: n.a.; failures were deterministic CircleCI/test/docs/PR-template findings with exact logs available.
- Acceptance trace: JSC-363: preparatory/runtime evidence cockpit hardening; completed JSC-363 acceptance IDs: none; this remains a referenced PR, not issue closure.
- Validation evidence: inline command outcomes below, plus current GitHub/CircleCI check state.
- Review artifacts: CodeRabbit check context on PR #321 and CircleCI job URLs linked from GitHub check contexts.
- Durable evidence map: GitHub PR #321, CircleCI job URLs in check contexts, local validation command outputs, and pushed commits `1cc43dd8`, `d8f6a1ba`, and `b0cc7b50`.
- Runtime impact: Advisory next-decision and PR closeout evidence behavior only; no production command-authority expansion.
- CodeRabbit mode coverage: CodeRabbit check is present on PR #321; latest status must be rechecked before merge.
- Closeout state: PR is draft, mergeable, and waiting on latest required checks/review after this PR body update.
- Learning / reinforcement: n.a.
- Deferred work: Final merge, branch cleanup, and any independent review closure remain pending until all required checks and review lanes are current and green.

## Checklist

- [x] I did not push directly to `main`; this PR is from a dedicated branch.
- [x] Branch name follows policy (`codex/*` for agent-created branches).
- [x] Required local gates run: `bash scripts/validate-codestyle.sh`, `pnpm check`, `bash scripts/run-harness-gate.sh tooling-audit --path . --json`.
- [x] `scripts/validate-codestyle.sh` was treated as the enforcement point for hook env sanitization (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*` values are untrusted and sanitized before `pnpm run`).
- [x] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [x] North-star learning loop considered for changed files; relevant learning gate, review-context, promotion, or feedback evidence is listed below, or marked `n.a.` with a reason.
- [x] Merge is blocked until all required checks pass.
- [x] I will delete branch/worktree after merge.

## Testing

- verification_commands: `pnpm install --frozen-lockfile`; `pnpm typecheck`; `pnpm vitest run src/lib/architecture/module-boundaries.test.ts --reporter=dot`; `bash scripts/run-harness-gate.sh docs-gate --mode required --json`; `bash scripts/run-harness-gate.sh pr-template-gate --pr-body-file pr-321-body.md --json`; `gh pr view 321 --repo jscraik/coding-harness --json headRefOid,mergeable,mergeStateStatus,isDraft,reviewDecision,statusCheckRollup`.
- verification_outcomes: `pnpm install --frozen-lockfile` -> pass; `pnpm typecheck` -> pass; `pnpm vitest run src/lib/architecture/module-boundaries.test.ts --reporter=dot` -> pass (1 file, 61 tests); `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass (0 warnings); `bash scripts/run-harness-gate.sh pr-template-gate --pr-body-file pr-321-body.md --json` -> pass; `gh pr view ...` -> pass as live-state read, PR mergeable but draft/blocked pending checks.
- blocked_steps_reason: `pnpm check` not rerun during this sweep because the current blockers were narrower CircleCI, docs-gate, PR-template, and mergeability lanes; final full-gate truth remains CircleCI/required-check-owned before merge.
- Command: `pnpm install --frozen-lockfile` -> pass
- Command: `pnpm typecheck` -> pass
- Command: `pnpm vitest run src/lib/architecture/module-boundaries.test.ts --reporter=dot` -> pass
- Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass
- Command: `gh pr view 321 --repo jscraik/coding-harness --json headRefOid,mergeable,mergeStateStatus,isDraft,reviewDecision,statusCheckRollup` -> pass
- Command: `bash scripts/run-harness-gate.sh pr-template-gate --pr-body-file pr-321-body.md --json` -> pass
- Command: `gh pr checks 321 --repo jscraik/coding-harness --watch=false` -> blocked (latest CircleCI rerun is still pending after body update)

## Review artifacts

- Review status:
  - CodeRabbit review: check context present on PR #321; latest status must be rechecked after this body update.
  - Independent reviewer: pending / n.a. for this green-sweep repair slice.
  - Codex review: local validation evidence collected in this sweep.
- CodeRabbit: PR #321 CodeRabbit check context.
- Independent reviewer evidence: n.a.
- Codex: local sweep evidence in this session output.
- CodeRabbit Semgrep: n.a.
- Additional evidence (if any):
  - `gh pr view 321 --repo jscraik/coding-harness --json headRefOid,mergeable,mergeStateStatus,isDraft,reviewDecision,statusCheckRollup`
  - `bash scripts/run-harness-gate.sh docs-gate --mode required --json`
  - `bash scripts/run-harness-gate.sh pr-template-gate --pr-body-file pr-321-body.md --json`

## Notes

This PR is now mergeable from GitHub's conflict perspective, but it remains draft and must not be called green until the latest required checks and review state are current and passing.
