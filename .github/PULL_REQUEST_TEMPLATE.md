# Pull request checklist

## Summary

- What changed (brief):
- Why this change was needed:
- Risk and rollback plan:

## Work performed

- Plan IDs: list Linear keys, spec paths, plan paths, or `n.a.` with reason
- Phase / slice: list completed phase, implementation slice, or `n.a.` with reason
- Session IDs: list Codex thread/session IDs, session-collector artifact IDs or paths, harness run IDs, or `n.a.` with reason. For AI-assisted work, include at least one session reference or explain why no session artifact was captured.
- Trace IDs: list CI workflow/job URLs, harness/eval/runtime trace IDs, runtime-card/evidence bundle artifact paths, review trace IDs, or `n.a.` with reason. For traced or evaluated work, include the trace or artifact reference used to verify the claim.
- AI session / traceability: map the AI session or trace reference to the work it supports; do not paste raw transcripts, prompts, secrets, or bulky telemetry into the PR body.
- Completed work: list implementation units, docs/config changes, or evidence-only work completed in this PR
- Expected outcome alignment: state how this change preserves Coding Harness as a portable agent operating system for greenfield and brownfield repos, or mark `n.a.` with reason
- Pattern scope inventory: for any steering feedback, review comment, or line-level correction that implies a broader design principle, name the principle, list sibling implementations searched, and state which siblings were changed, intentionally left unchanged, or deferred with tracker/evidence
- Acceptance trace: map completed acceptance items to evidence refs, or `n.a.` with reason
- Validation evidence: list command outcomes, CI jobs, artifact paths, or `n.a.` with reason
- Review artifacts: list CodeRabbit, Codex, reviewer, or harness review artifacts, or `n.a.` with reason
- Learning / reinforcement: list promoted learnings, memory updates, or `none` with reason
- Deferred work: list follow-up work intentionally left out, or `none`

## Checklist

- [ ] I did not push directly to `main`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (`codex/*` for agent-created branches).
- [ ] Required local gates run: `bash scripts/validate-codestyle.sh`, `pnpm check`, `bash scripts/run-harness-gate.sh tooling-audit --path . --json`.
- [ ] `scripts/validate-codestyle.sh` was treated as the enforcement point for hook env sanitization (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*` values are untrusted and sanitized before `pnpm run`).
- [ ] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [ ] North-star learning loop considered for changed files; relevant learning gate, review-context, promotion, or feedback evidence is listed below, or marked `n.a.` with a reason.
- [ ] Merge is blocked until all required checks pass.
- [ ] I will delete branch/worktree after merge.

## Testing

- verification_commands: list exact commands run here
- verification_outcomes: record pass/fail/blocked for each command here
- blocked_steps_reason: none if all planned steps ran
- Command: `bash scripts/validate-codestyle.sh` -> pass/fail
- Command: `pnpm check` -> pass/fail
- Command: `bash scripts/run-harness-gate.sh tooling-audit --path . --json` -> pass/fail
- Command: `CHANGED_FILES="<comma-separated-changed-files>"` (set before running file-scoped gates)
- Command: `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> pass/fail/n.a.
- Command: `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> pass/fail/n.a.
- Command: `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json` -> pass/fail/n.a.
- Command: `harness pr-closeout --pr <number> --json` -> pass/fail/n.a.
- Any other command(s):

## Review artifacts

- Review status:
  - CodeRabbit review: pending completion and finding resolution or waiver.
  - Independent reviewer: pending confirmation that review was performed outside the coding agent.
  - Codex review: pending completion and finding resolution or waiver.
- CodeRabbit: <link / artifact path / comment ID>
- Independent reviewer evidence: <reviewer + link>
- Codex: <link / artifact path / comment ID>
- CodeRabbit Semgrep: fixed / waived with rationale / n.a.
- Additional evidence (if any):

## Notes

Add one-paragraph merge rationale here.
