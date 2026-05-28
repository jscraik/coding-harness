import { REQUIRED_WORK_FIELDS } from "../pr-template-validator-rules.js";

type PullRequestTemplateOptions = {
	agentBranchPrefix: string;
	checkCommand: string;
	codestyleCommand: string;
	memoryValidateCommand: string;
};

function renderRequiredWorkFieldLines(): string {
	return REQUIRED_WORK_FIELDS.map(
		(field) => `- ${field.label}: ${field.placeholder}`,
	).join("\n");
}

/**
 * Render the GitHub pull request template used for downstream repositories.
 *
 * @param options - Template options including branch-name policy and verification commands.
 * @returns The Markdown content for `.github/PULL_REQUEST_TEMPLATE.md`.
 */
export function renderPullRequestTemplate(
	options: PullRequestTemplateOptions,
): string {
	const codeRabbitChecklist = `- [ ] **(Pending)** CodeRabbit review completed and findings handled (or explicitly waived).
- [ ] **(Pending)** CodeRabbit review was performed by an independent reviewer (not the coding agent).
`;
	const codeRabbitArtifacts = `- CodeRabbit: <link / artifact path / comment ID>
- Independent reviewer evidence: <reviewer + link>
`;
	return `# Pull request checklist

## Summary

- What changed (brief):
- Why this change was needed:
- Risk and rollback plan:

## Work performed

${renderRequiredWorkFieldLines()}

## Checklist

- [ ] I did not push directly to \`main\`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (\`${options.agentBranchPrefix}/*\` for agent-created branches).
- [ ] Required local gates run: \`${options.codestyleCommand}\`, \`${options.checkCommand}\`, \`${options.memoryValidateCommand}\`.
${codeRabbitChecklist}- [ ] **(Pending)** Codex review completed and findings handled (or explicitly waived).
- [ ] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [ ] Merge is blocked until all required checks pass.
- [ ] I will delete branch/worktree after merge.

## Testing

- verification_commands: list exact commands run here
- verification_outcomes: record pass/fail/blocked for each command here
- blocked_steps_reason: none if all planned steps ran
- Command: \`${options.codestyleCommand}\` -> pass/fail
- Command: \`${options.checkCommand}\` -> pass/fail
- Command: \`${options.memoryValidateCommand}\` -> pass/fail
- Any other command(s):

## Review artifacts

${codeRabbitArtifacts}- Codex: <link / artifact path / comment ID>
- CodeRabbit Semgrep: fixed / waived with rationale / n.a.
- Additional evidence (if any):

## Notes

Add one-paragraph merge rationale here.
`;
}
