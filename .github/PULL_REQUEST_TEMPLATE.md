# Pull request checklist

## Summary

- What changed (brief):
- Why this change was needed:
- Risk and rollback plan:

## Checklist

- [ ] I did not push directly to `main`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (`codex/*` for agent-created branches).
- [ ] Required local gates run: `bash scripts/validate-codestyle.sh`, `pnpm check`, `test -f memory.json && jq -e '.meta.version == "1.0" and (.preamble.bootstrap | type == "boolean") and (.preamble.search | type == "boolean") and (.entries | type == "array")' memory.json >/dev/null`.
- [ ] `scripts/validate-codestyle.sh` was treated as the enforcement point for hook env sanitization (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*` values are untrusted and sanitized before `pnpm run`).
- [ ] CodeRabbit review completed and findings handled (or explicitly waived).
- [ ] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [ ] Codex review completed and findings handled (or explicitly waived).
- [ ] CodeRabbit review was performed by an independent reviewer (not the coding agent).
- [ ] Merge is blocked until all required checks pass.
- [ ] If `harness linear*` commands were run, `LINEAR_API_KEY` was set in runtime (or `--token` was used), `~/.codex/.env` was loaded when applicable, and `harness symphony-check` evidence is recorded when secret discovery behavior changed.
- [ ] If this change affects release flow, tag-driven publish behavior is documented (`.github/workflows/release-private-npm.yml`, semver tag trigger, auth mode).
- [ ] I will delete branch/worktree after merge.

## Testing

- verification_commands: list exact commands run here
- verification_outcomes: record pass/fail/blocked for each command here
- blocked_steps_reason: none if all planned steps ran
- Command: `bash scripts/validate-codestyle.sh` -> pass/fail
- Command: `pnpm check` -> pass/fail
- Command: `test -f memory.json && jq -e '.meta.version == "1.0" and (.preamble.bootstrap | type == "boolean") and (.preamble.search | type == "boolean") and (.entries | type == "array")' memory.json >/dev/null` -> pass/fail
- Command: `harness symphony-check` (required when `harness linear*` secret discovery behavior changed) -> pass/fail/n.a.
- Any other command(s):

## Review artifacts

- CodeRabbit: <link / artifact path / comment ID>
- CodeRabbit Semgrep: fixed / waived with rationale / n.a.
- Independent reviewer evidence: <reviewer + link>
- Codex: <link / artifact path / comment ID>
- Additional evidence (if any):

## Notes

Add one-paragraph merge rationale here.
