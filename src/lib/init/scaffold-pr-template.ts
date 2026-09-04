import {
	CONDITIONAL_EVIDENCE_FIELDS,
	REQUIRED_CHANGE_FIELDS,
	REQUIRED_RELEASE_BOUNDARY_FIELDS,
} from "../pr-template-validator-rules.js";

type PullRequestTemplateOptions = {
	agentBranchPrefix: string;
	checkCommand: string;
	codestyleCommand: string;
	memoryValidateCommand: string;
};

/** Render PR evidence fields with traceability guidance where needed. */
function renderChangeFieldLines(): string {
	const required = REQUIRED_CHANGE_FIELDS.map((field) => `- ${field.label}:`);
	const conditional = CONDITIONAL_EVIDENCE_FIELDS.map((field) => {
		const line = `- ${field.label}:`;
		if (field.label === "Durable evidence map") {
			return `${line}\n<!-- ${field.placeholder}

| Artifact | Durable reference | Schema / version | Producer command | Digest | Replay command | Authority |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  | \`source-of-truth\` / \`retained context\` | -->`;
		}
		return line;
	});
	return `${required.join("\n")}

<!-- Complete the following fields only when their admission conditions apply. -->
${conditional.join("\n")}`;
}

/** Render the reusable PR behavior-proof guidance section. */
function renderBehaviorProofSection(): string {
	return `## Behavior proof

Complete this section when the PR changes runtime behavior, CLI behavior,
generated artifacts, validation behavior, agent workflow behavior, user-facing
docs, or any observable operator experience. Use \`n.a.\` with a concrete reason
for docs-only, metadata-only, or evidence-only changes where no behavior path
exists.

- Before:
- After:
- Environment or operator path:
- Verification steps:
- Evidence after fix:
- Untested paths and limitations:

Behavior proof guidance: Behavior proof is separate from unit tests, lint,
typecheck, and CI. Use it to show the actual production path or nearest
meaningful operator path after the patch. If the exact path could not run,
state the blocker and the nearest fallback. Do not paste secrets, raw
transcripts, bulky telemetry, or local absolute paths.`;
}

/** Render the reusable PR release-boundary guidance section. */
function renderReleaseBoundarySection(): string {
	const releaseModeField = REQUIRED_RELEASE_BOUNDARY_FIELDS.find(
		(field) => field.label === "Release mode",
	);
	return `## Release boundary

Choose the release standard before listing proof. Use \`n.a.\` with a concrete
reason only when the change has no release-stage meaning.

- Release mode: ${releaseModeField?.placeholder}
- Completion condition:
- Deferred work:
- Stronger-proof condition:

<!--
Prototype: prove the idea has value. Core path works; known gaps are listed; no unsafe behavior.
Portfolio: credible, coherent, navigable, and explainable. Demo, screenshots, and trade-offs matter more than infrastructure hardening.
Product: reusable and maintained. Tests, docs, release path, versioning, and supportable architecture are expected.
Harness: trust boundary or repeatable proof. Deterministic checks, receipts, failure behavior, and evidence boundaries are expected.

Name the condition that would require a more serious mode or additional proof.
-->`;
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
	return `# Pull request

Write for human maintainers first. Use \`n.a.\` with a concrete reason when a
field does not apply. Do not paste secrets, raw transcripts, bulky telemetry,
or local absolute paths.

## Summary

- Problem:
- Change:
- Why this approach:
- Intended outcome:
- Out of scope:
- Reviewer focus:
- Risk and rollback:

${renderReleaseBoundarySection()}

${renderBehaviorProofSection()}

## Change details

${renderChangeFieldLines()}

## Checklist

- [ ] I did not push directly to \`main\`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (\`${options.agentBranchPrefix}/*\` for agent-created branches).
- [ ] I ran the required validation for the changed surfaces and recorded every outcome below.
${codeRabbitChecklist}- [ ] **(Pending)** Codex review completed and findings handled (or explicitly waived).
- [ ] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [ ] Merge is blocked until all required checks pass.
- [ ] I will delete branch/worktree after merge.

## Validation

- Regression coverage:
<!-- Add one or more evidence lines such as:
- Command: \`${options.codestyleCommand}\` -> pass
- Command: \`${options.checkCommand}\` -> blocked (reason)
- Command: \`${options.memoryValidateCommand}\` -> blocked (reason)
-->
- Untested or blocked paths:

## Review and closeout

${codeRabbitArtifacts}- Codex:
- CodeRabbit Semgrep:
- User-facing impact: yes, with changelog / no / n.a. because reason
- Remaining findings or waivers:
- Current blockers:
`;
}
