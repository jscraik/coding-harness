# Pull request checklist

## Summary

- What changed (brief):
- Why this change was needed:
- Risk and rollback plan:

## Checklist

- [ ] I did not push directly to `main`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (`codex/*` for agent-created branches).
- [ ] Required local gates run: `bash scripts/validate-codestyle.sh`, `pnpm check`, `bash scripts/run-harness-gate.sh tooling-audit --path . --json`.
- [ ] `scripts/validate-codestyle.sh` was treated as the enforcement point for hook env sanitization (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*` values are untrusted and sanitized before `pnpm run`).
- [ ] CodeRabbit review completed and findings handled (or explicitly waived).
- [ ] CodeRabbit review was performed by an independent reviewer (not the coding agent).
- [ ] Codex review completed and findings handled (or explicitly waived).
- [ ] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [ ] North-star learning loop considered for changed files; relevant learning gate, review-context, promotion, or feedback evidence is listed below, or marked `n.a.` with a reason.
- [ ] Merge is blocked until all required checks pass.
- [ ] I will delete branch/worktree after merge.

## Testing

- `verification_commands`: list exact commands run here
- `verification_outcomes`: record pass/fail/blocked for each command here
- `blocked_steps_reason`: none if all planned steps ran
- Command: `bash scripts/validate-codestyle.sh` -> pass/fail
- Command: `pnpm check` -> pass/fail
- Command: `bash scripts/run-harness-gate.sh tooling-audit --path . --json` -> pass/fail
- Command: `harness learnings gate --source .harness/learnings/coderabbit.local.json --files <comma-separated-changed-files> --json` -> pass/fail/n.a.
- Command: `harness review-context --source .harness/learnings/coderabbit.local.json --files <comma-separated-changed-files> --json` -> pass/fail/n.a.
- Command: `harness north-star-feedback --source .harness/learnings/coderabbit.local.json --json` -> pass/fail/n.a.
- Any other command(s):

## Review artifacts

- CodeRabbit: <link / artifact path / comment ID>
- Independent reviewer evidence: <reviewer + link>
- Codex: <link / artifact path / comment ID>
- CodeRabbit Semgrep: fixed / waived with rationale / n.a.
- Additional evidence (if any):

## Notes

Add one-paragraph merge rationale here.
