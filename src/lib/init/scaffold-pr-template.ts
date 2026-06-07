import { REQUIRED_WORK_FIELDS } from "../pr-template-validator-rules.js";

type PullRequestTemplateOptions = {
	agentBranchPrefix: string;
	checkCommand: string;
	codestyleCommand: string;
	memoryValidateCommand: string;
};

function renderRequiredWorkFieldLines(): string {
	return REQUIRED_WORK_FIELDS.map((field) => `- ${field.label}:`).join("\n");
}

function renderBehaviorProofSection(): string {
	return `## Behavior Proof

Complete this section when the PR changes runtime behavior, CLI behavior,
generated artifacts, validation behavior, agent workflow behavior, user-facing
docs, or any observable operator experience. Use \`n.a.\` with a concrete reason
for docs-only, metadata-only, or evidence-only changes where no behavior path
exists.

- Behavior or issue addressed:
- Real environment tested:
- Exact steps or command run after this patch:
- Evidence after fix:
- Observed result after fix:
- What was not tested:
- Proof limitations or environment constraints:
- Before evidence, if available:

Behavior proof guidance: Behavior proof is separate from unit tests, lint,
typecheck, and CI. Use it to show the actual production path or nearest
meaningful operator path after the patch. If the exact path could not run,
state the blocker and the nearest fallback. Do not paste secrets, raw
transcripts, bulky telemetry, or local absolute paths.`;
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
	const codeRabbitArtifacts = `- CodeRabbit:
- Independent reviewer evidence:
`;
	return `# Pull request checklist

Write for human maintainers first. Use \`n.a.\` with a concrete reason when a
field does not apply. Do not paste secrets, raw transcripts, bulky telemetry,
or local absolute paths.

## Motivation

- Motivation:
- Reasoning:
- Chosen approach:

## Summary

- Problem:
- Why now:
- Intended outcome:
- Out of scope:
- Reviewer focus:
- Risk and rollback:

${renderBehaviorProofSection()}

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

- verification_commands:
- verification_outcomes:
- blocked_steps_reason:
<!-- Add one or more evidence lines such as:
- Command: \`${options.codestyleCommand}\` -> pass
- Command: \`${options.checkCommand}\` -> blocked (reason)
- Command: \`${options.memoryValidateCommand}\` -> n.a. (reason)
-->
- Any other command(s):

## Review artifacts

${codeRabbitArtifacts}- Codex:
- CodeRabbit Semgrep:
- Additional evidence (if any):

## Notes

<!-- Add one-paragraph merge rationale before requesting review. -->
`;
}
