# Pull request checklist

## Summary

- Linear issue:
- Plan IDs:
- What changed (brief):
- Why this change was needed:
- Risk and rollback plan:

## Checklist

- [ ] I did not push directly to `main`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (`codex/*` for agent-created branches).
- [ ] Linear issue key is present in the branch name or PR title/body for GitHub↔Linear linking.
- [ ] Plan IDs are listed in the PR summary and resolve to existing `docs/plans/*` frontmatter `plan_id` values.
- [ ] Completed acceptance items for referenced plans include evidence links/refs before requesting merge.
- [ ] Required local gates run: `pnpm lint`, `pnpm docs:lint`, `pnpm workflow:validate`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm check` (or reason for deviation).
- [ ] If scaffold/setup surfaces changed (`init`, `check-environment`, hooks, templates, tooling docs), `bash scripts/run-harness-setup-checks.sh` ran successfully.
- [ ] Workflow contract normalization reviewed: `pnpm workflow:normalize` run (no-op or changes committed), then `pnpm workflow:validate` passes.
- [ ] `docs-gate` passes locally when modifying governance-sensitive surfaces (CLI, CI, contract, init, docs).
- [ ] Greptile setup verified via `greploop` or `check-pr` skill with `.greptile/config.json`, `.greptile/rules.md`, `.greptile/files.json` present.
- [ ] `Greptile Review` check completed and findings handled (or explicitly waived).
- [ ] `Codex` review completed and findings handled (or explicitly waived).
- [ ] Independent reviewer evidence added when `reviewPolicy.enforceReviewerIndependence=true` (otherwise mark N/A).
- [ ] Greptile confidence score is `>= 4/5` for merge eligibility.
- [ ] Required CI gates pass: `risk-policy-gate`, `dependency-review`, `actions-pinning`, `security-scan`, `docs-gate`, `Greptile Review`.
- [ ] PR template sections are complete and accurate.
- [ ] I will delete branch/worktree after merge.

## Testing

- Command: `pnpm lint` → `pass/fail`
- Command: `pnpm docs:lint` → `pass/fail`
- Command: `pnpm workflow:normalize` → `pass/fail` (include `no-op` or `updated` outcome)
- Command: `pnpm workflow:validate` → `pass/fail`
- Command: `pnpm typecheck` → `pass/fail`
- Command: `pnpm test` → `pass/fail`
- Command: `pnpm audit` → `pass/fail`
- Command: `pnpm check` → `pass/fail`
- Command: `bash scripts/run-harness-setup-checks.sh` → `pass/fail` (required when scaffold/setup surfaces change)
- Command: `harness docs-gate --mode advisory` → `pass/fail` (if governance surfaces changed)
- Any other command(s):

## Review artifacts

- Greptile: `<link / artifact path / comment ID>`
- Greptile confidence score: `<0-5>`
- Independent reviewer evidence: `<reviewer + link>`
- Codex: `<link / artifact path / comment ID>`
- Additional evidence (if any):

## Notes

Add one-paragraph merge rationale here.
