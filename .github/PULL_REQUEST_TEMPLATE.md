# Pull request checklist

## Summary

- Linear issue:
- What changed (brief):
- Why this change was needed:
- Risk and rollback plan:

## Checklist

- [ ] I did not push directly to `main`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (`codex/*` for agent-created branches).
- [ ] Linear issue key is present in the branch name or PR title/body for GitHub↔Linear linking.
- [ ] Required local gates run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm check` (or reason for deviation).
- [ ] Greptile setup verified with `grepfile` skill and `.greptile/config.json`, `.greptile/rules.md`, `.greptile/files.json`.
- [ ] `Greptile` review completed and findings handled (or explicitly waived).
- [ ] `Codex` review completed and findings handled (or explicitly waived).
- [ ] Independent reviewer evidence added when `reviewPolicy.enforceReviewerIndependence=true` (otherwise mark N/A).
- [ ] Greptile confidence score is `>= 4/5` for merge eligibility.
- [ ] PR template sections are complete and accurate.
- [ ] I will delete branch/worktree after merge.

## Testing

- Command: `pnpm lint` → `pass/fail`
- Command: `pnpm typecheck` → `pass/fail`
- Command: `pnpm test` → `pass/fail`
- Command: `pnpm audit` → `pass/fail`
- Command: `pnpm check` → `pass/fail`
- Any other command(s):

## Review artifacts

- Greptile: `<link / artifact path / comment ID>`
- Greptile confidence score: `<0-5>`
- Independent reviewer evidence: `<reviewer + link>`
- Codex: `<link / artifact path / comment ID>`
- Additional evidence (if any):

## Notes

Add one-paragraph merge rationale here.
