# Pull request checklist

## Summary

- What changed (brief):
- Why this change was needed:
- Risk and rollback plan:

## Checklist

- [ ] I did not push directly to `main`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (`codex/*` for agent-created branches).
- [ ] Required local gates run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm check` (or reason for deviation).
- [ ] `Greptile` review completed and findings handled (or explicitly waived).
- [ ] `Codex` review completed and findings handled (or explicitly waived).
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
- Codex: `<link / artifact path / comment ID>`
- Additional evidence (if any):

## Notes

Add one-paragraph merge rationale here.
